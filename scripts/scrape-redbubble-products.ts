import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Page } from 'playwright';
import { isInkWanderStudioProductUrl, sanitizeImportedProductTitle } from '../lib/redbubbleProductSource';

type ProductRow = {
  title: string;
  product_url: string;
  image_url: string;
  product_type: string;
  source_shop: string;
};

type DesignLibraryRow = {
  title: string;
  image_url: string;
  redbubble_url: string;
  product_url: string;
  niche: string;
  tags: string;
  product_type: string;
  mood: string;
  notes: string;
  ai_keywords: string;
  ai_caption_seed: string;
  source: string;
};

type ScrapeDiagnostics = {
  page: number;
  discoveredUrlCount: number;
  firstProductUrls: string[];
};

type PageScrapeResult = {
  productUrls: string[];
  diagnostics: ScrapeDiagnostics;
};

type ProductPageResult = {
  title: string;
  image_url: string;
  product_url: string;
  product_type: string;
  source_shop: string;
};

const SHOP_URL = 'https://www.redbubble.com/people/inkwanderstudio/shop';
const SOURCE_SHOP = 'InkWanderStudio';
const OUTPUT_JSON = 'redbubble-products.json';
const OUTPUT_CSV = 'redbubble-products.csv';
const DESIGN_LIBRARY_OUTPUT_JSON = 'design-library-import.json';
const DESIGN_LIBRARY_OUTPUT_CSV = 'design-library-import.csv';
const MOBILE_VIEWPORT = { width: 390, height: 844 };

function cleanText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function csvEscape(value: unknown) {
  const text = cleanText(value);
  if (!text) return '';
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function productTypeFromUrl(productUrl: string) {
  try {
    const parts = new URL(productUrl).pathname.split('/').filter(Boolean);
    const index = parts.indexOf('i');
    const raw = index >= 0 ? parts[index + 1] || '' : '';
    if (!raw) return '';
    return raw
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  } catch {
    return '';
  }
}

function titleFromUrl(productUrl: string) {
  try {
    const parts = new URL(productUrl).pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const index = parts.indexOf('i');
    const slug = parts[index + 2] || parts.find((part) => part.includes('-by-')) || '';
    return cleanText(slug.replace(/-by-.+$/i, '').replace(/-/g, ' ')).replace(/\b\w/g, (char) => char.toUpperCase());
  } catch {
    return '';
  }
}

function hasBadTitle(title: string) {
  const value = cleanText(title).toLowerCase();
  return (
    !value
    || value === 'favorite'
    || value === 'add to favorites'
    || value === 'add to cart'
    || value === 'cart'
    || value === 'redbubble'
    || value === 'inkwanderstudio'
    || value.startsWith('tags:')
    || value.startsWith('from $')
    || value.startsWith('$')
  );
}

function hasBadImageUrl(url: string) {
  const value = cleanText(url).toLowerCase();
  return (
    !value
    || value.includes('/boom/client/')
    || value.includes('.svg')
    || value.includes('/avatar')
    || value.includes('avatar.')
    || value.includes('logo')
    || value.includes('icon')
    || value.includes('favorite')
    || value.includes('heart')
  );
}

function detectNiche(title: string, productType: string) {
  const haystack = `${cleanText(title)} ${cleanText(productType)}`.toLowerCase();
  if (/coffee|espresso|latte|cafe|caffeine/.test(haystack)) return 'coffee culture';
  if (/introvert|homebody|social battery|quiet|stay home/.test(haystack)) return 'introvert humor';
  if (/millennial|adulting|burnout|morally exhausted|financially flexible|nostalgia/.test(haystack)) return 'millennial humor';
  if (/cat|dog|frog|goose|duck|bird|bear|raccoon|animal/.test(haystack)) return 'sarcastic animals';
  return 'relatable stickers';
}

function detectMood(niche: string) {
  if (niche === 'coffee culture') return 'Cafe cozy';
  if (niche === 'introvert humor') return 'Quiet cozy';
  if (niche === 'millennial humor') return 'Witty burnout';
  if (niche === 'sarcastic animals') return 'Playful sarcasm';
  return 'Soft relatable';
}

function designTags(title: string, niche: string, productType: string) {
  return Array.from(new Set([
    niche,
    cleanText(productType).toLowerCase(),
    'InkWanderStudio',
    ...cleanText(title)
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((part) => part.length >= 4)
      .slice(0, 4),
  ].filter(Boolean)));
}

function toDesignLibraryRow(row: ProductRow): DesignLibraryRow {
  const niche = detectNiche(row.title, row.product_type);
  const mood = detectMood(niche);
  const tags = designTags(row.title, niche, row.product_type);

  return {
    title: row.title,
    image_url: row.image_url,
    redbubble_url: row.product_url,
    product_url: row.product_url,
    niche,
    tags: tags.join(', '),
    product_type: row.product_type,
    mood,
    notes: `Imported from the ${SOURCE_SHOP} Redbubble shop via the local Playwright sync.`,
    ai_keywords: tags.join(', '),
    ai_caption_seed: `${row.title} by ${SOURCE_SHOP}`,
    source: 'redbubble-sync',
  };
}

async function waitForProductGrid(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => document.querySelectorAll('a[href*="/i/"]').length > 3, undefined, { timeout: 30000 });
}

async function autoScroll(page: Page) {
  let previousHeight = -1;
  for (let index = 0; index < 12; index += 1) {
    const currentHeight = await page.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' as ScrollBehavior });
      return document.body.scrollHeight;
    });
    await page.waitForTimeout(1200);
    if (currentHeight === previousHeight) break;
    previousHeight = currentHeight;
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }));
  await page.waitForTimeout(600);
}

async function scrapeCurrentPage(page: Page, pageNumber: number): Promise<PageScrapeResult> {
  const browserScript = String.raw`(() => {
    const currentPage = ${JSON.stringify(pageNumber)};

    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const normalizeUrl = (value) => {
      const text = clean(value);
      if (!text) return '';
      if (text.startsWith('//')) return 'https:' + text;
      if (text.startsWith('/')) return new URL(text, location.origin).toString();
      return text;
    };
    const uniqueBy = (items, keyFn) => Array.from(new Map(items.map((item) => [keyFn(item), item])).values());
    const visibleRect = (el) => {
      if (!el || !(el instanceof HTMLElement)) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.right <= 0) return null;
      return rect;
    };
    const links = uniqueBy(
      Array.from(document.querySelectorAll('a[href]'))
        .map((anchor) => {
          const href = normalizeUrl(anchor.getAttribute('href') || anchor.href);
          if (!href.includes('/i/')) return null;
          const rect = visibleRect(anchor);
          if (!rect) return null;
          return {
            productUrl: href,
            rect,
          };
        })
        .filter(Boolean),
      (item) => item.productUrl
    );
    const uniqueUrls = links
      .map((item) => item.productUrl)
      .filter((url) => url.includes('-by-InkWanderStudio/') || url.includes('-by-inkwanderstudio/'));
    return {
      productUrls: uniqueUrls,
      diagnostics: {
        page: currentPage,
        discoveredUrlCount: uniqueUrls.length,
        firstProductUrls: uniqueUrls.slice(0, 10),
      },
    };
  })()`;

  return page.evaluate<PageScrapeResult>(browserScript);
}

function validProductImageUrl(url: string) {
  const value = cleanText(url).toLowerCase();
  if (hasBadImageUrl(value)) return false;
  return /https?:\/\/ih[0-9]\.redbubble\.net\/image\.[^"'?\s]+\.(png|jpe?g|webp)(\?|$)/i.test(value);
}

async function scrapeProductPage(page: Page, productUrl: string): Promise<ProductPageResult | null> {
  await page.goto(productUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const browserScript = String.raw`((targetUrl) => {
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const normalizeUrl = (value) => {
      const text = clean(value);
      if (!text) return '';
      if (text.startsWith('//')) return 'https:' + text;
      if (text.startsWith('/')) return new URL(text, location.origin).toString();
      return text;
    };
    const metaContent = (selector) => {
      const node = document.querySelector(selector);
      return clean(node?.getAttribute('content'));
    };
    const badImage = (value) => {
      const url = clean(value).toLowerCase();
      return !url || url.includes('/boom/client/') || url.includes('.svg') || url.includes('/avatar') || url.includes('avatar.') || url.includes('logo') || url.includes('icon') || url.includes('favorite') || url.includes('heart');
    };
    const directImage = (value) => {
      const url = clean(value);
      if (badImage(url)) return false;
      return /https?:\/\/ih[0-9]\.redbubble\.net\/image\.[^"'?\s]+\.(png|jpe?g|webp)(\?|$)/i.test(url);
    };
    const titleFromUrl = (value) => {
      try {
        const parts = new URL(value).pathname.split('/').filter(Boolean).map(decodeURIComponent);
        const index = parts.indexOf('i');
        const slug = parts[index + 2] || parts.find((part) => part.includes('-by-')) || '';
        return clean(slug.replace(/-by-.+$/i, '').replace(/-/g, ' ')).replace(/\b\w/g, (char) => char.toUpperCase());
      } catch {
        return '';
      }
    };
    const productTypeFromUrl = (value) => {
      try {
        const parts = new URL(value).pathname.split('/').filter(Boolean);
        const index = parts.indexOf('i');
        const raw = index >= 0 ? parts[index + 1] || '' : '';
        if (!raw) return '';
        return raw.split('-').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
      } catch {
        return '';
      }
    };

    const title = clean(
      metaContent('meta[property="og:title"]') ||
      metaContent('meta[name="twitter:title"]') ||
      document.querySelector('h1')?.textContent ||
      document.title
    )
      .replace(/\s*\|\s*Redbubble\s*$/i, '')
      .replace(/\s*by\s+InkWanderStudio\s*$/i, '')
      .trim();

    const imageCandidates = [
      normalizeUrl(metaContent('meta[property="og:image:secure_url"]')),
      normalizeUrl(metaContent('meta[property="og:image"]')),
      normalizeUrl(metaContent('meta[name="twitter:image"]')),
      ...Array.from(document.querySelectorAll('img[src], img[srcset]')).flatMap((img) => {
        const urls = [
          normalizeUrl(img.getAttribute('src')),
          normalizeUrl(img.getAttribute('data-src')),
          normalizeUrl(img.getAttribute('srcset')?.split(',')[0]?.trim()?.split(/\s+/)[0]),
          normalizeUrl(img.getAttribute('data-srcset')?.split(',')[0]?.trim()?.split(/\s+/)[0]),
          normalizeUrl(img.currentSrc),
        ];
        return urls.filter(Boolean);
      }),
    ].filter(Boolean);

    const imageUrl = imageCandidates.find((candidate) => directImage(candidate)) || '';

    return {
      title: title || titleFromUrl(targetUrl),
      image_url: imageUrl,
      product_url: targetUrl,
      product_type: productTypeFromUrl(targetUrl),
      source_shop: ${JSON.stringify(SOURCE_SHOP)},
    };
  })(${JSON.stringify(productUrl)})`;

  const row = await page.evaluate<ProductPageResult>(browserScript);
  const safeTitle = sanitizeImportedProductTitle(row.title, row.product_url);

  if (!row.product_url || !row.image_url || !isInkWanderStudioProductUrl(row.product_url)) return null;
  if (hasBadTitle(safeTitle) || !validProductImageUrl(row.image_url)) return null;

  return {
    ...row,
    title: safeTitle || titleFromUrl(row.product_url),
    product_type: row.product_type || productTypeFromUrl(row.product_url),
  };
}

async function gotoNextPage(page: Page) {
  const candidates = [
    page.locator('a[rel="next"]').first(),
    page.locator('a[aria-label*="Next"]').first(),
    page.locator('button[aria-label*="Next"]').first(),
    page.locator('a:has-text("Next")').first(),
    page.locator('button:has-text("Next")').first(),
  ];

  for (const locator of candidates) {
    if (await locator.count() === 0) continue;
    if (!(await locator.isVisible())) continue;
    const ariaDisabled = (await locator.getAttribute('aria-disabled')) || '';
    const disabled = await locator.getAttribute('disabled');
    if (ariaDisabled === 'true' || disabled !== null) continue;

    const href = await locator.getAttribute('href');
    if (href && href !== '#' && href !== page.url()) {
      await page.goto(new URL(href, page.url()).toString(), { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      return true;
    }

    await locator.click({ timeout: 5000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1200);
    return true;
  }

  return false;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const shopPage = await browser.newPage({
    viewport: MOBILE_VIEWPORT,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const productPage = await browser.newPage({
    viewport: MOBILE_VIEWPORT,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });

  const rowsByUrl = new Map<string, ProductRow>();
  const discoveredUrls = new Set<string>();
  const diagnostics: ScrapeDiagnostics[] = [];

  try {
    await shopPage.goto(SHOP_URL, { waitUntil: 'domcontentloaded' });

    for (let pageNumber = 1; pageNumber <= 20; pageNumber += 1) {
      await waitForProductGrid(shopPage);
      await autoScroll(shopPage);
      const result = await scrapeCurrentPage(shopPage, pageNumber);
      diagnostics.push(result.diagnostics);

      for (const productUrl of result.productUrls) {
        if (isInkWanderStudioProductUrl(productUrl)) discoveredUrls.add(productUrl);
      }

      const moved = await gotoNextPage(shopPage);
      if (!moved) break;
    }

    let processed = 0;
    for (const productUrl of discoveredUrls) {
      const row = await scrapeProductPage(productPage, productUrl);
      processed += 1;
      if (!row) continue;
      if (!rowsByUrl.has(row.product_url)) rowsByUrl.set(row.product_url, row);
      if (processed % 10 === 0) {
        console.log(`Processed ${processed}/${discoveredUrls.size} product pages...`);
      }
    }
  } finally {
    await browser.close();
  }

  const rows = Array.from(rowsByUrl.values());
  const designLibraryRows = rows.map(toDesignLibraryRow);
  const csv = [
    'title,product_url,image_url,product_type,source_shop',
    ...rows.map((row) => [
      csvEscape(row.title),
      csvEscape(row.product_url),
      csvEscape(row.image_url),
      csvEscape(row.product_type),
      csvEscape(row.source_shop),
    ].join(',')),
  ].join('\n');
  const designLibraryCsv = [
    'title,image_url,redbubble_url,product_url,niche,tags,product_type,mood,notes,ai_keywords,ai_caption_seed,source',
    ...designLibraryRows.map((row) => [
      csvEscape(row.title),
      csvEscape(row.image_url),
      csvEscape(row.redbubble_url),
      csvEscape(row.product_url),
      csvEscape(row.niche),
      csvEscape(row.tags),
      csvEscape(row.product_type),
      csvEscape(row.mood),
      csvEscape(row.notes),
      csvEscape(row.ai_keywords),
      csvEscape(row.ai_caption_seed),
      csvEscape(row.source),
    ].join(',')),
  ].join('\n');

  const cwd = process.cwd();
  const outputDir = path.resolve(cwd);
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, OUTPUT_JSON), `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
  await writeFile(path.join(outputDir, OUTPUT_CSV), `${csv}\n`, 'utf8');
  await writeFile(path.join(outputDir, DESIGN_LIBRARY_OUTPUT_JSON), `${JSON.stringify(designLibraryRows, null, 2)}\n`, 'utf8');
  await writeFile(path.join(outputDir, DESIGN_LIBRARY_OUTPUT_CSV), `${designLibraryCsv}\n`, 'utf8');

  console.log(`Scraped ${rows.length} unique Redbubble products.`);
  console.table(diagnostics.map((item) => ({
    page: item.page,
    discoveredUrls: item.discoveredUrlCount,
  })));
  console.log(`Discovered ${discoveredUrls.size} product URLs and kept ${rows.length} exact product-page matches.`);
  console.log(`Wrote ${OUTPUT_JSON}, ${OUTPUT_CSV}, ${DESIGN_LIBRARY_OUTPUT_JSON}, and ${DESIGN_LIBRARY_OUTPUT_CSV} in ${outputDir}`);
}

main().catch((error) => {
  console.error('Redbubble Playwright scraper failed:', error);
  process.exitCode = 1;
});
