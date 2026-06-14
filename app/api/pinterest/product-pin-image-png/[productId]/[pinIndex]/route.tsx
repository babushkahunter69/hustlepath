import { ImageResponse } from 'next/og';
import { parseKeywords } from '@/lib/monetization';
import { sql } from '@/lib/db';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const contentType = 'image/png';

const PIN_WIDTH = 1000;
const PIN_HEIGHT = 1500;
const MAX_REMOTE_IMAGE_BYTES = 4_500_000;
const FETCH_TIMEOUT_MS = 4500;
const SUPPORTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

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
  return cleanText(value).replace(/\w\S*/g, (word) => {
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
    { page: '#f8f1e8', card: '#fffdf8', ink: '#161616', accent: '#d8482f', chip: '#ffe1d4', soft: '#f4c7a5' },
    { page: '#eef5f2', card: '#ffffff', ink: '#172821', accent: '#217c67', chip: '#d7eee6', soft: '#b9ddd1' },
    { page: '#f4f2fb', card: '#ffffff', ink: '#251b35', accent: '#7c3aed', chip: '#e7ddff', soft: '#d8cbf5' },
    { page: '#f3f6ee', card: '#ffffff', ink: '#202411', accent: '#607b28', chip: '#e2ecc8', soft: '#cbdba3' },
  ];
  return themes[Math.abs(index) % themes.length];
}

function isWeakTitle(value: string) {
  const title = cleanText(value).toLowerCase();
  if (!title) return true;
  if (/\b(unique|trending|perfect|seasonal|cute|stylish)\s+(redbubble|stickers?|gifts?|shirts?|finds?)\b/i.test(title)) return true;
  if (/\b(gifts?|ideas?|stickers?|shirts?|finds?)\s+(for|on|and|with|of|to|in)$/i.test(title)) return true;
  if (/\bfor\s+(side|people|friends)$/i.test(title)) return true;
  return title.length < 10;
}

function designName(pin: any, product: any) {
  const fromPin = cleanText(pin?.design_focus || pin?.designFocus);
  const fromProduct = cleanText(product?.title, 'InkWanderStudio design');
  const raw = fromPin || fromProduct;
  return titleCase(
    raw
      .replace(/\b(redbubble|stickers?|shirts?|tees?|mugs?|gifts?)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim() || fromProduct
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
  if (niche.includes('coffee')) return `${design} Coffee Sticker`;
  if (niche.includes('introvert')) return `${design} Introvert Sticker`;
  if (niche.includes('millennial')) return `${design} Millennial Sticker`;
  if (niche.includes('animal')) return `${design} Sarcastic Sticker`;
  if (niche.includes('relatable')) return `${design} Relatable Sticker`;
  return `${design} Sticker`;
}

function captionFor(pin: any, product: any) {
  const design = designName(pin, product);
  const niche = nicheLabel(pin, product).toLowerCase();
  const raw = cleanText(pin?.description);
  const generic = !raw || /unique redbubble|trending redbubble|perfect gifts|seasonal gift ideas|category pin/i.test(raw);

  if (!generic) return clampSentence(raw, 150);
  if (niche.includes('coffee')) return `${design} brings coffee culture humor to stickers, mugs, laptops, and cozy desk setups.`;
  if (niche.includes('introvert')) return `${design} is a relatable introvert humor design for laptops, notebooks, mugs, and quiet-day gifts.`;
  if (niche.includes('millennial')) return `${design} turns millennial humor into a specific Redbubble design worth saving for later.`;
  if (niche.includes('animal')) return `${design} gives sarcastic animal art a giftable Redbubble look for stickers, tees, and mugs.`;
  return `${design} is a design-specific Redbubble find for relatable stickers, gifts, notebooks, and everyday favorites.`;
}

function keywordTags(pin: any, product: any) {
  const raw = Array.isArray(pin?.keyword_focus) ? pin.keyword_focus : parseKeywords(product?.keywords);
  const tags = raw
    .map((value: unknown) => titleCase(clampSentence(value as string, 22)))
    .filter(Boolean)
    .filter((tag: string) => !/redbubble design/i.test(tag));

  const fallback = [nicheLabel(pin, product), 'Sticker Idea', 'Giftable Art'];
  return Array.from(new Set([...tags, ...fallback])).slice(0, 3);
}

function imageDataToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function fetchProductImageDataUrl(imageUrl?: string | null) {
  const source = cleanText(imageUrl);
  if (!source || !/^https?:\/\//i.test(source)) return null;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(source, {
      signal: controller.signal,
      headers: {
        accept: 'image/png,image/jpeg,image/webp,image/*;q=0.8',
      },
      cache: 'force-cache',
    });

    if (!response.ok) return null;

    const contentType = cleanText(response.headers.get('content-type')).split(';')[0].toLowerCase();
    if (!SUPPORTED_IMAGE_TYPES.has(contentType)) return null;

    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REMOTE_IMAGE_BYTES) return null;

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.byteLength || bytes.byteLength > MAX_REMOTE_IMAGE_BYTES) return null;

    return `data:${contentType};base64,${imageDataToBase64(bytes)}`;
  } catch {
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
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
    <div style={{ height: 74, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
      <div style={{ fontSize: 28, fontWeight: 900, color: theme.ink, letterSpacing: 1 }}>InkWanderStudio</div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          maxWidth: 430,
          borderRadius: 999,
          padding: '12px 20px',
          background: theme.chip,
          color: theme.ink,
          fontSize: 22,
          fontWeight: 800,
          whiteSpace: 'nowrap',
        }}
      >
        {niche}
      </div>
    </div>
  );
}

function FallbackHero({ title, niche, theme }: { title: string; niche: string; theme: Theme }) {
  const titleLines = wrapText(title, 16, 3).lines;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(145deg, ${theme.card} 0%, ${theme.soft} 100%)`,
        padding: 52,
      }}
    >
      <div
        style={{
          width: 650,
          height: 650,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: theme.card,
          color: theme.ink,
          border: `6px solid ${theme.ink}`,
          borderRadius: 34,
          padding: 44,
          transform: 'rotate(-3deg)',
          boxShadow: '0 36px 70px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', alignSelf: 'flex-start', background: theme.chip, borderRadius: 999, padding: '12px 18px', fontSize: 24, fontWeight: 900 }}>
          {niche}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {titleLines.map((line, index) => (
            <div key={`${line}-${index}`} style={{ fontSize: titleLines.length >= 3 ? 72 : 86, lineHeight: 0.98, fontWeight: 1000, color: theme.ink, textTransform: 'uppercase' }}>
              {line}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: theme.accent }}>REDBUBBLE DESIGN</div>
          <div style={{ width: 180, height: 12, background: theme.accent, borderRadius: 999 }} />
        </div>
      </div>
    </div>
  );
}

function HeroImage({ imageDataUrl, title, niche, theme }: { imageDataUrl: string | null; title: string; niche: string; theme: Theme }) {
  return (
    <div
      style={{
        height: 790,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: theme.card,
        border: `5px solid ${theme.ink}`,
        borderRadius: 30,
        boxShadow: '0 24px 60px rgba(0,0,0,0.14)',
      }}
    >
      {imageDataUrl ? (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(180deg, ${theme.card}, ${theme.chip})`, padding: 34 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageDataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      ) : (
        <FallbackHero title={title} niche={niche} theme={theme} />
      )}
    </div>
  );
}

function BottomCopy({ title, caption, tags, theme }: { title: string; caption: string; tags: string[]; theme: Theme }) {
  const titleWrap = wrapText(title, 19, 3);
  const descriptionWrap = wrapText(caption, 42, 3);
  const titleSize = titleWrap.lines.length >= 3 ? 54 : 62;

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: theme.card,
        border: `5px solid ${theme.ink}`,
        borderRadius: 30,
        padding: 32,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 178 }}>
        {titleWrap.lines.map((line, index) => (
          <div key={`${line}-${index}`} style={{ fontSize: titleSize, lineHeight: 0.98, fontWeight: 1000, color: theme.ink, textTransform: 'uppercase' }}>
            {line}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minHeight: 108, marginTop: 14 }}>
        {descriptionWrap.lines.map((line, index) => (
          <div key={`${line}-${index}`} style={{ fontSize: 28, lineHeight: 1.2, color: theme.ink }}>
            {line}{index === descriptionWrap.lines.length - 1 && descriptionWrap.truncated ? '...' : ''}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 18, minHeight: 46 }}>
        {tags.map((tag, index) => (
          <div key={`${tag}-${index}`} style={{ display: 'flex', alignItems: 'center', borderRadius: 999, padding: '9px 15px', background: theme.chip, color: theme.ink, fontSize: 20, fontWeight: 800, whiteSpace: 'nowrap' }}>
            {tag}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', gap: 22 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 19, color: theme.accent, fontWeight: 900, letterSpacing: 1 }}>SAVE FOR LATER</div>
          <div style={{ fontSize: 23, color: theme.ink, fontWeight: 800 }}>Design-specific Redbubble find</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, padding: '16px 24px', background: theme.accent, color: '#fff', fontSize: 23, fontWeight: 900, whiteSpace: 'nowrap' }}>
          Open Design
        </div>
      </div>
    </div>
  );
}

export async function GET(_request: Request, { params }: { params: Promise<{ productId: string; pinIndex: string }> }) {
  const { productId, pinIndex } = await params;
  const index = Number(pinIndex);

  const [product] = await sql`
    select id, title, description, image_url, keywords, pinterest_meta, updated_at, created_at
    from products
    where id = ${productId}
    limit 1
  `;

  if (!product || !Number.isFinite(index)) {
    return new ImageResponse(<NotFoundImage message="Pin not found" />, { width: PIN_WIDTH, height: PIN_HEIGHT });
  }

  const pin = getPin(product.pinterest_meta, index);
  const theme = themeFor(index);
  const niche = nicheLabel(pin, product);
  const headline = headlineFor(pin, product);
  const caption = captionFor(pin, product);
  const tags = keywordTags(pin, product);
  const imageDataUrl = await fetchProductImageDataUrl(product.image_url);

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
        padding: 44,
        gap: 18,
        overflow: 'hidden',
      }}
    >
      <TopBar theme={theme} niche={niche} />
      <HeroImage imageDataUrl={imageDataUrl} title={headline} niche={niche} theme={theme} />
      <BottomCopy title={headline} caption={caption} tags={tags} theme={theme} />
    </div>,
    { width: PIN_WIDTH, height: PIN_HEIGHT }
  );
}
