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
export type CampaignType = 'direct_product' | 'article_funnel';

export type CampaignGenerationSummary = {
  createdPinterest: number;
  createdInstagram: number;
  createdFacebook: number;
  createdFunnels: number;
  skipped: number;
  failed: number;
  reasons: string[];
  designCount: number;
  batchTag: string;
};

type CampaignBuildOptions = {
  batchTag?: string;
};

type ArticleFunnelProduct = {
  id: string;
  title: string;
  image_url: string;
  redbubble_url: string;
  niche: string;
  product_type: string;
  mood: string;
  tags: string[];
};

type ArticleFunnelDraft = {
  article_title: string;
  article_slug: string;
  article_intro: string;
  article_angle: string;
  article_group_key: string;
  product_group: string;
  target_keywords: string[];
  pinterest_title_ideas: string[];
  related_products: ArticleFunnelProduct[];
  representative_design_id: string;
  representative_image_url: string;
  representative_target_url: string;
  representative_title: string;
  niche: string;
  product_type: string;
  mood: string;
};

function cleanText(value: unknown, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

function titleCase(value: string) {
  const text = cleanText(value);
  return text.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function slugify(value: string) {
  return cleanText(value)
    .toLowerCase()
    .replace(/["'`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
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

function readJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!value) return [];

  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
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

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values.map((item) => cleanText(item)).filter(Boolean)) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return counts;
}

function topValue(values: string[], fallback: string) {
  const counts = Array.from(countBy(values).entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return counts[0]?.[0] || fallback;
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
    createdFunnels: 0,
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
  target.createdFunnels += source.createdFunnels;
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

function articleTargetUrl(slug: string) {
  return `/blog/${slug}`;
}

function buildArticleAngle(niche: string, productType: string, mood: string, tags: string[]) {
  const tagHint = titleCase(tags.find((tag) => tag.toLowerCase() !== 'inkwanderstudio') || niche);

  if (/season|holiday|summer|winter|fall|spring/i.test(tags.join(' '))) return `Seasonal ${titleCase(niche)} collection`;
  if (/sticker/i.test(productType)) return `${titleCase(niche)} sticker roundup`;
  if (/gift/i.test(tags.join(' ')) || /gift/i.test(mood)) return `${titleCase(niche)} gift guide`;
  if (/coffee|cozy/i.test(`${niche} ${mood} ${tags.join(' ')}`)) return `Cozy ${titleCase(tagHint)} collection`;
  if (/funny|sarcastic|humor/i.test(`${niche} ${mood} ${tags.join(' ')}`)) return `Funny ${titleCase(tagHint)} collection`;
  return `${titleCase(niche)} ${titleCase(productType)} ideas`;
}

function buildArticleTitle(angle: string, niche: string, productType: string, mood: string, tags: string[]) {
  const tagHint = titleCase(tags.find((tag) => tag.toLowerCase() !== 'inkwanderstudio') || niche);

  if (/sticker roundup/i.test(angle)) return `${titleCase(niche)} Sticker Roundup: ${tagHint} Designs to Save`;
  if (/gift guide/i.test(angle)) return `${titleCase(tagHint)} Gift Guide: ${titleCase(niche)} Picks from InkWanderStudio`;
  if (/cozy/i.test(angle)) return `Cozy ${titleCase(tagHint)} Collection for ${titleCase(niche)} Fans`;
  if (/funny/i.test(angle)) return `Funny ${titleCase(tagHint)} Collection: ${titleCase(niche)} Favorites`;
  return `${titleCase(niche)} ${titleCase(productType)} Ideas to Feature from InkWanderStudio`;
}

function buildArticleIntro(title: string, products: ArticleFunnelProduct[], niche: string, mood: string) {
  const count = products.length;
  return compactText(
    `${title} pulls together ${count} InkWanderStudio products for readers who love ${niche} with ${mood.toLowerCase()} energy. Use this draft article to spotlight the collection, then send Pinterest traffic to the post before readers click through to the matching Redbubble listings.`,
    320,
  );
}

function buildArticleKeywords(niche: string, productType: string, mood: string, tags: string[]) {
  return dedupe([
    niche,
    productType.toLowerCase(),
    mood.toLowerCase(),
    ...tags.filter((tag) => tag.toLowerCase() !== 'inkwanderstudio').slice(0, 6),
    'inkwanderstudio roundup',
  ]).slice(0, 8);
}

function buildArticlePinterestIdeas(title: string, angle: string, productType: string, niche: string) {
  const shortTitle = title.replace(/\s+/g, ' ').trim();
  return dedupe([
    shortTitle,
    `${titleCase(niche)} ${titleCase(productType)} roundup`,
    `${titleCase(niche)} gift ideas to save`,
    `${angle} for Pinterest boards`,
    `Save this InkWanderStudio ${productType.toLowerCase()} collection`,
  ]).slice(0, 5);
}

function normalizeArticleFunnelProduct(design: DesignRecord): ArticleFunnelProduct {
  return {
    id: cleanText(design.id),
    title: cleanText(design.title),
    image_url: cleanText(design.image_url),
    redbubble_url: designTargetUrl(design),
    niche: normalizeNiche(design.niche, design),
    product_type: normalizeProductType(design.product_type, design),
    mood: normalizeMood(design.mood, design),
    tags: normalizeTags(design.tags, design),
  };
}

function buildArticleFunnelDraft(products: ArticleFunnelProduct[]): ArticleFunnelDraft | null {
  const cleanProducts = products.filter((product) => product.id && product.image_url && product.redbubble_url);
  if (cleanProducts.length < 2) return null;

  const niche = topValue(cleanProducts.map((product) => product.niche), 'relatable stickers');
  const productType = topValue(cleanProducts.map((product) => product.product_type), 'Design');
  const mood = topValue(cleanProducts.map((product) => product.mood), 'Giftable');
  const tags = dedupe(cleanProducts.flatMap((product) => product.tags.map((tag) => cleanText(tag).toLowerCase())).filter(Boolean)).slice(0, 8);
  const articleAngle = buildArticleAngle(niche, productType, mood, tags);
  const articleTitle = buildArticleTitle(articleAngle, niche, productType, mood, tags);
  const articleSlug = slugify(articleTitle);
  const productGroup = `${titleCase(niche)} · ${titleCase(productType)} · ${titleCase(mood)}`;
  const articleGroupKey = slugify(`${niche}-${productType}-${mood}-${tags.slice(0, 3).join('-')}`);
  const intro = buildArticleIntro(articleTitle, cleanProducts, niche, mood);
  const targetKeywords = buildArticleKeywords(niche, productType, mood, tags);
  const pinterestTitleIdeas = buildArticlePinterestIdeas(articleTitle, articleAngle, productType, niche);
  const representative = cleanProducts[0];

  return {
    article_title: articleTitle,
    article_slug: articleSlug,
    article_intro: intro,
    article_angle: articleAngle,
    article_group_key: articleGroupKey,
    product_group: productGroup,
    target_keywords: targetKeywords,
    pinterest_title_ideas: pinterestTitleIdeas,
    related_products: cleanProducts,
    representative_design_id: representative.id,
    representative_image_url: representative.image_url,
    representative_target_url: representative.redbubble_url,
    representative_title: representative.title,
    niche,
    product_type: productType,
    mood,
  };
}

function collectArticleFunnelDrafts(designs: DesignRecord[], limit = 0) {
  const groups = new Map<string, ArticleFunnelProduct[]>();

  for (const design of designs.filter((item) => designIsReady(item))) {
    const product = normalizeArticleFunnelProduct(design);
    const groupKey = slugify(`${product.niche}-${product.product_type}-${product.mood}`);
    const existing = groups.get(groupKey) || [];
    existing.push(product);
    groups.set(groupKey, existing);
  }

  const drafts = Array.from(groups.values())
    .map((products) => buildArticleFunnelDraft(products))
    .filter(Boolean) as ArticleFunnelDraft[];

  drafts.sort((a, b) => b.related_products.length - a.related_products.length || a.article_title.localeCompare(b.article_title));
  return limit > 0 ? drafts.slice(0, limit) : drafts;
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
      campaign_type text default 'direct_product',
      article_title text,
      article_slug text,
      article_intro text,
      article_angle text,
      article_group_key text,
      product_group text,
      target_keywords jsonb default '[]'::jsonb,
      pinterest_title_ideas jsonb default '[]'::jsonb,
      related_products jsonb default '[]'::jsonb,
      status text default 'draft',
      scheduled_at timestamptz,
      published_at timestamptz,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`alter table social_campaigns add column if not exists batch_tag text default ''`;
  await sql`alter table social_campaigns add column if not exists campaign_type text default 'direct_product'`;
  await sql`alter table social_campaigns add column if not exists article_title text`;
  await sql`alter table social_campaigns add column if not exists article_slug text`;
  await sql`alter table social_campaigns add column if not exists article_intro text`;
  await sql`alter table social_campaigns add column if not exists article_angle text`;
  await sql`alter table social_campaigns add column if not exists article_group_key text`;
  await sql`alter table social_campaigns add column if not exists product_group text`;
  await sql`alter table social_campaigns add column if not exists target_keywords jsonb default '[]'::jsonb`;
  await sql`alter table social_campaigns add column if not exists pinterest_title_ideas jsonb default '[]'::jsonb`;
  await sql`alter table social_campaigns add column if not exists related_products jsonb default '[]'::jsonb`;
  await sql`update social_campaigns set campaign_type = 'direct_product' where campaign_type is null or campaign_type = ''`;

  await sql`create index if not exists social_campaigns_design_idx on social_campaigns(design_id)`;
  await sql`create index if not exists social_campaigns_channel_idx on social_campaigns(channel)`;
  await sql`create index if not exists social_campaigns_status_idx on social_campaigns(status)`;
  await sql`create index if not exists social_campaigns_batch_tag_idx on social_campaigns(batch_tag)`;
  await sql`create index if not exists social_campaigns_type_idx on social_campaigns(campaign_type)`;
  await sql`create index if not exists social_campaigns_article_group_idx on social_campaigns(article_group_key)`;
  await sql`drop index if exists social_campaigns_design_channel_variant_idx`;
  await sql`
    create unique index if not exists social_campaigns_direct_product_unique_idx
    on social_campaigns(design_id, channel, campaign_type, variant_index)
    where campaign_type = 'direct_product'
  `;
  await sql`
    create unique index if not exists social_campaigns_article_funnel_unique_idx
    on social_campaigns(channel, campaign_type, article_group_key, title)
    where campaign_type = 'article_funnel'
  `;
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
    campaign_type: 'direct_product' as const,
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
    article_title: '',
    article_slug: '',
    article_intro: '',
    article_angle: '',
    article_group_key: '',
    product_group: '',
    target_keywords: [] as string[],
    pinterest_title_ideas: [] as string[],
    related_products: [] as ArticleFunnelProduct[],
    status: 'draft' as const,
  };
}

function buildFacebookCampaign(design: DesignRecord, batchTag: string) {
  const targetUrl = designTargetUrl(design);
  return {
    campaign_type: 'direct_product' as const,
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
    article_title: '',
    article_slug: '',
    article_intro: '',
    article_angle: '',
    article_group_key: '',
    product_group: '',
    target_keywords: [] as string[],
    pinterest_title_ideas: [] as string[],
    related_products: [] as ArticleFunnelProduct[],
    status: 'draft' as const,
  };
}

async function buildDirectProductCampaignDrafts(design: DesignRecord, options: CampaignBuildOptions = {}) {
  const batchTag = cleanText(options.batchTag);
  const targetUrl = designTargetUrl(design);
  const pinterestPins = await ensurePinterestPins(design, 5);

  const pinterest = pinterestPins.map((pin, index) => ({
    campaign_type: 'direct_product' as const,
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
    carousel_ideas: [] as string[],
    batch_tag: batchTag,
    article_title: '',
    article_slug: '',
    article_intro: '',
    article_angle: '',
    article_group_key: '',
    product_group: '',
    target_keywords: [] as string[],
    pinterest_title_ideas: [] as string[],
    related_products: [] as ArticleFunnelProduct[],
    status: 'draft' as const,
  }));

  return [
    ...pinterest,
    buildInstagramCampaign(design, batchTag),
    buildFacebookCampaign(design, batchTag),
  ];
}

function buildArticleFunnelCampaignDrafts(draft: ArticleFunnelDraft, batchTag: string) {
  const hashtags = dedupe([
    ...draft.target_keywords.map(normalizeHashtag),
    normalizeHashtag(draft.niche),
    normalizeHashtag(draft.product_type),
    normalizeHashtag('InkWanderStudio'),
  ]).filter(Boolean);
  const targetUrl = articleTargetUrl(draft.article_slug);

  return [
    {
      campaign_type: 'article_funnel' as const,
      channel: 'pinterest' as const,
      variant_index: 0,
      title: cleanText(draft.pinterest_title_ideas[0] || draft.article_title),
      caption: compactText(`${draft.article_intro} Read the draft article, then click through to the featured Redbubble products.`, 260),
      hashtags: hashtags.slice(0, 5),
      image_url: draft.representative_image_url,
      generated_image_url: '',
      target_url: targetUrl,
      board_name: `${titleCase(draft.niche)} Article Funnel`,
      keywords: draft.target_keywords,
      carousel_ideas: [] as string[],
      batch_tag: batchTag,
      article_title: draft.article_title,
      article_slug: draft.article_slug,
      article_intro: draft.article_intro,
      article_angle: draft.article_angle,
      article_group_key: draft.article_group_key,
      product_group: draft.product_group,
      target_keywords: draft.target_keywords,
      pinterest_title_ideas: draft.pinterest_title_ideas,
      related_products: draft.related_products,
      status: 'draft' as const,
    },
    {
      campaign_type: 'article_funnel' as const,
      channel: 'instagram' as const,
      variant_index: 0,
      title: `${draft.article_title} Instagram Draft`,
      caption: compactText(`${draft.article_intro} Save this collection idea, then use the linked article draft to send readers to the featured Redbubble products. ${targetUrl}`, 260),
      hashtags: hashtags.slice(0, 8),
      image_url: draft.representative_image_url,
      generated_image_url: '',
      target_url: targetUrl,
      board_name: '',
      keywords: draft.target_keywords,
      carousel_ideas: [
        `Cover slide: ${draft.article_title}`,
        `Product slides: feature ${draft.related_products.slice(0, 3).map((product) => product.title).join(', ')}`,
        'CTA slide: read the HustlePathDaily article draft and shop the linked Redbubble products',
      ],
      batch_tag: batchTag,
      article_title: draft.article_title,
      article_slug: draft.article_slug,
      article_intro: draft.article_intro,
      article_angle: draft.article_angle,
      article_group_key: draft.article_group_key,
      product_group: draft.product_group,
      target_keywords: draft.target_keywords,
      pinterest_title_ideas: draft.pinterest_title_ideas,
      related_products: draft.related_products,
      status: 'draft' as const,
    },
    {
      campaign_type: 'article_funnel' as const,
      channel: 'facebook' as const,
      variant_index: 0,
      title: `${draft.article_title} Facebook Draft`,
      caption: compactText(`${draft.article_title} is a draft collection article built around ${draft.product_group.toLowerCase()}. Use the article to feature the related Redbubble picks, then share it from HustlePathDaily. ${targetUrl}`, 220),
      hashtags: hashtags.slice(0, 5),
      image_url: draft.representative_image_url,
      generated_image_url: '',
      target_url: targetUrl,
      board_name: '',
      keywords: draft.target_keywords,
      carousel_ideas: [] as string[],
      batch_tag: batchTag,
      article_title: draft.article_title,
      article_slug: draft.article_slug,
      article_intro: draft.article_intro,
      article_angle: draft.article_angle,
      article_group_key: draft.article_group_key,
      product_group: draft.product_group,
      target_keywords: draft.target_keywords,
      pinterest_title_ideas: draft.pinterest_title_ideas,
      related_products: draft.related_products,
      status: 'draft' as const,
    },
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

  const drafts = await buildDirectProductCampaignDrafts(design, { batchTag });
  const existing = await sql`
    select channel, variant_index, title
    from social_campaigns
    where design_id = ${design.id}
      and coalesce(campaign_type, 'direct_product') = 'direct_product'
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
        campaign_type,
        article_title,
        article_slug,
        article_intro,
        article_angle,
        article_group_key,
        product_group,
        target_keywords,
        pinterest_title_ideas,
        related_products,
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
        ${draft.campaign_type},
        ${draft.article_title || null},
        ${draft.article_slug || null},
        ${draft.article_intro || null},
        ${draft.article_angle || null},
        ${draft.article_group_key || null},
        ${draft.product_group || null},
        ${JSON.stringify(draft.target_keywords)}::jsonb,
        ${JSON.stringify(draft.pinterest_title_ideas)}::jsonb,
        ${JSON.stringify(draft.related_products)}::jsonb,
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
  summary.reasons = summary.reasons.slice(0, 8);
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

export async function generateArticleFunnelDrafts(options: { limit?: number; batchTag?: string } = {}) {
  await ensureSocialCampaignsTable();

  const limit = Number(options.limit || 0);
  const batchTag = cleanText(options.batchTag);
  const summary = emptySummary(batchTag);
  const designs = await sql`
    select *
    from design_library
    where coalesce(status, 'active') = 'active'
    order by updated_at desc nulls last, created_at desc
  `;

  const drafts = collectArticleFunnelDrafts(designs as DesignRecord[], limit);

  for (const draft of drafts) {
    const campaigns = buildArticleFunnelCampaignDrafts(draft, batchTag);
    const existing = await sql`
      select channel, title
      from social_campaigns
      where campaign_type = 'article_funnel'
        and article_group_key = ${draft.article_group_key}
    `;
    const existingKeys = new Set(existing.map((row: any) => `${cleanText(row.channel).toLowerCase()}:${cleanText(row.title).toLowerCase()}`));

    let createdForDraft = 0;

    for (const campaign of campaigns) {
      const duplicateKey = `${campaign.channel}:${cleanText(campaign.title).toLowerCase()}`;
      if (existingKeys.has(duplicateKey)) {
        summary.skipped += 1;
        summary.reasons.push(`${campaign.title}: article funnel already exists`);
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
          campaign_type,
          article_title,
          article_slug,
          article_intro,
          article_angle,
          article_group_key,
          product_group,
          target_keywords,
          pinterest_title_ideas,
          related_products,
          status,
          created_at,
          updated_at
        ) values (
          ${crypto.randomUUID()},
          ${draft.representative_design_id},
          ${campaign.channel},
          ${campaign.variant_index},
          ${campaign.title},
          ${campaign.caption},
          ${JSON.stringify(campaign.hashtags)}::jsonb,
          ${campaign.image_url || null},
          ${campaign.generated_image_url || null},
          ${campaign.target_url || null},
          ${campaign.board_name || null},
          ${JSON.stringify(campaign.keywords)}::jsonb,
          ${JSON.stringify(campaign.carousel_ideas)}::jsonb,
          ${campaign.batch_tag || ''},
          ${campaign.campaign_type},
          ${campaign.article_title || null},
          ${campaign.article_slug || null},
          ${campaign.article_intro || null},
          ${campaign.article_angle || null},
          ${campaign.article_group_key || null},
          ${campaign.product_group || null},
          ${JSON.stringify(campaign.target_keywords)}::jsonb,
          ${JSON.stringify(campaign.pinterest_title_ideas)}::jsonb,
          ${JSON.stringify(campaign.related_products)}::jsonb,
          ${campaign.status},
          now(),
          now()
        )
      `;

      existingKeys.add(duplicateKey);
      createdForDraft += 1;
      if (campaign.channel === 'pinterest') summary.createdPinterest += 1;
      else if (campaign.channel === 'instagram') summary.createdInstagram += 1;
      else if (campaign.channel === 'facebook') summary.createdFacebook += 1;
    }

    if (createdForDraft > 0) {
      summary.createdFunnels += 1;
      summary.designCount += draft.related_products.length;
    }
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

  const campaignType = cleanText(campaign.campaign_type || 'direct_product').toLowerCase() as CampaignType;

  if (campaignType === 'article_funnel') {
    const relatedProducts = readJsonArray<ArticleFunnelProduct>(campaign.related_products).map((product) => ({
      id: cleanText(product?.id),
      title: cleanText(product?.title),
      image_url: cleanText(product?.image_url),
      redbubble_url: cleanText(product?.redbubble_url),
      niche: cleanText(product?.niche),
      product_type: cleanText(product?.product_type),
      mood: cleanText(product?.mood),
      tags: Array.isArray(product?.tags) ? product.tags.map((tag) => cleanText(tag)).filter(Boolean) : [],
    })).filter((product) => product.id && product.image_url && product.redbubble_url);

    const draft = buildArticleFunnelDraft(relatedProducts);
    if (!draft) return { updated: false, reason: 'Article funnel no longer has enough linked products.' };

    const rebuilt = buildArticleFunnelCampaignDrafts(draft, cleanText(campaign.batch_tag));
    const match = rebuilt.find((entry) => entry.channel === campaign.channel);
    if (!match) return { updated: false, reason: 'Could not rebuild this article funnel campaign.' };

    await sql`
      update social_campaigns
      set design_id = ${draft.representative_design_id},
          title = ${match.title},
          caption = ${match.caption},
          hashtags = ${JSON.stringify(match.hashtags)}::jsonb,
          image_url = ${match.image_url || null},
          generated_image_url = ${match.generated_image_url || null},
          target_url = ${match.target_url || null},
          board_name = ${match.board_name || null},
          keywords = ${JSON.stringify(match.keywords)}::jsonb,
          carousel_ideas = ${JSON.stringify(match.carousel_ideas)}::jsonb,
          batch_tag = ${match.batch_tag || ''},
          campaign_type = 'article_funnel',
          article_title = ${match.article_title || null},
          article_slug = ${match.article_slug || null},
          article_intro = ${match.article_intro || null},
          article_angle = ${match.article_angle || null},
          article_group_key = ${match.article_group_key || null},
          product_group = ${match.product_group || null},
          target_keywords = ${JSON.stringify(match.target_keywords)}::jsonb,
          pinterest_title_ideas = ${JSON.stringify(match.pinterest_title_ideas)}::jsonb,
          related_products = ${JSON.stringify(match.related_products)}::jsonb,
          status = 'draft',
          scheduled_at = null,
          published_at = null,
          updated_at = now()
      where id = ${campaign.id}
    `;

    return { updated: true, title: match.title };
  }

  const design = await getDesignById(String(campaign.design_id));
  if (!design || !designIsReady(design)) return { updated: false, reason: 'Design is no longer ready for campaign generation.' };

  const drafts = await buildDirectProductCampaignDrafts(design, { batchTag: cleanText(campaign.batch_tag) });
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
        campaign_type = 'direct_product',
        article_title = null,
        article_slug = null,
        article_intro = null,
        article_angle = null,
        article_group_key = null,
        product_group = null,
        target_keywords = '[]'::jsonb,
        pinterest_title_ideas = '[]'::jsonb,
        related_products = '[]'::jsonb,
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
