import Link from 'next/link';
import { sql } from '@/lib/db';

export default async function Admin() {
  let stats = { drafts: 0, review: 0, published: 0 };

  try {
    const rows = await sql`
      select status, count(*)::int as count
      from posts
      group by status
    `;

    stats = rows.reduce((acc: any, row: any) => {
      if (row.status === 'published') acc.published = row.count;
      else if (row.status === 'needs_review') acc.review = row.count;
      else acc.drafts += row.count;
      return acc;
    }, stats);
  } catch {
    // Keep admin page usable even before DATABASE_URL/schema is configured.
  }

  return (
    <main className="admin-shell">
      <section className="admin-panel">
        <div className="admin-topline">Admin Dashboard</div>
        <h1>HustlePathDaily</h1>
        <p className="admin-muted">Create, review, approve, and publish AI-assisted blog drafts.</p>

        <div className="stat-grid">
          <div className="stat-card"><span>{stats.drafts}</span><p>Drafts</p></div>
          <div className="stat-card"><span>{stats.review}</span><p>Needs review</p></div>
          <div className="stat-card"><span>{stats.published}</span><p>Published</p></div>
        </div>

        <div className="admin-actions">
          <form action="/api/admin/generate-draft" method="POST">
            <button className="primary-link" type="submit">Generate draft now</button>
          </form>
          <Link href="/admin/drafts" className="secondary-link">Open draft queue</Link>
          <Link href="/admin/published" className="secondary-link">View published posts</Link>
        </div>
      </section>
    </main>
  );
}
