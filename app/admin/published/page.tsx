import { sql } from '@/lib/db';
import Link from 'next/link';

export default async function PublishedPage() {
  let posts: any[] = [];
  let error = '';

  try {
    posts = await sql`
      select id, title, slug, published_at, created_at
      from posts
      where status = 'published'
      order by published_at desc nulls last, created_at desc
    `;
  } catch (err: any) {
    error = err.message || 'Unable to load published posts.';
  }

  return (
    <main className="admin-shell">
      <section className="admin-panel wide">
        <div className="admin-row">
          <div>
            <div className="admin-topline">Editorial</div>
            <h1>Published Posts</h1>
          </div>
          <Link href="/admin" className="secondary-link small">Dashboard</Link>
        </div>

        {error && <div className="notice">Database not ready: {error}</div>}

        <div className="draft-list">
          {posts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`} className="draft-item">
              <div>
                <h2>{post.title || 'Untitled post'}</h2>
                <p>Published {post.published_at ? new Date(post.published_at).toLocaleString() : 'recently'}</p>
              </div>
              <span>view</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
