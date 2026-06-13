import { ImageResponse } from 'next/og';
import { sql } from '@/lib/db';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

function getPin(meta: any, index: number) {
  const source = meta && typeof meta === 'object' ? meta : {};
  const pins = Array.isArray(source.pins) ? source.pins : [];
  return pins[index] || null;
}

function cleanText(value: unknown, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

function shortText(value: unknown, fallback: string, max = 90) {
  const text = cleanText(value, fallback);
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

function splitTitle(value: string) {
  const words = cleanText(value).split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > 12 && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines.slice(0, 5);
}

function emojiFor(title: string) {
  const text = title.toLowerCase();
  if (text.includes('animal') || text.includes('raccoon')) return '🦝';
  if (text.includes('frog')) return '🐸';
  if (text.includes('goose')) return '🪿';
  if (text.includes('otter')) return '🦦';
  if (text.includes('beaver')) return '🦫';
  if (text.includes('coffee')) return '☕';
  if (text.includes('shirt') || text.includes('tee')) return '👕';
  if (text.includes('sticker')) return '🏷️';
  if (text.includes('gift')) return '🎁';
  return '✨';
}

function themeFor(index: number) {
  const themes = [
    { bg: '#141414', card: '#fff5e6', ink: '#fff7ed', accent: '#f97316', shadow: 'rgba(249,115,22,0.35)' },
    { bg: '#3b1d2f', card: '#fff1f2', ink: '#fff7ed', accent: '#fb7185', shadow: 'rgba(251,113,133,0.35)' },
    { bg: '#1f2937', card: '#ecfccb', ink: '#f8fafc', accent: '#84cc16', shadow: 'rgba(132,204,22,0.35)' },
    { bg: '#172554', card: '#dbeafe', ink: '#eff6ff', accent: '#60a5fa', shadow: 'rgba(96,165,250,0.35)' },
  ];
  return themes[Math.abs(index) % themes.length];
}

export async function GET(_request: Request, { params }: { params: Promise<{ productId: string; pinIndex: string }> }) {
  const { productId, pinIndex } = await params;
  const index = Number(pinIndex);

  const [product] = await sql`
    select id, title, description, image_url, pinterest_meta, updated_at, created_at
    from products
    where id = ${productId}
    limit 1
  `;

  if (!product || !Number.isFinite(index)) {
    return new ImageResponse(
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111827', color: '#fff', fontSize: 48, fontWeight: 800 }}>
        Pin not found
      </div>,
      { width: 1000, height: 1500 }
    );
  }

  const pin = getPin(product.pinterest_meta, index);
  const title = shortText(pin?.title || product.title, 'Funny gift idea', 70);
  const productTitle = shortText(product.title, 'InkWanderStudio find', 60);
  const description = shortText(pin?.description || product.description, 'Save this Redbubble find for later.', 115);
  const titleLines = splitTitle(title);
  const badge = cleanText(pin?.angle || 'find').toUpperCase();
  const hasImage = Boolean(product.image_url);
  const theme = themeFor(index);
  const emoji = emojiFor(`${title} ${productTitle} ${description}`);

  return new ImageResponse(
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: theme.bg,
      color: theme.ink,
      fontFamily: 'Arial, Helvetica, sans-serif',
      padding: 56,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 18% 16%, ${theme.accent} 0, transparent 28%), radial-gradient(circle at 85% 78%, ${theme.accent} 0, transparent 30%)`, opacity: 0.28 }} />
      <div style={{ position: 'absolute', top: 120, left: -80, transform: 'rotate(-12deg)', fontSize: 180, fontWeight: 1000, color: 'rgba(255,255,255,0.06)' }}>SAVE THIS</div>
      <div style={{ position: 'absolute', bottom: 190, right: -90, transform: 'rotate(12deg)', fontSize: 150, fontWeight: 1000, color: 'rgba(255,255,255,0.06)' }}>GIFT IDEA</div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 1000, letterSpacing: 5 }}>INKWANDERSTUDIO</div>
        <div style={{ padding: '14px 22px', borderRadius: 999, background: theme.accent, color: '#111827', fontSize: 24, fontWeight: 1000, letterSpacing: 2 }}>{badge}</div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, gap: 44 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
          <div style={{ fontSize: 112, lineHeight: 1 }}>{emoji}</div>
          <div style={{ fontSize: 34, fontWeight: 1000, letterSpacing: 2, color: theme.accent, textTransform: 'uppercase' }}>Funny Redbubble Find</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {titleLines.map((line, lineIndex) => (
            <div key={`${line}-${lineIndex}`} style={{ fontSize: titleLines.length > 4 ? 90 : 108, lineHeight: 0.88, fontWeight: 1000, letterSpacing: -4, textTransform: 'uppercase' }}>
              {line}
            </div>
          ))}
        </div>

        <div style={{
          display: 'flex',
          gap: 34,
          alignItems: 'center',
          background: theme.card,
          color: '#111827',
          borderRadius: 46,
          padding: 34,
          boxShadow: `0 30px 80px ${theme.shadow}`,
          border: '8px solid rgba(255,255,255,0.4)',
        }}>
          <div style={{
            width: 300,
            height: 300,
            borderRadius: 40,
            background: '#ffffff',
            border: '8px solid rgba(17,24,39,0.10)',
            boxShadow: '0 22px 55px rgba(17,24,39,0.20)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {hasImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ fontSize: 110 }}>{emoji}</div>
                <div style={{ fontSize: 26, fontWeight: 1000, letterSpacing: 1 }}>RED BUBBLE</div>
              </div>
            )}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ fontSize: 38, lineHeight: 1.05, fontWeight: 1000 }}>{description}</div>
            <div style={{ fontSize: 24, opacity: 0.72, fontWeight: 900 }}>Shirts · Stickers · Mugs · Gifts</div>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 1000 }}>{productTitle}</div>
        <div style={{ background: '#fff', color: '#111827', borderRadius: 999, padding: '16px 24px', fontSize: 28, fontWeight: 1000 }}>SAVE FOR LATER</div>
      </div>
    </div>,
    {
      width: 1000,
      height: 1500,
    }
  );
}
