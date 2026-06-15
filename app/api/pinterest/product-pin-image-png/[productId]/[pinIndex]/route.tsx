import { ImageResponse } from 'next/og';
import { parseKeywords } from '@/lib/monetization';
import { pinterestProductImageDebugSummary, pinterestProductImageHeaders, resolvePinterestProductImage } from '@/lib/pinterestProductImage';
import { validateProductSource } from '@/lib/redbubbleProductSource';
import { sql } from '@/lib/db';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const contentType = 'image/png';

const PIN_WIDTH = 1000;
const PIN_HEIGHT = 1500;
const SYSTEM_PIN_KEYWORD_RE = /^(image_server_check|warning):/i;

type Theme = ReturnType<typeof themeFor>;

type WrappedText = {
  lines: string[];
  truncated: boolean;
};

function getPin(meta: any, index: number) {
  const source = meta && typeof meta === 'object' ? meta : {};
  const pins = Array.isArray(source.pins) ? source.pins : [];
  return pins[index] || null;
}

function cleanText(value: unknown, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

function titleCase(value: string) {
  return cleanText(value).replace(/[-_]+/g, ' ').replace(/\w\S*/g, (word) => {
    if (word.length <= 3 && word === word.toUpperCase()) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

function withoutTrailingWeakWord(value: string) {
  return cleanText(value).replace(/\s+\b(for|on|and|with|of|to|in|the|a|an)\b$/i, '').trim();
}

function wrapText(value: string, maxChars: number, maxLines: number): WrappedText {
  const words = cleanText(value).split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  let truncated = false;

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) {
        truncated = true;
        break;
      }
    } else if (word.length > maxChars && !line) {
      lines.push(word);
      line = '';
      if (lines.length === maxLines) {
        truncated = true;
        break;
      }
    } else {
      line = next;
    }
  }

  if (!truncated && line) lines.push(line);
  const visible = lines.slice(0, maxLines).map(withoutTrailingWeakWord).filter(Boolean);
  return {
    lines: visible,
    truncated: truncated || lines.length > maxLines || words.join(' ').length > visible.join(' ').length,
  };
}

function clampSentence(value: string, maxChars: number) {
  const text = cleanText(value);
  if (text.length <= maxChars) return text;
  const words = text.split(' ');
  const output: string[] = [];

  for (const word of words) {
    const next = [...output, word].join(' ');
    if (next.length > maxChars) break;
    output.push(word);
  }

  return withoutTrailingWeakWord(output.join(' ')).replace(/[,.!?;:]$/, '');
}

function themeFor(index: number) {
  const themes = [
    { page: '#f7efe5', card: '#fffdf8', ink: '#161616', accent: '#d8482f', chip: '#ffe1d4', soft: '#f4c7a5', shadow: '#c67a5a' },
    { page: '#eef5f2', card: '#ffffff', ink: '#172821', accent: '#217c67', chip: '#d7eee6', soft: '#b9ddd1', shadow: '#84b8a6' },
    { page: '#f3f0f7', card: '#ffffff', ink: '#241b30', accent: '#6d4d9a', chip: '#e9ddf8', soft: '#d7caea', shadow: '#a18ac2' },
    { page: '#f3f6ee', card: '#ffffff', ink: '#202411', accent: '#607b28', chip: '#e2ecc8', soft: '#cbdba3', shadow: '#9eb26e' },
  ];
  return themes[Math.abs(index) % themes.length];
}

function isWeakTitle(value: string) {
  const title = cleanText(value).toLowerCase();
  if (!title) return true;
  if (/\b(unique|trending|perfect|seasonal|cute|stylish)\s+(redbubble|creator|stickers?|gifts?|shirts?|t-?shirts?|finds?)\b/i.test(title)) return true;
  if (/\b(gifts?|ideas?|stickers?|shirts?|t-?shirts?|finds?)\s+(for|on|and|with|of|to|in)$/i.test(title)) return true;
  if (/\bfor\s+(side|people|friends|hustlers)$/i.test(title)) return true;
  return title.length < 10;
}

function designNameFromUrl(value: unknown) {
  const rawUrl = cleanText(value);
  if (!rawUrl) return '';

  try {
    const url = new URL(rawUrl);
    const parts = url.pathname.split('/').map((part) => decodeURIComponent(part)).filter(Boolean);
    const productTypeIndex = parts.findIndex((part) => /^(i|shop|people)$/i.test(part));
    const likelyParts = productTypeIndex >= 0 ? parts.slice(productTypeIndex + 1) : parts;
    const designPart = likelyParts.find((part) => part.includes('-by-')) || likelyParts.find((part) => /[a-z]/i.test(part) && !/^ap$|^p$|^u$|^sticker$|^t-shirt$|^classic-t-shirt$|^mug$/i.test(part));
    if (!designPart) return '';

    return titleCase(
      designPart
        .replace(/-by-.+$/i, '')
        .replace(/\b(redbubble|stickers?|shirts?|tees?|mugs?|gifts?|designs?|prints?)\b/gi, ' ')
    );
  } catch {
    return '';
  }
}

function productTypeLabel(product: any) {
  const haystack = `${cleanText(product?.target_url)} ${parseKeywords(product?.keywords).join(' ')}`.toLowerCase();
  if (/mouse-pad|mouse pad|mousepad/.test(haystack)) return 'Mouse Pad';
  if (/throw-pillow|pillow/.test(haystack)) return 'Throw Pillow';
  if (/classic-t-shirt|t-shirt|shirt|tee/.test(haystack)) return 'T-Shirt';
  if (/mug|coffee-cup/.test(haystack)) return 'Mug';
  if (/poster|print/.test(haystack)) return 'Print';
  if (/notebook|journal/.test(haystack)) return 'Notebook';
  if (/phone-case|case/.test(haystack)) return 'Phone Case';
  if (/sticker/.test(haystack)) return 'Sticker';
  return 'Redbubble Design';
}

function designName(pin: any, product: any) {
  const fromPin = cleanText(pin?.design_focus || pin?.designFocus);
  const fromUrl = designNameFromUrl(product?.target_url);
  const fromProduct = cleanText(product?.title, 'InkWanderStudio design');
  const raw = (!isWeakTitle(fromPin) && fromPin) || fromUrl || (!isWeakTitle(fromProduct) && fromProduct) || fromProduct;
  return titleCase(
    raw
      .replace(/\b(redbubble|stickers?|shirts?|tees?|mugs?|gifts?|designs?|prints?)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'InkWanderStudio Design'
  );
}

function nicheLabel(pin: any, product: any) {
  const text = cleanText(pin?.niche || product?.niche || product?.title, 'relatable stickers');
  const normalized = text
    .replace(/funny graphic design/gi, 'relatable stickers')
    .replace(/redbubble/gi, '')
    .trim();
  return titleCase(clampSentence(normalized || 'relatable stickers', 34));
}

function headlineFor(pin: any, product: any) {
  const design = designName(pin, product);
  const raw = cleanText(pin?.title);
  if (!isWeakTitle(raw) && raw.toLowerCase().includes(design.split(' ')[0].toLowerCase())) {
    return titleCase(withoutTrailingWeakWord(raw.replace(/\bRedbubble\b/gi, '')));
  }

  const niche = nicheLabel(pin, product).toLowerCase();
  const productType = productTypeLabel(product);
  if (niche.includes('coffee')) return `${design} Coffee ${productType}`;
  if (niche.includes('introvert')) return `${design} Introvert ${productType}`;
  if (niche.includes('millennial')) return `${design} Millennial ${productType}`;
  if (niche.includes('animal')) return `${design} Sarcastic ${productType}`;
  if (niche.includes('relatable')) return `${design} Relatable ${productType}`;
  return `${design} ${productType}`;
}

function captionFor(pin: any, product: any) {
  const design = designName(pin, product);
  const niche = nicheLabel(pin, product).toLowerCase();
  const productType = productTypeLabel(product).toLowerCase();
  const raw = cleanText(pin?.description);
  const generic = !raw || /unique redbubble|trending redbubble|perfect gifts|seasonal gift ideas|category pin/i.test(raw) || /captured from browser/i.test(raw);

  if (!generic) return clampSentence(raw, 132);
  if (niche.includes('coffee')) return `${design} brings coffee culture humor to this ${productType} for cozy desks, gift boards, and save-worthy Redbubble finds.`;
  if (niche.includes('introvert')) return `${design} turns introvert humor into a specific ${productType} for quiet-day gifts, notebooks, and desk setups.`;
  if (niche.includes('millennial')) return `${design} gives millennial humor a design-specific ${productType} angle that feels worth saving.`;
  if (niche.includes('animal')) return `${design} gives sarcastic animal art a giftable ${productType} look for niche Redbubble boards.`;
  return `${design} is a design-specific Redbubble ${productType} for relatable humor boards, gifts, and everyday favorites.`;
}

function keywordTags(pin: any, product: any) {
  const raw = Array.isArray(pin?.keyword_focus) ? pin.keyword_focus : parseKeywords(product?.keywords);
  const tags = raw
    .map((value: unknown) => titleCase(clampSentence(value as string, 20)))
    .filter(Boolean)
    .filter((tag: string) => !/redbubble design/i.test(tag))
    .filter((tag: string) => !SYSTEM_PIN_KEYWORD_RE.test(tag));

  const fallback = [nicheLabel(pin, product), productTypeLabel(product), 'Giftable Art'];
  return Array.from(new Set([...tags, ...fallback])).slice(0, 3);
}

function NotFoundImage({ message }: { message: string }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#111827',
        color: '#fff',
        fontSize: 48,
        fontWeight: 900,
      }}
    >
      {message}
    </div>
  );
}

function TopBar({ theme, niche }: { theme: Theme; niche: string }) {
  return (
    <div style={{ height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
      <div style={{ fontSize: 28, fontWeight: 900, color: theme.ink, letterSpacing: 0.5 }}>InkWanderStudio</div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          maxWidth: 430,
          borderRadius: 999,
          padding: '11px 18px',
          background: theme.chip,
          color: theme.ink,
          fontSize: 21,
          fontWeight: 800,
          whiteSpace: 'nowrap',
        }}
      >
        {niche}
      </div>
    </div>
  );
}

function MockupFallbackHero({ title, niche, productType, theme }: { title: string; niche: string; productType: string; theme: Theme }) {
  const titleLines = wrapText(title, 14, 3).lines;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(145deg, ${theme.card} 0%, ${theme.chip} 45%, ${theme.soft} 100%)`,
        padding: 30,
      }}
    >
      <div style={{ width: 720, height: 720, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', width: 670, height: 670, borderRadius: 84, background: theme.shadow, opacity: 0.5, transform: 'rotate(8deg)' }} />
        <div style={{ position: 'absolute', width: 660, height: 660, borderRadius: 84, background: theme.card, border: `8px solid ${theme.ink}`, transform: 'rotate(-4deg)', boxShadow: '0 34px 70px rgba(0,0,0,0.22)' }} />
        <div style={{ position: 'absolute', width: 530, height: 530, borderRadius: 76, background: `linear-gradient(160deg, ${theme.soft}, ${theme.card})`, border: `16px solid ${theme.ink}`, outline: '14px solid #ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(3deg)' }}>
          <div style={{ position: 'absolute', top: 30, left: 34, right: 34, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: theme.accent }}>REDBUBBLE</div>
            <div style={{ fontSize: 18, fontWeight: 900, borderRadius: 999, background: theme.card, padding: '8px 13px', color: theme.ink }}>{productType}</div>
          </div>
          <div style={{ position: 'absolute', top: 82, borderRadius: 999, background: theme.chip, color: theme.ink, padding: '8px 14px', fontSize: 18, fontWeight: 900 }}>{niche}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 390, marginTop: 92 }}>
            {titleLines.map((line, index) => (
              <div key={`${line}-${index}`} style={{ fontSize: titleLines.length >= 3 ? 48 : 58, lineHeight: 0.98, fontWeight: 1000, color: theme.ink, textAlign: 'center', textTransform: 'uppercase' }}>
                {line}
              </div>
            ))}
          </div>
          <div style={{ position: 'absolute', bottom: 34, borderRadius: 999, background: theme.accent, color: '#fff', padding: '14px 22px', fontSize: 22, fontWeight: 900 }}>VIEW DESIGN</div>
        </div>
      </div>
    </div>
  );
}

function HeroImage({ heroImageSrc, title, niche, productType, theme }: { heroImageSrc: string | null; title: string; niche: string; productType: string; theme: Theme }) {
  return (
    <div
      style={{
        height: 880,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: theme.card,
        border: `5px solid ${theme.ink}`,
        borderRadius: 28,
        boxShadow: '0 24px 60px rgba(0,0,0,0.14)',
      }}
    >
      {heroImageSrc ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 18,
            background: `radial-gradient(circle at 50% 28%, ${theme.card} 0%, ${theme.chip} 58%, ${theme.soft} 100%)`,
            padding: '48px 56px 36px',
          }}
        >
          <div
            style={{
              width: 760,
              height: 760,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 40,
              background: 'rgba(255,255,255,0.42)',
              boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.6)',
              padding: 24,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImageSrc}
              alt=""
              width={680}
              height={680}
              style={{
                width: 680,
                height: 680,
                objectFit: 'contain',
              }}
            />
          </div>
          <div
            style={{
              width: 420,
              height: 28,
              borderRadius: 999,
              background: 'rgba(0,0,0,0.08)',
            }}
          />
        </div>
      ) : (
        <MockupFallbackHero title={title} niche={niche} productType={productType} theme={theme} />
      )}
    </div>
  );
}

function BottomCopy({ title, caption, tags, theme }: { title: string; caption: string; tags: string[]; theme: Theme }) {
  const titleWrap = wrapText(title, 22, 2);
  const descriptionWrap = wrapText(caption, 46, 2);
  const titleSize = titleWrap.lines.length >= 2 ? 50 : 58;

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: theme.card,
        border: `5px solid ${theme.ink}`,
        borderRadius: 28,
        padding: 28,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 96 }}>
        {titleWrap.lines.map((line, index) => (
          <div key={`${line}-${index}`} style={{ fontSize: titleSize, lineHeight: 0.96, fontWeight: 1000, color: theme.ink, textTransform: 'uppercase' }}>
            {line}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minHeight: 62, marginTop: 8 }}>
        {descriptionWrap.lines.map((line, index) => (
          <div key={`${line}-${index}`} style={{ fontSize: 25, lineHeight: 1.16, color: theme.ink }}>
            {line}{index === descriptionWrap.lines.length - 1 && descriptionWrap.truncated ? '...' : ''}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 12, minHeight: 38 }}>
        {tags.map((tag, index) => (
          <div key={`${tag}-${index}`} style={{ display: 'flex', alignItems: 'center', borderRadius: 999, padding: '7px 12px', background: theme.chip, color: theme.ink, fontSize: 18, fontWeight: 800, whiteSpace: 'nowrap' }}>
            {tag}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', gap: 22 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 18, color: theme.accent, fontWeight: 900, letterSpacing: 0.8 }}>SAVE FOR LATER</div>
          <div style={{ fontSize: 21, color: theme.ink, fontWeight: 800 }}>Design-specific Redbubble find</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, padding: '15px 22px', background: theme.accent, color: '#fff', fontSize: 22, fontWeight: 900, whiteSpace: 'nowrap' }}>
          View Design
        </div>
      </div>
    </div>
  );
}

export async function GET(request: Request, { params }: { params: Promise<{ productId: string; pinIndex: string }> }) {
  const { productId, pinIndex } = await params;
  const index = Number(pinIndex);

  const [product] = await sql`
    select id, title, description, image_url, target_url, keywords, pinterest_meta, updated_at, created_at
    from products
    where id = ${productId}
    limit 1
  `;

  if (!product || !Number.isFinite(index)) {
    return new ImageResponse(<NotFoundImage message="Pin not found" />, { width: PIN_WIDTH, height: PIN_HEIGHT });
  }

  const validation = validateProductSource(product);
  if (validation.status !== 'ready') {
    return new ImageResponse(<NotFoundImage message="Product source incomplete" />, {
      width: PIN_WIDTH,
      height: PIN_HEIGHT,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Product-Source-Status': validation.status,
        'X-Product-Source-Reason': validation.reason,
      },
    });
  }

  const pin = getPin(product.pinterest_meta, index);
  const theme = themeFor(index);
  const niche = nicheLabel(pin, product);
  const headline = headlineFor(pin, product);
  const caption = captionFor(pin, product);
  const tags = keywordTags(pin, product);
  const productType = productTypeLabel(product);
  const productImage = await resolvePinterestProductImage(product);
  const origin = new URL(request.url).origin;
  const heroImageSrc = productImage.hasImage ? `${origin}/api/pinterest/product-source-image/${productId}` : null;

  console.info('Pinterest product pin image source', pinterestProductImageDebugSummary(productImage));

  return new ImageResponse(
    <div
      style={{
        width: PIN_WIDTH,
        height: PIN_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        background: theme.page,
        color: theme.ink,
        fontFamily: 'Arial, Helvetica, sans-serif',
        padding: 28,
        gap: 12,
        overflow: 'hidden',
      }}
    >
      <TopBar theme={theme} niche={niche} />
      <HeroImage heroImageSrc={heroImageSrc} title={headline} niche={niche} productType={productType} theme={theme} />
      <BottomCopy title={headline} caption={caption} tags={tags} theme={theme} />
    </div>,
    {
      width: PIN_WIDTH,
      height: PIN_HEIGHT,
      headers: {
        ...pinterestProductImageHeaders(productImage),
        'X-Product-Image-Render-Mode': heroImageSrc ? 'local-source-route' : 'fallback-mockup',
      },
    }
  );
}
