import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { parseKeywords } from '@/lib/monetization';
import { importRedbubbleProduct, importRedbubbleShopProducts, validateProductSource } from '@/lib/redbubbleProductSource';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const INKWANDERSTUDIO_SHOP_URL = 'https://www.redbubble.com/people/InkWanderStudio/shop';

function flashRedirect(message: string) {
  redirect(`/admin/products?notice=${encodeURIComponent(message)}`);
}

function productKey(value: unknown) {
  try {
    const url = new URL(String(value || '').trim());
    url.hash = '';
    url.search = '';
    return url.toString().toLowerCase();
  } catch {
    return String(value || '').trim().toLowerCase();
  }
}

async function importRedbubbleShopAction() {
  'use server';

  const existingProducts = await sql`select target_url from products where target_url is not null`;
  const existingTargetUrls = new Set(existingProducts.map((product: any) => productKey(product.target_url)));
  const imported = await importRedbubbleShopProducts(INKWANDERSTUDIO_SHOP_URL);

  if (!imported.ok && imported.products.length === 0) {
    flashRedirect(imported.errors[0] || 'No valid Redbubble products were found on the InkWanderStudio shop page.');
  }

  let inserted = 0;
  let skipped = 0;

  for (const product of imported.products) {
    const key = productKey(product.targetUrl);
    if (!key || existingTargetUrls.has(key)) {
      skipped += 1;
      continue;
    }

    const keywords = Array.from(new Set([...product.tags, product.productType, product.sourceShopName].filter(Boolean)));
    await sql`
      insert into products (title, description, target_url, image_url, cta_label, keywords, status, source)
      values (${product.title}, ${product.description || null}, ${product.targetUrl}, ${product.imageUrl}, ${'View product'}, ${JSON.stringify(keywords)}::jsonb, 'active', ${`redbubble:${product.sourceShopName || imported.shopName}`})
    `;
    existingTargetUrls.add(key);
    inserted += 1;
  }

  flashRedirect(`Imported ${inserted} ready InkWanderStudio products. Skipped ${skipped} duplicates. Discovered ${imported.discoveredUrls.length} product URLs.`);
}

async function importRedbubbleProductAction(formData: FormData) {
  'use server';

  const productUrl = String(formData.get('product_url') || '').trim();
  if (!productUrl) flashRedirect('Enter a specific Redbubble product URL to import.');

  const imported = await importRedbubbleProduct(productUrl);
  if (!imported.ok) flashRedirect(imported.error || 'Could not import that Redbubble product page.');

  const existing = await sql`select id from products where target_url = ${imported.targetUrl} limit 1`;
  if (existing.length) flashRedirect(`${imported.title} is already in the product library.`);

  const keywords = Array.from(new Set([...imported.tags, imported.productType, imported.sourceShopName].filter(Boolean)));
  await sql`
    insert into products (title, description, target_url, image_url, cta_label, keywords, status, source)
    values (${imported.title}, ${imported.description || null}, ${imported.targetUrl}, ${imported.imageUrl}, ${'View product'}, ${JSON.stringify(keywords)}::jsonb, 'active', ${`redbubble:${imported.sourceShopName || 'InkWanderStudio'}`})
  `;

  flashRedirect(`Imported ${imported.title}.`);
}

async function createProductAction(formData: FormData) {
  'use server';
  const title = String(formData.get('title') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const targetUrl = String(formData.get('target_url') || '').trim();
  const imageUrl = String(formData.get('image_url') || '').trim();
  const ctaLabel = String(formData.get('cta_label') || 'View product').trim();
  const keywords = parseKeywords(String(formData.get('keywords') || ''));
  if (!title || !targetUrl) redirect('/admin/products');

  const validation = validateProductSource({ target_url: targetUrl, image_url: imageUrl });
  if (validation.status === 'invalid') flashRedirect(validation.reason);

  await sql`
    insert into products (title, description, target_url, image_url, cta_label, keywords, status, source)
    values (${title}, ${description || null}, ${targetUrl}, ${imageUrl || null}, ${ctaLabel || 'View product'}, ${JSON.stringify(keywords)}::jsonb, 'active', 'redbubble')
  `;
  redirect('/admin/products');
}

async function updateProductAction(formData: FormData) {
  'use server';
  const id = String(formData.get('id') || '');
  const intent = String(formData.get('intent') || 'save');
  if (!id) redirect('/admin/products');
  if (intent === 'archive') {
    await sql`update products set status = 'archived', updated_at = now() where id = ${id}`;
    redirect('/admin/products');
  }
  if (intent === 'activate') {
    await sql`update products set status = 'active', updated_at = now() where id = ${id}`;
    redirect('/admin/products');
  }
  const title = String(formData.get('title') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const targetUrl = String(formData.get('target_url') || '').trim();
  const imageUrl = String(formData.get('image_url') || '').trim();
  const ctaLabel = String(formData.get('cta_label') || 'View product').trim();
  const keywords = parseKeywords(String(formData.get('keywords') || ''));
  const validation = validateProductSource({ target_url: targetUrl, image_url: imageUrl });

  await sql`
    update products
    set title = ${title},
        description = ${description || null},
        target_url = ${targetUrl},
        image_url = ${imageUrl || null},
        cta_label = ${ctaLabel || 'View product'},
        keywords = ${JSON.stringify(keywords)}::jsonb,
        status = ${validation.status === 'invalid' ? 'archived' : 'active'},
        updated_at = now()
    where id = ${id}
  `;
  redirect('/admin/products');
}

function statusStyles(status: string) {
  if (status === 'ready') return { background: '#dcfce7', color: '#14532d', border: '1px solid #86efac' };
  if (status === 'missing_image') return { background: '#fef3c7', color: '#78350f', border: '1px solid #facc15' };
  return { background: '#fee2e2', color: '#7f1d1d', border: '1px solid #fca5a5' };
}

export default async function ProductsPage({ searchParams }: { searchParams?: Promise<{ notice?: string }> }) {
  const params = searchParams ? await searchParams : {};
  let products: any[] = [];
  let error = '';
  try {
    products = await sql`select * from products order by status asc, updated_at desc nulls last, created_at desc`;
  } catch (err: any) {
    error = err.message || 'Products table is not ready. Run the monetization migration first.';
  }
  return (
    <main className="admin-shell">
      <section className="admin-panel wide">
        <div className="admin-row">
          <div>
            <div className="admin-topline">Monetization</div>
            <h1>Product library</h1>
            <p className="admin-muted">Import specific Redbubble product pages so every Pinterest pin has a real target URL and product image.</p>
          </div>
          <Link href="/admin" className="secondary-link">Back to admin</Link>
        </div>
        {error && <div className="notice">{error}</div>}
        {params.notice && <div className="notice">{params.notice}</div>}

        <form action={importRedbubbleShopAction} className="product-form admin-section">
          <h2>Import Redbubble products</h2>
          <p className="admin-muted">Crawl {INKWANDERSTUDIO_SHOP_URL}, discover specific design/product URLs, extract each main image, skip duplicates, and save only Ready records.</p>
          <button type="submit" className="primary-link">Import Redbubble products</button>
        </form>

        <form action={importRedbubbleProductAction} className="product-form admin-section">
          <h2>Import one Redbubble product URL</h2>
          <p className="admin-muted">Paste a specific product/design page. Shop/profile URLs like https://www.redbubble.com/people/InkWanderStudio/ are rejected because they do not identify one design image.</p>
          <label className="field"><span>Specific product URL</span><input name="product_url" placeholder="https://www.redbubble.com/i/sticker/..." /></label>
          <button type="submit" className="primary-link">Import and extract image</button>
        </form>

        <form action={createProductAction} className="product-form admin-section">
          <h2>Add product manually</h2>
          <p className="admin-muted">Manual products must use a specific Redbubble product URL. Missing images are allowed for repair, but Product Pins will not generate until the image URL is present.</p>
          <div className="field-row">
            <label className="field"><span>Title</span><input name="title" placeholder="Minimalist Side Hustle Sticker" /></label>
            <label className="field"><span>CTA label</span><input name="cta_label" defaultValue="View product" /></label>
          </div>
          <label className="field"><span>Target URL</span><input name="target_url" placeholder="https://www.redbubble.com/i/sticker/..." /></label>
          <label className="field"><span>Image URL</span><input name="image_url" placeholder="Required before Pinterest pins can generate" /></label>
          <label className="field"><span>Description</span><textarea name="description" rows={3} placeholder="Short sentence shown inside the article product block." /></label>
          <label className="field"><span>Keywords, comma separated</span><input name="keywords" placeholder="coffee culture, introvert humor, sticker, mug" /></label>
          <button type="submit" className="primary-link">Add product</button>
        </form>
        <div className="admin-section product-list">
          <h2>Products</h2>
          {products.length === 0 && !error && <div className="empty-state">No products yet.</div>}
          {products.map((product) => {
            const validation = validateProductSource(product);
            return (
              <form key={product.id} action={updateProductAction} className="product-editor">
                <input type="hidden" name="id" value={product.id} />
                <div className="field-row">
                  <label className="field"><span>Title</span><input name="title" defaultValue={product.title || ''} /></label>
                  <label className="field"><span>Status</span><input value={product.status || 'active'} readOnly /></label>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, alignSelf: 'flex-start', borderRadius: 999, padding: '8px 12px', fontWeight: 800, ...statusStyles(validation.status) }}>
                  {validation.label}
                </div>
                <p className="admin-muted">{validation.reason}</p>
                <label className="field"><span>Target URL</span><input name="target_url" defaultValue={product.target_url || ''} /></label>
                <div className="field-row">
                  <label className="field"><span>Image URL</span><input name="image_url" defaultValue={product.image_url || ''} /></label>
                  <label className="field"><span>CTA label</span><input name="cta_label" defaultValue={product.cta_label || 'View product'} /></label>
                </div>
                <label className="field"><span>Description</span><textarea name="description" rows={2} defaultValue={product.description || ''} /></label>
                <label className="field"><span>Keywords</span><input name="keywords" defaultValue={parseKeywords(product.keywords).join(', ')} /></label>
                <div className="editor-actions">
                  <button type="submit" name="intent" value="save" className="btn btn-dark">Save product</button>
                  <button type="submit" name="intent" value={product.status === 'active' ? 'archive' : 'activate'} className="btn btn-light">{product.status === 'active' ? 'Archive' : 'Activate'}</button>
                </div>
              </form>
            );
          })}
        </div>
      </section>
    </main>
  );
}
