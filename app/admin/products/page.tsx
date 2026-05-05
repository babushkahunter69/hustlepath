import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { parseKeywords } from '@/lib/monetization';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function createProductAction(formData: FormData) {
  'use server';
  const title = String(formData.get('title') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const targetUrl = String(formData.get('target_url') || '').trim();
  const imageUrl = String(formData.get('image_url') || '').trim();
  const ctaLabel = String(formData.get('cta_label') || 'View product').trim();
  const keywords = parseKeywords(String(formData.get('keywords') || ''));
  if (!title || !targetUrl) redirect('/admin/products');
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
  await sql`
    update products
    set title = ${title}, description = ${description || null}, target_url = ${targetUrl}, image_url = ${imageUrl || null}, cta_label = ${ctaLabel || 'View product'}, keywords = ${JSON.stringify(keywords)}::jsonb, updated_at = now()
    where id = ${id}
  `;
  redirect('/admin/products');
}

export default async function ProductsPage() {
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
            <p className="admin-muted">Add Redbubble products or shop links, tag them with keywords, and HustlePathDaily will match them to related articles.</p>
          </div>
          <Link href="/admin" className="secondary-link">Back to admin</Link>
        </div>
        {error && <div className="notice">{error}</div>}
        <form action={createProductAction} className="product-form admin-section">
          <h2>Add Redbubble product</h2>
          <div className="field-row">
            <label className="field"><span>Title</span><input name="title" placeholder="Minimalist Side Hustle Sticker" /></label>
            <label className="field"><span>CTA label</span><input name="cta_label" defaultValue="View product" /></label>
          </div>
          <label className="field"><span>Target URL</span><input name="target_url" placeholder="https://www.redbubble.com/..." /></label>
          <label className="field"><span>Image URL</span><input name="image_url" placeholder="Optional product image URL" /></label>
          <label className="field"><span>Description</span><textarea name="description" rows={3} placeholder="Short sentence shown inside the article product block." /></label>
          <label className="field"><span>Keywords, comma separated</span><input name="keywords" placeholder="redbubble, print on demand, canva, design, side hustle" /></label>
          <button type="submit" className="primary-link">Add product</button>
        </form>
        <div className="admin-section product-list">
          <h2>Products</h2>
          {products.length === 0 && !error && <div className="empty-state">No products yet.</div>}
          {products.map((product) => (
            <form key={product.id} action={updateProductAction} className="product-editor">
              <input type="hidden" name="id" value={product.id} />
              <div className="field-row">
                <label className="field"><span>Title</span><input name="title" defaultValue={product.title || ''} /></label>
                <label className="field"><span>Status</span><input value={product.status || 'active'} readOnly /></label>
              </div>
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
          ))}
        </div>
      </section>
    </main>
  );
}
