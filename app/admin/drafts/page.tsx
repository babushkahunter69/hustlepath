import { sql } from '@/lib/db';
import Link from 'next/link';

export default async function Drafts() {
  let drafts: any[] = [];
  let error = '';

  try {
    drafts = await sql`
      select id, title, status, created_at, updated_at, quality_score, risk_level, category
      from posts
      where coalesce(status, 'draft') != 'published'
      order by updated_at desc nulls last, created_at desc
    `;
  } catch (err: any) {
    error = err.message || 'Unable to load drafts.';
  }

  return (
    <main className="admin-shell">
      <section className="admin-panel wide">
        <div className="admin-row">
          <div>
            <div className="admin-topline">Editorial</div>
            <h1>Draft Queue</h1>
            <p className="admin-muted">Review generated drafts, improve SEO, approve, and publish.</p>
          </div>
          <div className="admin-actions compact">
            <form action="/api/admin/generate-draft" method="POST">
              <button className="primary-link" type="submit">Generate draft</button>
            </form>
            <Link href="/admin" className="secondary-link small">Dashboard</Link>
          </div>
        </div>

        {error && <div className="notice">Database not ready: {error}</div>}

        {!error && drafts.length === 0 && (
          <div className="empty-state">No drafts yet. Generate a new draft to start.</div>
        )}

        <div className="draft-list">
          {drafts.map((draft) => (
            <Link key={draft.id} href={`/admin/drafts/${draft.id}`} className="draft-item">
              <div>
                <h2>{draft.title || 'Untitled draft'}</h2>
                <p>{draft.category || 'Guide'} · SEO {draft.quality_score ?? 'not scored'} · Updated {draft.updated_at ? new Date(draft.updated_at).toLocaleString() : 'recently'}</p>
              </div>
              <span>{draft.status || 'draft'}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
