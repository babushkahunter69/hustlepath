import OpenAI from 'openai';
import slugify from 'slugify';
import { sql } from '@/lib/db';
import { scorePost } from '@/lib/seo';
import { formatArticleMarkdown } from '@/lib/articleFormat';
import { getInternalLinkCandidates, internalLinksForPrompt } from '@/lib/internalLinks';
import { getTodaysClusterSeed } from '@/lib/contentClusters';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type GenerateDraftInput = {
  topic?: string;
  category?: string;
  niche?: string;
  clusterId?: string;
  clusterRole?: 'pillar' | 'supporting';
  source?: string;
};

const fallbackTopics = [
  'how to make your first online income with one beginner-friendly service',
  'Pinterest blog traffic plan for a new beginner income blog',
  'best free tools for starting a small online income project',
  'side hustles beginners can start with no audience and no budget',
  'how to turn one skill into a simple freelance offer',
  'weekly plan for publishing helpful beginner blog content',
];

async function makeUniqueSlug(baseSlug: string) {
  const cleanBaseSlug =
    slugify(baseSlug || 'hustlepath-draft', {
      lower: true,
      strict: true,
    }) || 'hustlepath-draft';

  let slug = cleanBaseSlug;
  let counter = 2;

  while (true) {
    const existing = await sql`
      select id
      from posts
      where slug = ${slug}
      limit 1
    `;

    if (existing.length === 0) return slug;

    slug = `${cleanBaseSlug}-${counter}`;
    counter++;
  }
}

function parseJson(content: string | null | undefined) {
  try {
    return JSON.parse(content || '{}');
  } catch {
    return {};
  }
}

export async function generateDailyDraft(input: GenerateDraftInput = {}) {
  const seed = getTodaysClusterSeed();
  const topic = input.topic || fallbackTopics[new Date().getUTCDate() % fallbackTopics.length];
  const category = input.category || seed.category || 'Beginner Guide';
  const niche = input.niche || seed.niche || 'beginner online income';

  const linkCandidates = await getInternalLinkCandidates({
    topic: `${topic} ${niche}`,
    category,
    limit: 5,
  });

  const internalLinks = internalLinksForPrompt(linkCandidates);

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    messages: [
      {
        role: 'system',
        content: `
You are the senior editor for HustlePathDaily.

Your job is to create practical, beginner-friendly articles that can pass an SEO quality gate without manual polishing.

Hard rules:
- Return valid JSON only.
- Do not include markdown fences around JSON.
- Do not make income guarantees.
- Do not use hype phrases like "get rich", "passive income overnight", or "easy money".
- Write for beginners who want realistic online income steps.
- The article must feel written by a helpful editor, not a generic AI tool.

SEO quality gate you must satisfy:
- title: 35 to 70 characters
- seo_title: 35 to 70 characters
- seo_description: 120 to 160 characters
- excerpt: 140 to 220 characters
- body: 1300 to 1800 words
- primary keyword appears in the title, intro, one H2, and conclusion
- include 5 to 8 H2 sections
- include at least 2 H3 sections
- include at least 4 bullet lists
- include 1 numbered step list
- include one FAQ section with 3 questions
- include one blockquote formatted as: > **Pro tip:** ...
- include one blockquote formatted as: > **Quick win:** ...
- include 2 to 4 internal links from the provided list only
- include Pinterest metadata for distribution

Formatting rules:
- Use clean markdown.
- Start body with a short intro paragraph, not an H1.
- Use ## for main sections and ### for subsections.
- Keep paragraphs short, usually 2 to 4 sentences.
- Use natural anchor text for internal links.
`,
      },
      {
        role: 'user',
        content: `Create a complete HustlePathDaily article.

Topic: ${topic}
Niche: ${niche}
Category: ${category}
Cluster role: ${input.clusterRole || 'standalone'}

Available internal links:
${internalLinks}

Return JSON with exactly these keys:
title, slug, excerpt, body, category, seo_title, seo_description, primary_keyword, related_keywords, internal_links, pinterest_titles, pinterest_descriptions, pinterest_image_prompts.

Key requirements:
- related_keywords must be an array of 6 to 10 keyword variations.
- internal_links must be an array of objects with title, url, and anchor_text.
- pinterest_titles must be an array of 3 click-friendly Pinterest titles.
- pinterest_descriptions must be an array of 3 Pinterest descriptions, each 250 to 450 characters.
- pinterest_image_prompts must be an array of 3 simple vertical image concepts for Canva or AI image tools.
- If no internal links are available, return an empty internal_links array and do not invent URLs.
`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const data = parseJson(completion.choices[0].message.content);

  const title = String(data.title || 'Untitled HustlePath Draft');

  const baseSlug = slugify(String(data.slug || title), {
    lower: true,
    strict: true,
  });

  const slug = await makeUniqueSlug(baseSlug);

  const excerpt = String(
    data.excerpt || 'A practical beginner guide from HustlePathDaily.'
  );

  const body = formatArticleMarkdown(String(data.body || ''));
  const seoTitle = String(data.seo_title || title);
  const seoDescription = String(data.seo_description || excerpt);
  const primaryKeyword = String(data.primary_keyword || '');

  const seo = scorePost({
    title,
    excerpt,
    body,
    seoTitle,
    seoDescription,
    primaryKeyword,
  });

  const autoPublish =
    process.env.AUTO_PUBLISH_DAILY_DRAFTS === 'true' && seo.score >= 85;

  const [post] = await sql`
    insert into posts (
      title, slug, excerpt, body, category, status,
      seo_title, seo_description, primary_keyword, related_keywords,
      quality_score, risk_level, workflow_meta, pinterest_meta,
      cluster_id, cluster_role, published_at
    ) values (
      ${title},
      ${slug},
      ${excerpt},
      ${body},
      ${String(data.category || category)},
      ${autoPublish ? 'published' : 'draft'},
      ${seoTitle},
      ${seoDescription},
      ${primaryKeyword},
      ${JSON.stringify(data.related_keywords || [])}::jsonb,
      ${seo.score},
      ${seo.score >= 85 ? 'low' : seo.score >= 70 ? 'medium' : 'needs_work'},
      ${JSON.stringify({
        source: input.source || 'daily-ai-cron',
        niche,
        seo_checks: seo.checks,
        internal_links: data.internal_links || [],
        internal_link_candidates: linkCandidates,
        auto_published: autoPublish,
        base_slug: baseSlug,
        final_slug: slug,
      })}::jsonb,
      ${JSON.stringify({
        titles: data.pinterest_titles || [],
        descriptions: data.pinterest_descriptions || [],
        image_prompts: data.pinterest_image_prompts || [],
      })}::jsonb,
      ${input.clusterId || null},
      ${input.clusterRole || null},
      ${autoPublish ? new Date().toISOString() : null}
    ) returning id, status, quality_score
  `;

  return post;
}
