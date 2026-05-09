import OpenAI from 'openai';
import slugify from 'slugify';
import { formatArticleMarkdown } from '@/lib/articleFormat';
import { scorePost } from '@/lib/seo';

type ExistingPost = {
  title?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  body?: string | null;
  category?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  primary_keyword?: string | null;
  related_keywords?: any;
};

function keywordList(value: any): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {}
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function ensureMetaDescription(text: string) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length >= 120 && cleaned.length <= 160) return cleaned;
  if (cleaned.length > 160) return cleaned.slice(0, 157).replace(/\s+\S*$/, '') + '...';
  return `${cleaned} Learn practical steps, simple examples, and beginner-friendly tips you can use today.`.slice(0, 160);
}

export async function polishArticle(post: ExistingPost, internalLinks: any[] = []) {
  const fallbackTitle = String(post.title || 'Untitled HustlePath guide').trim();
  const existing = {
    title: fallbackTitle,
    slug: String(post.slug || slugify(fallbackTitle, { lower: true, strict: true })),
    excerpt: String(post.excerpt || '').trim(),
    body: String(post.body || '').trim(),
    category: String(post.category || 'Beginner Guide').trim(),
    seo_title: String(post.seo_title || fallbackTitle).trim(),
    seo_description: String(post.seo_description || post.excerpt || '').trim(),
    primary_keyword: String(post.primary_keyword || '').trim(),
    related_keywords: keywordList(post.related_keywords),
  };

  if (!process.env.OPENAI_API_KEY) {
    const body = formatArticleMarkdown(existing.body);
    const seo = scorePost({
      title: existing.title,
      excerpt: existing.excerpt,
      body,
      seoTitle: existing.seo_title,
      seoDescription: ensureMetaDescription(existing.seo_description || existing.excerpt),
      primaryKeyword: existing.primary_keyword,
    });

    return {
      ...existing,
      slug: slugify(existing.slug || existing.title, { lower: true, strict: true }),
      body,
      seo_description: ensureMetaDescription(existing.seo_description || existing.excerpt || existing.title),
      quality_score: seo.score,
      seo_checks: seo.checks,
      polish_notes: 'Formatted locally because OPENAI_API_KEY is not configured.',
    };
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const linkContext = internalLinks
    .map((link: any) => `- ${link.title}: /blog/${link.slug}`)
    .join('\n');

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    messages: [
      {
        role: 'system',
        content: 'You are an editor for HustlePathDaily. Improve article drafts without hype, fake claims, income guarantees, or fluff. Return JSON only.',
      },
      {
        role: 'user',
        content: `Polish this draft so it is ready for a professional beginner-income blog.

Fix these targets:
- Title should be 35 to 70 characters.
- SEO title should be 35 to 70 characters.
- Meta description should be 120 to 160 characters.
- Body should be at least 900 words if possible.
- Use H2 sections, short paragraphs, polished bullet lists, examples, and clear next steps.
- Add at least one callout formatted exactly as: > **Pro tip:** ...
- Add at least one callout formatted exactly as: > **Quick win:** ...
- Use the primary keyword naturally in title, excerpt, and body when it fits.
- Add 2 to 4 internal links naturally if relevant from this list:
${linkContext || 'No internal links available yet.'}

Existing draft JSON:
${JSON.stringify(existing, null, 2)}

Return JSON with exactly these keys:
title, slug, excerpt, body, category, seo_title, seo_description, primary_keyword, related_keywords, polish_notes.

body must be clean markdown.`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const data = JSON.parse(completion.choices[0].message.content || '{}');
  const title = String(data.title || existing.title).trim();
  const body = formatArticleMarkdown(String(data.body || existing.body));
  const excerpt = String(data.excerpt || existing.excerpt).trim();
  const seoTitle = String(data.seo_title || title).trim();
  const seoDescription = ensureMetaDescription(String(data.seo_description || excerpt || existing.seo_description));
  const primaryKeyword = String(data.primary_keyword || existing.primary_keyword).trim();
  const seo = scorePost({ title, excerpt, body, seoTitle, seoDescription, primaryKeyword });

  return {
    title,
    slug: slugify(String(data.slug || title), { lower: true, strict: true }),
    excerpt,
    body,
    category: String(data.category || existing.category || 'Beginner Guide').trim(),
    seo_title: seoTitle,
    seo_description: seoDescription,
    primary_keyword: primaryKeyword,
    related_keywords: Array.isArray(data.related_keywords) ? data.related_keywords : existing.related_keywords,
    quality_score: seo.score,
    seo_checks: seo.checks,
    polish_notes: String(data.polish_notes || 'Polished with AI.'),
  };
}
