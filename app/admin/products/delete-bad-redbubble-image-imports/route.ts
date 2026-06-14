import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function redirectWithNotice(request: NextRequest, message: string) {
  const url = new URL('/admin/products', request.url);
  url.searchParams.set('notice', message);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: NextRequest) {
  try {
    const result = await sql`
      with deleted as (
        delete from products
        where (
          source like 'redbubble:%'
          or coalesce(target_url, '') ~* '^https?://(?:www\.)?redbubble\.com/'
        )
          and (
            coalesce(image_url, '') ~* '(/boom/client/|\.svg(\?|#|$)|www\.redbubble\.com/boom)'
            or coalesce(image_url, '') !~* '^https?://ih[01]\.redbubble\.net/.*/image\..*\.(png|jpe?g|webp)(\?|#|$)'
          )
        returning id
      )
      select count(*)::int as count from deleted
    `;

    return redirectWithNotice(request, `Deleted ${result[0]?.count || 0} bad Redbubble image imports.`);
  } catch (error) {
    console.error('Failed to delete bad Redbubble image imports', error);
    return redirectWithNotice(request, 'Cleanup failed. Could not delete bad Redbubble image imports.');
  }
}

export async function GET(request: NextRequest) {
  return redirectWithNotice(request, 'Use the cleanup button to delete bad Redbubble image imports.');
}
