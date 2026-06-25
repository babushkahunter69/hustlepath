import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import DesignPinPreviewImage from '../design-library/DesignPinPreviewImage';
import AdminNav from '../AdminNav';
import {
  deleteCampaigns,
  ensureSocialCampaignsTable,
  generateCampaignDraftsForAllReadyDesigns,
  generateCampaignDraftsForDesignId,
  regenerateCampaignById,
  updateCampaignStatus,
} from '@/lib/socialCampaigns';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SearchParams = Promise<{
  notice?: string;
  q?: string;
  channel?: string;
  status?: string;
  design_id?: string;
}>;

function flashRedirect(message: string) {
  redirect(`/admin/social-campaigns?notice=${encodeURIComponent(message)}`);
}

function cleanText(value: unknown, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

function compactText(value: unknown, maxLength = 180) {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  const words = text.split(' ');
  const output: string[] = [];

  for (const word of words) {
    const next = [...output, word].join(' ');
    if (next.length > maxLength) break;
    output.push(word);
  }

  return `${output.join(' ').replace(/[,.!?;:]$/, '')}...`;
}

function readStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => cleanText(item)).filter(Boolean);
  if (!value) return [];

  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map((item) => cleanText(item)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function formatChannel(value: unknown) {
  const channel = cleanText(value).toLowerCase();
  if (channel === 'pinterest') return 'Pinterest';
  if (channel === 'instagram') return 'Instagram';
  if (channel === 'facebook') return 'Facebook';
  return 'Social';
}

function formatStatus(value: unknown) {
  const status = cleanText(value).toLowerCase();
  if (status === 'ready') return 'Ready';
  if (status === 'scheduled') return 'Scheduled';
  if (status === 'published') return 'Published';
  if (status === 'failed') return 'Failed';
  return 'Draft';
}

function formatDateTime(value: unknown) {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function targetUrlFor(campaign: any) {
  return cleanText(campaign.target_url || campaign.redbubble_url || campaign.product_url);
}

function productTypeFor(campaign: any) {
  return cleanText(campaign.design_product_type, 'Product');
}

function nicheFor(campaign: any) {
  return cleanText(campaign.design_niche, 'InkWanderStudio');
}

async function generateOneDesignCampaignAction(formData: FormData) {
  'use server';

  const designId = cleanText(formData.get('design_id'));
  if (!designId) flashRedirect('Pick a design first.');

  const result = await generateCampaignDraftsForDesignId(designId);
  const suffix = result.reasons.length ? ` First notes: ${result.reasons.slice(0, 3).join(' | ')}` : '';
  flashRedirect(`Generated ${result.imported} campaign drafts, skipped ${result.skipped}, rejected ${result.rejected}.${suffix}`);
}

async function generateAllCampaignsAction() {
  'use server';

  const result = await generateCampaignDraftsForAllReadyDesigns();
  const suffix = result.reasons.length ? ` First notes: ${result.reasons.slice(0, 4).join(' | ')}` : '';
  flashRedirect(`Generated ${result.imported} campaign drafts, skipped ${result.skipped}, rejected ${result.rejected}.${suffix}`);
}

async function regenerateSingleCampaignAction(formData: FormData) {
  'use server';

  const campaignId = cleanText(formData.get('campaign_id'));
  if (!campaignId) flashRedirect('Campaign not found.');

  const result = await regenerateCampaignById(campaignId);
  if (!result.updated) flashRedirect(result.reason || 'Could not regenerate this campaign.');
  flashRedirect(`Regenerated ${result.title}.`);
}

async function updateSingleCampaignAction(formData: FormData) {
  'use server';

  const campaignId = cleanText(formData.get('campaign_id'));
  const intent = cleanText(formData.get('intent'));
  const scheduledAt = cleanText(formData.get('scheduled_at')) || null;
  if (!campaignId) flashRedirect('Campaign not found.');

  if (intent === 'delete') {
    await deleteCampaigns([campaignId]);
    flashRedirect('Deleted 1 campaign.');
  }

  if (intent === 'schedule' && !scheduledAt) {
    flashRedirect('Add a date and time before scheduling this campaign.');
  }

  const statusMap: Record<string, 'draft' | 'ready' | 'scheduled' | 'published' | 'failed'> = {
    draft: 'draft',
    ready: 'ready',
    schedule: 'scheduled',
    published: 'published',
    failed: 'failed',
  };

  const nextStatus = statusMap[intent];
  if (!nextStatus) flashRedirect('Unknown campaign action.');

  await updateCampaignStatus([campaignId], nextStatus, scheduledAt);
  flashRedirect(`Updated 1 campaign to ${formatStatus(nextStatus).toLowerCase()}.`);
}

async function bulkCampaignAction(formData: FormData) {
  'use server';

  const ids = formData.getAll('campaign_id').map((value) => cleanText(value)).filter(Boolean);
  const intent = cleanText(formData.get('intent'));
  const scheduledAt = cleanText(formData.get('scheduled_at')) || null;

  if (!ids.length) flashRedirect('Select at least one campaign first.');

  if (intent === 'delete') {
    const deleted = await deleteCampaigns(ids);
    flashRedirect(`Deleted ${deleted} campaigns.`);
  }

  if (intent === 'schedule' && !scheduledAt) {
    flashRedirect('Add a date and time before scheduling selected campaigns.');
  }

  const statusMap: Record<string, 'draft' | 'ready' | 'scheduled' | 'published' | 'failed'> = {
    draft: 'draft',
    ready: 'ready',
    schedule: 'scheduled',
    published: 'published',
    failed: 'failed',
  };

  const nextStatus = statusMap[intent];
  if (!nextStatus) flashRedirect('Unknown bulk action.');

  const updated = await updateCampaignStatus(ids, nextStatus, scheduledAt);
  flashRedirect(`Updated ${updated} campaigns to ${formatStatus(nextStatus).toLowerCase()}.`);
}

export default async function SocialCampaignsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const params = searchParams ? await searchParams : {};
  let campaigns: any[] = [];
  let designs: any[] = [];
  let error = '';

  try {
    await ensureSocialCampaignsTable();

    designs = await sql`
      select id, title, image_url, redbubble_url, product_url, niche, product_type, mood, status, source, updated_at, created_at
      from design_library
      where coalesce(status, 'active') = 'active'
      order by updated_at desc nulls last, created_at desc
    `;

    campaigns = await sql`
      select
        social_campaigns.*,
        design_library.title as design_title,
        design_library.image_url as design_image_url,
        design_library.redbubble_url,
        design_library.product_url,
        design_library.niche as design_niche,
        design_library.product_type as design_product_type,
        design_library.source as design_source
      from social_campaigns
      join design_library on design_library.id = social_campaigns.design_id
      where coalesce(design_library.status, 'active') = 'active'
      order by social_campaigns.updated_at desc nulls last, social_campaigns.created_at desc
    `;
  } catch (err: any) {
    error = err.message || 'Unable to load social campaign queue.';
  }

  const query = cleanText(params.q).toLowerCase();
  const selectedChannel = cleanText(params.channel).toLowerCase();
  const selectedStatus = cleanText(params.status).toLowerCase();
  const selectedDesignId = cleanText(params.design_id);

  const readyDesigns = designs.filter((design) => cleanText(design.image_url) && cleanText(design.redbubble_url || design.product_url));

  const filteredCampaigns = campaigns.filter((campaign) => {
    const channel = cleanText(campaign.channel).toLowerCase();
    const status = cleanText(campaign.status || 'draft').toLowerCase();
    const haystack = [
      campaign.title,
      campaign.caption,
      campaign.design_title,
      campaign.board_name,
      ...readStringArray(campaign.hashtags),
      ...readStringArray(campaign.keywords),
    ].join(' ').toLowerCase();

    if (selectedChannel && channel !== selectedChannel) return false;
    if (selectedStatus && status !== selectedStatus) return false;
    if (selectedDesignId && cleanText(campaign.design_id) !== selectedDesignId) return false;
    if (query && !haystack.includes(query)) return false;
    return true;
  });

  const summary = campaigns.reduce((acc, campaign) => {
    acc.total += 1;
    const status = cleanText(campaign.status || 'draft').toLowerCase();
    if (status === 'ready') acc.ready += 1;
    else if (status === 'scheduled') acc.scheduled += 1;
    else if (status === 'published') acc.published += 1;
    else if (status === 'failed') acc.failed += 1;
    else acc.draft += 1;
    return acc;
  }, { total: 0, draft: 0, ready: 0, scheduled: 0, published: 0, failed: 0 });

  return (
    <main className="admin-shell">
      <section className="admin-panel wide">
        <div className="admin-row">
          <div>
            <div className="admin-topline">Social campaign workflow</div>
            <h1>Social campaign queue</h1>
            <p className="admin-muted">
              Generate Pinterest, Instagram, and Facebook drafts from your Design Library, then move them through one simple queue.
            </p>
          </div>
          <Link href="/admin/design-library" className="secondary-link">Back to Design Library</Link>
        </div>

        <AdminNav current="social-campaigns" />

        {error && <div className="notice">{error}</div>}
        {params.notice && <div className="notice">{params.notice}</div>}

        <div className="stat-grid campaign-summary-grid">
          <div className="stat-card"><span>{summary.total}</span><p>Total campaigns</p></div>
          <div className="stat-card"><span>{summary.draft}</span><p>Draft</p></div>
          <div className="stat-card"><span>{summary.ready}</span><p>Ready</p></div>
          <div className="stat-card"><span>{summary.scheduled}</span><p>Scheduled</p></div>
          <div className="stat-card"><span>{summary.published}</span><p>Published</p></div>
          <div className="stat-card"><span>{summary.failed}</span><p>Failed</p></div>
        </div>

        <section className="product-form admin-section">
          <h2>Generate campaigns</h2>
          <p className="admin-muted">Import your Redbubble products using CSV, then generate marketing assets from your ready designs.</p>
          <div className="campaign-action-grid">
            <form action={generateAllCampaignsAction} className="campaign-inline-form">
              <button type="submit" className="primary-link">Generate campaigns for all Ready designs</button>
            </form>

            <form action={generateOneDesignCampaignAction} className="campaign-inline-form">
              <label className="field compact-field">
                <span>Generate campaigns for one design</span>
                <select name="design_id" defaultValue="">
                  <option value="">Pick a ready design</option>
                  {readyDesigns.map((design) => (
                    <option key={design.id} value={design.id}>{design.title}</option>
                  ))}
                </select>
              </label>
              <button type="submit" className="secondary-link">Generate selected design</button>
            </form>
          </div>
        </section>

        <form method="get" className="product-form admin-section">
          <h2>Search and filter</h2>
          <div className="design-filter-grid">
            <label className="field">
              <span>Search</span>
              <input name="q" defaultValue={params.q || ''} placeholder="title, caption, hashtag, board" />
            </label>
            <label className="field">
              <span>Channel</span>
              <select name="channel" defaultValue={params.channel || ''}>
                <option value="">All channels</option>
                <option value="pinterest">Pinterest</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
              </select>
            </label>
            <label className="field">
              <span>Status</span>
              <select name="status" defaultValue={params.status || ''}>
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="ready">Ready</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
                <option value="failed">Failed</option>
              </select>
            </label>
            <label className="field">
              <span>Design</span>
              <select name="design_id" defaultValue={params.design_id || ''}>
                <option value="">All designs</option>
                {designs.map((design) => (
                  <option key={design.id} value={design.id}>{design.title}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="editor-actions">
            <button type="submit" className="primary-link">Apply filters</button>
            <Link href="/admin/social-campaigns" className="secondary-link">Clear filters</Link>
          </div>
        </form>

        {filteredCampaigns.length === 0 ? (
          <div className="empty-state">No campaigns match the current filters yet. Generate campaigns from your ready designs to populate the queue.</div>
        ) : (
          <>
            <div className="pin-workflow-list">
              {filteredCampaigns.map((campaign) => {
                const hashtags = readStringArray(campaign.hashtags);
                const keywords = readStringArray(campaign.keywords);
                const carouselIdeas = readStringArray(campaign.carousel_ideas);
                const targetUrl = targetUrlFor(campaign);

                return (
                  <article key={campaign.id} className="pin-workflow-post campaign-card">
                    <div className="pin-workflow-post-head">
                      <div>
                        <div className="campaign-meta-row">
                          <span className={`campaign-badge channel-${cleanText(campaign.channel).toLowerCase()}`}>{formatChannel(campaign.channel)}</span>
                          <span className={`campaign-status status-${cleanText(campaign.status || 'draft').toLowerCase()}`}>{formatStatus(campaign.status)}</span>
                          <span className="campaign-meta-text">{campaign.design_title}</span>
                        </div>
                        <h2>{campaign.title}</h2>
                        <p className="admin-muted">{nicheFor(campaign)} · {productTypeFor(campaign)}{campaign.board_name ? ` · Board: ${campaign.board_name}` : ''}</p>
                      </div>
                      <div className="pin-workflow-actions">
                        {targetUrl && <Link href={targetUrl} target="_blank" className="secondary-link small">Open link</Link>}
                        <Link href="/admin/design-library" className="secondary-link small">View design</Link>
                      </div>
                    </div>

                    <div className="campaign-preview-layout">
                      <div className="campaign-preview-media">
                        {cleanText(campaign.channel).toLowerCase() === 'pinterest' && cleanText(campaign.generated_image_url) ? (
                          <DesignPinPreviewImage
                            src={cleanText(campaign.generated_image_url)}
                            title={campaign.title}
                            niche={campaign.design_niche}
                            description={campaign.caption}
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={cleanText(campaign.image_url || campaign.design_image_url)}
                            alt={campaign.title}
                            className="design-library-image"
                          />
                        )}
                      </div>

                      <div className="campaign-preview-copy">
                        <p>{compactText(campaign.caption, 240) || 'No caption saved yet.'}</p>

                        {hashtags.length > 0 && (
                          <div>
                            <strong>Hashtags</strong>
                            <div className="design-tag-row">{hashtags.map((tag) => <span key={`${campaign.id}-${tag}`} className="design-tag-pill">{tag}</span>)}</div>
                          </div>
                        )}

                        {keywords.length > 0 && (
                          <p className="admin-muted"><strong>Keywords:</strong> {keywords.join(', ')}</p>
                        )}

                        {carouselIdeas.length > 0 && (
                          <details className="design-article-box">
                            <summary>Carousel ideas</summary>
                            <ul className="design-idea-list">
                              {carouselIdeas.map((idea) => <li key={`${campaign.id}-${idea}`}>{idea}</li>)}
                            </ul>
                          </details>
                        )}

                        <p className="admin-muted">
                          {campaign.scheduled_at ? `Scheduled for ${formatDateTime(campaign.scheduled_at)}.` : 'Not scheduled yet.'}
                          {campaign.published_at ? ` Published ${formatDateTime(campaign.published_at)}.` : ''}
                        </p>
                      </div>
                    </div>

                    <form action={updateSingleCampaignAction} className="campaign-controls">
                      <input type="hidden" name="campaign_id" value={campaign.id} />
                      <label className="field compact-field">
                        <span>Schedule date & time</span>
                        <input name="scheduled_at" type="datetime-local" defaultValue="" />
                      </label>
                      <div className="pin-workflow-actions">
                        <button type="submit" formAction={regenerateSingleCampaignAction} className="secondary-link small">Regenerate</button>
                        <button type="submit" name="intent" value="ready" className="secondary-link small">Mark Ready</button>
                        <button type="submit" name="intent" value="schedule" className="secondary-link small">Schedule</button>
                        <button type="submit" name="intent" value="published" className="secondary-link small">Mark Published</button>
                        <button type="submit" name="intent" value="failed" className="secondary-link small">Mark Failed</button>
                        <button type="submit" name="intent" value="delete" className="secondary-link small">Delete</button>
                      </div>
                    </form>
                  </article>
                );
              })}
            </div>

            <form action={bulkCampaignAction} className="product-form admin-section">
              <h2>Bulk select</h2>
              <p className="admin-muted">Pick campaigns to move through the queue together.</p>
              <div className="campaign-checkbox-list">
                {filteredCampaigns.map((campaign) => (
                  <label key={`bulk-${campaign.id}`} className="campaign-checkbox-item">
                    <input type="checkbox" name="campaign_id" value={campaign.id} />
                    <span>
                      <strong>{campaign.title}</strong>
                      <small>{formatChannel(campaign.channel)} · {formatStatus(campaign.status)} · {campaign.design_title}</small>
                    </span>
                  </label>
                ))}
              </div>
              <div className="campaign-bulk-actions">
                <label className="field compact-field">
                  <span>Schedule selected at</span>
                  <input name="scheduled_at" type="datetime-local" defaultValue="" />
                </label>
                <div className="pin-workflow-actions">
                  <button type="submit" name="intent" value="ready" className="secondary-link">Mark Ready</button>
                  <button type="submit" name="intent" value="schedule" className="secondary-link">Schedule</button>
                  <button type="submit" name="intent" value="published" className="secondary-link">Mark Published</button>
                  <button type="submit" name="intent" value="failed" className="secondary-link">Mark Failed</button>
                  <button type="submit" name="intent" value="delete" className="primary-link">Delete</button>
                </div>
              </div>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
