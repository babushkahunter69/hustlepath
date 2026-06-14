import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BAD_IMAGE_WHERE_SQL = `
  (
    source like 'redbubble:%'
    or coalesce(target_url, '') ~* '^https?://(?:www\\.)?redbubble\\.com/'
  )
  and (
    coalesce(image_url, '') ~* '(/boom/client/|\\.svg(\\?|#|$)|www\\.redbubble\\.com/boom)'
    or coalesce(image_url, '') !~* '^https?://ih[01]\\.redbubble\\.net/.*/image\\..*\\.(png|jpe?g|webp)(\\?|#|$)'
  )
`;

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
    where: BAD_IMAGE_WHERE_SQL,
    message: maybeError?.message || String(error),
    name: maybeError?.name,
    stack: maybeError?.stack,
    cause: maybeError?.cause,
    ...extra,
  });
}

async function countBadImports() {
  const result = await sql(`
    select count(*)::int as count
    from products
    where ${BAD_IMAGE_WHERE_SQL}
  `);
  return Number(result[0]?.count || 0);
}

async function deleteBadImports() {
  const result = await sql(`
    with deleted as (
      delete from products
      where ${BAD_IMAGE_WHERE_SQL}
      returning id
    )
    select count(*)::int as count from deleted
  `);
  return Number(result[0]?.count || 0);
}

async function invalidateBadImports() {
  const result = await sql(`
    with updated as (
      update products
      set status = 'archived',
          updated_at = now()
      where ${BAD_IMAGE_WHERE_SQL}
      returning id
    )
    select count(*)::int as count from updated
  `);
  return Number(result[0]?.count || 0);
}

export async function POST(request: NextRequest) {
  try {
    const candidateCount = await countBadImports();

    if (candidateCount === 0) {
      return redirectWithNotice(request, 'Deleted 0 bad imports.');
    }

    try {
      const deletedCount = await deleteBadImports();
      return redirectWithNotice(request, `Deleted ${deletedCount} bad imports.`);
    } catch (deleteError) {
      logCleanupError('delete', deleteError, { candidateCount });

      try {
        const invalidatedCount = await invalidateBadImports();
        return redirectWithNotice(request, `Marked ${invalidatedCount} bad imports invalid.`);
      } catch (updateError) {
        logCleanupError('invalidate', updateError, { candidateCount });
        const message = errorMessage(updateError) || errorMessage(deleteError);
        const notice = process.env.NODE_ENV === 'production'
          ? `Cleanup failed. Delete blocked and invalidation failed: ${message}`
          : `Cleanup failed. table=products image_column=image_url delete_error=${errorMessage(deleteError)} invalidate_error=${message}`;
        return redirectWithNotice(request, notice);
      }
    }
  } catch (error) {
    logCleanupError('count', error);
    const message = errorMessage(error);
    const notice = process.env.NODE_ENV === 'production'
      ? `Cleanup failed: ${message}`
      : `Cleanup failed while inspecting products.image_url: ${message}`;
    return redirectWithNotice(request, notice);
  }
}

export async function GET(request: NextRequest) {
  return redirectWithNotice(request, 'Use the cleanup button to delete bad Redbubble image imports.');
}
