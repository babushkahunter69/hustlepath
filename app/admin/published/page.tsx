import { sql } from '@/lib/db';
import Link from 'next/link';

export default async function PublishedPage() {
  let posts: any[] = [];
  let error = '';

  try {
    posts = await sql`
      select id, title, slug, published_at, created_at, pinterest_meta
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

        {!error && posts.length === 0 && (
          <div className="empty-state">No published posts yet.</div>
        )}

        <div className="draft-list">
          {posts.map((post) => (
            <div key={post.id} className="draft-item">
              <div>
                <h2>{post.title || 'Untitled post'}</h2>
                <p>
                  {Array.isArray(post.pinterest_meta?.pins) ? `${post.pinterest_meta.pins.length} pins · ` : ''}
                  Published{' '}
                  {post.published_at
                    ? new Date(post.published_at).toLocaleString()
                    : 'recently'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <Link href={`/admin/drafts/${post.id}`} className="secondary-link small">
                  Edit / pins
                </Link>
                <Link href={`/blog/${post.slug}`} className="secondary-link small">
                  View
                </Link>
                <form action={`/api/admin/delete-post/${post.id}`} method="POST">
                  <button
                    type="submit"
                    className="secondary-link small"
                    style={{ color: '#dc2626' }}
                  >
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
