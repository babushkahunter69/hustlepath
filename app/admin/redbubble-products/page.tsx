import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { parseCsvRows } from '@/lib/designLibrary';
import {
  ensureRedbubbleProductsTable,
  importRedbubbleProductsCsv,
  nicheOptions,
  productTypeOptions,
  syncReadyProductsToPinterest,
} from '@/lib/redbubbleProducts';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function cleanText(value: unknown, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

function titleCase(value: string) {
  return cleanText(value).replace(/\w\S*/g, (word) => (
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ));
}

function flashRedirect(message: string) {
  redirect(`/admin/redbubble-products?notice=${encodeURIComponent(message)}`);
}

async function readCsvInput(formData: FormData) {
  let csv = cleanText(formData.get('csv_data'));
  const csvFile = formData.get('csv_file');

  if (!csv && csvFile instanceof File && csvFile.size > 0) {
    csv = cleanText(await csvFile.text());
  }

  return csv;
}

async function importCsvAction(formData: FormData) {
  'use server';

  await ensureRedbubbleProductsTable();
  const csv = await readCsvInput(formData);
  if (!csv) flashRedirect('Paste CSV data from Google Sheets or upload a CSV file first.');

  const rows = parseCsvRows(csv);
  if (!rows.length) flashRedirect('No CSV rows were found to import.');

  const result = await importRedbubbleProductsCsv(csv);
  const suffix = result.rejectedReasons.length
    ? ` First rejected: ${result.rejectedReasons.join(' | ')}`
    : '';

  flashRedirect(
    `Imported ${result.imported}. Skipped ${result.skipped}. Rejected ${result.rejected}.${suffix}`
  );
}

async function generatePinsAction(formData: FormData) {
  'use server';

  const niche = cleanText(formData.get('niche'));
  const productType = cleanText(formData.get('product_type'));
  const result = await syncReadyProductsToPinterest({ niche, productType });

  flashRedirect(`Generated Pinterest pin drafts for ${result.synced} Ready Redbubble products.`);
}

function statusTone(status: string) {
  if (status === 'ready') return { background: '#dcfce7', color: '#14532d', border: '1px solid #86efac' };
  if (status === 'missing_image') return { background: '#fef3c7', color: '#78350f', border: '1px solid #facc15' };
  return { background: '#fee2e2', color: '#7f1d1d', border: '1px solid #fca5a5' };
}

export default async function RedbubbleProductsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    notice?: string;
    q?: string;
    status?: string;
    product_type?: string;
    niche?: string;
  }>;
}) {
  const params = searchParams ? await searchParams : {};
  let rows: any[] = [];
  let error = '';

  try {
    await ensureRedbubbleProductsTable();
    rows = await sql`
      select *
      from redbubble_products
      order by updated_at desc nulls last, created_at desc
    `;
  } catch (err: any) {
    error = err.message || 'Unable to load Redbubble products.';
  }

  const query = cleanText(params.q).toLowerCase();
  const status = cleanText(params.status).toLowerCase();
  const productType = cleanText(params.product_type).toLowerCase();
  const niche = cleanText(params.niche).toLowerCase();

  const filteredRows = rows.filter((row) => {
    const haystack = [
      row.title,
      row.redbubble_url,
      row.image_url,
      row.product_type,
      row.niche,
      ...(Array.isArray(row.tags) ? row.tags : []),
    ].join(' ').toLowerCase();

    if (query && !haystack.includes(query)) return false;
    if (status && cleanText(row.status).toLowerCase() !== status) return false;
    if (productType && cleanText(row.product_type).toLowerCase() !== productType) return false;
    if (niche && cleanText(row.niche).toLowerCase() !== niche) return false;
    return true;
  });

  const totals = rows.reduce((acc, row) => {
    acc.total += 1;
    if (row.status === 'ready') acc.ready += 1;
    else if (row.status === 'missing_image') acc.missingImage += 1;
    else acc.invalid += 1;
    return acc;
  }, { total: 0, ready: 0, missingImage: 0, invalid: 0 });

  const productTypes = productTypeOptions(rows);
  const niches = nicheOptions(rows);

  return (
    <main className="admin-shell">
      <section className="admin-panel wide">
        <div className="admin-row">
          <div>
            <div className="admin-topline">Google Sheets workflow</div>
            <h1>Redbubble products</h1>
            <p className="admin-muted">
              Paste or upload Google Sheets CSV rows for InkWanderStudio Redbubble products, save valid rows to Neon, then generate Pinterest pins from the Ready records.
            </p>
          </div>
          <Link href="/admin" className="secondary-link">Back to admin</Link>
        </div>

        {error && <div className="notice">{error}</div>}
        {params.notice && <div className="notice">{params.notice}</div>}

        <div className="stat-grid four">
          <div className="stat-card"><span>{totals.total}</span><p>Total rows</p></div>
          <div className="stat-card"><span>{totals.ready}</span><p>Ready</p></div>
          <div className="stat-card"><span>{totals.missingImage}</span><p>Missing image</p></div>
          <div className="stat-card"><span>{totals.invalid}</span><p>Invalid</p></div>
        </div>

        <form action={importCsvAction} encType="multipart/form-data" className="product-form admin-section">
          <h2>Import from Google Sheets</h2>
          <p className="admin-muted">
            Accepts <code>title</code>, <code>redbubble_url</code>, <code>image_url</code>, <code>product_type</code>, <code>niche</code>, and <code>tags</code>. Valid rows are saved to Neon. Duplicates are skipped by Redbubble URL.
          </p>
          <label className="field">
            <span>Upload CSV file</span>
            <input name="csv_file" type="file" accept=".csv,text/csv" />
          </label>
          <label className="field">
            <span>Or paste CSV data</span>
            <textarea
              name="csv_data"
              rows={8}
              placeholder={'title,redbubble_url,image_url,product_type,niche,tags\nFinancially Flexible Morally Exhausted,https://www.redbubble.com/i/t-shirt/.../0283,https://ih1.redbubble.net/image....jpg,T Shirt,millennial humor,"millennial humor, witty burnout"'}
            />
          </label>
          <button type="submit" className="primary-link">Import Redbubble products</button>
        </form>

        <form method="get" className="product-form admin-section">
          <h2>Filter products</h2>
          <div className="design-filter-grid">
            <label className="field">
              <span>Keyword</span>
              <input name="q" defaultValue={params.q || ''} placeholder="pancakes, coffee, introvert, tshirt" />
            </label>
            <label className="field">
              <span>Status</span>
              <select name="status" defaultValue={params.status || ''}>
                <option value="">All statuses</option>
                <option value="ready">Ready</option>
                <option value="missing_image">Missing image</option>
                <option value="invalid">Invalid</option>
              </select>
            </label>
            <label className="field">
              <span>Product type</span>
              <select name="product_type" defaultValue={params.product_type || ''}>
                <option value="">All product types</option>
                {productTypes.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Niche</span>
              <select name="niche" defaultValue={params.niche || ''}>
                <option value="">All niches</option>
                {niches.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>
          <div className="editor-actions">
            <button type="submit" className="primary-link">Apply filters</button>
            <Link href="/admin/redbubble-products" className="secondary-link">Clear filters</Link>
          </div>
        </form>

        <form action={generatePinsAction} className="product-form admin-section">
          <h2>Generate Pinterest pins</h2>
          <p className="admin-muted">
            Sync the current Ready Redbubble products into the Pinterest product generator and create fresh pin drafts from those records.
          </p>
          <input type="hidden" name="niche" value={params.niche || ''} />
          <input type="hidden" name="product_type" value={params.product_type || ''} />
          <button type="submit" className="primary-link">Generate Pinterest pins from Ready products</button>
        </form>

        <div className="admin-section">
          <h2>Product records</h2>
          {!error && filteredRows.length === 0 && (
            <div className="empty-state">No Redbubble products match the current filters.</div>
          )}

          <div className="pin-workflow-list">
            {filteredRows.map((row) => {
              const tags = Array.isArray(row.tags) ? row.tags : [];
              return (
                <article key={row.id} className="pin-workflow-post">
                  <div className="pin-workflow-post-head">
                    <div>
                      <p className="eyebrow">{cleanText(row.source, 'google-sheets')} · active</p>
                      <h2>{row.title}</h2>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, borderRadius: 999, padding: '8px 12px', fontWeight: 800, ...statusTone(cleanText(row.status).toLowerCase()) }}>
                        {titleCase(cleanText(row.status, 'invalid').replace(/_/g, ' '))}
                      </div>
                      <p className="admin-muted">
                        {cleanText(row.niche, 'No niche')} · {cleanText(row.product_type, 'No product type')}
                      </p>
                    </div>

                    <div className="pin-workflow-actions">
                      <Link href={row.redbubble_url} className="secondary-link small" target="_blank">
                        Open Redbubble
                      </Link>
                      {row.status === 'ready' && (
                        <Link href="/admin/product-pins" className="secondary-link small">
                          Open product pins
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="tracked-url-box">
                    <small>Redbubble URL</small>
                    <code>{row.redbubble_url}</code>
                  </div>
                  <div className="tracked-url-box">
                    <small>Image URL</small>
                    <code>{cleanText(row.image_url, 'Missing image')}</code>
                  </div>
                  {!!tags.length && (
                    <p className="admin-muted">Tags: {tags.join(', ')}</p>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
