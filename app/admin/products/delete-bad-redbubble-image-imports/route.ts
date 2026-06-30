import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ProductRow = {
  id: string;
  image_url?: string | null;
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
  const maybeError = error as { message?: string; name?: string; stack?: string; cause?: unknown };
  return maybeError.message || maybeError.name || 'Unknown error';
}

function logCleanupError(stage: string, error: unknown, extra: Record<string, unknown> = {}) {
  const maybeError = error as { message?: string; name?: string; stack?: string; cause?: unknown };
  console.error('Redbubble bad image cleanup failed', {
    stage,
    table: 'products',
    imageColumn: 'image_url',
    statusColumn: 'status',
    message: maybeError?.message || String(error),
    name: maybeError?.name,
    stack: maybeError?.stack,
    cause: maybeError?.cause,
    ...extra,
  });
}

function cleanText(value: unknown) {
  return String(value || '').trim();
}

function isImportedRedbubbleProduct(product: ProductRow) {
  const source = cleanText(product.source).toLowerCase();
  const targetUrl = cleanText(product.target_url).toLowerCase();
  return source.startsWith('redbubble:') || targetUrl.includes('redbubble.com/');
}

function isBadRedbubbleImageUrl(value: unknown) {
  const imageUrl = cleanText(value).toLowerCase();
  if (!imageUrl) return true;
  if (imageUrl.includes('/boom/client/')) return true;
  if (imageUrl.endsWith('.svg')) return true;
  if (imageUrl.includes('.svg?')) return true;
  if (imageUrl.includes('.svg#')) return true;
  if (imageUrl.includes('www.redbubble.com/boom')) return true;
  if (!imageUrl.includes('ih0.redbubble.net') && !imageUrl.includes('ih1.redbubble.net')) return true;
  if (!imageUrl.includes('/image.')) return true;
  return false;
}

async function fetchImportedRedbubbleProducts() {
  const rows = await sql`
    select id, image_url, source, target_url
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

async function deleteBadImports(ids: string[]) {
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

async function invalidateBadImports(ids: string[]) {
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
              validation_status = 'bad_image_url',
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
              validation_status = 'bad_image_url'
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
    const badProducts = importedProducts.filter((product) => isImportedRedbubbleProduct(product) && isBadRedbubbleImageUrl(product.image_url));
    const badIds = badProducts.map((product) => String(product.id)).filter(Boolean);

    if (badIds.length === 0) {
      return redirectWithNotice(request, 'Cleaned 0 bad Redbubble image imports.');
    }

    try {
      const deletedCount = await deleteBadImports(badIds);
      return redirectWithNotice(request, `Cleaned ${deletedCount} bad Redbubble image imports.`);
    } catch (deleteError) {
      logCleanupError('delete', deleteError, { badIds, badCount: badIds.length });

      try {
        const invalidatedCount = await invalidateBadImports(badIds);
        return redirectWithNotice(request, `Cleaned ${invalidatedCount} bad Redbubble image imports.`);
      } catch (updateError) {
        logCleanupError('invalidate', updateError, { badIds, badCount: badIds.length });
        const notice = process.env.NODE_ENV === 'production'
          ? `Cleanup failed: ${errorMessage(updateError)}`
          : `Cleanup failed. delete_error=${errorMessage(deleteError)} invalidate_error=${errorMessage(updateError)}`;
        return redirectWithNotice(request, notice);
      }
    }
  } catch (error) {
    logCleanupError('fetch-and-filter', error);
    const notice = process.env.NODE_ENV === 'production'
      ? `Cleanup failed: ${errorMessage(error)}`
      : `Cleanup failed while loading imported Redbubble products: ${errorMessage(error)}`;
    return redirectWithNotice(request, notice);
  }
}

export async function GET(request: NextRequest) {
  return redirectWithNotice(request, 'Use the cleanup button to delete bad Redbubble image imports.');
}
