import OpenAI from 'openai';
import slugify from 'slugify';
import { sql } from '@/lib/db';
import { scorePost } from '@/lib/seo';
import { formatArticleMarkdown } from '@/lib/articleFormat';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const topics = [
  'how to make your first online income with one beginner-friendly service',
  'Pinterest blog traffic plan for a new beginner income blog',
  'best free tools for starting a small online income project',
  'side hustles beginners can start with no audience and no budget',
  'how to turn one skill into a simple freelance offer',
  'weekly plan for publishing helpful beginner blog content',
];

export async function generateDailyDraft() {
  const topic = topics[new Date().getUTCDate() % topics.length];
  const existing = await sql`
    select title, slug, category, excerpt
    from posts
    where slug is not null
    order by created_at desc
    limit 12
  `;

  const internalLinks = existing
    .map((post: any) => `- ${post.title}: /blog/${post.slug}`)
    .join('\n');

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    messages: [
      {
        role: 'system',
        content: 'You write practical HustlePathDaily articles. Be realistic, specific, beginner-friendly, and avoid income guarantees. Return JSON only.',
      },
      {
        role: 'user',
        content: `Write a complete blog draft about: ${topic}.

Requirements:
- 1000 to 1400 words
- Use short sections with clear H2 and H3 headings
- Use polished bullet lists for steps, examples, qualities, checks, and tool lists
- Include one blockquote callout formatted exactly like: > **Pro tip:** practical tip here
- Include one blockquote callout formatted exactly like: > **Quick win:** action step here
- Use bold text sparingly for important phrases
- Practical examples
- No hype, no guaranteed income claims
- Include 3 to 5 natural internal links if relevant from this list:
${internalLinks || 'No existing links yet.'}

Return JSON with exactly these keys:
title, slug, excerpt, body, category, seo_title, seo_description, primary_keyword, related_keywords, internal_links.

body should be clean markdown with bullet lists, blockquote callouts, and scannable sections. internal_links should be an array of objects with title and url.`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const data = JSON.parse(completion.choices[0].message.content || '{}');
  const title = String(data.title || 'Untitled HustlePath Draft');
  const slug = slugify(String(data.slug || title), { lower: true, strict: true });
  const excerpt = String(data.excerpt || 'A practical beginner guide from HustlePathDaily.');
  const body = formatArticleMarkdown(String(data.body || ''));
  const seoTitle = String(data.seo_title || title);
  const seoDescription = String(data.seo_description || excerpt);
  const primaryKeyword = String(data.primary_keyword || '');
  const seo = scorePost({ title, excerpt, body, seoTitle, seoDescription, primaryKeyword });
  const autoPublish = process.env.AUTO_PUBLISH_DAILY_DRAFTS === 'true' && seo.score >= 85;

  const [post] = await sql`
    insert into posts (
      title, slug, excerpt, body, category, status,
      seo_title, seo_description, primary_keyword, related_keywords,
      quality_score, risk_level, workflow_meta, published_at
    ) values (
      ${title},
      ${slug},
      ${excerpt},
      ${body},
      ${String(data.category || 'Beginner Guide')},
      ${autoPublish ? 'published' : 'draft'},
      ${seoTitle},
      ${seoDescription},
      ${primaryKeyword},
      ${JSON.stringify(data.related_keywords || [])}::jsonb,
      ${seo.score},
      ${seo.score >= 85 ? 'low' : seo.score >= 65 ? 'medium' : 'needs_work'},
      ${JSON.stringify({
        source: 'daily-ai-cron',
        seo_checks: seo.checks,
        internal_links: data.internal_links || [],
        auto_published: autoPublish,
      })}::jsonb,
      ${autoPublish ? new Date().toISOString() : null}
    ) returning id, status, quality_score
  `;

  return post;
}
