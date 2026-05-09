import { sql } from '@/lib/db';
import { redirect } from 'next/navigation';
import { scorePost } from '@/lib/seo';

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const [post] = await sql`select * from posts where id = ${id}`;
  if (!post) redirect('/admin/drafts');

  const seo = scorePost({
    title: post.title,
    excerpt: post.excerpt,
    body: post.body,
    seoTitle: post.seo_title,
    seoDescription: post.seo_description,
    primaryKeyword: post.primary_keyword,
  });

  await sql`
    update posts
    set status = 'published',
        published_at = coalesce(published_at, now()),
        quality_score = ${seo.score},
        risk_level = ${seo.score >= 85 ? 'low' : seo.score >= 65 ? 'medium' : 'needs_work'},
        workflow_meta = coalesce(workflow_meta, '{}'::jsonb) || ${JSON.stringify({ seo_checks: seo.checks, manually_published: true })}::jsonb,
        updated_at = now()
    where id = ${id}
  `;

  redirect('/admin/published');
}
