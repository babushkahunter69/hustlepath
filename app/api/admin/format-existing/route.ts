import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { formatArticleMarkdown } from '@/lib/articleFormat';
import { scorePost } from '@/lib/seo';

export async function POST() {
  const posts = await sql`
    select id, title, excerpt, body, seo_title, seo_description, primary_keyword
    from posts
    where body is not null
  `;

  for (const post of posts as any[]) {
    const body = formatArticleMarkdown(String(post.body || ''));
    const seo = scorePost({
      title: String(post.title || ''),
      excerpt: String(post.excerpt || ''),
      body,
      seoTitle: String(post.seo_title || post.title || ''),
      seoDescription: String(post.seo_description || post.excerpt || ''),
      primaryKeyword: String(post.primary_keyword || ''),
    });

    await sql`
      update posts
      set body = ${body},
          quality_score = ${seo.score},
          workflow_meta = coalesce(workflow_meta, '{}'::jsonb) || ${JSON.stringify({ formatted_at: new Date().toISOString(), seo_checks: seo.checks })}::jsonb,
          updated_at = now()
      where id = ${post.id}
    `;
  }

  redirect('/admin');
}
