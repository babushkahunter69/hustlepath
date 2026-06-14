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

type Template = 'sticker' | 'shirt' | 'gift' | 'quote';

function getPin(meta: any, index: number) {
  const source = meta && typeof meta === 'object' ? meta : {};
  const pins = Array.isArray(source.pins) ? source.pins : [];
  return pins[index] || null;
}

function cleanText(value: unknown, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

function splitTitle(value: string, maxLine = 16, maxLines = 4) {
  const words = cleanText(value).split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxLine && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

function inferTemplate(text: string, index: number): Template {
  const value = text.toLowerCase();
  if (value.includes('shirt') || value.includes('tee')) return 'shirt';
  if (value.includes('gift') || value.includes('mug')) return 'gift';
  if (value.includes('quote') || value.includes('sarcastic') || value.includes('funny')) return 'quote';
  if (value.includes('sticker')) return 'sticker';
  const templates: Template[] = ['sticker', 'shirt', 'gift', 'quote'];
  return templates[Math.abs(index) % templates.length];
}

function themeFor(index: number) {
  const themes = [
    { page: '#f6efe7', card: '#fffdf9', ink: '#161616', accent: '#d97706', chip: '#f3e8d7', soft: '#fde6cf' },
    { page: '#f4f0fb', card: '#ffffff', ink: '#28163a', accent: '#db2777', chip: '#f8d8ea', soft: '#eadcf8' },
    { page: '#edf8f2', card: '#ffffff', ink: '#183525', accent: '#2f855a', chip: '#d7f0df', soft: '#cfe9d9' },
    { page: '#eef4fb', card: '#ffffff', ink: '#152c4f', accent: '#2563eb', chip: '#d8e8ff', soft: '#dbeafe' },
  ];
  return themes[Math.abs(index) % themes.length];
}

function strongerHeadline(pin: any, product: any) {
  const raw = cleanText(pin?.title || pin?.design_focus || product.title, 'InkWanderStudio Redbubble Find');
  return raw.replace(/\bRedbubble\b/gi, '').replace(/\s+/g, ' ').trim() || raw;
}

function buildCaption(pin: any, product: any, template: Template) {
  const fallback = cleanText(product.description, 'Save this InkWanderStudio design for later.');
  const text = cleanText(pin?.description, fallback);
  const short = text.length > 165 ? `${text.slice(0, 162).trim()}...` : text;
  if (template === 'sticker') return short || 'Sticker idea for laptops, water bottles, notebooks, and funny little gifts.';
  if (template === 'shirt') return short || 'Graphic tee idea with a real niche point of view and giftable humor.';
  if (template === 'gift') return short || 'Giftable design pick for mugs, stickers, and personal little surprises.';
  return short || 'Pinterest-worthy funny art with clean, readable text and a specific niche hook.';
}

function keywordTags(pin: any, product: any) {
  const raw = Array.isArray(pin?.keyword_focus) ? pin.keyword_focus : parseKeywords(product?.keywords);
  const tags = raw.map((value: unknown) => cleanText(value)).filter(Boolean);
  if (tags.length) return tags.slice(0, 3);
  return ['InkWanderStudio', 'Redbubble design', 'gift idea'];
}

function nicheLabel(pin: any, product: any) {
  return cleanText(pin?.niche, product?.title || 'Pinterest product pin').slice(0, 48);
}

function formatProductLabel(product: any) {
  const title = cleanText(product?.title, 'InkWanderStudio design');
  return title.length > 52 ? `${title.slice(0, 49).trim()}...` : title;
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
        accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
      cache: 'force-cache',
    });

    if (!response.ok) return null;

    const contentType = cleanText(response.headers.get('content-type')).split(';')[0].toLowerCase();
    if (!contentType.startsWith('image/') || contentType === 'image/svg+xml') return null;

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

function FallbackArtwork({ title, theme, niche }: { title: string; theme: ReturnType<typeof themeFor>; niche: string }) {
  const words = splitTitle(title, 12, 3);
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 42,
        background: `linear-gradient(135deg, ${theme.soft}, ${theme.card})`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          alignSelf: 'flex-start',
          borderRadius: 999,
          padding: '10px 18px',
          background: theme.card,
          border: `3px solid ${theme.ink}`,
          fontSize: 24,
          fontWeight: 800,
          color: theme.ink,
        }}
      >
        {niche.toUpperCase()}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {words.map((word, index) => (
          <div
            key={`${word}-${index}`}
            style={{
              fontSize: 76,
              lineHeight: 0.94,
              fontWeight: 1000,
              letterSpacing: -2,
              textTransform: 'uppercase',
              color: theme.ink,
            }}
          >
            {word}
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 180,
            height: 180,
            borderRadius: 999,
            background: theme.accent,
            opacity: 0.9,
            border: `6px solid ${theme.ink}`,
          }}
        />
        <div
          style={{
            flex: 1,
            height: 24,
            borderRadius: 999,
            background: theme.ink,
            opacity: 0.14,
          }}
        />
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
  const fullText = `${pin?.title || ''} ${pin?.description || ''} ${product.title || ''} ${product.description || ''}`;
  const template = inferTemplate(fullText, index);
  const theme = themeFor(index);
  const headline = strongerHeadline(pin, product);
  const lines = splitTitle(headline, 16, 4);
  const caption = buildCaption(pin, product, template);
  const tags = keywordTags(pin, product);
  const niche = nicheLabel(pin, product);
  const imageDataUrl = await fetchProductImageDataUrl(product.image_url);
  const eyebrow =
    template === 'quote'
      ? 'RELATABLE FIND'
      : template === 'shirt'
        ? 'GRAPHIC TEE IDEA'
        : template === 'gift'
          ? 'GIFTABLE REDBUBBLE PICK'
          : 'SAVE-WORTHY STICKER';

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: theme.page,
        color: theme.ink,
        fontFamily: 'Arial, Helvetica, sans-serif',
        padding: 34,
        gap: 28,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: 860,
          borderRadius: 42,
          overflow: 'hidden',
          background: theme.card,
          border: `4px solid ${theme.ink}`,
          boxShadow: '0 28px 80px rgba(0,0,0,0.12)',
          position: 'relative',
        }}
      >
        {imageDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageDataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <FallbackArtwork title={headline} theme={theme} niche={niche} />
        )}

        <div
          style={{
            position: 'absolute',
            top: 28,
            left: 28,
            display: 'flex',
            alignItems: 'center',
            borderRadius: 999,
            padding: '12px 18px',
            background: 'rgba(255,255,255,0.94)',
            border: `3px solid ${theme.ink}`,
            fontSize: 22,
            fontWeight: 900,
            letterSpacing: 1,
          }}
        >
          INKWANDERSTUDIO
        </div>

        <div
          style={{
            position: 'absolute',
            right: 28,
            top: 28,
            display: 'flex',
            alignItems: 'center',
            borderRadius: 999,
            padding: '12px 18px',
            background: theme.accent,
            color: '#fff',
            border: `3px solid ${theme.ink}`,
            fontSize: 20,
            fontWeight: 900,
            letterSpacing: 1,
          }}
        >
          {eyebrow}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          flex: 1,
          borderRadius: 42,
          background: theme.card,
          border: `4px solid ${theme.ink}`,
          padding: 36,
          gap: 22,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            alignSelf: 'flex-start',
            borderRadius: 999,
            padding: '10px 16px',
            background: theme.chip,
            fontSize: 22,
            fontWeight: 800,
            color: theme.ink,
          }}
        >
          {niche.toUpperCase()}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {lines.map((line, lineIndex) => (
            <div
              key={`${line}-${lineIndex}`}
              style={{
                fontSize: lines.length >= 4 ? 68 : 78,
                lineHeight: 0.94,
                fontWeight: 1000,
                letterSpacing: -2,
                textTransform: 'uppercase',
              }}
            >
              {line}
            </div>
          ))}
        </div>

        <div style={{ fontSize: 30, lineHeight: 1.25, color: theme.ink }}>{caption}</div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {tags.map((tag, tagIndex) => (
            <div
              key={`${tag}-${tagIndex}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                borderRadius: 999,
                padding: '10px 16px',
                background: theme.chip,
                fontSize: 22,
                fontWeight: 700,
                color: theme.ink,
              }}
            >
              {tag}
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 20,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 20, letterSpacing: 1.4, fontWeight: 800, color: theme.accent }}>REDBUBBLE DESIGN</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: theme.ink }}>{formatProductLabel(product)}</div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
              padding: '16px 24px',
              background: theme.accent,
              color: '#fff',
              border: `4px solid ${theme.ink}`,
              fontSize: 24,
              fontWeight: 900,
            }}
          >
            SAVE THIS PIN
          </div>
        </div>
      </div>
    </div>,
    { width: PIN_WIDTH, height: PIN_HEIGHT }
  );
}
