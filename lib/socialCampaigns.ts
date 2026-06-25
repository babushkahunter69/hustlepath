import { sql } from '@/lib/db';
import {
  attachDesignPinUrls,
  buildArticleIdeas,
  DesignPin,
  DesignRecord,
  generateDesignPinterestPins,
  normalizeDesignPinterestMeta,
  normalizeMood,
  normalizeNiche,
  normalizeProductType,
  normalizeTags,
  parseList,
  ensureDesignLibraryTable,
} from '@/lib/designLibrary';

export type SocialChannel = 'pinterest' | 'instagram' | 'facebook';
export type SocialStatus = 'draft' | 'ready' | 'scheduled' | 'published' | 'failed';

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
      status text default 'draft',
      scheduled_at timestamptz,
      published_at timestamptz,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`create index if not exists social_campaigns_design_idx on social_campaigns(design_id)`;
  await sql`create index if not exists social_campaigns_channel_idx on social_campaigns(channel)`;
  await sql`create index if not exists social_campaigns_status_idx on social_campaigns(status)`;
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

function buildInstagramCampaign(design: DesignRecord) {
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
    status: 'draft' as const,
  };
}

function buildFacebookCampaign(design: DesignRecord) {
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
    status: 'draft' as const,
  };
}

async function buildCampaignDrafts(design: DesignRecord) {
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
    status: 'draft' as const,
  }));

  return [
    ...pinterest,
    buildInstagramCampaign(design),
    buildFacebookCampaign(design),
  ];
}

export async function generateCampaignDraftsForDesignId(designId: string) {
  await ensureSocialCampaignsTable();

  const design = await getDesignById(designId);
  if (!design) {
    return { imported: 0, skipped: 1, rejected: 1, reasons: ['Design not found.'] };
  }

  if (!designIsReady(design)) {
    return { imported: 0, skipped: 1, rejected: 1, reasons: [`${cleanText(design.title, 'Design')}: add an image and product link first.`] };
  }

  const drafts = await buildCampaignDrafts(design);
  const existing = await sql`
    select channel, variant_index, title
    from social_campaigns
    where design_id = ${design.id}
  `;

  const existingKeys = new Set(existing.map((row: any) => `${row.channel}:${Number(row.variant_index || 0)}`));
  const existingTitles = new Set(existing.map((row: any) => `${row.channel}:${cleanText(row.title).toLowerCase()}`));

  let imported = 0;
  let skipped = 0;
  const reasons: string[] = [];

  for (const draft of drafts) {
    const variantKey = `${draft.channel}:${draft.variant_index}`;
    const titleKey = `${draft.channel}:${cleanText(draft.title).toLowerCase()}`;

    if (existingKeys.has(variantKey) || existingTitles.has(titleKey)) {
      skipped += 1;
      reasons.push(`${draft.title}: campaign already exists`);
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
        ${draft.status},
        now(),
        now()
      )
    `;

    imported += 1;
  }

  return { imported, skipped, rejected: 0, reasons, designTitle: cleanText(design.title) };
}

export async function generateCampaignDraftsForAllReadyDesigns() {
  await ensureSocialCampaignsTable();

  const designs = await sql`
    select *
    from design_library
    where coalesce(status, 'active') = 'active'
    order by updated_at desc nulls last, created_at desc
  `;

  let imported = 0;
  let skipped = 0;
  let rejected = 0;
  const reasons: string[] = [];

  for (const row of designs as DesignRecord[]) {
    const result = await generateCampaignDraftsForDesignId(row.id);
    imported += result.imported;
    skipped += result.skipped;
    rejected += result.rejected;
    reasons.push(...result.reasons.slice(0, 2));
  }

  return { imported, skipped, rejected, reasons: reasons.slice(0, 5) };
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

  const drafts = await buildCampaignDrafts(design);
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
