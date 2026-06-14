import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { sanitizeImportedProductTitle } from '@/lib/redbubbleProductSource';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ProductRow = {
  id: string;
  title?: string | null;
  source?: string | null;
  target_url?: string | null;
};

function redirectWithNotice(request: NextRequest, message: string) {
  const url = new URL('/admin/products', request.url);
  url.searchParams.set('notice', message);
  return NextResponse.redirect(url, { status: 303 });
}

function cleanText(value: unknown) {
  return String(value || '').trim();
}

function isImportedRedbubbleProduct(product: ProductRow) {
  const source = cleanText(product.source).toLowerCase();
  const targetUrl = cleanText(product.target_url).toLowerCase();
  return source.startsWith('redbubble:') || targetUrl.includes('redbubble.com/');
}

function looksContaminatedTitle(title: unknown) {
  const text = cleanText(title).toLowerCase();
  return (
    text.includes('<img')
    || text.includes('<svg')
    || text.includes('data-testid=')
    || text.includes('loading="lazy"')
    || text.includes('class="favoriteicon_')
    || text.includes('/frontend-static/_next/static/media/')
    || text.includes('style="position:absolute')
  );
}

async function fetchImportedRedbubbleProducts() {
  const rows = await sql`
    select id, title, source, target_url
    from products
    where source like 'redbubble:%'
       or target_url like 'https://%redbubble.com/%'
       or target_url like 'http://%redbubble.com/%'
  `;
  return rows as ProductRow[];
}

export async function POST(request: NextRequest) {
  try {
    const products = await fetchImportedRedbubbleProducts();
    const candidates = products.filter((product) => isImportedRedbubbleProduct(product) && looksContaminatedTitle(product.title));

    let repaired = 0;

    for (const product of candidates) {
      const repairedTitle = sanitizeImportedProductTitle(product.title, cleanText(product.target_url));
      if (!repairedTitle || repairedTitle === cleanText(product.title)) continue;

      await sql`
        update products
        set title = ${repairedTitle},
            updated_at = now()
        where id = ${product.id}
      `;
      repaired += 1;
    }

    return redirectWithNotice(request, `Repaired ${repaired} bad Redbubble product titles.`);
  } catch (error: any) {
    return redirectWithNotice(request, `Title repair failed: ${error?.message || 'Unknown error'}`);
  }
}

export async function GET(request: NextRequest) {
  return redirectWithNotice(request, 'Use the repair button to clean bad Redbubble product titles.');
}
