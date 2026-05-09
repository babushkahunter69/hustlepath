import OpenAI from 'openai';
import slugify from 'slugify';
import { sql } from '@/lib/db';
import { scorePost } from '@/lib/seo';
import { formatArticleMarkdown } from '@/lib/articleFormat';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Category = 'Beginner Guide' | 'Side Hustles' | 'Tools' | 'Pinterest';

type DraftTopic = {
  topic: string;
  category: Category;
};

type InternalLink = {
  title: string;
  slug: string;
  category?: string;
  excerpt?: string;
};

// ---------------------------------------------------------------------------
// Seed topics — used ONLY as fallback when the DB keyword bank is empty.
// The AI expander takes over as soon as at least one batch has been generated.
// ---------------------------------------------------------------------------

const SEED_TOPICS: DraftTopic[] = [
  { topic: 'how to make your first online income with one beginner-friendly service', category: 'Beginner Guide' },
  { topic: 'Pinterest blog traffic plan for a new beginner income blog', category: 'Pinterest' },
  { topic: 'best free tools for starting a small online income project', category: 'Tools' },
  { topic: 'side hustles beginners can start with no audience and no budget', category: 'Side Hustles' },
  { topic: 'how to turn one skill into a simple freelance offer', category: 'Side Hustles' },
  { topic: 'weekly plan for publishing helpful beginner blog content', category: 'Beginner Guide' },
  { topic: 'how to choose a profitable beginner blog niche', category: 'Beginner Guide' },
  { topic: 'simple Canva side hustles beginners can start this week', category: 'Side Hustles' },
  { topic: 'how to create Pinterest pins for a brand new blog post', category: 'Pinterest' },
  { topic: 'AI tools that help beginners create blog content faster', category: 'Tools' },
  { topic: 'how to get your first freelance client without paid ads', category: 'Side Hustles' },
  { topic: 'best beginner side hustles for people with limited time', category: 'Side Hustles' },
  { topic: 'how to write blog posts that answer beginner questions', category: 'Beginner Guide' },
  { topic: 'Pinterest SEO checklist for new bloggers', category: 'Pinterest' },
  { topic: 'free tools for planning content clusters and blog ideas', category: 'Tools' },
  { topic: 'how to package one small skill into a paid service', category: 'Side Hustles' },
  { topic: 'how to build a simple weekly content routine', category: 'Beginner Guide' },
  { topic: 'how to use Pinterest boards to organize blog traffic topics', category: 'Pinterest' },
  { topic: 'beginner guide to creating digital products with free tools', category: 'Tools' },
  { topic: 'realistic online income ideas for beginners who want low risk', category: 'Beginner Guide' },
  { topic: 'how to start a print on demand side hustle with no budget', category: 'Side Hustles' },
  { topic: 'how to design simple products for Redbubble beginners', category: 'Side Hustles' },
  { topic: 'how to choose a niche for print on demand products', category: 'Beginner Guide' },
  { topic: 'Pinterest marketing for print on demand products', category: 'Pinterest' },
  { topic: 'free tools for creating Redbubble designs as a beginner', category: 'Tools' },
  { topic: 'how to promote Redbubble products without paid ads', category: 'Pinterest' },
  { topic: 'beginner guide to selling digital art online', category: 'Side Hustles' },
  { topic: 'how to make simple quote designs for print on demand', category: 'Side Hustles' },
  { topic: 'how to use Canva for print on demand product ideas', category: 'Tools' },
  { topic: 'how to create a weekly content plan for a Redbubble shop', category: 'Beginner Guide' },
  { topic: 'how to validate a side hustle idea before spending money', category: 'Beginner Guide' },
  { topic: 'how to create your first simple digital download', category: 'Tools' },
  { topic: 'how to use Pinterest keywords before writing a blog post', category: 'Pinterest' },
  { topic: 'how to build a beginner content calendar in one afternoon', category: 'Beginner Guide' },
  { topic: 'how to turn common questions into helpful blog posts', category: 'Beginner Guide' },
  { topic: 'how to create a simple service page for your first offer', category: 'Tools' },
  { topic: 'how to get side hustle ideas from skills you already have', category: 'Side Hustles' },
  { topic: 'how to organize blog topics into content clusters', category: 'Tools' },
];

// ---------------------------------------------------------------------------
// Keyword bank — persisted in the `topic_bank` DB table
// ---------------------------------------------------------------------------

async function ensureTopicBankTable() {
  await sql`
    create table if not exists topic_bank (
      id         uuid primary key default gen_random_uuid(),
      topic      text not null unique,
      category   text not null,
      used       boolean not null default false,
      created_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists topic_bank_used_idx on topic_bank(used)`;
}

async function countUnusedTopics(): Promise<number> {
  await ensureTopicBankTable();
  const [row] = await sql`select count(*) as n from topic_bank where used = false`;
  return Number((row as any).n ?? 0);
}

async function loadUnusedTopics(): Promise<DraftTopic[]> {
  await ensureTopicBankTable();
  const rows = await sql`
    select topic, category from topic_bank
    where used = false
    order by created_at asc
  `;
  return rows.map((r: any) => ({ topic: String(r.topic), category: String(r.category) as Category }));
}

async function markTopicUsed(topic: string) {
  await sql`update topic_bank set used = true where topic = ${topic}`;
}

// ---------------------------------------------------------------------------
// Deduplication helpers
// ---------------------------------------------------------------------------

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordSet(value: string): Set<string> {
  return new Set(
    normalise(value)
      .split(' ')
      .filter((w) => w.length > 3),
  );
}

function similarity(a: string, b: string): number {
  const aWords = wordSet(a);
  const bWords = wordSet(b);
  if (!aWords.size || !bWords.size) return 0;
  let overlap = 0;
  for (const w of aWords) if (bWords.has(w)) overlap++;
  return overlap / Math.min(aWords.size, bWords.size);
}

// ---------------------------------------------------------------------------
// All known topics (for deduplication during expansion)
// ---------------------------------------------------------------------------

async function getAllKnownTopics(): Promise<string[]> {
  await ensureTopicBankTable();

  const bankRows = await sql`select topic from topic_bank`;
  const bankTopics = bankRows.map((r: any) => String(r.topic));

  const postRows = await sql`select title, primary_keyword from posts`;
  const postTopics = postRows
    .flatMap((r: any) => [String(r.title || ''), String(r.primary_keyword || '')])
    .filter(Boolean);

  return [...bankTopics, ...postTopics];
}

// ---------------------------------------------------------------------------
// AI keyword expander
// ---------------------------------------------------------------------------

type GeneratedTopicItem = {
  topic: string;
  category: Category;
};

async function generateNewTopics(
  existingTopics: string[],
  batchSize = 30,
): Promise<GeneratedTopicItem[]> {
  const categories: Category[] = ['Beginner Guide', 'Side Hustles', 'Tools', 'Pinterest'];

  // Send up to 80 recent known topics to avoid duplication
  const existingList = existingTopics
    .slice(-80)
    .map((t) => `- ${t}`)
    .join('\n');

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    temperature: 0.95,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a senior content strategist for HustlePathDaily, a beginner-friendly blog about online income, side hustles, tools, and Pinterest traffic.

Your job is to generate a batch of fresh, unique article topic ideas that:
- Are NOT duplicates or near-duplicates of existing topics
- Are practical and actionable for beginners
- Cover a wide variety of angles
- Would genuinely help someone starting their first side hustle or online income stream

Return JSON only. No markdown outside JSON.`,
      },
      {
        role: 'user',
        content: `Generate exactly ${batchSize} UNIQUE article topic ideas for HustlePathDaily.

SITE NICHE: Beginner online income, side hustles, Pinterest marketing, and helpful tools.

ALLOWED CATEGORIES: ${categories.join(', ')}

RULES:
- Each topic must be a clear, specific blog post angle
- Do NOT duplicate or closely paraphrase any of these already-used topics:
${existingList || '(none yet — this is the first batch)'}

- Span a wide range of angles: money-making methods, platforms, skills, mindsets, tools, workflows, Pinterest strategies, digital products, freelancing, content creation, Redbubble/print-on-demand, Etsy, Gumroad, email lists, Ko-fi, Fiverr, Upwork, Substack, etc.
- Beginner-friendly framing only — no advanced or technical topics
- No income promises or hype (no "make $10k fast")
- Vary the category distribution: include a mix of all four categories
- Include 2–3 seasonal or trend-adjacent angles (e.g. holiday print-on-demand, Q4 content planning)
- Include 2–3 that address common beginner fears, myths, or misconceptions
- Include 2–3 that compare beginner-friendly platforms or approaches
- Include 2–3 about under-discussed platforms (Ko-fi, Gumroad, Substack, Fiverr, etc.)

Return JSON:
{
  "topics": [
    { "topic": "...", "category": "Beginner Guide" },
    { "topic": "...", "category": "Side Hustles" },
    ...
  ]
}`,
      },
    ],
  });

  const raw = safeJsonParse(completion.choices[0].message.content || '{}');
  if (!Array.isArray(raw?.topics)) return [];

  return (raw.topics as any[])
    .filter((item) => item?.topic && categories.includes(item?.category))
    .map((item) => ({
      topic: String(item.topic).trim(),
      category: item.category as Category,
    }));
}

async function expandTopicBank(minUnused = 15, batchSize = 30) {
  const unusedCount = await countUnusedTopics();
  if (unusedCount >= minUnused) return; // bank is healthy, nothing to do

  const known = await getAllKnownTopics();
  const newTopics = await generateNewTopics(known, batchSize);

  // Build a normalised set of everything we already know
  const knownNorm = new Set(known.map(normalise));

  for (const item of newTopics) {
    const norm = normalise(item.topic);

    // Skip if too similar to anything known
    const isDuplicate =
      knownNorm.has(norm) ||
      [...knownNorm].some((k) => similarity(item.topic, k) >= 0.55);

    if (isDuplicate) continue;

    try {
      await sql`
        insert into topic_bank (topic, category)
        values (${item.topic}, ${item.category})
        on conflict (topic) do nothing
      `;
      knownNorm.add(norm); // prevent within-batch duplicates
    } catch {
      // ignore unique-constraint violations
    }
  }
}

// ---------------------------------------------------------------------------
// Topic selection
// ---------------------------------------------------------------------------

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

async function getRecentTitles(): Promise<string[]> {
  const rows = await sql`
    select title, primary_keyword
    from posts
    order by created_at desc
    limit 60
  `;
  return rows
    .flatMap((r: any) => [String(r.title || ''), String(r.primary_keyword || '')])
    .filter(Boolean);
}

async function chooseDailyTopic(options?: {
  topic?: string;
  category?: string;
}): Promise<DraftTopic> {
  // Manual override
  if (options?.topic) {
    return {
      topic: options.topic,
      category: (options.category as Category) || 'Beginner Guide',
    };
  }

  // Keep the bank topped up (no-op if already healthy)
  await expandTopicBank(15, 30);

  const recentTitles = await getRecentTitles();
  const unused = await loadUnusedTopics();

  // Primary: pick from DB bank
  if (unused.length > 0) {
    const candidates = shuffle(unused);
    const fresh = candidates.find(
      (c) => !recentTitles.some((t) => similarity(c.topic, t) >= 0.45),
    );
    const chosen = fresh || candidates[0];
    await markTopicUsed(chosen.topic);
    return chosen;
  }

  // Fallback: use seed list (should rarely be reached after first expansion)
  const candidates = shuffle(SEED_TOPICS);
  return (
    candidates.find(
      (c) => !recentTitles.some((t) => similarity(c.topic, t) >= 0.45),
    ) || candidates[0]
  );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function safeJsonParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
}

async function makeUniqueSlug(baseSlug: string): Promise<string> {
  const clean =
    slugify(baseSlug || 'hustlepath-draft', { lower: true, strict: true }) ||
    'hustlepath-draft';

  let slug = clean;
  let counter = 2;

  while (true) {
    const existing = await sql`select id from posts where slug = ${slug} limit 1`;
    if (existing.length === 0) return slug;
    slug = `${clean}-${counter++}`;
  }
}

async function getInternalLinks(): Promise<InternalLink[]> {
  const rows = await sql`
    select title, slug, category, excerpt
    from posts
    where slug is not null
      and status = 'published'
      and body is not null
      and length(body) > 300
    order by published_at desc nulls last, created_at desc
    limit 12
  `;
  return rows.map((row: any) => ({
    title: String(row.title || ''),
    slug: String(row.slug || ''),
    category: String(row.category || ''),
    excerpt: String(row.excerpt || ''),
  }));
}

function internalLinksForPrompt(links: InternalLink[]): string {
  if (!links.length)
    return 'No published internal links exist yet. Do not include any /blog links.';
  return links
    .map(
      (post) =>
        `- Title: ${post.title}\n  URL: /blog/${post.slug}\n  Category: ${post.category || 'General'}\n  Context: ${post.excerpt || 'Related HustlePathDaily article'}`,
    )
    .join('\n');
}

function wordCount(text: string): number {
  return String(text || '')
    .split(/\s+/)
    .filter(Boolean).length;
}

function stripInventedInternalLinks(
  markdown: string,
  links: InternalLink[],
): string {
  const allowed = new Set(links.map((l) => `/blog/${l.slug}`));
  return String(markdown || '')
    .replace(/\[([^\]]+)\]\(#\)/g, '$1')
    .replace(/\[([^\]]+)\]\((\/blog\/[^)]+)\)/g, (match, label, url) =>
      allowed.has(url) ? match : String(label),
    )
    .replace(
      /\n-{3,}\n(?=\s*(Related Articles|Related Posts|Recommended Reading))/gi,
      '\n',
    );
}

// ---------------------------------------------------------------------------
// Article generation
// ---------------------------------------------------------------------------

async function generateArticleJson(
  topic: string,
  category: string,
  links: InternalLink[],
  recentTitles: string[] = [],
) {
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    temperature: 0.75,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are the senior SEO editor for HustlePathDaily.

Your job is to create a publish-ready article on the FIRST draft.

The article must be practical, beginner-friendly, specific, and structured well enough to score 85+ without needing a separate polish pass.

Return JSON only. No markdown outside the JSON.`,
      },
      {
        role: 'user',
        content: `Write a complete HustlePathDaily blog post about:

${topic}

Target category: ${category}

Do not reuse or closely copy any of these recent titles:
${recentTitles.map((t) => `- ${t}`).join('\n') || '- No recent titles yet'}

STRICT OUTPUT RULES:
Return valid JSON with exactly these keys:
title, slug, excerpt, body, category, seo_title, seo_description, primary_keyword, related_keywords, pinterest_meta, internal_links

CONTENT REQUIREMENTS:
- 1400 to 1900 words
- Beginner-friendly but not shallow
- No fake income promises
- No hype
- No generic filler
- Make the angle specific to the requested topic, not a repeated generic freelance article
- Short paragraphs
- Clear steps
- Practical examples
- Actionable advice

SEO REQUIREMENTS:
- Title must be 40 to 68 characters
- SEO title must be 40 to 68 characters
- SEO description must be 130 to 155 characters
- Primary keyword must appear naturally in:
  - title
  - excerpt
  - first 150 words
  - at least one H2
- Include 5 to 8 H2 sections
- Include at least 2 H3 sections
- Include at least 3 bullet lists
- Include a FAQ section with 4 questions
- Include a conclusion section
- Include one exact blockquote starting with: > **Pro tip:**
- Include one exact blockquote starting with: > **Quick win:**

INTERNAL LINKING:
${links.length ? 'Use 1 to 3 internal links naturally if relevant.' : 'Use zero internal links because no real published links exist yet.'}
Only use links from this list.
Never invent /blog URLs.
Never use placeholder links.
Never use [Title](#).
Do not add a "Related Articles" or "Related Posts" section inside the article body.
If no link from the list fits naturally, use no internal links.

REDBUBBLE PROMOTION:
If the topic naturally involves print-on-demand, Redbubble, digital art, product design, Canva designs, selling designs online, or creative side hustles, include ONE natural mention of the Redbubble shop.

Use this exact markdown format:
> **Creator resource:** You can also check out my Redbubble designs here: https://www.redbubble.com/people/InkWanderStudio/

Rules:
- Only include it when relevant.
- Do not force it into unrelated articles.
- Do not include it more than once.
- Place it after a helpful section, not at the very beginning.

AVAILABLE INTERNAL LINKS:
${internalLinksForPrompt(links)}

BODY FORMAT:
- body must be clean markdown
- use ## for H2 headings
- use ### for H3 headings
- use - for bullet lists
- links must use markdown format like [Article Title](/blog/slug)
- Do not use markdown horizontal dividers like --- anywhere in the article.
- Do not use markdown tables unless absolutely necessary.
- Prefer bullet lists or short comparison sections instead of tables.

CATEGORY:
Use this exact category unless it is clearly wrong: ${category}

RELATED KEYWORDS:
Return 5 to 8 related keyword strings.

PINTEREST_META:
Return an object with:
{
  "titles": ["3 Pinterest title options"],
  "descriptions": ["3 Pinterest descriptions"],
  "image_prompts": ["3 vertical pin image prompt ideas"]
}

INTERNAL_LINKS:
Return an array of objects only for links actually used in the body:
[
  { "title": "Exact existing title", "url": "/blog/exact-existing-slug" }
]`,
      },
    ],
  });

  return safeJsonParse(completion.choices[0].message.content || '{}');
}

async function lightPolishArticle(input: {
  title: string;
  excerpt: string;
  body: string;
  category: string;
  seoTitle: string;
  seoDescription: string;
  primaryKeyword: string;
  relatedKeywords: string[];
  internalLinks: InternalLink[];
}) {
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are an SEO editor.

Improve the article enough to pass an 85+ SEO score.
Do not change the topic.
Do not make fake claims.
Do not remove useful sections.
Return JSON only.`,
      },
      {
        role: 'user',
        content: `Fix this article so it scores 85+.

You must ensure:
- 1300+ words
- SEO description is 130 to 155 characters
- title is 40 to 68 characters
- SEO title is 40 to 68 characters
- primary keyword appears in title, excerpt, first paragraph, and at least one H2
- at least 5 H2 sections
- at least 2 H3 sections
- at least 3 bullet lists
- FAQ section with 4 questions
- conclusion section
- one > **Pro tip:** callout
- one > **Quick win:** callout

Internal links:
${input.internalLinks.length ? 'Use 1 to 3 links only if they fit naturally.' : 'Use zero internal links because no real published links exist yet.'}
Never invent /blog URLs.
Never use placeholder links.
Never use [Title](#).
Do not add a "Related Articles" or "Related Posts" section inside the article body.

REDBUBBLE PROMOTION:
If the topic naturally involves print-on-demand, Redbubble, digital art, product design, Canva designs, selling designs online, or creative side hustles, include ONE natural mention of the Redbubble shop.

Use this exact markdown format:
> **Creator resource:** You can also check out my Redbubble designs here: https://www.redbubble.com/people/InkWanderStudio/

Rules:
- Only include it when relevant.
- Do not force it into unrelated articles.
- Do not include it more than once.
- Place it after a helpful section, not at the very beginning.

Formatting rules:
- Do not use markdown tables unless absolutely necessary.
- Prefer bullet lists or short comparison sections instead of tables.
- Do not use markdown horizontal dividers like --- anywhere in the article.

Only use links from this list:
${internalLinksForPrompt(input.internalLinks)}

Return JSON with exactly these keys:
title, excerpt, body, category, seo_title, seo_description, primary_keyword, related_keywords, pinterest_meta, internal_links

Current article:
${JSON.stringify(
  {
    title: input.title,
    excerpt: input.excerpt,
    body: input.body,
    category: input.category,
    seo_title: input.seoTitle,
    seo_description: input.seoDescription,
    primary_keyword: input.primaryKeyword,
    related_keywords: input.relatedKeywords,
  },
  null,
  2,
)}`,
      },
    ],
  });

  return safeJsonParse(completion.choices[0].message.content || '{}');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateDailyDraft(options?: {
  topic?: string;
  category?: string;
  clusterId?: string;
  clusterRole?: 'pillar' | 'supporting';
}) {
  const chosen = await chooseDailyTopic(options);
  const topic = chosen.topic;
  const internalLinks = await getInternalLinks();
  const recentTitles = await getRecentTitles();

  let data = await generateArticleJson(
    topic,
    chosen.category,
    internalLinks,
    recentTitles,
  );

  let title = String(data.title || 'Untitled HustlePath Draft');
  let excerpt = String(data.excerpt || 'A practical beginner guide from HustlePathDaily.');
  let body = formatArticleMarkdown(
    stripInventedInternalLinks(String(data.body || ''), internalLinks),
  );
  let category = String(options?.category || data.category || chosen.category || 'Beginner Guide');
  let seoTitle = String(data.seo_title || title);
  let seoDescription = String(data.seo_description || excerpt);
  let primaryKeyword = String(data.primary_keyword || '');
  let relatedKeywords = Array.isArray(data.related_keywords) ? data.related_keywords : [];
  let pinterestMeta =
    data.pinterest_meta && typeof data.pinterest_meta === 'object' ? data.pinterest_meta : {};

  let seo = scorePost({ title, excerpt, body, seoTitle, seoDescription, primaryKeyword });
  let autoPolished = false;

  if (seo.score < 85 || wordCount(body) < 1200) {
    const polished = await lightPolishArticle({
      title,
      excerpt,
      body,
      category,
      seoTitle,
      seoDescription,
      primaryKeyword,
      relatedKeywords,
      internalLinks,
    });

    title = String(polished.title || title);
    excerpt = String(polished.excerpt || excerpt);
    body = formatArticleMarkdown(
      stripInventedInternalLinks(String(polished.body || body), internalLinks),
    );
    category = String(options?.category || polished.category || category);
    seoTitle = String(polished.seo_title || title);
    seoDescription = String(polished.seo_description || excerpt);
    primaryKeyword = String(polished.primary_keyword || primaryKeyword);
    relatedKeywords = Array.isArray(polished.related_keywords)
      ? polished.related_keywords
      : relatedKeywords;
    pinterestMeta =
      polished.pinterest_meta && typeof polished.pinterest_meta === 'object'
        ? polished.pinterest_meta
        : pinterestMeta;

    data = {
      ...data,
      ...polished,
      internal_links: polished.internal_links || data.internal_links || [],
    };

    seo = scorePost({ title, excerpt, body, seoTitle, seoDescription, primaryKeyword });
    autoPolished = true;
  }

  if (!body || wordCount(body) < 900) {
    throw new Error('Generated article body was empty or too short. Try generating again.');
  }

  const baseSlug = slugify(String(data.slug || title), { lower: true, strict: true });
  const slug = await makeUniqueSlug(baseSlug);
  const autoPublish = process.env.AUTO_PUBLISH_DAILY_DRAFTS === 'true' && seo.score >= 85;

  const [post] = await sql`
    insert into posts (
      title, slug, excerpt, body, category, status,
      seo_title, seo_description, primary_keyword, related_keywords,
      pinterest_meta, quality_score, risk_level, workflow_meta, cluster_id, cluster_role, published_at
    ) values (
      ${title},
      ${slug},
      ${excerpt},
      ${body},
      ${category},
      ${autoPublish ? 'published' : 'draft'},
      ${seoTitle},
      ${seoDescription},
      ${primaryKeyword},
      ${JSON.stringify(relatedKeywords)}::jsonb,
      ${JSON.stringify(pinterestMeta)}::jsonb,
      ${seo.score},
      ${seo.score >= 85 ? 'low' : seo.score >= 70 ? 'medium' : 'needs_work'},
      ${JSON.stringify({
        source: options?.clusterId ? 'cluster-generator' : 'daily-ai-cron',
        topic,
        seo_checks: seo.checks,
        internal_links: data.internal_links || [],
        auto_published: autoPublish,
        auto_polished: autoPolished,
        base_slug: baseSlug,
        final_slug: slug,
      })}::jsonb,
      ${options?.clusterId || null},
      ${options?.clusterRole || null},
      ${autoPublish ? new Date().toISOString() : null}
    ) returning id, status, quality_score
  `;

  return post;
}

/**
 * Manually trigger a topic bank expansion.
 * Useful from an admin route or scheduled job to pre-warm the bank.
 */
export async function refillTopicBank(batchSize = 40) {
  await expandTopicBank(0, batchSize);
}
