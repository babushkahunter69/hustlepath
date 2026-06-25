import { sql } from '@/lib/db';
import {
  attachDesignPinUrls,
  buildArticleIdeas,
  DesignPin,
  DesignRecord,
  ensureDesignLibraryTable,
  generateDesignPinterestPins,
  normalizeDesignPinterestMeta,
  normalizeMood,
  normalizeNiche,
  normalizeProductType,
  normalizeTags,
  parseList,
} from '@/lib/designLibrary';

export type SocialChannel = 'pinterest' | 'instagram' | 'facebook';
export type SocialStatus = 'draft' | 'ready' | 'scheduled' | 'published' | 'failed';

export type CampaignGenerationSummary = {
  createdPinterest: number;
  createdInstagram: number;
  createdFacebook: number;
  skipped: number;
  failed: number;
  reasons: string[];
  designCount: number;
  batchTag: string;
};

type CampaignBuildOptions = {
  batchTag?: string;
};

function cleanText(value: unknown, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

function titleCase(value: string) {
  const text = cleanText(value);
  return text.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function dedupe<T>(items: T[]) {
  return Array.from(new Set(items));
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

function readJsonObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readPins(meta: unknown): DesignPin[] {
  const source = readJsonObject(meta);
  return Array.isArray(source.pins) ? (source.pins as DesignPin[]) : [];
}

function normalizeHashtag(value: string) {
  const cleaned = cleanText(value)
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, '');

  return cleaned ? `#${cleaned}` : '';
}

function buildHashtags(design: Partial<DesignRecord>, channel: SocialChannel) {
  const seeds = [
    normalizeNiche(design.niche, design),
    normalizeProductType(design.product_type, design),
    normalizeMood(design.mood, design),
    'InkWanderStudio',
    ...normalizeTags(design.tags, design),
    ...parseList(design.ai_keywords),
  ];

  const limit = channel === 'instagram' ? 8 : 5;
  return dedupe(seeds.map(normalizeHashtag).filter(Boolean)).slice(0, limit);
}

function boardRecommendation(design: Partial<DesignRecord>, pin: DesignPin) {
  const niche = titleCase(normalizeNiche(design.niche, design));
  const productType = titleCase(normalizeProductType(design.product_type, design));
  const angle = titleCase(cleanText(pin.angle || 'Product'));
  return `${niche} ${productType} ${angle}`.trim();
}

function buildInstagramCaption(design: Partial<DesignRecord>, targetUrl: string) {
  const title = cleanText(design.title, 'InkWanderStudio design');
  const niche = normalizeNiche(design.niche, design);
  const mood = normalizeMood(design.mood, design);
  const productType = normalizeProductType(design.product_type, design);

  return compactText(
    `${title} brings ${mood.toLowerCase()} energy to ${niche}. Save this ${productType.toLowerCase()} from InkWanderStudio for your next gift list or scroll-stopping post. ${targetUrl}`,
    260,
  );
}

function buildInstagramCarouselIdeas(design: Partial<DesignRecord>) {
  const title = cleanText(design.title, 'InkWanderStudio design');
  const productType = normalizeProductType(design.product_type, design);
  return [
    `Cover slide: ${title}`,
    `Detail slide: zoom in on the ${productType.toLowerCase()} design artwork`,
    'CTA slide: save this design and tap through to Redbubble',
  ];
}

function buildFacebookCaption(design: Partial<DesignRecord>, targetUrl: string) {
  const title = cleanText(design.title, 'InkWanderStudio design');
  const niche = normalizeNiche(design.niche, design);
  return compactText(
    `${title} is a fresh ${niche} pick from InkWanderStudio. If this design feels like your kind of humor, take a look here: ${targetUrl}`,
    220,
  );
}

function designTargetUrl(design: Partial<DesignRecord>) {
  return cleanText(design.redbubble_url || design.product_url);
}

function designIsReady(design: Partial<DesignRecord>) {
  return Boolean(cleanText(design.image_url) && designTargetUrl(design));
}

function emptySummary(batchTag = ''): CampaignGenerationSummary {
  return {
    createdPinterest: 0,
    createdInstagram: 0,
    createdFacebook: 0,
    skipped: 0,
    failed: 0,
    reasons: [],
    designCount: 0,
    batchTag,
  };
}

function mergeSummaries(target: CampaignGenerationSummary, source: CampaignGenerationSummary) {
  target.createdPinterest += source.createdPinterest;
  target.createdInstagram += source.createdInstagram;
  target.createdFacebook += source.createdFacebook;
  target.skipped += source.skipped;
  target.failed += source.failed;
  target.designCount += source.designCount;
  target.reasons.push(...source.reasons);
  return target;
}

async function updateDesignPins(design: DesignRecord, pins: DesignPin[]) {
  const articleIdeas = buildArticleIdeas(design);
  await sql`
    update design_library
    set pinterest_meta = ${JSON.stringify(normalizeDesignPinterestMeta(design.pinterest_meta, pins, articleIdeas))}::jsonb,
        ai_article_ideas = ${JSON.stringify(articleIdeas)}::jsonb,
        updated_at = now()
    where id = ${design.id}
  `;
}

async function ensurePinterestPins(design: DesignRecord, count = 5) {
  const existingPins = readPins(design.pinterest_meta).filter((pin) => cleanText(pin.title));
  if (existingPins.length >= count) {
    return existingPins.slice(0, count);
  }

  const generatedPins = await generateDesignPinterestPins(design, Math.max(5, count));
  const attachedPins = attachDesignPinUrls(design.id, generatedPins);
  await updateDesignPins(design, attachedPins);
  return attachedPins.slice(0, count);
}

export async function ensureSocialCampaignsTable() {
  await ensureDesignLibraryTable();

  await sql`
    create table if not exists social_campaigns (
      id text primary key,
      design_id text not null,
      channel text not null,
      variant_index integer default 0,
      title text not null,
      caption text,
      hashtags jsonb default '[]'::jsonb,
      image_url text,
      generated_image_url text,
      target_url text,
      board_name text,
      keywords jsonb default '[]'::jsonb,
      carousel_ideas jsonb default '[]'::jsonb,
      batch_tag text default '',
      status text default 'draft',
      scheduled_at timestamptz,
      published_at timestamptz,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`alter table social_campaigns add column if not exists batch_tag text default ''`;
  await sql`create index if not exists social_campaigns_design_idx on social_campaigns(design_id)`;
  await sql`create index if not exists social_campaigns_channel_idx on social_campaigns(channel)`;
  await sql`create index if not exists social_campaigns_status_idx on social_campaigns(status)`;
  await sql`create index if not exists social_campaigns_batch_tag_idx on social_campaigns(batch_tag)`;
  await sql`create unique index if not exists social_campaigns_design_channel_variant_idx on social_campaigns(design_id, channel, variant_index)`;
}

async function getDesignById(designId: string) {
  const [design] = await sql`
    select *
    from design_library
    where id = ${designId}
    limit 1
  `;

  return design as DesignRecord | undefined;
}

function buildInstagramCampaign(design: DesignRecord, batchTag: string) {
  const targetUrl = designTargetUrl(design);
  return {
    channel: 'instagram' as const,
    variant_index: 0,
    title: `${cleanText(design.title)} Instagram Post`,
    caption: buildInstagramCaption(design, targetUrl),
    hashtags: buildHashtags(design, 'instagram'),
    image_url: cleanText(design.image_url),
    generated_image_url: '',
    target_url: targetUrl,
    board_name: '',
    keywords: normalizeTags(design.tags, design).slice(0, 6),
    carousel_ideas: buildInstagramCarouselIdeas(design),
    batch_tag: batchTag,
    status: 'draft' as const,
  };
}

function buildFacebookCampaign(design: DesignRecord, batchTag: string) {
  const targetUrl = designTargetUrl(design);
  return {
    channel: 'facebook' as const,
    variant_index: 0,
    title: `${cleanText(design.title)} Facebook Post`,
    caption: buildFacebookCaption(design, targetUrl),
    hashtags: buildHashtags(design, 'facebook'),
    image_url: cleanText(design.image_url),
    generated_image_url: '',
    target_url: targetUrl,
    board_name: '',
    keywords: normalizeTags(design.tags, design).slice(0, 6),
    carousel_ideas: [],
    batch_tag: batchTag,
    status: 'draft' as const,
  };
}

async function buildCampaignDrafts(design: DesignRecord, options: CampaignBuildOptions = {}) {
  const batchTag = cleanText(options.batchTag);
  const targetUrl = designTargetUrl(design);
  const pinterestPins = await ensurePinterestPins(design, 5);

  const pinterest = pinterestPins.map((pin, index) => ({
    channel: 'pinterest' as const,
    variant_index: index,
    title: cleanText(pin.title),
    caption: compactText(pin.description, 260),
    hashtags: buildHashtags(design, 'pinterest'),
    image_url: cleanText(design.image_url),
    generated_image_url: cleanText(pin.image_url),
    target_url: cleanText(pin.target_url || targetUrl),
    board_name: boardRecommendation(design, pin),
    keywords: Array.isArray(pin.keyword_focus) ? pin.keyword_focus.slice(0, 6) : normalizeTags(design.tags, design).slice(0, 6),
    carousel_ideas: [],
    batch_tag: batchTag,
    status: 'draft' as const,
  }));

  return [
    ...pinterest,
    buildInstagramCampaign(design, batchTag),
    buildFacebookCampaign(design, batchTag),
  ];
}

export async function generateCampaignDraftsForDesignId(designId: string, options: CampaignBuildOptions = {}) {
  await ensureSocialCampaignsTable();

  const batchTag = cleanText(options.batchTag);
  const summary = emptySummary(batchTag);
  const design = await getDesignById(designId);
  if (!design) {
    summary.failed = 1;
    summary.reasons.push('Design not found.');
    return summary;
  }

  if (!designIsReady(design)) {
    summary.failed = 1;
    summary.reasons.push(`${cleanText(design.title, 'Design')}: add an image and product link first.`);
    return summary;
  }

  const drafts = await buildCampaignDrafts(design, { batchTag });
  const existing = await sql`
    select channel, variant_index, title
    from social_campaigns
    where design_id = ${design.id}
  `;

  const existingKeys = new Set(existing.map((row: any) => `${row.channel}:${Number(row.variant_index || 0)}`));
  const existingTitles = new Set(existing.map((row: any) => `${row.channel}:${cleanText(row.title).toLowerCase()}`));

  for (const draft of drafts) {
    const variantKey = `${draft.channel}:${draft.variant_index}`;
    const titleKey = `${draft.channel}:${cleanText(draft.title).toLowerCase()}`;

    if (existingKeys.has(variantKey) || existingTitles.has(titleKey)) {
      summary.skipped += 1;
      summary.reasons.push(`${draft.title}: campaign already exists`);
      continue;
    }

    await sql`
      insert into social_campaigns (
        id,
        design_id,
        channel,
        variant_index,
        title,
        caption,
        hashtags,
        image_url,
        generated_image_url,
        target_url,
        board_name,
        keywords,
        carousel_ideas,
        batch_tag,
        status,
        created_at,
        updated_at
      ) values (
        ${crypto.randomUUID()},
        ${design.id},
        ${draft.channel},
        ${draft.variant_index},
        ${draft.title},
        ${draft.caption},
        ${JSON.stringify(draft.hashtags)}::jsonb,
        ${draft.image_url || null},
        ${draft.generated_image_url || null},
        ${draft.target_url || null},
        ${draft.board_name || null},
        ${JSON.stringify(draft.keywords)}::jsonb,
        ${JSON.stringify(draft.carousel_ideas)}::jsonb,
        ${draft.batch_tag || ''},
        ${draft.status},
        now(),
        now()
      )
    `;

    if (draft.channel === 'pinterest') summary.createdPinterest += 1;
    else if (draft.channel === 'instagram') summary.createdInstagram += 1;
    else if (draft.channel === 'facebook') summary.createdFacebook += 1;
  }

  summary.designCount = summary.createdPinterest + summary.createdInstagram + summary.createdFacebook > 0 ? 1 : 0;
  return summary;
}

export async function generateCampaignDraftsForAllReadyDesigns(options: { limit?: number; batchTag?: string } = {}) {
  await ensureSocialCampaignsTable();

  const limit = Number(options.limit || 0);
  const batchTag = cleanText(options.batchTag);
  const designs = await sql`
    select *
    from design_library
    where coalesce(status, 'active') = 'active'
    order by updated_at desc nulls last, created_at desc
  `;

  const readyDesigns = (designs as DesignRecord[]).filter((row) => designIsReady(row));
  const picked = limit > 0 ? readyDesigns.slice(0, limit) : readyDesigns;
  const summary = emptySummary(batchTag);

  for (const row of picked) {
    const result = await generateCampaignDraftsForDesignId(row.id, { batchTag });
    mergeSummaries(summary, result);
  }

  summary.reasons = summary.reasons.slice(0, 8);
  return summary;
}

export async function deleteTestCampaigns(batchTag = 'test-campaign') {
  await ensureSocialCampaignsTable();
  const tag = cleanText(batchTag, 'test-campaign');
  const deleted = await sql`
    delete from social_campaigns
    where batch_tag = ${tag}
    returning id
  `;

  return deleted.length;
}

export async function regenerateCampaignById(campaignId: string) {
  await ensureSocialCampaignsTable();

  const [campaign] = await sql`
    select *
    from social_campaigns
    where id = ${campaignId}
    limit 1
  `;

  if (!campaign) return { updated: false, reason: 'Campaign not found.' };

  const design = await getDesignById(String(campaign.design_id));
  if (!design || !designIsReady(design)) return { updated: false, reason: 'Design is no longer ready for campaign generation.' };

  const drafts = await buildCampaignDrafts(design, { batchTag: cleanText(campaign.batch_tag) });
  const match = drafts.find((draft) => draft.channel === campaign.channel && Number(draft.variant_index) === Number(campaign.variant_index || 0));
  if (!match) return { updated: false, reason: 'Could not rebuild this campaign.' };

  await sql`
    update social_campaigns
    set title = ${match.title},
        caption = ${match.caption},
        hashtags = ${JSON.stringify(match.hashtags)}::jsonb,
        image_url = ${match.image_url || null},
        generated_image_url = ${match.generated_image_url || null},
        target_url = ${match.target_url || null},
        board_name = ${match.board_name || null},
        keywords = ${JSON.stringify(match.keywords)}::jsonb,
        carousel_ideas = ${JSON.stringify(match.carousel_ideas)}::jsonb,
        batch_tag = ${match.batch_tag || ''},
        status = 'draft',
        scheduled_at = null,
        published_at = null,
        updated_at = now()
    where id = ${campaign.id}
  `;

  return { updated: true, title: match.title };
}

export async function updateCampaignStatus(ids: string[], status: SocialStatus, scheduledAt?: string | null) {
  await ensureSocialCampaignsTable();

  const cleanIds = dedupe(ids.map((value) => cleanText(value)).filter(Boolean));
  let count = 0;

  for (const id of cleanIds) {
    const scheduled = status === 'scheduled' && scheduledAt ? new Date(scheduledAt) : null;
    const published = status === 'published' ? new Date() : null;

    await sql`
      update social_campaigns
      set status = ${status},
          scheduled_at = ${status === 'scheduled' ? scheduled : null},
          published_at = ${status === 'published' ? published : null},
          updated_at = now()
      where id = ${id}
    `;
    count += 1;
  }

  return count;
}

export async function deleteCampaigns(ids: string[]) {
  await ensureSocialCampaignsTable();

  const cleanIds = dedupe(ids.map((value) => cleanText(value)).filter(Boolean));
  let count = 0;

  for (const id of cleanIds) {
    await sql`delete from social_campaigns where id = ${id}`;
    count += 1;
  }

  return count;
}
