import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Page } from 'playwright';

type ProductRow = {
  title: string;
  product_url: string;
  image_url: string;
  product_type: string;
  source_shop: string;
};

type ScrapeDiagnostics = {
  page: number;
  productLinkCount: number;
  visibleLargeImageCount: number;
  acceptedImageCount: number;
  rowCount: number;
  firstProductUrls: string[];
  firstImageUrls: string[];
};

type PageScrapeResult = {
  rows: ProductRow[];
  diagnostics: ScrapeDiagnostics;
};

const SHOP_URL = 'https://www.redbubble.com/people/inkwanderstudio/shop';
const SOURCE_SHOP = 'InkWanderStudio';
const OUTPUT_JSON = 'redbubble-products.json';
const OUTPUT_CSV = 'redbubble-products.csv';
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

async function waitForProductGrid(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => document.querySelectorAll('a[href*="/i/"]').length > 12, undefined, { timeout: 30000 });
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
  return page.evaluate(({ sourceShop, currentPage }) => {
    const clean = (value: unknown) => String(value || '').replace(/\s+/g, ' ').trim();
    const normalizeUrl = (value: unknown) => {
      const text = clean(value);
      if (!text) return '';
      if (text.startsWith('//')) return `https:${text}`;
      if (text.startsWith('/')) return new URL(text, location.origin).toString();
      return text;
    };
    const uniqueBy = <T,>(items: T[], keyFn: (item: T) => string) => Array.from(new Map(items.map((item) => [keyFn(item), item])).values());
    const srcsetUrls = (srcset: unknown) => clean(srcset)
      .split(',')
      .map((part) => normalizeUrl(clean(part).split(/\s+/)[0]))
      .filter(Boolean);
    const backgroundUrls = (value: unknown) => {
      const text = clean(value);
      const urls: string[] = [];
      if (!text) return urls;
      let cursor = 0;
      while (cursor < text.length) {
        const start = text.indexOf('url(', cursor);
        if (start === -1) break;
        const end = text.indexOf(')', start + 4);
        if (end === -1) break;
        let candidate = text.slice(start + 4, end).trim();
        if ((candidate.startsWith('"') && candidate.endsWith('"')) || (candidate.startsWith("'") && candidate.endsWith("'"))) {
          candidate = candidate.slice(1, -1);
        }
        const normalized = normalizeUrl(candidate);
        if (normalized) urls.push(normalized);
        cursor = end + 1;
      }
      return urls;
    };
    const visibleRect = (el: Element | null) => {
      if (!el || !(el instanceof HTMLElement)) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.right <= 0) return null;
      return rect;
    };
    const largeVisibleRect = (el: Element | null) => {
      const rect = visibleRect(el);
      if (!rect) return null;
      if (rect.width <= 80 || rect.height <= 80) return null;
      return rect;
    };
    const isBadTitle = (value: unknown) => {
      const title = clean(value).toLowerCase();
      return !title || title === 'favorite' || title === 'add to favorites' || title === 'add to cart' || title === 'cart' || title === 'redbubble' || title === 'inkwanderstudio' || title.startsWith('tags:') || title.startsWith('from $') || title.startsWith('$');
    };
    const looksLikePrice = (value: unknown) => {
      const text = clean(value);
      if (!text) return false;
      if (text.toLowerCase().startsWith('from $') || text.startsWith('$')) return true;
      let digits = 0;
      for (const char of text.replace('$', '').replaceAll(',', '')) {
        if (char >= '0' && char <= '9') {
          digits += 1;
          continue;
        }
        if (char !== '.') return false;
      }
      return digits > 0;
    };
    const isBadImageUrl = (value: unknown) => {
      const url = clean(value).toLowerCase();
      return !url || url.includes('/boom/client/') || url.includes('.svg') || url.includes('/avatar') || url.includes('avatar.') || url.includes('logo') || url.includes('icon') || url.includes('favorite') || url.includes('heart');
    };
    const tileFor = (el: Element | null) => el?.closest('[data-testid*="product"], [data-testid*="tile"], [data-testid*="card"], article, li, section, div') || el?.parentElement || el;
    const imageCandidatesFor = (el: Element | null) => {
      if (!el || !(el instanceof HTMLElement)) return [] as string[];
      const urls = [
        normalizeUrl((el as HTMLImageElement).currentSrc),
        normalizeUrl(el.getAttribute('src')),
        normalizeUrl(el.getAttribute('data-src')),
        ...srcsetUrls(el.getAttribute('srcset')),
        ...srcsetUrls(el.getAttribute('data-srcset')),
        ...backgroundUrls(el.style.backgroundImage),
      ];
      const parent = el.parentElement;
      if (parent) urls.push(...backgroundUrls(parent.style.backgroundImage));
      return uniqueBy(urls.filter(Boolean), (url) => url);
    };
    const links = uniqueBy(
      Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
        .map((link) => {
          const href = normalizeUrl(link.getAttribute('href') || link.href);
          if (!href.includes('/i/')) return null;
          const rect = visibleRect(link);
          if (!rect) return null;
          return {
            element: link,
            productUrl: href,
            rect,
            tile: tileFor(link),
            text: clean(link.textContent),
          };
        })
        .filter(Boolean) as Array<{ element: HTMLAnchorElement; productUrl: string; rect: DOMRect; tile: Element | null; text: string }>,
      (item) => item.productUrl
    );

    const largeImages = Array.from(document.querySelectorAll<HTMLImageElement>('img'))
      .map((img) => {
        const rect = largeVisibleRect(img);
        if (!rect) return null;
        const urls = imageCandidatesFor(img);
        const acceptedUrl = urls.find((url) => !isBadImageUrl(url) && (url.startsWith('http://') || url.startsWith('https://'))) || '';
        return {
          element: img,
          rect,
          urls,
          acceptedUrl,
          tile: tileFor(img),
          alt: clean(img.getAttribute('alt')),
        };
      })
      .filter(Boolean) as Array<{ element: HTMLImageElement; rect: DOMRect; urls: string[]; acceptedUrl: string; tile: Element | null; alt: string }>;

    const backgroundBlocks = Array.from(document.querySelectorAll<HTMLElement>('article, li, section, div'))
      .map((el) => {
        const rect = largeVisibleRect(el);
        if (!rect) return null;
        const urls = uniqueBy([
          ...backgroundUrls(el.style.backgroundImage),
          ...backgroundUrls(el.parentElement?.style?.backgroundImage),
        ].filter(Boolean), (url) => url);
        const acceptedUrl = urls.find((url) => !isBadImageUrl(url) && (url.startsWith('http://') || url.startsWith('https://'))) || '';
        if (!acceptedUrl) return null;
        return {
          element: el,
          rect,
          urls,
          acceptedUrl,
          tile: tileFor(el),
          alt: '',
        };
      })
      .filter(Boolean) as Array<{ element: HTMLElement; rect: DOMRect; urls: string[]; acceptedUrl: string; tile: Element | null; alt: string }>;

    const visibleLargeImageCandidates = largeImages.map((item) => ({ url: item.acceptedUrl || item.urls[0] || '', width: item.rect.width, height: item.rect.height }));
    const productImages = uniqueBy(
      [...largeImages, ...backgroundBlocks]
        .filter((item) => item.acceptedUrl)
        .map((item) => ({
          imageUrl: item.acceptedUrl,
          rect: item.rect,
          tile: item.tile,
          alt: item.alt,
        })),
      (item) => `${item.imageUrl}|${Math.round(item.rect.top)}|${Math.round(item.rect.left)}`
    );

    const nearestLinkForImage = (image: { rect: DOMRect; tile: Element | null }) => {
      const tileLinks = links.filter((link) => link.tile === image.tile || (image.tile && image.tile.contains(link.element)));
      const pool = tileLinks.length ? tileLinks : links;
      const ranked = pool
        .map((link) => {
          const verticalPenalty = link.rect.top >= image.rect.top - 24 ? 0 : 1200;
          const distance = Math.abs(link.rect.top - image.rect.bottom) + Math.abs(link.rect.left - image.rect.left);
          return { link, score: distance + verticalPenalty };
        })
        .sort((a, b) => a.score - b.score);
      return ranked[0]?.link || null;
    };

    const titleFromLink = (link: { element: Element; productUrl: string; text: string } | null, imageAlt: string) => {
      const directText = clean(link?.text);
      if (directText && !isBadTitle(directText) && !looksLikePrice(directText)) return directText;
      if (imageAlt && !isBadTitle(imageAlt) && !looksLikePrice(imageAlt)) return imageAlt;
      return link ? clean(titleFromUrl(link.productUrl)) : '';
    };

    const rows = productImages
      .map((image) => {
        const link = nearestLinkForImage(image);
        if (!link) return null;
        const title = titleFromLink(link, image.alt);
        if (!title || isBadTitle(title) || looksLikePrice(title)) return null;
        return {
          title,
          product_url: link.productUrl,
          image_url: image.imageUrl,
          product_type: clean(productTypeFromUrl(link.productUrl)),
          source_shop: sourceShop,
        };
      })
      .filter((item): item is ProductRow => Boolean(item));

    const uniqueRows = uniqueBy(rows, (row) => row.product_url);

    return {
      rows: uniqueRows,
      diagnostics: {
        page: currentPage,
        productLinkCount: links.length,
        visibleLargeImageCount: visibleLargeImageCandidates.length,
        acceptedImageCount: productImages.length,
        rowCount: uniqueRows.length,
        firstProductUrls: links.slice(0, 10).map((item) => item.productUrl),
        firstImageUrls: productImages.slice(0, 20).map((item) => item.imageUrl),
      },
    };

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
        return clean(slug.replace(/-by-.+$/i, '').replace(/-/g, ' ')).replace(/\b\w/g, (char) => char.toUpperCase());
      } catch {
        return '';
      }
    }
  }, { sourceShop: SOURCE_SHOP, currentPage: pageNumber });
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
  const page = await browser.newPage({
    viewport: MOBILE_VIEWPORT,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });

  const rowsByUrl = new Map<string, ProductRow>();
  const diagnostics: ScrapeDiagnostics[] = [];

  try {
    await page.goto(SHOP_URL, { waitUntil: 'domcontentloaded' });

    for (let pageNumber = 1; pageNumber <= 20; pageNumber += 1) {
      await waitForProductGrid(page);
      await autoScroll(page);
      const result = await scrapeCurrentPage(page, pageNumber);
      diagnostics.push(result.diagnostics);

      for (const row of result.rows) {
        if (!row.product_url || !row.image_url || hasBadTitle(row.title) || hasBadImageUrl(row.image_url)) continue;
        if (!rowsByUrl.has(row.product_url)) rowsByUrl.set(row.product_url, row);
      }

      const moved = await gotoNextPage(page);
      if (!moved) break;
    }
  } finally {
    await browser.close();
  }

  const rows = Array.from(rowsByUrl.values());
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

  const cwd = process.cwd();
  const outputDir = path.resolve(cwd);
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, OUTPUT_JSON), `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
  await writeFile(path.join(outputDir, OUTPUT_CSV), `${csv}\n`, 'utf8');

  console.log(`Scraped ${rows.length} unique Redbubble products.`);
  console.table(diagnostics.map((item) => ({
    page: item.page,
    productLinks: item.productLinkCount,
    largeImages: item.visibleLargeImageCount,
    acceptedImages: item.acceptedImageCount,
    rows: item.rowCount,
  })));
  console.log(`Wrote ${OUTPUT_JSON} and ${OUTPUT_CSV} in ${outputDir}`);
}

main().catch((error) => {
  console.error('Redbubble Playwright scraper failed:', error);
  process.exitCode = 1;
});
