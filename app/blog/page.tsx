import Link from 'next/link';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function BlogPage() {
  const posts = await sql`
    select title, slug, excerpt, category, published_at, created_at
    from posts
    where status = 'published'
    order by published_at desc nulls last, created_at desc
  `;

  return (
    <main className="page-shell">
      <section className="section-container">
        <p className="eyebrow">All Guides</p>
        <h1 className="page-title">Blog</h1>

        <div className="post-grid">
          {posts.map((post: any) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="post-card flat">
              <div className="post-card-body">
                <p className="post-card-category">{post.category || 'Guide'}</p>
                <h3>{post.title}</h3>
                <p>{post.excerpt}</p>
                <span>
                  {post.published_at
                    ? new Date(post.published_at).toISOString().slice(0, 10)
                    : new Date(post.created_at).toISOString().slice(0, 10)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}