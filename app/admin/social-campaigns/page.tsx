import Link from 'next/link';
import { sql } from '@/lib/db';
import AdminNav from '../AdminNav';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function cleanText(value: unknown, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

function pinsFor(design: any) {
  const meta = design?.pinterest_meta && typeof design.pinterest_meta === 'object' ? design.pinterest_meta : {};
  return Array.isArray(meta.pins) ? meta.pins : [];
}

export default async function SocialCampaignsPage() {
  let designs: any[] = [];
  let error = '';

  try {
    designs = await sql`
      select id, title, niche, product_type, redbubble_url, product_url, pinterest_meta, updated_at, created_at
      from design_library
      where coalesce(status, 'active') = 'active'
      order by updated_at desc nulls last, created_at desc
    `;
  } catch (err: any) {
    error = err.message || 'Unable to load campaign drafts.';
  }

  const drafted = designs
    .map((design) => ({ ...design, pins: pinsFor(design) }))
    .filter((design) => design.pins.length > 0);

  return (
    <main className="admin-shell">
      <section className="admin-panel wide">
        <div className="admin-row">
          <div>
            <div className="admin-topline">Social Campaigns</div>
            <h1>Campaign drafts</h1>
            <p className="admin-muted">
              Review the designs that already have generated marketing drafts. Create new Pinterest assets from the Design Library, then return here to review campaign-ready records.
            </p>
          </div>
        </div>

        <AdminNav current="social-campaigns" />

        {error && <div className="notice">{error}</div>}

        <div className="stat-grid three">
          <div className="stat-card"><span>{drafted.length}</span><p>Designs with drafts</p></div>
          <div className="stat-card"><span>{drafted.reduce((sum, design) => sum + design.pins.length, 0)}</span><p>Pinterest drafts</p></div>
          <div className="stat-card"><span>{designs.length}</span><p>Total designs</p></div>
        </div>

        <div className="admin-actions">
          <Link href="/admin/design-library#import-designs" className="secondary-link">Import CSV</Link>
          <Link href="/admin/design-library#design-records" className="primary-link">Generate Pinterest Pins</Link>
          <Link href="/admin/design-library#design-records" className="secondary-link">View Drafts</Link>
        </div>

        {drafted.length === 0 ? (
          <div className="empty-state">No campaign drafts yet. Import your Redbubble products using CSV, then generate marketing assets from the Design Library.</div>
        ) : (
          <div className="pin-workflow-list">
            {drafted.map((design) => (
              <article key={design.id} className="pin-workflow-post">
                <div className="pin-workflow-post-head">
                  <div>
                    <p className="eyebrow">{cleanText(design.niche, 'design')}</p>
                    <h2>{design.title}</h2>
                    <p className="admin-muted">{design.pins.length} Pinterest draft{design.pins.length === 1 ? '' : 's'} · {cleanText(design.product_type, 'Product')}</p>
                  </div>
                  <div className="pin-workflow-actions">
                    <Link href="/admin/design-library" className="secondary-link small">View in Design Library</Link>
                    {(design.product_url || design.redbubble_url) && (
                      <Link href={design.product_url || design.redbubble_url} target="_blank" className="secondary-link small">Open link</Link>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
