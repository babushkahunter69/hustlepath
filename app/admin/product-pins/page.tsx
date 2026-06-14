import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { attachProductPinUrls, generateProductPinterestPins, normalizeProductPinterestMeta } from '@/lib/productPinterest';
import { parseKeywords } from '@/lib/monetization';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function productPinsAction(formData: FormData) {
  'use server';

  const intent = String(formData.get('intent') || '');
  const productId = String(formData.get('product_id') || '');

  if (!productId) redirect('/admin/product-pins');

  const [product] = await sql`
    select id, title, description, image_url, target_url, keywords, status, source, pinterest_meta
    from products
    where id = ${productId}
    limit 1
  `;

  if (!product) redirect('/admin/product-pins');

  if (intent === 'generate_pins') {
    const pins = await generateProductPinterestPins({
      id: String(product.id),
      title: String(product.title || ''),
      description: product.description || '',
      image_url: product.image_url || '',
      target_url: String(product.target_url || ''),
      keywords: parseKeywords(product.keywords),
      source: product.source || 'redbubble',
      count: 8,
    });

    const meta = normalizeProductPinterestMeta(
      product.pinterest_meta,
      attachProductPinUrls(String(product.id), pins)
    );

    await sql`
      update products
      set pinterest_meta = ${JSON.stringify(meta)}::jsonb,
          updated_at = now()
      where id = ${product.id}
    `;

    redirect('/admin/product-pins');
  }

  if (intent === 'mark_pin_posted' || intent === 'mark_pin_draft') {
    const pinIndex = Number(formData.get('pin_index'));
    const existingMeta = product.pinterest_meta && typeof product.pinterest_meta === 'object' ? product.pinterest_meta : {};
    const existingPins = Array.isArray(existingMeta.pins) ? existingMeta.pins : [];
    const posted = intent === 'mark_pin_posted';
    const updatedPins = existingPins.map((pin: any, index: number) => (
      index === pinIndex
        ? { ...pin, status: posted ? 'posted' : 'draft', posted_at: posted ? new Date().toISOString() : undefined }
        : pin
    ));

    await sql`
      update products
      set pinterest_meta = ${JSON.stringify({ ...existingMeta, pins: updatedPins, updated_at: new Date().toISOString() })}::jsonb,
          updated_at = now()
      where id = ${product.id}
    `;

    redirect('/admin/product-pins');
  }

  redirect('/admin/product-pins');
}

function getPins(product: any) {
  const meta = product.pinterest_meta && typeof product.pinterest_meta === 'object' ? product.pinterest_meta : {};
  return Array.isArray(meta.pins) ? meta.pins : [];
}

function normalizeSiteUrl(value?: string | null) {
  const cleaned = String(value || '').trim().replace(/\/$/, '');
  if (!cleaned) return '';
  return /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
}

async function getCanonicalSiteUrl() {
  const headerStore = await headers();
  const host = headerStore.get('x-forwarded-host') || headerStore.get('host');
  const proto = headerStore.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
  const runtimeUrl = host ? `${proto}://${host}`.replace(/\/$/, '') : '';

  return (
    normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeSiteUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    runtimeUrl ||
    'https://hustlepathdaily.com'
  );
}

function shortPreviewText(value: unknown, maxLength = 170) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  const words = text.split(' ');
  const output: string[] = [];
  for (const word of words) {
    const next = [...output, word].join(' ');
    if (next.length > maxLength) break;
    output.push(word);
  }
  return `${output.join(' ').replace(/[,.!?;:]$/, '')}...`;
}

export default async function ProductPinsPage() {
  let products: any[] = [];
  let error = '';

  try {
    products = await sql`
      select id, title, description, image_url, target_url, keywords, status, source, pinterest_meta, updated_at, created_at
      from products
      where coalesce(status, 'active') = 'active'
      order by updated_at desc nulls last, created_at desc
    `;
  } catch (err: any) {
    error = err.message || 'Unable to load product pins.';
  }

  const canonicalSiteUrl = await getCanonicalSiteUrl();
  const totals = products.reduce((acc, product) => {
    const pins = getPins(product);
    acc.total += pins.length;
    acc.draft += pins.filter((pin: any) => pin.status !== 'posted').length;
    acc.posted += pins.filter((pin: any) => pin.status === 'posted').length;
    return acc;
  }, { total: 0, draft: 0, posted: 0 });

  return (
    <main className="admin-shell">
      <section className="admin-panel wide">
        <div className="admin-row">
          <div>
            <div className="admin-topline">Redbubble Pinterest workflow</div>
            <h1>Product pin command center</h1>
            <p className="admin-muted">
              Generate Pinterest-ready campaigns for Redbubble products, preview the exact image output, copy tracked links, and open the Pinterest pin builder with the same image route.
            </p>
          </div>
          <Link href="/admin" className="secondary-link small">Dashboard</Link>
        </div>

        {error && <div className="notice">Database not ready: {error}</div>}

        <div className="notice">
          Open image and Open Pinterest now use the same canonical product pin image URL, so the admin preview matches what gets pinned.
        </div>

        <div className="stat-grid three">
          <div className="stat-card"><span>{totals.total}</span><p>Total product pins</p></div>
          <div className="stat-card"><span>{totals.draft}</span><p>Draft pins</p></div>
          <div className="stat-card"><span>{totals.posted}</span><p>Posted pins</p></div>
        </div>

        <div className="pin-workflow-list">
          {!error && products.length === 0 && <div className="empty-state">No active products found.</div>}

          {products.map((product) => {
            const pins = getPins(product);
            const draftCount = pins.filter((pin: any) => pin.status !== 'posted').length;
            const postedCount = pins.filter((pin: any) => pin.status === 'posted').length;

            return (
              <article key={product.id} className="pin-workflow-post">
                <div className="pin-workflow-post-head">
                  <div>
                    <p className="eyebrow">{product.source || 'redbubble'} · {product.status || 'active'}</p>
                    <h2>{product.title || 'Untitled product'}</h2>
                    <p className="admin-muted">{pins.length} pins · {draftCount} draft · {postedCount} posted</p>
                  </div>

                  <div className="pin-workflow-actions">
                    <Link href={`/go/product/${product.id}`} className="secondary-link small" target="_blank">
                      Test product
                    </Link>
                    <Link href="/admin/products" className="secondary-link small">
                      Edit products
                    </Link>
                    <form action={productPinsAction}>
                      <input type="hidden" name="product_id" value={product.id} />
                      <button type="submit" name="intent" value="generate_pins" className="primary-link small">
                        {pins.length ? 'Regenerate pins' : 'Generate pins'}
                      </button>
                    </form>
                  </div>
                </div>

                {pins.length === 0 && (
                  <div className="empty-state compact-empty">
                    No product pins generated yet. Use Generate pins to create 8 Pinterest campaign drafts.
                  </div>
                )}

                {pins.length > 0 && (
                  <div className="pin-grid">
                    {pins.map((pin: any, index: number) => {
                      const imagePath = `/api/pinterest/product-pin-image-png/${product.id}/${index}`;
                      const trackedPath = pin.tracked_url || `/go/product-pin/${product.id}/${index}`;
                      const imageUrl = new URL(imagePath, canonicalSiteUrl).toString();
                      const trackedUrl = trackedPath.startsWith('http') ? trackedPath : new URL(trackedPath, canonicalSiteUrl).toString();
                      const pinterestDescription = [pin.title, shortPreviewText(pin.description, 320)].filter(Boolean).join(' - ');
                      const pinterestUrl = `https://www.pinterest.com/pin-builder/?url=${encodeURIComponent(trackedUrl)}&media=${encodeURIComponent(imageUrl)}&description=${encodeURIComponent(pinterestDescription)}`;
                      const posted = pin.status === 'posted';
                      const focusTags = Array.isArray(pin.keyword_focus) ? pin.keyword_focus.slice(0, 3) : [];

                      return (
                        <div key={`${product.id}-${index}-${pin.title}`} className={`pin-card admin-pin-card ${posted ? 'posted' : ''}`}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imageUrl}
                              alt={pin.title || `Pin ${index + 1}`}
                              loading="lazy"
                              style={{ width: '100%', aspectRatio: '2 / 3', objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(15, 23, 42, 0.1)', background: '#f8fafc' }}
                            />
                            <span>{pin.angle || 'pin'} · {posted ? 'posted' : 'draft'}</span>
                          </div>
                          <strong style={{ display: 'block', overflow: 'hidden' }}>{pin.title}</strong>
                          <p>{shortPreviewText(pin.description)}</p>

                          {pin.niche && <p className="admin-muted">Niche: {pin.niche}</p>}
                          {focusTags.length > 0 && <p className="admin-muted">Keywords: {focusTags.join(', ')}</p>}

                          <div className="pin-tools">
                            <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="btn btn-light small">Open image</a>
                            <a href={trackedUrl} target="_blank" rel="noopener noreferrer" className="btn btn-light small">Test link</a>
                            <a href={pinterestUrl} target="_blank" rel="noopener noreferrer" className="btn btn-dark small">Open Pinterest</a>
                          </div>

                          <div className="tracked-url-box">
                            <small>Tracked URL</small>
                            <code>{trackedUrl}</code>
                          </div>

                          <div className="tracked-url-box">
                            <small>Image URL used by preview and Pinterest</small>
                            <code>{imageUrl}</code>
                          </div>

                          <form action={productPinsAction} className="pin-status-form">
                            <input type="hidden" name="product_id" value={product.id} />
                            <input type="hidden" name="pin_index" value={index} />
                            {posted ? (
                              <button type="submit" name="intent" value="mark_pin_draft" className="btn btn-light small">Move back to draft</button>
                            ) : (
                              <button type="submit" name="intent" value="mark_pin_posted" className="btn btn-dark small">Mark as posted</button>
                            )}
                          </form>

                          <details>
                            <summary>Creative direction</summary>
                            <p>This pin carries design-specific niche and keyword metadata so future image generation can stay tied to the real Redbubble product.</p>
                            <p>{pin.image_prompt}</p>
                          </details>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
