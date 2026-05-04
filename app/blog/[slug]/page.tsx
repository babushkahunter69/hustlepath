import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import { remark } from 'remark';
import html from 'remark-html';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function markdownToHtml(markdown: string) {
  const result = await remark().use(html).process(markdown || '');
  return result.toString();
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [post] = await sql`
    select *
    from posts
    where slug = ${slug}
    and status = 'published'
    limit 1
  `;

  if (!post) notFound();

  const content = await markdownToHtml(post.body || '');

  return (
    <main className="page-shell">
      <article className="article-shell">
        <p className="eyebrow">{post.category || 'Guide'}</p>
        <h1 className="article-title">{post.title}</h1>
        <p className="article-excerpt">{post.excerpt}</p>

        <div className="article-meta">
          <span>
            {post.published_at
              ? new Date(post.published_at).toISOString().slice(0, 10)
              : new Date(post.created_at).toISOString().slice(0, 10)}
          </span>
        </div>

        <div
          className="prose"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </article>
    </main>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [post] = await sql`
    select title, excerpt, seo_title, seo_description
    from posts
    where slug = ${slug}
    and status = 'published'
    limit 1
  `;

  if (!post) return {};

  return {
    title: post.seo_title || post.title,
    description: post.seo_description || post.excerpt,
  };
}