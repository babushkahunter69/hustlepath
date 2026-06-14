const MAX_REMOTE_IMAGE_BYTES = 6_500_000;
const FETCH_TIMEOUT_MS = 8000;
const SUPPORTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

export type PinterestProductImageDebug = {
  productId?: string;
  productImageUrl: string;
  productImageUrlIsAbsolute: boolean;
  productTargetUrl: string;
  productTargetUrlIsAbsolute: boolean;
  candidates: string[];
  sourceUrl: string;
  status: string;
  httpStatus?: number;
  contentType: string;
  byteLength: number;
  hasImage: boolean;
  reason?: string;
};

export type PinterestProductImageResult = PinterestProductImageDebug & {
  bytes: Uint8Array | null;
  dataUrl: string | null;
};

function cleanText(value: unknown, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

function imageDataToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function isAbsoluteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function sniffImageType(bytes: Uint8Array, declaredType: string) {
  if (SUPPORTED_IMAGE_TYPES.has(declaredType)) return declaredType === 'image/jpg' ? 'image/jpeg' : declaredType;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) return 'image/webp';
  return '';
}

function absolutizeUrl(value: string, baseUrl: string) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return '';
  }
}

function extractMetaImageUrl(html: string, pageUrl: string) {
  const patterns = [
    /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return absolutizeUrl(match[1].replaceAll('&amp;', '&'), pageUrl);
  }

  const cdnMatch = html.match(/https:\/\/[^"'\s<>]+(?:redbubble|rb\.gy|ih\d?\.redbubble\.net)[^"'\s<>]+\.(?:png|jpe?g|webp)(?:\?[^"'\s<>]*)?/i);
  return cdnMatch?.[0]?.replaceAll('&amp;', '&') || '';
}

async function fetchRedbubblePageImageUrl(pageUrl: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(pageUrl, {
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        referer: 'https://www.redbubble.com/',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      },
      cache: 'no-store',
    });

    if (!response.ok) return '';
    return extractMetaImageUrl(await response.text(), pageUrl);
  } catch {
    return '';
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function emptyResult(product: any, candidates: string[], sourceUrl: string, status: string, reason?: string): PinterestProductImageResult {
  const productImageUrl = cleanText(product?.image_url);
  const productTargetUrl = cleanText(product?.target_url);

  return {
    productId: product?.id ? String(product.id) : undefined,
    productImageUrl,
    productImageUrlIsAbsolute: isAbsoluteUrl(productImageUrl),
    productTargetUrl,
    productTargetUrlIsAbsolute: isAbsoluteUrl(productTargetUrl),
    candidates,
    sourceUrl,
    status,
    contentType: '',
    byteLength: 0,
    hasImage: false,
    reason,
    bytes: null,
    dataUrl: null,
  };
}

async function fetchImageCandidate(product: any, candidates: string[], sourceUrl: string): Promise<PinterestProductImageResult> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(sourceUrl, {
      signal: controller.signal,
      headers: {
        accept: 'image/png,image/jpeg,image/webp,image/*;q=0.6,*/*;q=0.4',
        'accept-language': 'en-US,en;q=0.9',
        referer: 'https://www.redbubble.com/',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      },
      cache: 'no-store',
    });

    const declaredType = cleanText(response.headers.get('content-type')).split(';')[0].toLowerCase();
    const declaredLength = Number(response.headers.get('content-length') || 0);
    const baseResult = emptyResult(product, candidates, sourceUrl, 'pending');

    if (!response.ok) {
      return {
        ...baseResult,
        status: `http-${response.status}`,
        reason: 'non-ok-response',
        httpStatus: response.status,
        contentType: declaredType,
      };
    }

    if (Number.isFinite(declaredLength) && declaredLength > MAX_REMOTE_IMAGE_BYTES) {
      return {
        ...baseResult,
        status: 'too-large-header',
        reason: 'content-length-too-large',
        httpStatus: response.status,
        contentType: declaredType,
        byteLength: declaredLength,
      };
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    const contentType = sniffImageType(bytes, declaredType);

    if (!bytes.byteLength) {
      return {
        ...baseResult,
        status: 'empty-image',
        reason: 'empty-response-body',
        httpStatus: response.status,
        contentType: declaredType,
      };
    }

    if (bytes.byteLength > MAX_REMOTE_IMAGE_BYTES) {
      return {
        ...baseResult,
        status: 'too-large-body',
        reason: 'response-body-too-large',
        httpStatus: response.status,
        contentType: declaredType,
        byteLength: bytes.byteLength,
      };
    }

    if (!contentType) {
      return {
        ...baseResult,
        status: `unsupported-${declaredType || 'unknown'}`,
        reason: 'unsupported-image-content-type',
        httpStatus: response.status,
        contentType: declaredType,
        byteLength: bytes.byteLength,
      };
    }

    return {
      ...baseResult,
      status: 'ok',
      reason: undefined,
      httpStatus: response.status,
      contentType,
      byteLength: bytes.byteLength,
      hasImage: true,
      bytes,
      dataUrl: `data:${contentType};base64,${imageDataToBase64(bytes)}`,
    };
  } catch (error: any) {
    return emptyResult(product, candidates, sourceUrl, error?.name === 'AbortError' ? 'timeout' : 'fetch-error', error?.message || 'fetch-threw');
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function isDirectImageUrl(value: string) {
  return /\.(png|jpe?g|webp)(\?|$)/i.test(value);
}

export async function resolvePinterestProductImage(product: any): Promise<PinterestProductImageResult> {
  const explicitImageUrl = cleanText(product?.image_url);
  const targetUrl = cleanText(product?.target_url);
  const candidates: string[] = [];

  if (isAbsoluteUrl(explicitImageUrl)) candidates.push(explicitImageUrl);

  if (isAbsoluteUrl(explicitImageUrl) && !isDirectImageUrl(explicitImageUrl)) {
    const scrapedExplicitImageUrl = await fetchRedbubblePageImageUrl(explicitImageUrl);
    if (scrapedExplicitImageUrl) candidates.push(scrapedExplicitImageUrl);
  }

  if (isAbsoluteUrl(targetUrl) && isDirectImageUrl(targetUrl)) {
    candidates.push(targetUrl);
  }

  if (isAbsoluteUrl(targetUrl) && !isDirectImageUrl(targetUrl)) {
    const scrapedTargetImageUrl = await fetchRedbubblePageImageUrl(targetUrl);
    if (scrapedTargetImageUrl) candidates.push(scrapedTargetImageUrl);
  }

  const seen = new Set<string>();
  const uniqueCandidates = candidates.filter((candidate) => {
    if (seen.has(candidate)) return false;
    seen.add(candidate);
    return true;
  });

  if (!uniqueCandidates.length) {
    const result = emptyResult(product, [], explicitImageUrl || targetUrl || '', 'no-image-candidates', 'image_url-and-target_url-missing-or-not-absolute');
    console.info('Pinterest product image fallback triggered', result);
    return result;
  }

  let lastResult: PinterestProductImageResult | null = null;

  for (const candidate of uniqueCandidates) {
    const result = await fetchImageCandidate(product, uniqueCandidates, candidate);
    console.info('Pinterest product image candidate result', result);
    if (result.hasImage) return result;
    lastResult = result;
  }

  const fallbackResult = {
    ...(lastResult || emptyResult(product, uniqueCandidates, uniqueCandidates[0], 'all-candidates-failed')),
    status: 'all-candidates-failed',
    hasImage: false,
    bytes: null,
    dataUrl: null,
  };
  console.info('Pinterest product image fallback triggered', fallbackResult);
  return fallbackResult;
}

export function pinterestProductImageHeaders(result: PinterestProductImageResult) {
  return {
    'Cache-Control': 'no-store, max-age=0',
    'X-Product-Image-Status': result.status,
    'X-Product-Image-Source': result.sourceUrl.slice(0, 240),
    'X-Product-Image-Content-Type': result.contentType || 'none',
    'X-Product-Image-Bytes': String(result.byteLength || 0),
    'X-Product-Image-Has-Image': result.hasImage ? 'true' : 'false',
    'X-Product-Image-Reason': (result.reason || '').slice(0, 160),
    'X-Product-Image-Url-Absolute': result.productImageUrlIsAbsolute ? 'true' : 'false',
    'X-Product-Target-Url-Absolute': result.productTargetUrlIsAbsolute ? 'true' : 'false',
    'X-Product-Image-Candidates': result.candidates.join(' | ').slice(0, 500),
  };
}
