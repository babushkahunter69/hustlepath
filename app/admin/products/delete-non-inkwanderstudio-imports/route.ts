import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isInkWanderStudioProductUrl } from '@/lib/redbubbleProductSource';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ProductRow = {
  id: string;
  source?: string | null;
  target_url?: string | null;
};

function redirectWithNotice(request: NextRequest, message: string) {
  const url = new URL('/admin/products', request.url);
  url.searchParams.set('notice', message);
  return NextResponse.redirect(url, { status: 303 });
}

function errorMessage(error: unknown) {
  if (!error || typeof error !== 'object') return String(error || 'Unknown error');
  const maybeError = error as { message?: string; name?: string };
  return maybeError.message || maybeError.name || 'Unknown error';
}

function cleanText(value: unknown) {
  return String(value || '').trim();
}

function isImportedRedbubbleProduct(product: ProductRow) {
  const source = cleanText(product.source).toLowerCase();
  const targetUrl = cleanText(product.target_url).toLowerCase();
  return source.startsWith('redbubble:') || targetUrl.includes('redbubble.com/');
}

function isForeignArtistImport(product: ProductRow) {
  const targetUrl = cleanText(product.target_url);
  return Boolean(targetUrl) && isImportedRedbubbleProduct(product) && !isInkWanderStudioProductUrl(targetUrl);
}

async function fetchImportedRedbubbleProducts() {
  const rows = await sql`
    select id, source, target_url
    from products
    where source like 'redbubble:%'
       or target_url like 'https://%redbubble.com/%'
       or target_url like 'http://%redbubble.com/%'
  `;
  return rows as ProductRow[];
}

async function fetchProductsColumnNames() {
  const rows = await sql`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
  `;
  return new Set(rows.map((row: any) => String(row.column_name || '').toLowerCase()).filter(Boolean));
}

async function deleteImports(ids: string[]) {
  let deletedCount = 0;

  for (const id of ids) {
    const result = await sql`
      with deleted as (
        delete from products
        where id = ${id}
        returning id
      )
      select count(*)::int as count from deleted
    `;
    deletedCount += Number(result[0]?.count || 0);
  }

  return deletedCount;
}

async function invalidateImports(ids: string[]) {
  const columns = await fetchProductsColumnNames();
  const hasReady = columns.has('ready');
  const hasValidationStatus = columns.has('validation_status');
  const hasUpdatedAt = columns.has('updated_at');
  let invalidatedCount = 0;

  for (const id of ids) {
    let updated = 0;

    if (hasReady && hasValidationStatus && hasUpdatedAt) {
      const result = await sql`
        with updated as (
          update products
          set status = 'invalid',
              ready = false,
              validation_status = 'foreign_artist',
              updated_at = now()
          where id = ${id}
          returning id
        )
        select count(*)::int as count from updated
      `;
      updated = Number(result[0]?.count || 0);
    } else if (hasReady && hasValidationStatus) {
      const result = await sql`
        with updated as (
          update products
          set status = 'invalid',
              ready = false,
              validation_status = 'foreign_artist'
          where id = ${id}
          returning id
        )
        select count(*)::int as count from updated
      `;
      updated = Number(result[0]?.count || 0);
    } else if (hasUpdatedAt) {
      const result = await sql`
        with updated as (
          update products
          set status = 'invalid',
              updated_at = now()
          where id = ${id}
          returning id
        )
        select count(*)::int as count from updated
      `;
      updated = Number(result[0]?.count || 0);
    } else {
      const result = await sql`
        with updated as (
          update products
          set status = 'invalid'
          where id = ${id}
          returning id
        )
        select count(*)::int as count from updated
      `;
      updated = Number(result[0]?.count || 0);
    }

    invalidatedCount += updated;
  }

  return invalidatedCount;
}

export async function POST(request: NextRequest) {
  try {
    const importedProducts = await fetchImportedRedbubbleProducts();
    const foreignProducts = importedProducts.filter(isForeignArtistImport);
    const ids = foreignProducts.map((product) => String(product.id)).filter(Boolean);

    if (ids.length === 0) {
      return redirectWithNotice(request, 'Removed 0 non-InkWanderStudio Redbubble imports.');
    }

    try {
      const deletedCount = await deleteImports(ids);
      return redirectWithNotice(request, `Removed ${deletedCount} non-InkWanderStudio Redbubble imports.`);
    } catch (deleteError) {
      try {
        const invalidatedCount = await invalidateImports(ids);
        return redirectWithNotice(request, `Marked ${invalidatedCount} non-InkWanderStudio Redbubble imports invalid.`);
      } catch (updateError) {
        const detail = process.env.NODE_ENV === 'production'
          ? errorMessage(updateError)
          : `delete_error=${errorMessage(deleteError)} invalidate_error=${errorMessage(updateError)}`;
        return redirectWithNotice(request, `Cleanup failed: ${detail}`);
      }
    }
  } catch (error) {
    return redirectWithNotice(request, `Cleanup failed: ${errorMessage(error)}`);
  }
}

export async function GET(request: NextRequest) {
  return redirectWithNotice(request, 'Use the cleanup button to remove non-InkWanderStudio Redbubble imports.');
}
