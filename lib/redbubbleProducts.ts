import { sql } from '@/lib/db';
import {
  attachProductPinUrls,
  generateProductPinterestPins,
  normalizeProductPinterestMeta,
} from '@/lib/productPinterest';
import { parseCsvRows, parseList } from '@/lib/designLibrary';

export type RedbubbleProductStatus = 'ready' | 'missing_image' | 'invalid';

export type RedbubbleProductRecord = {
  id: string;
  title: string;
  redbubble_url: string;
  image_url: string | null;
  product_type: string | null;
  niche: string | null;
  tags: unknown;
  status: RedbubbleProductStatus;
  source: string | null;
  notes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ValidationResult = {
  status: RedbubbleProductStatus;
  reasons: string[];
};

type ImportSummary = {
  imported: number;
  skipped: number;
  rejected: number;
  rejectedReasons: string[];
};

function cleanText(value: unknown, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

function titleCase(value: string) {
  return cleanText(value).replace(/\w\S*/g, (word) => (
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ));
}

export function isAbsoluteHttpUrl(value: unknown) {
  return /^https?:\/\//i.test(cleanText(value));
}

export function isRedbubbleProductUrl(value: unknown) {
  return cleanText(value).toLowerCase().includes('redbubble.com/i/');
}

export function invalidImageAssetReason(value: unknown) {
  const imageUrl = cleanText(value).toLowerCase();
  if (!imageUrl) return 'image_url is missing';
  if (!isAbsoluteHttpUrl(imageUrl)) return 'image_url must be absolute http/https';
  if (imageUrl.includes('/boom/client/')) return 'image_url is a Redbubble UI asset';
  if (imageUrl.includes('avatar')) return 'image_url looks like an avatar';
  if (imageUrl.includes('logo')) return 'image_url looks like a logo';
  if (/\.svg(\?|#|$)/i.test(imageUrl)) return 'image_url cannot be an svg asset';
  return '';
}

export function validateRedbubbleProduct(input: {
  title?: unknown;
  redbubble_url?: unknown;
  image_url?: unknown;
}) {
  const title = cleanText(input.title);
  const redbubbleUrl = cleanText(input.redbubble_url);
  const imageUrl = cleanText(input.image_url);
  const reasons: string[] = [];

  if (!title) reasons.push('title is required');
  if (!redbubbleUrl) reasons.push('redbubble_url is required');
  else if (!isRedbubbleProductUrl(redbubbleUrl)) reasons.push('redbubble_url must include redbubble.com/i/');

  if (!imageUrl) reasons.push('image_url is required');
  else {
    const imageReason = invalidImageAssetReason(imageUrl);
    if (imageReason) reasons.push(imageReason);
  }

  let status: RedbubbleProductStatus = 'ready';
  if (!imageUrl) status = 'missing_image';
  if (reasons.length) status = status === 'missing_image' ? 'missing_image' : 'invalid';

  return { status, reasons } satisfies ValidationResult;
}

export function keywordsForProduct(product: Partial<RedbubbleProductRecord>) {
  return Array.from(new Set([
    ...parseList(product.tags),
    cleanText(product.niche).toLowerCase(),
    cleanText(product.product_type).toLowerCase(),
    'InkWanderStudio',
  ].map((value) => cleanText(value)).filter(Boolean))).slice(0, 12);
}

export async function ensureRedbubbleProductsTable() {
  await sql`
    create table if not exists redbubble_products (
      id uuid primary key default gen_random_uuid(),
      title text not null,
      redbubble_url text not null,
      image_url text,
      product_type text,
      niche text,
      tags jsonb default '[]'::jsonb,
      status text default 'ready',
      source text default 'google-sheets',
      notes text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`create unique index if not exists redbubble_products_url_idx on redbubble_products(redbubble_url)`;
  await sql`create index if not exists redbubble_products_status_idx on redbubble_products(status)`;
  await sql`create index if not exists redbubble_products_product_type_idx on redbubble_products(product_type)`;
  await sql`create index if not exists redbubble_products_niche_idx on redbubble_products(niche)`;
  await sql`create index if not exists redbubble_products_tags_idx on redbubble_products using gin(tags)`;
}

export async function importRedbubbleProductsCsv(csv: string): Promise<ImportSummary> {
  await ensureRedbubbleProductsTable();

  const rows = parseCsvRows(csv);
  const existingRows = await sql`select redbubble_url from redbubble_products`;
  const existingUrls = new Set(existingRows.map((row: any) => cleanText(row.redbubble_url).toLowerCase()));

  let imported = 0;
  let skipped = 0;
  let rejected = 0;
  const rejectedReasons: string[] = [];

  for (const row of rows) {
    const title = cleanText(row.title || row.name);
    const redbubbleUrl = cleanText(row.redbubble_url || row.product_url || row.url);
    const imageUrl = cleanText(row.image_url || row.image);
    const productType = cleanText(row.product_type);
    const niche = cleanText(row.niche);
    const tags = parseList(row.tags);
    const source = cleanText(row.source, 'google-sheets');
    const notes = cleanText(row.notes);
    const validation = validateRedbubbleProduct({
      title,
      redbubble_url: redbubbleUrl,
      image_url: imageUrl,
    });

    if (validation.reasons.length) {
      rejected += 1;
      if (rejectedReasons.length < 5) {
        rejectedReasons.push(`${title || redbubbleUrl || 'row'}: ${validation.reasons[0]}`);
      }
      continue;
    }

    if (existingUrls.has(redbubbleUrl.toLowerCase())) {
      skipped += 1;
      continue;
    }

    await sql`
      insert into redbubble_products (
        title,
        redbubble_url,
        image_url,
        product_type,
        niche,
        tags,
        status,
        source,
        notes
      )
      values (
        ${title},
        ${redbubbleUrl},
        ${imageUrl},
        ${productType || null},
        ${niche || null},
        ${JSON.stringify(tags)}::jsonb,
        ${validation.status},
        ${source},
        ${notes || null}
      )
    `;

    existingUrls.add(redbubbleUrl.toLowerCase());
    imported += 1;
  }

  return { imported, skipped, rejected, rejectedReasons };
}

export async function syncReadyProductsToPinterest(filters: {
  niche?: string;
  productType?: string;
}) {
  await ensureRedbubbleProductsTable();

  const rows = await sql`
    select *
    from redbubble_products
    where status = 'ready'
    order by updated_at desc nulls last, created_at desc
  `;

  const filteredRows = rows.filter((row: any) => {
    const niche = cleanText(filters.niche).toLowerCase();
    const productType = cleanText(filters.productType).toLowerCase();
    if (niche && cleanText(row.niche).toLowerCase() !== niche) return false;
    if (productType && cleanText(row.product_type).toLowerCase() !== productType) return false;
    return true;
  });

  let synced = 0;

  for (const row of filteredRows as RedbubbleProductRecord[]) {
    const [existing] = await sql`
      select id, pinterest_meta
      from products
      where target_url = ${row.redbubble_url}
      limit 1
    `;

    const description = `${row.title} from InkWanderStudio.${row.niche ? ` Niche: ${row.niche}.` : ''}${row.product_type ? ` Product type: ${row.product_type}.` : ''}`.trim();
    const keywords = keywordsForProduct(row);
    const source = cleanText(row.source, 'google-sheets');

    let productId = cleanText(existing?.id);
    let pinterestMeta = existing?.pinterest_meta;

    if (productId) {
      await sql`
        update products
        set title = ${row.title},
            description = ${description},
            image_url = ${row.image_url},
            cta_label = 'View on Redbubble',
            keywords = ${JSON.stringify(keywords)}::jsonb,
            source = ${source},
            status = 'active',
            updated_at = now()
        where id = ${productId}
      `;
    } else {
      const inserted = await sql`
        insert into products (
          title,
          description,
          image_url,
          target_url,
          cta_label,
          keywords,
          status,
          source
        )
        values (
          ${row.title},
          ${description},
          ${row.image_url},
          ${row.redbubble_url},
          'View on Redbubble',
          ${JSON.stringify(keywords)}::jsonb,
          'active',
          ${source}
        )
        returning id, pinterest_meta
      `;
      productId = cleanText(inserted[0]?.id);
      pinterestMeta = inserted[0]?.pinterest_meta;
    }

    const pins = await generateProductPinterestPins({
      id: productId,
      title: row.title,
      description,
      image_url: row.image_url,
      target_url: row.redbubble_url,
      keywords,
      source,
      count: 8,
    });

    await sql`
      update products
      set pinterest_meta = ${JSON.stringify(
        normalizeProductPinterestMeta(
          pinterestMeta,
          attachProductPinUrls(productId, pins),
        )
      )}::jsonb,
          updated_at = now()
      where id = ${productId}
    `;

    synced += 1;
  }

  return { synced, total: filteredRows.length };
}

export function productTypeOptions(rows: any[]) {
  return Array.from(new Set(rows.map((row) => cleanText(row.product_type)).filter(Boolean))).sort();
}

export function nicheOptions(rows: any[]) {
  return Array.from(new Set(rows.map((row) => cleanText(row.niche)).filter(Boolean))).sort();
}
