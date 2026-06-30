import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { importRedbubbleProduct, isInkWanderStudioProductUrl, isRedbubbleProductUrl, sanitizeImportedProductTitle } from '@/lib/redbubbleProductSource';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ProductRow = {
  id: string;
  title?: string | null;
  description?: string | null;
  image_url?: string | null;
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
    select id, title, description, image_url, source, target_url
    from products
    where source like 'redbubble:%'
       or target_url like 'https://%redbubble.com/%'
       or target_url like 'http://%redbubble.com/%'
  `;
  return rows as ProductRow[];
}

function keywordJson(productType: string, sourceShopName: string | undefined, existingDescription: string, importedDescription: string) {
  const values = [productType, sourceShopName, existingDescription, importedDescription]
    .map((value) => cleanText(value))
    .filter(Boolean);
  return JSON.stringify(Array.from(new Set(values)));
}

export async function POST(request: NextRequest) {
  try {
    const products = await fetchImportedRedbubbleProducts();
    let repairedTitles = 0;
    let refreshedSources = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const product of products) {
      const targetUrl = cleanText(product.target_url);
      const originalTitle = cleanText(product.title);
      const repairedTitle = sanitizeImportedProductTitle(product.title, targetUrl);

      if (looksContaminatedTitle(product.title) && repairedTitle && repairedTitle !== originalTitle) {
        await sql`
          update products
          set title = ${repairedTitle},
              updated_at = now()
          where id = ${product.id}
        `;
        repairedTitles += 1;
      }

      if (!targetUrl || !isImportedRedbubbleProduct(product) || !isRedbubbleProductUrl(targetUrl) || !isInkWanderStudioProductUrl(targetUrl)) {
        skipped += 1;
        continue;
      }

      const imported = await importRedbubbleProduct(targetUrl);
      if (!imported.ok) {
        skipped += 1;
        if (imported.error) errors.push(`${targetUrl}: ${imported.error}`);
        continue;
      }

      const nextTitle = sanitizeImportedProductTitle(imported.title, imported.targetUrl);
      await sql`
        update products
        set title = ${nextTitle || repairedTitle || originalTitle},
            description = ${cleanText(imported.description) || cleanText(product.description) || null},
            target_url = ${imported.targetUrl},
            image_url = ${imported.imageUrl},
            keywords = ${keywordJson(imported.productType, imported.sourceShopName, cleanText(product.description), cleanText(imported.description))}::jsonb,
            status = 'active',
            source = ${`redbubble:${imported.sourceShopName || 'InkWanderStudio'}`},
            updated_at = now()
        where id = ${product.id}
      `;
      refreshedSources += 1;
    }

    const suffix = errors.length ? ` First issues: ${errors.slice(0, 3).join(' | ')}` : '';
    return redirectWithNotice(request, `Repaired ${repairedTitles} bad Redbubble titles and refreshed ${refreshedSources} Redbubble source records. Skipped ${skipped}.${suffix}`);
  } catch (error: any) {
    return redirectWithNotice(request, `Title repair failed: ${error?.message || 'Unknown error'}`);
  }
}

export async function GET(request: NextRequest) {
  return redirectWithNotice(request, 'Use the repair button to clean bad Redbubble product titles.');
}
