const FETCH_TIMEOUT_MS = 9000;
const DEFAULT_SHOP_URL = 'https://www.redbubble.com/people/InkWanderStudio/shop';
const SHOP_PROFILE_RE = /^https?:\/\/(?:www\.)?redbubble\.com\/people\/[^/?#]+(?:\/shop)?\/?(?:[?#].*)?$/i;
const SHOP_URL_RE = /^https?:\/\/(?:www\.)?redbubble\.com\/people\/[^/?#]+\/shop\/?(?:[?#].*)?$/i;
const REDBUBBLE_HOST_RE = /(^|\.)redbubble\.com$/i;

export type ProductValidationStatus = 'ready' | 'missing_image' | 'invalid';

export type ProductValidation = {
  status: ProductValidationStatus;
  label: string;
  reason: string;
  hasAbsoluteTargetUrl: boolean;
  hasAbsoluteImageUrl: boolean;
  isShopProfileUrl: boolean;
};

export type RedbubbleImportResult = {
  ok: boolean;
  title: string;
  description: string;
  targetUrl: string;
  imageUrl: string;
  productType: string;
  tags: string[];
  sourceShopName?: string;
  error?: string;
};

export type RedbubbleShopImportResult = {
  ok: boolean;
  shopUrl: string;
  shopName: string;
  discoveredUrls: string[];
  products: RedbubbleImportResult[];
  errors: string[];
};

function cleanText(value: unknown, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/\\u002F/g, '/')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

export function isAbsoluteHttpUrl(value: unknown) {
  return /^https?:\/\//i.test(cleanText(value));
}

export function isRedbubbleShopProfileUrl(value: unknown) {
  return SHOP_PROFILE_RE.test(cleanText(value));
}

export function isRedbubbleShopUrl(value: unknown) {
  return SHOP_URL_RE.test(cleanText(value));
}

export function isRedbubbleProductUrl(value: unknown) {
  const raw = cleanText(value);
  if (!isAbsoluteHttpUrl(raw) || isRedbubbleShopProfileUrl(raw)) return false;

  try {
    const url = new URL(raw);
    if (!REDBUBBLE_HOST_RE.test(url.hostname)) return false;
    const parts = url.pathname.split('/').filter(Boolean);
    return parts.includes('i') || parts.some((part) => /-by-/i.test(part));
  } catch {
    return false;
  }
}

export function validateProductSource(product: { target_url?: unknown; image_url?: unknown }): ProductValidation {
  const targetUrl = cleanText(product.target_url);
  const imageUrl = cleanText(product.image_url);
  const hasAbsoluteTargetUrl = isAbsoluteHttpUrl(targetUrl);
  const hasAbsoluteImageUrl = isAbsoluteHttpUrl(imageUrl);
  const isShopProfileUrl = isRedbubbleShopProfileUrl(targetUrl);

  if (!hasAbsoluteTargetUrl) {
    return {
      status: 'invalid',
      label: 'Invalid',
      reason: 'Target URL is missing or is not an absolute URL.',
      hasAbsoluteTargetUrl,
      hasAbsoluteImageUrl,
      isShopProfileUrl,
    };
  }

  if (isShopProfileUrl || !isRedbubbleProductUrl(targetUrl)) {
    return {
      status: 'invalid',
      label: 'Invalid',
      reason: 'Use a specific Redbubble product/design URL, not the shop or profile URL.',
      hasAbsoluteTargetUrl,
      hasAbsoluteImageUrl,
      isShopProfileUrl,
    };
  }

  if (!hasAbsoluteImageUrl) {
    return {
      status: 'missing_image',
      label: 'Missing image',
      reason: 'Target URL is product-specific, but image_url is missing.',
      hasAbsoluteTargetUrl,
      hasAbsoluteImageUrl,
      isShopProfileUrl,
    };
  }

  return {
    status: 'ready',
    label: 'Ready',
    reason: 'Product has a specific target URL and absolute image URL.',
    hasAbsoluteTargetUrl,
    hasAbsoluteImageUrl,
    isShopProfileUrl,
  };
}

function redbubbleBlockedMessage(kind: 'shop' | 'product') {
  if (kind === 'shop') return 'Redbubble blocked automatic import. Use manual import or CSV import with image URLs.';
  return 'Redbubble blocked automatic extraction. Paste the product image URL manually.';
}

function metaContent(html: string, key: string, attr = 'property') {
  const escapedKey = key.replaceAll(':', '\\:');
  const direct = new RegExp(`<meta[^>]+${attr}=["']${escapedKey}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  const reverse = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${escapedKey}["'][^>]*>`, 'i');
  return decodeHtml(html.match(direct)?.[1] || html.match(reverse)?.[1] || '');
}

function canonicalUrl(html: string, fallbackUrl: string) {
  const href = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i)?.[1];
  if (!href) return fallbackUrl;
  try {
    return new URL(decodeHtml(href), fallbackUrl).toString();
  } catch {
    return fallbackUrl;
  }
}

function canonicalProductUrl(value: string, baseUrl = DEFAULT_SHOP_URL) {
  try {
    const url = new URL(decodeHtml(value), baseUrl);
    url.hash = '';
    url.search = '';
    return url.toString();
  } catch {
    return '';
  }
}

function titleFromHtml(html: string) {
  return cleanText(
    metaContent(html, 'og:title') ||
    metaContent(html, 'twitter:title', 'name') ||
    decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
  )
    .replace(/\s*\|\s*Redbubble\s*$/i, '')
    .replace(/\s*by\s+InkWanderStudio\s*$/i, '')
    .trim();
}

function imageFromHtml(html: string, pageUrl: string) {
  const candidate =
    metaContent(html, 'og:image:secure_url') ||
    metaContent(html, 'og:image') ||
    metaContent(html, 'twitter:image', 'name') ||
    html.match(/https:\/\/[^"'\s<>]+(?:ih\d?\.redbubble\.net|redbubble)[^"'\s<>]+\.(?:png|jpe?g|webp)(?:\?[^"'\s<>]*)?/i)?.[0] ||
    '';

  try {
    return candidate ? new URL(candidate, pageUrl).toString() : '';
  } catch {
    return '';
  }
}

function productTypeFromUrlOrTitle(url: string, title: string) {
  const haystack = `${url} ${title}`.toLowerCase();
  if (haystack.includes('classic-t-shirt') || haystack.includes('t-shirt') || haystack.includes('shirt')) return 'T-Shirt';
  if (haystack.includes('mug')) return 'Mug';
  if (haystack.includes('poster') || haystack.includes('print')) return 'Print';
  if (haystack.includes('notebook')) return 'Notebook';
  if (haystack.includes('phone-case')) return 'Phone Case';
  if (haystack.includes('sticker')) return 'Sticker';
  return '';
}

function tagsFromText(title: string, description: string, productType: string) {
  const text = `${title} ${description}`.toLowerCase();
  const tags = new Set<string>();
  if (productType) tags.add(productType.toLowerCase());
  if (/coffee|espresso|latte|caffeine/.test(text)) tags.add('coffee culture');
  if (/introvert|social battery|homebody|awkward/.test(text)) tags.add('introvert humor');
  if (/millennial|adulting|burnout|nostalgia/.test(text)) tags.add('millennial humor');
  if (/animal|cat|dog|frog|goose|duck/.test(text)) tags.add('sarcastic animals');
  tags.add('relatable stickers');
  tags.add('InkWanderStudio');
  return Array.from(tags).slice(0, 8);
}

function shopNameFromUrl(shopUrl: string) {
  try {
    const parts = new URL(shopUrl).pathname.split('/').filter(Boolean);
    const peopleIndex = parts.findIndex((part) => part.toLowerCase() === 'people');
    return peopleIndex >= 0 ? decodeURIComponent(parts[peopleIndex + 1] || 'InkWanderStudio') : 'InkWanderStudio';
  } catch {
    return 'InkWanderStudio';
  }
}

async function fetchRedbubbleHtml(url: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        referer: 'https://www.redbubble.com/',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      },
      cache: 'no-store',
    });

    if (!response.ok) return { ok: false, status: response.status, html: '' };
    return { ok: true, status: response.status, html: await response.text() };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function discoverProductUrlsFromShopHtml(html: string, shopUrl: string) {
  const urls = new Set<string>();
  const decodedHtml = decodeHtml(html);
  const hrefPattern = /href=["']([^"']+)["']/gi;
  const absolutePattern = /https:\/\/(?:www\.)?redbubble\.com\/i\/[^"'\s<>\\]+/gi;
  const pathPattern = /\/i\/[^"'\s<>\\]+/gi;

  for (const pattern of [hrefPattern, absolutePattern, pathPattern]) {
    for (const match of decodedHtml.matchAll(pattern)) {
      const candidate = match[1] || match[0];
      const productUrl = canonicalProductUrl(candidate, shopUrl);
      if (isRedbubbleProductUrl(productUrl)) urls.add(productUrl);
    }
  }

  return Array.from(urls).slice(0, 36);
}

export async function importRedbubbleProduct(productUrl: string, sourceShopName = 'InkWanderStudio'): Promise<RedbubbleImportResult> {
  const targetUrl = canonicalProductUrl(cleanText(productUrl));
  if (!isRedbubbleProductUrl(targetUrl)) {
    return {
      ok: false,
      title: '',
      description: '',
      targetUrl,
      imageUrl: '',
      productType: '',
      tags: [],
      sourceShopName,
      error: 'Enter a specific Redbubble product/design URL, not a shop or profile URL.',
    };
  }

  try {
    const response = await fetchRedbubbleHtml(targetUrl);
    if (!response.ok) {
      return {
        ok: false,
        title: '',
        description: '',
        targetUrl,
        imageUrl: '',
        productType: '',
        tags: [],
        sourceShopName,
        error: response.status === 403 ? redbubbleBlockedMessage('product') : `Redbubble returned HTTP ${response.status}.`,
      };
    }

    const html = response.html;
    const resolvedTargetUrl = canonicalProductUrl(canonicalUrl(html, targetUrl), targetUrl);
    const title = titleFromHtml(html);
    const description = cleanText(metaContent(html, 'og:description') || metaContent(html, 'description', 'name')).slice(0, 360);
    const imageUrl = imageFromHtml(html, resolvedTargetUrl);
    const productType = productTypeFromUrlOrTitle(resolvedTargetUrl, title);
    const tags = Array.from(new Set([...tagsFromText(title, description, productType), sourceShopName])).slice(0, 8);

    return {
      ok: Boolean(title && imageUrl && isRedbubbleProductUrl(resolvedTargetUrl)),
      title,
      description,
      targetUrl: resolvedTargetUrl,
      imageUrl,
      productType,
      tags,
      sourceShopName,
      error: title && imageUrl ? undefined : 'Could not extract a title and main product image from this Redbubble page.',
    };
  } catch (error: any) {
    return {
      ok: false,
      title: '',
      description: '',
      targetUrl,
      imageUrl: '',
      productType: '',
      tags: [],
      sourceShopName,
      error: error?.name === 'AbortError' ? 'Timed out fetching the Redbubble product page.' : error?.message || 'Failed to fetch Redbubble product page.',
    };
  }
}

export async function importRedbubbleShopProducts(shopUrl = DEFAULT_SHOP_URL): Promise<RedbubbleShopImportResult> {
  const normalizedShopUrl = cleanText(shopUrl) || DEFAULT_SHOP_URL;
  const shopName = shopNameFromUrl(normalizedShopUrl);

  if (!isRedbubbleShopUrl(normalizedShopUrl)) {
    return {
      ok: false,
      shopUrl: normalizedShopUrl,
      shopName,
      discoveredUrls: [],
      products: [],
      errors: ['Enter the InkWanderStudio Redbubble shop URL, not a profile-only URL.'],
    };
  }

  try {
    const response = await fetchRedbubbleHtml(normalizedShopUrl);
    if (!response.ok) {
      return {
        ok: false,
        shopUrl: normalizedShopUrl,
        shopName,
        discoveredUrls: [],
        products: [],
        errors: [response.status === 403 ? redbubbleBlockedMessage('shop') : `Redbubble shop returned HTTP ${response.status}.`],
      };
    }

    const discoveredUrls = discoverProductUrlsFromShopHtml(response.html, normalizedShopUrl);
    const products: RedbubbleImportResult[] = [];
    const errors: string[] = [];

    for (const productUrl of discoveredUrls.slice(0, 24)) {
      const imported = await importRedbubbleProduct(productUrl, shopName);
      if (imported.ok && validateProductSource({ target_url: imported.targetUrl, image_url: imported.imageUrl }).status === 'ready') {
        products.push(imported);
      } else {
        errors.push(`${productUrl}: ${imported.error || 'missing image or invalid product URL'}`);
      }
    }

    return {
      ok: products.length > 0,
      shopUrl: normalizedShopUrl,
      shopName,
      discoveredUrls,
      products,
      errors,
    };
  } catch (error: any) {
    return {
      ok: false,
      shopUrl: normalizedShopUrl,
      shopName,
      discoveredUrls: [],
      products: [],
      errors: [error?.message || 'Failed to fetch Redbubble shop page.'],
    };
  }
}
