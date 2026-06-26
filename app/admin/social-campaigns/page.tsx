import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import DesignPinPreviewImage from '../design-library/DesignPinPreviewImage';
import AdminNav from '../AdminNav';
import CampaignBulkToggle from './CampaignBulkToggle';
import {
  deleteCampaigns,
  deleteTestCampaigns,
  ensureSocialCampaignsTable,
  generateArticleFunnelDrafts,
  generateCampaignDraftsForAllReadyDesigns,
  generateCampaignDraftsForDesignId,
  regenerateCampaignById,
  updateCampaignStatus,
} from '@/lib/socialCampaigns';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TEST_BATCH_TAG = 'test-campaign';

type SearchParams = Promise<{
  notice?: string;
  q?: string;
  channel?: string;
  status?: string;
  design_id?: string;
  campaign_type?: string;
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

function readRelatedProducts(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => ({
        id: cleanText((item as any)?.id),
        title: cleanText((item as any)?.title),
        image_url: cleanText((item as any)?.image_url),
        redbubble_url: cleanText((item as any)?.redbubble_url),
        niche: cleanText((item as any)?.niche),
        product_type: cleanText((item as any)?.product_type),
        mood: cleanText((item as any)?.mood),
        tags: readStringArray((item as any)?.tags),
      }))
      .filter((item) => item.id || item.title);
  }

  if (!value) return [];

  try {
    return readRelatedProducts(JSON.parse(String(value)));
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

function formatCampaignType(value: unknown) {
  const type = cleanText(value).toLowerCase();
  if (type === 'article_funnel') return 'Article Funnel';
  return 'Direct Product';
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

function generationMessage(result: any, label: string) {
  const reasons = result.reasons?.length
    ? ` Failed ${result.failed} with reasons: ${result.reasons.slice(0, 4).join(' | ')}`
    : ` Failed ${result.failed}.`;
  const funnelLine = result.createdFunnels ? ` Created ${result.createdFunnels} article funnel idea sets.` : '';
  return `${label} Created ${result.createdPinterest} Pinterest drafts, ${result.createdInstagram} Instagram drafts, and ${result.createdFacebook} Facebook drafts.${funnelLine} Skipped ${result.skipped} duplicates.${reasons}`;
}

async function generateOneDesignCampaignAction(formData: FormData) {
  'use server';

  const designId = cleanText(formData.get('design_id'));
  if (!designId) flashRedirect('Pick a ready design first.');

  const result = await generateCampaignDraftsForDesignId(designId);
  flashRedirect(generationMessage(result, 'Generated selected direct product campaigns.'));
}

async function generateDirectProductCampaignsAction() {
  'use server';

  const result = await generateCampaignDraftsForAllReadyDesigns();
  flashRedirect(generationMessage(result, 'Generated direct product campaigns for all ready designs.'));
}

async function generateArticleFunnelIdeasAction() {
  'use server';

  const result = await generateArticleFunnelDrafts();
  flashRedirect(generationMessage(result, 'Generated article funnel campaign drafts.'));
}

async function generateTestCampaignsAction() {
  'use server';

  const result = await generateCampaignDraftsForAllReadyDesigns({ limit: 3, batchTag: TEST_BATCH_TAG });
  flashRedirect(generationMessage(result, 'Generated test campaigns for up to 3 ready designs.'));
}

async function deleteTestCampaignsAction() {
  'use server';

  const deleted = await deleteTestCampaigns(TEST_BATCH_TAG);
  flashRedirect(`Deleted ${deleted} test campaigns.`);
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
  if (!campaignId) flashRedirect('Campaign not found.');

  if (intent === 'delete') {
    await deleteCampaigns([campaignId]);
    flashRedirect('Deleted 1 campaign.');
  }

  const statusMap: Record<string, 'draft' | 'ready' | 'published'> = {
    draft: 'draft',
    ready: 'ready',
    published: 'published',
  };

  const nextStatus = statusMap[intent];
  if (!nextStatus) flashRedirect('Unknown campaign action.');

  await updateCampaignStatus([campaignId], nextStatus);
  flashRedirect(`Updated 1 campaign to ${formatStatus(nextStatus).toLowerCase()}.`);
}

async function bulkCampaignAction(formData: FormData) {
  'use server';

  const ids = formData.getAll('campaign_id').map((value) => cleanText(value)).filter(Boolean);
  const intent = cleanText(formData.get('intent'));

  if (!ids.length) flashRedirect('Select at least one visible campaign first.');

  if (intent === 'delete') {
    const deleted = await deleteCampaigns(ids);
    flashRedirect(`Deleted ${deleted} campaigns.`);
  }

  const statusMap: Record<string, 'ready'> = {
    ready: 'ready',
  };

  const nextStatus = statusMap[intent];
  if (!nextStatus) flashRedirect('Unknown bulk action.');

  const updated = await updateCampaignStatus(ids, nextStatus);
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
  const selectedCampaignType = cleanText(params.campaign_type).toLowerCase();

  const readyDesigns = designs.filter((design) => cleanText(design.image_url) && cleanText(design.redbubble_url || design.product_url));
  const missingImageCount = designs.filter((design) => !cleanText(design.image_url)).length;
  const missingLinkCount = designs.filter((design) => !cleanText(design.redbubble_url || design.product_url)).length;
  const testCampaignCount = campaigns.filter((campaign) => cleanText(campaign.batch_tag) === TEST_BATCH_TAG).length;

  const filteredCampaigns = campaigns.filter((campaign) => {
    const channel = cleanText(campaign.channel).toLowerCase();
    const status = cleanText(campaign.status || 'draft').toLowerCase();
    const campaignType = cleanText(campaign.campaign_type || 'direct_product').toLowerCase();
    const relatedProducts = readRelatedProducts(campaign.related_products);
    const haystack = [
      campaign.title,
      campaign.caption,
      campaign.design_title,
      campaign.board_name,
      campaign.article_title,
      campaign.article_intro,
      campaign.article_angle,
      campaign.product_group,
      ...readStringArray(campaign.hashtags),
      ...readStringArray(campaign.keywords),
      ...readStringArray(campaign.target_keywords),
      ...readStringArray(campaign.pinterest_title_ideas),
      ...relatedProducts.map((product) => product.title),
      campaign.batch_tag,
      campaign.campaign_type,
    ].join(' ').toLowerCase();

    if (selectedChannel && channel !== selectedChannel) return false;
    if (selectedStatus && status !== selectedStatus) return false;
    if (selectedCampaignType && campaignType !== selectedCampaignType) return false;
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

    const campaignType = cleanText(campaign.campaign_type || 'direct_product').toLowerCase();
    if (campaignType === 'article_funnel') acc.articleFunnel += 1;
    else acc.directProduct += 1;
    return acc;
  }, { total: 0, draft: 0, ready: 0, scheduled: 0, published: 0, failed: 0, directProduct: 0, articleFunnel: 0 });

  return (
    <main className="admin-shell">
      <section className="admin-panel wide">
        <div className="admin-row">
          <div>
            <div className="admin-topline">Social campaign workflow</div>
            <h1>Social campaign queue</h1>
            <p className="admin-muted">
              Generate direct Redbubble product campaigns or article-funnel draft campaigns from your Design Library, then review everything in one queue.
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

        <div className="stat-grid campaign-summary-grid compact-grid">
          <div className="stat-card"><span>{summary.directProduct}</span><p>Direct product</p></div>
          <div className="stat-card"><span>{summary.articleFunnel}</span><p>Article funnel</p></div>
          <div className="stat-card"><span>{readyDesigns.length}</span><p>Ready designs</p></div>
          <div className="stat-card"><span>{testCampaignCount}</span><p>Test campaigns</p></div>
        </div>

        <section className="product-form admin-section">
          <h2>Generate campaigns</h2>
          <p className="admin-muted">Direct Product campaigns link straight to Redbubble. Article Funnel campaigns create grouped draft article ideas that can later promote multiple products from HustlePathDaily.</p>
          <div className="campaign-action-grid">
            <form action={generateDirectProductCampaignsAction} className="campaign-inline-form">
              <button type="submit" className="primary-link">Generate Direct Product Campaigns</button>
              <p className="admin-muted">Creates Pinterest, Instagram, and Facebook draft campaigns for all ready designs that do not already have matching direct-product entries.</p>
            </form>

            <form action={generateArticleFunnelIdeasAction} className="campaign-inline-form">
              <button type="submit" className="secondary-link">Generate Article Funnel Ideas</button>
              <p className="admin-muted">Groups related designs by niche, product type, and mood, then creates article-funnel drafts that can later point to HustlePathDaily collection posts.</p>
            </form>
          </div>
        </section>

        <section className="product-form admin-section">
          <h2>Safe test mode</h2>
          <p className="admin-muted">Generate campaigns for only 3 ready designs, tag them as test campaigns, review them, then delete them in one click.</p>
          <div className="campaign-action-grid">
            <form action={generateTestCampaignsAction} className="campaign-inline-form">
              <button type="submit" className="primary-link">Generate campaigns for 3 Ready designs</button>
              <p className="admin-muted">Current test campaigns in queue: {testCampaignCount}</p>
            </form>

            <form action={deleteTestCampaignsAction} className="campaign-inline-form">
              <button type="submit" className="secondary-link">Delete test campaigns</button>
              <p className="admin-muted">This only removes campaigns tagged as test campaigns.</p>
            </form>
          </div>
        </section>

        <section className="product-form admin-section">
          <h2>Generate campaigns for one design</h2>
          <p className="admin-muted">Use this when you want to test one ready design before making a wider batch.</p>
          <form action={generateOneDesignCampaignAction} className="campaign-inline-form">
            <label className="field compact-field">
              <span>Ready design</span>
              <select name="design_id" defaultValue="">
                <option value="">Pick a ready design</option>
                {readyDesigns.map((design) => (
                  <option key={design.id} value={design.id}>{`${design.title} · ${cleanText(design.product_type, 'Product')} · ${cleanText(design.niche, 'InkWanderStudio')}`}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="secondary-link">Generate selected design</button>
          </form>
          {readyDesigns.length === 0 && (
            <div className="inline-notice">
              No ready designs are available yet. {missingImageCount > 0 ? `${missingImageCount} design(s) are missing an image.` : ''} {missingLinkCount > 0 ? `${missingLinkCount} design(s) are missing a Redbubble link.` : ''}
            </div>
          )}
        </section>

        <form method="get" className="product-form admin-section">
          <h2>Search and filter</h2>
          <div className="design-filter-grid">
            <label className="field">
              <span>Search</span>
              <input name="q" defaultValue={params.q || ''} placeholder="title, caption, hashtag, board, article" />
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
                <option value="published">Published</option>
              </select>
            </label>
            <label className="field">
              <span>Campaign type</span>
              <select name="campaign_type" defaultValue={params.campaign_type || ''}>
                <option value="">All campaign types</option>
                <option value="direct_product">Direct Product</option>
                <option value="article_funnel">Article Funnel</option>
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
          <div className="empty-state">No campaigns match the current filters yet. Start with the 3-design test batch, generate one selected design, or create article-funnel ideas.</div>
        ) : (
          <>
            <div className="pin-workflow-list">
              {filteredCampaigns.map((campaign) => {
                const hashtags = readStringArray(campaign.hashtags);
                const keywords = readStringArray(campaign.keywords);
                const carouselIdeas = readStringArray(campaign.carousel_ideas);
                const targetKeywords = readStringArray(campaign.target_keywords);
                const pinterestTitleIdeas = readStringArray(campaign.pinterest_title_ideas);
                const relatedProducts = readRelatedProducts(campaign.related_products);
                const targetUrl = targetUrlFor(campaign);
                const channel = cleanText(campaign.channel).toLowerCase();
                const batchTag = cleanText(campaign.batch_tag);
                const campaignType = cleanText(campaign.campaign_type || 'direct_product').toLowerCase();
                const articleSlug = cleanText(campaign.article_slug);
                const articleIntro = cleanText(campaign.article_intro);
                const articleAngle = cleanText(campaign.article_angle);
                const productGroup = cleanText(campaign.product_group);
                const articleTitle = cleanText(campaign.article_title || campaign.title);

                return (
                  <article key={campaign.id} className="pin-workflow-post campaign-card">
                    <div className="pin-workflow-post-head">
                      <div>
                        <div className="campaign-meta-row">
                          <span className={`campaign-badge channel-${channel}`}>{formatChannel(campaign.channel)}</span>
                          <span className={`campaign-status status-${cleanText(campaign.status || 'draft').toLowerCase()}`}>{formatStatus(campaign.status)}</span>
                          <span className="campaign-flag">{formatCampaignType(campaignType)}</span>
                          {batchTag && <span className="campaign-flag">{batchTag}</span>}
                          <span className="campaign-meta-text">{campaign.design_title}</span>
                        </div>
                        <h2>{campaign.title}</h2>
                        <p className="admin-muted">{nicheFor(campaign)} · {productTypeFor(campaign)}</p>
                      </div>
                      <div className="pin-workflow-actions">
                        {targetUrl && <Link href={targetUrl} target="_blank" className="secondary-link small">Open link</Link>}
                        <Link href="/admin/design-library" className="secondary-link small">View design</Link>
                      </div>
                    </div>

                    <div className="campaign-preview-layout">
                      <div className="campaign-preview-media">
                        {channel === 'pinterest' ? (
                          <DesignPinPreviewImage
                            src={cleanText(campaign.generated_image_url)}
                            fallbackSrc={cleanText(campaign.image_url || campaign.design_image_url)}
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
                        {channel === 'pinterest' && (
                          <>
                            <p><strong>Pin title:</strong> {campaign.title}</p>
                            <p><strong>Description:</strong> {compactText(campaign.caption, 240)}</p>
                            <p><strong>Board recommendation:</strong> {cleanText(campaign.board_name, 'Not saved yet')}</p>
                            <p><strong>Target URL:</strong> {targetUrl || 'Missing target URL'}</p>
                          </>
                        )}

                        {channel === 'instagram' && (
                          <>
                            <p><strong>Caption:</strong> {compactText(campaign.caption, 240)}</p>
                            <p><strong>Target URL:</strong> {targetUrl || 'Missing target URL'}</p>
                          </>
                        )}

                        {channel === 'facebook' && (
                          <>
                            <p><strong>Post text:</strong> {compactText(campaign.caption, 240)}</p>
                            <p><strong>Target URL:</strong> {targetUrl || 'Missing target URL'}</p>
                          </>
                        )}

                        {hashtags.length > 0 && (
                          <div>
                            <strong>Hashtags</strong>
                            <div className="design-tag-row">{hashtags.map((tag) => <span key={`${campaign.id}-${tag}`} className="design-tag-pill">{tag}</span>)}</div>
                          </div>
                        )}

                        {keywords.length > 0 && channel === 'pinterest' && (
                          <p className="admin-muted"><strong>Keywords:</strong> {keywords.join(', ')}</p>
                        )}

                        {carouselIdeas.length > 0 && channel === 'instagram' && (
                          <details className="design-article-box">
                            <summary>Carousel ideas</summary>
                            <ul className="design-idea-list">
                              {carouselIdeas.map((idea) => <li key={`${campaign.id}-${idea}`}>{idea}</li>)}
                            </ul>
                          </details>
                        )}

                        {campaignType === 'article_funnel' && (
                          <section className="design-article-box campaign-funnel-preview">
                            <h3>Article funnel preview</h3>
                            <p><strong>Proposed article title:</strong> {articleTitle}</p>
                            <p><strong>Slug suggestion:</strong> {articleSlug || 'Draft slug not saved yet'}</p>
                            <p><strong>Article angle:</strong> {articleAngle || 'Collection article draft'}</p>
                            <p><strong>Product group:</strong> {productGroup || 'Grouped designs'}</p>
                            <p><strong>Intro:</strong> {compactText(articleIntro, 280)}</p>

                            {targetKeywords.length > 0 && (
                              <div>
                                <strong>Target keywords</strong>
                                <div className="design-tag-row">{targetKeywords.map((keyword) => <span key={`${campaign.id}-keyword-${keyword}`} className="design-tag-pill">{keyword}</span>)}</div>
                              </div>
                            )}

                            {pinterestTitleIdeas.length > 0 && (
                              <details className="design-article-box nested-box">
                                <summary>Pinterest angles</summary>
                                <ul className="design-idea-list">
                                  {pinterestTitleIdeas.map((idea) => <li key={`${campaign.id}-idea-${idea}`}>{idea}</li>)}
                                </ul>
                              </details>
                            )}

                            {relatedProducts.length > 0 && (
                              <details className="design-article-box nested-box">
                                <summary>Related Redbubble products included ({relatedProducts.length})</summary>
                                <ul className="design-idea-list">
                                  {relatedProducts.map((product) => (
                                    <li key={`${campaign.id}-product-${product.id || product.title}`}>
                                      <strong>{product.title}</strong>
                                      <span> · {product.product_type || 'Product'} · {product.niche || 'InkWanderStudio'}</span>
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </section>
                        )}
                      </div>
                    </div>

                    <form action={updateSingleCampaignAction} className="campaign-controls">
                      <input type="hidden" name="campaign_id" value={campaign.id} />
                      <div className="pin-workflow-actions">
                        <button type="submit" formAction={regenerateSingleCampaignAction} className="secondary-link small">Regenerate</button>
                        <button type="submit" name="intent" value="ready" className="secondary-link small">Mark Ready</button>
                        <button type="submit" name="intent" value="published" className="secondary-link small">Mark Published</button>
                        <button type="submit" name="intent" value="delete" className="secondary-link small">Delete</button>
                      </div>
                    </form>
                  </article>
                );
              })}
            </div>

            <form action={bulkCampaignAction} className="product-form admin-section">
              <h2>Bulk actions</h2>
              <p className="admin-muted">Select visible campaigns, then move them together.</p>
              <CampaignBulkToggle />
              <div className="campaign-checkbox-list">
                {filteredCampaigns.map((campaign) => (
                  <label key={`bulk-${campaign.id}`} className="campaign-checkbox-item">
                    <input data-campaign-checkbox="true" type="checkbox" name="campaign_id" value={campaign.id} />
                    <span>
                      <strong>{campaign.title}</strong>
                      <small>{formatChannel(campaign.channel)} · {formatStatus(campaign.status)} · {formatCampaignType(campaign.campaign_type)} · {campaign.design_title}</small>
                    </span>
                  </label>
                ))}
              </div>
              <div className="campaign-bulk-actions">
                <div className="pin-workflow-actions">
                  <button type="submit" name="intent" value="ready" className="secondary-link">Mark Ready</button>
                  <button type="submit" name="intent" value="delete" className="primary-link">Delete selected</button>
                </div>
              </div>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
