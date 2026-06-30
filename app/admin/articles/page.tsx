import Link from 'next/link';
import { sql } from '@/lib/db';
import AdminNav from '../AdminNav';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ArticlesPage() {
  let stats = { drafts: 0, review: 0, approved: 0, published: 0 };
  let error = '';

  try {
    const rows = await sql`
      select coalesce(status, 'draft') as status, count(*)::int as count
      from posts
      group by coalesce(status, 'draft')
    `;

    stats = rows.reduce((acc: any, row: any) => {
      if (row.status === 'published') acc.published = row.count;
      else if (row.status === 'approved') acc.approved = row.count;
      else if (row.status === 'needs_review') acc.review = row.count;
      else acc.drafts += row.count;
      return acc;
    }, { drafts: 0, review: 0, approved: 0, published: 0 });
  } catch (err: any) {
    error = err.message || 'Unable to load article workflow.';
  }

  return (
    <main className="admin-shell">
      <section className="admin-panel wide">
        <div className="admin-row">
          <div>
            <div className="admin-topline">Articles</div>
            <h1>Article workflow</h1>
            <p className="admin-muted">
              Review draft progress, open published posts, and manage article-related Pinterest content from one place.
            </p>
          </div>
        </div>

        <AdminNav current="articles" />

        {error && <div className="notice">{error}</div>}

        <div className="stat-grid four">
          <div className="stat-card"><span>{stats.drafts}</span><p>Drafts</p></div>
          <div className="stat-card"><span>{stats.review}</span><p>Needs review</p></div>
          <div className="stat-card"><span>{stats.approved}</span><p>Approved</p></div>
          <div className="stat-card"><span>{stats.published}</span><p>Published</p></div>
        </div>

        <div className="admin-actions">
          <Link href="/admin/drafts" className="primary-link">Open Draft Queue</Link>
          <Link href="/admin/published" className="secondary-link">View Published Posts</Link>
          <Link href="/admin/pins" className="secondary-link">Article Pinterest Drafts</Link>
        </div>
      </section>
    </main>
  );
}
