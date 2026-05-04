import { sql } from '@/lib/db';
import { redirect } from 'next/navigation';
import slugify from 'slugify';
import { scorePost } from '@/lib/seo';
import { formatArticleMarkdown } from '@/lib/articleFormat';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const form = await req.formData();
  const title = String(form.get('title') || '').trim();
  const body = formatArticleMarkdown(String(form.get('body') || '').trim());
  const excerpt = String(form.get('excerpt') || '').trim();
  const rawSlug = String(form.get('slug') || title).trim();
  const slug = slugify(rawSlug || title || id, { lower: true, strict: true });
  const category = String(form.get('category') || 'Beginner Guide').trim();
  const seoTitle = String(form.get('seo_title') || title).trim();
  const seoDescription = String(form.get('seo_description') || excerpt).trim();
  const primaryKeyword = String(form.get('primary_keyword') || '').trim();
  const relatedKeywords = String(form.get('related_keywords') || '')
    .split(',')
    .map((keyword) => keyword.trim())
    .filter(Boolean);
  const reviewNotes = String(form.get('review_notes') || '').trim();
  const seo = scorePost({ title, excerpt, body, seoTitle, seoDescription, primaryKeyword });

  await sql`
    update posts
    set title = ${title},
        slug = ${slug},
        excerpt = ${excerpt},
        body = ${body},
        category = ${category},
        seo_title = ${seoTitle},
        seo_description = ${seoDescription},
        primary_keyword = ${primaryKeyword},
        related_keywords = ${JSON.stringify(relatedKeywords)}::jsonb,
        review_notes = ${reviewNotes},
        quality_score = ${seo.score},
        risk_level = ${seo.score >= 85 ? 'low' : seo.score >= 65 ? 'medium' : 'needs_work'},
        workflow_meta = coalesce(workflow_meta, '{}'::jsonb) || ${JSON.stringify({ seo_checks: seo.checks })}::jsonb,
        status = case when status = 'published' then 'published' else 'needs_review' end,
        updated_at = now()
    where id = ${id}
  `;

  redirect(`/admin/drafts/${id}`);
}
