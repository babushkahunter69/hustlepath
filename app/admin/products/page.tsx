import Link from 'next/link';
import { redirect } from 'next/navigation';
import BrowserJsonImportPreview from './BrowserJsonImportPreview';
import { sql } from '@/lib/db';
import { parseKeywords } from '@/lib/monetization';
import { importRedbubbleProduct, importRedbubbleShopProducts, isRedbubbleProductUrl, validateProductSource } from '@/lib/redbubbleProductSource';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const INKWANDERSTUDIO_SHOP_URL = 'https://www.redbubble.com/people/InkWanderStudio/shop';
const BROWSER_IMAGE_WARNING_KEYWORD = 'image_server_check:failed';
const BROWSER_IMAGE_WARNING = 'Image may not be server-fetchable, but was captured from browser.';
const BAD_BROWSER_TITLES = new Set(['favorite', 'add to favorites', 'add to cart', 'cart', 'redbubble', 'inkwanderstudio']);
const BROWSER_IMPORT_SNIPPET = `(() => {
  const STORAGE_KEY = 'hpd_redbubble_products';
  const shopName = 'InkWanderStudio';
  const BAD_LABELS = new Set(['favorite', 'add to favorites', 'add to cart', 'cart']);

  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const normalizeUrl = (value) => {
    const url = clean(value);
    if (!url) return '';
    if (url.startsWith('//')) return 'https:' + url;
    if (url.startsWith('/')) return new URL(url, location.origin).href;
    return url;
  };
  const srcsetUrls = (srcset) => clean(srcset).split(',').map((part) => normalizeUrl(part.trim().split(/\s+/)[0])).filter(Boolean);
  const imageCandidates = (el) => [
    normalizeUrl(el.currentSrc),
    ...srcsetUrls(el.getAttribute('srcset')),
    ...srcsetUrls(el.getAttribute('data-srcset')),
    normalizeUrl(el.getAttribute('src')),
    normalizeUrl(el.getAttribute('data-src')),
  ].filter(Boolean);
  const isBadLabel = (value) => BAD_LABELS.has(clean(value).toLowerCase());
  const isProductImage = (url) => {
    const value = clean(url).toLowerCase();
    if (!value || value.includes('/boom/client/') || value.includes('.svg')) return false;
    if (/avatar|logo|icon|heart|favorite|placeholder|sprite/.test(value)) return false;
    try {
      const parsed = new URL(value);
      return /^ih\d?\.redbubble\.net$/i.test(parsed.hostname) && parsed.pathname.includes('/image.') && /\.(png|jpe?g|webp)$/i.test(parsed.pathname);
    } catch {
      return false;
    }
  };
  const isProductLink = (link) => {
    if (!link) return false;
    if (isBadLabel(link.getAttribute('aria-label')) || isBadLabel(link.getAttribute('title')) || isBadLabel(link.textContent)) return false;
    try {
      const url = new URL(normalizeUrl(link.getAttribute('href') || link.href), location.origin);
      return /(^|\.)redbubble\.com$/i.test(url.hostname) && url.pathname.split('/').includes('i');
    } catch {
      return false;
    }
  };
  const titleFromUrl = (productUrl) => {
    try {
      const parts = new URL(productUrl).pathname.split('/').filter(Boolean).map(decodeURIComponent);
      const index = parts.indexOf('i');
      const slug = parts[index + 2] || parts.find((part) => part.includes('-by-')) || '';
      return clean(slug.replace(/-by-.+$/i, '').replace(/-/g, ' ')).replace(/\b\w/g, (char) => char.toUpperCase());
    } catch {
      return '';
    }
  };
  const visibleTitle = (card, productUrl, imageAlt) => {
    const ignored = /^(favorite|add to favorites|add to cart|cart|redbubble|inkwanderstudio)$/i;
    const nodes = Array.from(card.querySelectorAll('h1,h2,h3,[data-testid],a,span,p,div'));
    const texts = nodes
      .map((node) => clean(node.textContent))
      .filter((text) => text && text.length > 2 && text.length < 120)
      .filter((text) => !ignored.test(text))
      .filter((text) => !/^\$?\d+(\.\d{2})?$/.test(text))
      .filter((text) => !/^by\s+/i.test(text));
    const fromUrl = titleFromUrl(productUrl);
    const matching = texts.find((text) => fromUrl && text.toLowerCase().includes(fromUrl.split(' ')[0].toLowerCase()));
    return matching || texts[0] || (!ignored.test(clean(imageAlt)) ? clean(imageAlt) : '') || fromUrl;
  };

  const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const media = Array.from(document.querySelectorAll('img, source'));

  const captured = media
    .map((el) => {
      const card = el.closest('[data-testid], article, li, div') || el.parentElement || el;
      const cardMedia = Array.from(new Set([...Array.from(card.querySelectorAll('img, source')), el]));
      const imageUrl = cardMedia.flatMap(imageCandidates).find(isProductImage) || '';
      if (!imageUrl) return null;
      if (el.tagName === 'IMG' && el.naturalWidth && el.naturalHeight && (el.naturalWidth < 120 || el.naturalHeight < 120)) return null;

      const links = Array.from(new Set([
        el.closest('a[href]'),
        ...Array.from(card.querySelectorAll('a[href]')),
      ].filter(Boolean)));
      const productLink = links.find(isProductLink);
      if (!productLink) return null;

      const productUrl = normalizeUrl(productLink.getAttribute('href') || productLink.href);
      const title = visibleTitle(card, productUrl, el.getAttribute('alt'));
      if (!title || /^(favorite|redbubble|inkwanderstudio)$/i.test(title)) return null;

      return {
        title,
        product_url: productUrl,
        image_url: imageUrl,
        product_type: '',
        niche: '',
        tags: '',
        source_shop: shopName,
      };
    })
    .filter(Boolean);

  const uniquePageProducts = Array.from(new Map(captured.map((item) => [item.product_url, item])).values());
  console.table(uniquePageProducts);

  const merged = Array.from(
    new Map([...existing, ...uniquePageProducts].map((item) => [item.product_url, item])).values()
  );

  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  copy(JSON.stringify(merged, null, 2));

  alert('Captured ' + uniquePageProducts.length + ' products on this page. Total saved: ' + merged.length + '. Full JSON copied to clipboard.');
})();`;
const BROWSER_CLEAR_SNIPPET = `(() => {
  localStorage.removeItem('hpd_redbubble_products');
  alert('Cleared captured Redbubble products.');
})();`;

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

function cleanText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isBadBrowserTitle(value: unknown) {
  const title = cleanText(value).toLowerCase();
  return !title || BAD_BROWSER_TITLES.has(title);
}

function isSpecificRedbubbleProductUrl(value: unknown) {
  const url = cleanText(value);
  if (!isRedbubbleProductUrl(url)) return false;
  try {
    return new URL(url).pathname.split('/').includes('i');
  } catch {
    return false;
  }
}

function isRedbubbleProductImageUrl(value: unknown) {
  const imageUrl = cleanText(value).toLowerCase();
  if (!imageUrl || imageUrl.includes('/boom/client/') || imageUrl.includes('.svg')) return false;
  if (/avatar|logo|icon|heart|favorite|placeholder|sprite/.test(imageUrl)) return false;
  try {
    const url = new URL(imageUrl);
    return /^ih\d?\.redbubble\.net$/i.test(url.hostname) && url.pathname.includes('/image.') && /\.(png|jpe?g|webp)$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function parseCsvRows(csv: string) {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase().trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return headers.reduce((row: Record<string, string>, header, index) => {
      row[header] = cells[index] || '';
      return row;
    }, {});
  });
}

function splitJsonValues(input: string) {
  const chunks: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '[' || char === '{') {
      if (depth === 0) start = index;
      depth += 1;
    } else if (char === ']' || char === '}') {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        chunks.push(input.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return chunks;
}

function parseBrowserJsonRows(json: string) {
  const chunks = splitJsonValues(json);
  const values = chunks.length ? chunks.map((chunk) => JSON.parse(chunk)) : [JSON.parse(json)];
  const rows = values.flatMap((value) => Array.isArray(value) ? value : [value]);
  return rows.filter((row) => row && typeof row === 'object') as Record<string, unknown>[];
}

function keywordsForProduct(productType: string, niche: string, tags: string, shopName = 'InkWanderStudio', extra: string[] = []) {
  return Array.from(new Set([
    ...parseKeywords(tags),
    ...parseKeywords(niche),
    cleanText(productType),
    cleanText(shopName),
    ...extra.map(cleanText),
  ].filter(Boolean)));
}

async function productExists(targetUrl: string) {
  const existing = await sql`select id from products where target_url = ${targetUrl} limit 1`;
  return existing.length > 0;
}

async function deleteBadImportedProductsAction() {
  'use server';

  const result = await sql`
    with deleted as (
      delete from products
      where source like 'redbubble:%:browser'
        and (
          lower(trim(coalesce(title, ''))) in ('favorite', 'add to favorites', 'add to cart', 'cart', 'redbubble', 'inkwanderstudio')
          or coalesce(image_url, '') ~* '(/boom/client/|\.svg(\?|#|$)|avatar|logo|icon|heart|favorite|placeholder|sprite)'
          or coalesce(image_url, '') !~* '^https?://ih[0-9]?\.redbubble\.net/.*/image\..*\.(png|jpe?g|webp)(\?|#|$)'
        )
      returning id
    )
    select count(*)::int as count from deleted
  `;

  flashRedirect(`Deleted ${result[0]?.count || 0} bad image imports.`);
}

async function insertManualProduct(input: {
  title: string;
  description?: string;
  targetUrl: string;
  imageUrl: string;
  productType?: string;
  niche?: string;
  tags?: string;
  shopName?: string;
}) {
  const validation = validateProductSource({ target_url: input.targetUrl, image_url: input.imageUrl });
  if (validation.status !== 'ready') return { inserted: false, skipped: true, reason: validation.reason };
  if (await productExists(input.targetUrl)) return { inserted: false, skipped: true, reason: 'duplicate' };

  const shopName = cleanText(input.shopName) || 'InkWanderStudio';
  const keywords = keywordsForProduct(input.productType || '', input.niche || '', input.tags || '', shopName);
  const description = cleanText(input.description) || [input.productType, input.niche].map(cleanText).filter(Boolean).join(' · ');

  await sql`
    insert into products (title, description, target_url, image_url, cta_label, keywords, status, source)
    values (${input.title}, ${description || null}, ${input.targetUrl}, ${input.imageUrl}, ${'View product'}, ${JSON.stringify(keywords)}::jsonb, 'active', ${`redbubble:${shopName}`})
  `;
  return { inserted: true, skipped: false, reason: 'ready' };
}

async function insertBrowserCapturedProduct(input: {
  title: string;
  targetUrl: string;
  imageUrl: string;
  productType?: string;
  niche?: string;
  tags?: string;
  shopName?: string;
}) {
  if (isBadBrowserTitle(input.title)) return { inserted: false, skipped: true, reason: 'bad product title' };
  if (!isSpecificRedbubbleProductUrl(input.targetUrl)) return { inserted: false, skipped: true, reason: 'product_url must be an absolute Redbubble /i/... product URL' };
  if (!isRedbubbleProductImageUrl(input.imageUrl)) return { inserted: false, skipped: true, reason: 'image_url must be an ih*.redbubble.net /image. product mockup URL' };
  if (await productExists(input.targetUrl)) return { inserted: false, skipped: true, reason: 'duplicate' };

  const shopName = cleanText(input.shopName) || 'InkWanderStudio';
  const keywords = keywordsForProduct(input.productType || '', input.niche || '', input.tags || '', shopName, [BROWSER_IMAGE_WARNING_KEYWORD]);
  const description = [input.productType, input.niche].map(cleanText).filter(Boolean).join(' · ') || BROWSER_IMAGE_WARNING;

  await sql`
    insert into products (title, description, target_url, image_url, cta_label, keywords, status, source)
    values (${input.title}, ${description}, ${input.targetUrl}, ${input.imageUrl}, ${'View product'}, ${JSON.stringify(keywords)}::jsonb, 'active', ${`redbubble:${shopName}:browser`})
  `;
  return { inserted: true, skipped: false, reason: 'ready', warning: BROWSER_IMAGE_WARNING_KEYWORD };
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

async function manualRedbubbleProductAction(formData: FormData) {
  'use server';

  const title = cleanText(formData.get('manual_title'));
  const targetUrl = cleanText(formData.get('manual_product_url'));
  const imageUrl = cleanText(formData.get('manual_image_url'));
  if (!title || !targetUrl || !imageUrl) flashRedirect('Manual import needs title, product URL, and image URL.');

  const result = await insertManualProduct({
    title,
    targetUrl,
    imageUrl,
    productType: cleanText(formData.get('manual_product_type')),
    niche: cleanText(formData.get('manual_niche')),
    tags: cleanText(formData.get('manual_tags')),
    shopName: cleanText(formData.get('manual_shop_name')) || 'InkWanderStudio',
  });

  if (!result.inserted) flashRedirect(result.reason === 'duplicate' ? `${title} is already in the product library.` : result.reason);
  flashRedirect(`Imported ${title} manually. It is Ready for Pinterest pins.`);
}

async function importRows(rows: Record<string, unknown>[]) {
  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const title = cleanText(row.title);
    const targetUrl = cleanText(row.product_url || row.target_url || row.url);
    const imageUrl = cleanText(row.image_url || row.image);

    if (!title || !targetUrl || !imageUrl) {
      skipped += 1;
      errors.push(`${title || targetUrl || 'import row'}: missing title, product_url, or image_url`);
      continue;
    }

    const result = await insertManualProduct({
      title,
      targetUrl,
      imageUrl,
      productType: cleanText(row.product_type),
      niche: cleanText(row.niche),
      tags: cleanText(row.tags),
      shopName: cleanText(row.source_shop || row.source_shop_name || row.shop || row.source) || 'InkWanderStudio',
    });

    if (result.inserted) inserted += 1;
    else {
      skipped += 1;
      errors.push(`${title}: ${result.reason}`);
    }
  }

  return { inserted, skipped, errors };
}

async function importBrowserRows(rows: Record<string, unknown>[]) {
  let inserted = 0;
  let skipped = 0;
  let warnings = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const title = cleanText(row.title);
    const targetUrl = cleanText(row.product_url || row.target_url || row.url);
    const imageUrl = cleanText(row.image_url || row.image);

    const result = await insertBrowserCapturedProduct({
      title,
      targetUrl,
      imageUrl,
      productType: cleanText(row.product_type),
      niche: cleanText(row.niche),
      tags: cleanText(row.tags),
      shopName: cleanText(row.source_shop || row.source_shop_name || row.shop || row.source) || 'InkWanderStudio',
    });

    if (result.inserted) {
      inserted += 1;
      if (result.warning) warnings += 1;
    } else {
      skipped += 1;
      errors.push(`${title || targetUrl || 'import row'}: ${result.reason}`);
    }
  }

  return { inserted, skipped, warnings, errors };
}

async function browserJsonRedbubbleProductsAction(formData: FormData) {
  'use server';

  const json = String(formData.get('browser_json') || '').trim();
  if (!json) flashRedirect('Paste the JSON copied by the browser snippet.');

  let rows: Record<string, unknown>[] = [];
  try {
    rows = parseBrowserJsonRows(json);
  } catch {
    flashRedirect('Browser import JSON could not be parsed. Run the snippet again and paste the copied JSON array.');
  }

  if (!rows.length) flashRedirect('Browser import JSON did not contain any product rows.');
  const { inserted, skipped, warnings, errors } = await importBrowserRows(rows);
  const suffix = errors.length ? ` First issues: ${errors.slice(0, 3).join(' | ')}` : '';
  flashRedirect(`Browser JSON import complete. Imported: ${inserted}. Ready: ${inserted}. Skipped: ${skipped}. Warnings: ${warnings ? 'image server check failed' : 'none'}.${suffix}`);
}

async function csvRedbubbleProductsAction(formData: FormData) {
  'use server';

  const csv = String(formData.get('csv_data') || '').trim();
  const rows = parseCsvRows(csv);
  if (!rows.length) flashRedirect('Paste CSV rows with title, product_url, image_url, product_type, niche, tags.');

  const { inserted, skipped, errors } = await importRows(rows);
  const suffix = errors.length ? ` First issues: ${errors.slice(0, 3).join(' | ')}` : '';
  flashRedirect(`CSV import added ${inserted} Ready products and skipped ${skipped}.${suffix}`);
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

function productWarnings(product: any) {
  const keywords = parseKeywords(product?.keywords);
  const warnings: string[] = [];
  if (keywords.includes(BROWSER_IMAGE_WARNING_KEYWORD)) warnings.push(BROWSER_IMAGE_WARNING);
  return warnings;
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
          <h2>Automatic Redbubble import</h2>
          <p className="admin-muted">Optional: try to crawl {INKWANDERSTUDIO_SHOP_URL}. If Redbubble blocks Vercel with 403, use manual or browser JSON import below.</p>
          <button type="submit" className="primary-link">Import Redbubble products</button>
        </form>

        <form action={deleteBadImportedProductsAction} className="product-form admin-section">
          <h2>Cleanup bad image imports</h2>
          <p className="admin-muted">Deletes browser imports whose image URL is a Redbubble UI asset, SVG, /boom/client URL, logo, icon, placeholder, or non-product CDN image.</p>
          <button type="submit" className="primary-link">Delete bad image imports</button>
        </form>

        <div className="product-form admin-section">
          <h2>Browser-assisted paginated capture</h2>
          <p className="admin-muted">Use this when Redbubble blocks server-side import. The capture snippet searches every image/source in the product card and only keeps ih*.redbubble.net mockup URLs containing /image.</p>
          <ol className="admin-muted">
            <li>Open Redbubble shop page 1.</li>
            <li>Run the capture products snippet in the browser console.</li>
            <li>Click the next shop page.</li>
            <li>Run the capture snippet again.</li>
            <li>Repeat until all pages are captured.</li>
            <li>Paste the final copied JSON into HustlePathDaily below.</li>
          </ol>
          <a href="https://www.redbubble.com/people/InkWanderStudio/shop" target="_blank" rel="noopener noreferrer" className="secondary-link small">Open InkWanderStudio shop</a>
          <label className="field"><span>Capture products snippet</span><textarea readOnly rows={28} value={BROWSER_IMPORT_SNIPPET} /></label>
          <p className="admin-muted">Run this clear snippet in the Redbubble browser console when you want to start a fresh capture.</p>
          <label className="field"><span>Clear captured Redbubble products</span><textarea readOnly rows={4} value={BROWSER_CLEAR_SNIPPET} /></label>
        </div>

        <form action={browserJsonRedbubbleProductsAction} className="product-form admin-section">
          <h2>Browser JSON import</h2>
          <p className="admin-muted">Paste the final accumulated JSON copied by the browser snippet. Review the preview table first; rows with bad titles, non-product URLs, SVGs, /boom/client URLs, or non-Redbubble product images are skipped.</p>
          <BrowserJsonImportPreview />
          <button type="submit" className="primary-link">Import browser JSON</button>
        </form>

        <form action={manualRedbubbleProductAction} className="product-form admin-section">
          <h2>Manual product import</h2>
          <p className="admin-muted">Use this when Redbubble blocks automatic extraction. Open the Redbubble product in your browser, copy the product page URL and main image URL, then paste them here.</p>
          <div className="field-row">
            <label className="field"><span>Product title</span><input name="manual_title" placeholder="Financially Flexible Morally Exhausted" /></label>
            <label className="field"><span>Product type</span><input name="manual_product_type" placeholder="Sticker, Mug, T-Shirt" /></label>
          </div>
          <label className="field"><span>Specific product URL</span><input name="manual_product_url" placeholder="https://www.redbubble.com/i/sticker/..." /></label>
          <label className="field"><span>Main image URL</span><input name="manual_image_url" placeholder="https://ih1.redbubble.net/image..." /></label>
          <div className="field-row">
            <label className="field"><span>Niche</span><input name="manual_niche" placeholder="millennial humor, coffee culture" /></label>
            <label className="field"><span>Source shop name</span><input name="manual_shop_name" defaultValue="InkWanderStudio" /></label>
          </div>
          <label className="field"><span>Tags</span><input name="manual_tags" placeholder="adulting, funny sticker, relatable stickers" /></label>
          <button type="submit" className="primary-link">Save manual product</button>
        </form>

        <form action={csvRedbubbleProductsAction} className="product-form admin-section">
          <h2>CSV bulk import</h2>
          <p className="admin-muted">Columns: title, product_url, image_url, product_type, niche, tags. Valid rows become Ready products; invalid rows and duplicates are skipped.</p>
          <label className="field"><span>CSV data</span><textarea name="csv_data" rows={8} placeholder={'title,product_url,image_url,product_type,niche,tags\nFinancially Flexible Morally Exhausted,https://www.redbubble.com/i/sticker/Financially-Flexible-Morally-Exhausted-by-InkWanderStudio/181480283/7sgk,https://ih1.redbubble.net/image...,Sticker,millennial humor,"adulting, relatable stickers"'} /></label>
          <button type="submit" className="primary-link">Import CSV products</button>
        </form>

        <form action={importRedbubbleProductAction} className="product-form admin-section">
          <h2>Try automatic single-product extraction</h2>
          <p className="admin-muted">Optional. If Redbubble returns 403, the app will ask you to paste the image URL manually.</p>
          <label className="field"><span>Specific product URL</span><input name="product_url" placeholder="https://www.redbubble.com/i/sticker/..." /></label>
          <button type="submit" className="primary-link">Try automatic extraction</button>
        </form>

        <form action={createProductAction} className="product-form admin-section">
          <h2>Add product manually legacy</h2>
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
            const warnings = productWarnings(product);
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
                {warnings.map((warning) => <p key={warning} className="admin-muted">Warning: {warning}</p>)}
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
