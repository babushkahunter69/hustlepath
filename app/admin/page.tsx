import Link from 'next/link';
import { sql } from '@/lib/db';

async function generateDraftAction() {
  'use server';

  const { generateDailyDraft } = await import('@/lib/aiDraft');
  const post = await generateDailyDraft();

  const { redirect } = await import('next/navigation');
  redirect(`/admin/drafts/${post.id}`);
}

export default async function Admin() {
  let stats = { drafts: 0, review: 0, approved: 0, published: 0 };
  let recent: any[] = [];

  try {
    const rows = await sql`
      select status, count(*)::int as count
      from posts
      group by status
    `;

    stats = rows.reduce((acc: any, row: any) => {
      if (row.status === 'published') acc.published = row.count;
      else if (row.status === 'approved') acc.approved = row.count;
      else if (row.status === 'needs_review') acc.review = row.count;
      else acc.drafts += row.count;
      return acc;
    }, stats);

    recent = await sql`
      select id, title, status, quality_score, updated_at, created_at
      from posts
      where status != 'published'
      order by updated_at desc nulls last, created_at desc
      limit 5
    `;
  } catch {
    // Keep admin page usable even before DATABASE_URL/schema is configured.
  }

  return (
    <main className="admin-shell">
      <section className="admin-panel wide">
        <div className="admin-row">
          <div>
            <div className="admin-topline">Admin Dashboard</div>
            <h1>Editorial command center</h1>
            <p className="admin-muted">
              Generate drafts, review SEO, approve posts, and publish HustlePathDaily articles.
            </p>
          </div>

          <div className="admin-actions compact">
            <form action="/api/admin/logout" method="POST">
              <button className="secondary-link" type="submit">Logout</button>
            </form>

            <form action="/api/admin/format-existing" method="POST">
              <button className="secondary-link" type="submit">Format existing posts</button>
            </form>

            <form action={generateDraftAction}>
              <button className="primary-link" type="submit">Generate draft now</button>
            </form>
          </div>
        </div>

        <div className="stat-grid four">
          <div className="stat-card"><span>{stats.drafts}</span><p>Drafts</p></div>
          <div className="stat-card"><span>{stats.review}</span><p>Needs review</p></div>
          <div className="stat-card"><span>{stats.approved}</span><p>Approved</p></div>
          <div className="stat-card"><span>{stats.published}</span><p>Published</p></div>
        </div>

        <div className="admin-actions">
          <Link href="/admin/drafts" className="primary-link">Open draft queue</Link>
          <Link href="/admin/published" className="secondary-link">View published posts</Link>
          <Link href="/blog" className="secondary-link">View public blog</Link>
        </div>

        <div className="admin-section">
          <h2>Recent drafts</h2>
          <div className="draft-list">
            {recent.length === 0 && (
              <div className="empty-state">
                No drafts yet. Generate one to start the editorial flow.
              </div>
            )}

            {recent.map((post) => (
              <Link key={post.id} href={`/admin/drafts/${post.id}`} className="draft-item">
                <div>
                  <h2>{post.title || 'Untitled draft'}</h2>
                  <p>SEO score {post.quality_score ?? 'not scored'} · {post.status}</p>
                </div>
                <span>edit</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}