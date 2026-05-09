export type Product = {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  target_url: string;
  cta_label?: string;
  keywords?: string[];
  status?: string;
};

function tokenize(value: string) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((word) => word.length > 2);
}

export function parseKeywords(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).map((item) => item.trim()).filter(Boolean);
    } catch {}
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

export function scoreProductMatch(product: Product, postText: string) {
  const haystack = new Set(tokenize(postText));
  const keywords = parseKeywords(product.keywords);
  let score = 0;
  for (const keyword of keywords) {
    const parts = tokenize(keyword);
    if (!parts.length) continue;
    if (parts.every((part) => haystack.has(part))) score += parts.length >= 2 ? 3 : 1;
  }
  return score;
}

export function productBlockHtml(product?: Product | null) {
  if (!product?.target_url) return '';
  const title = escapeHtml(product.title || 'Creator resource');
  const description = escapeHtml(product.description || 'A related resource from HustlePathDaily that fits this topic.');
  const cta = escapeHtml(product.cta_label || 'View the resource');
  const hasImage = Boolean(product.image_url);
  const image = hasImage ? `<img src="${escapeAttribute(product.image_url || '')}" alt="${title}" loading="lazy" />` : '';
  const href = product.id ? `/go/product/${escapeAttribute(product.id)}` : escapeAttribute(product.target_url);
  return `\n<section class="monetization-card ${hasImage ? 'has-image' : 'no-image'}">\n  ${image}\n  <div>\n    <p class="monetization-eyebrow">Creator resource</p>\n    <h2>${title}</h2>\n    <p>${description}</p>\n    <a href="${href}" target="_blank" rel="sponsored noopener noreferrer">${cta}</a>\n  </div>\n</section>`;
}

export function emailCtaHtml() {
  return `\n<section class="article-email-cta">\n  <p class="monetization-eyebrow">Free traffic checklist</p>\n  <h2>Want more beginner-friendly online income guides?</h2>\n  <p>Get practical HustlePathDaily ideas for Pinterest traffic, simple side hustles, and content systems.</p>\n  <a href="/newsletter">Join the newsletter</a>\n</section>`;
}

export function injectMonetizationBlocks(html: string, product?: Product | null) {
  const blocks = String(html || '').split(/\n(?=<h2|<h3|<p|<ul|<blockquote|<table)/g);
  if (blocks.length < 4) return `${html}${productBlockHtml(product)}${emailCtaHtml()}`;
  const output: string[] = [];
  let paragraphCount = 0;
  let productInserted = false;
  let ctaInserted = false;
  for (const block of blocks) {
    output.push(block);
    if (block.trim().startsWith('<p')) paragraphCount++;
    if (!ctaInserted && paragraphCount >= 2) { output.push(emailCtaHtml()); ctaInserted = true; }
    if (!productInserted && product && paragraphCount >= 5) { output.push(productBlockHtml(product)); productInserted = true; }
  }
  if (product && !productInserted) output.push(productBlockHtml(product));
  if (!ctaInserted) output.push(emailCtaHtml());
  return output.join('\n');
}

function escapeHtml(value: string) {
  return String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll("'", '&#39;');
}
