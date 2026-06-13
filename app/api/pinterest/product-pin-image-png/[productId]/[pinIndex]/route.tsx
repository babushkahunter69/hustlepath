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
    if (next.length > 16 && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines.slice(0, 4);
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
  const title = shortText(pin?.title || product.title, 'Funny gift idea', 72);
  const productTitle = shortText(product.title, 'InkWanderStudio find', 72);
  const description = shortText(pin?.description || product.description, 'Save this Redbubble find for later.', 130);
  const titleLines = splitTitle(title);
  const badge = cleanText(pin?.angle || 'redbubble').toUpperCase();
  const hasImage = Boolean(product.image_url);

  return new ImageResponse(
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(180deg, #f6efe4 0%, #e6d3bd 100%)',
      color: '#1f2933',
      fontFamily: 'Arial, Helvetica, sans-serif',
      padding: 70,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 42, left: 42, right: 42, bottom: 42, border: '8px solid rgba(31,41,51,0.12)', borderRadius: 42 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 42 }}>
        <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: 5 }}>INKWANDERSTUDIO</div>
        <div style={{ padding: '14px 22px', borderRadius: 999, background: '#1f2933', color: '#fff', fontSize: 24, fontWeight: 900, letterSpacing: 2 }}>{badge}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, gap: 42 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {titleLines.map((line, lineIndex) => (
            <div key={`${line}-${lineIndex}`} style={{ fontSize: titleLines.length > 3 ? 86 : 104, lineHeight: 0.92, fontWeight: 1000, letterSpacing: -3, textTransform: 'uppercase' }}>
              {line}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 34, alignItems: 'center' }}>
          <div style={{
            width: 340,
            height: 340,
            borderRadius: 38,
            background: '#ffffff',
            border: '8px solid rgba(31,41,51,0.1)',
            boxShadow: '0 22px 55px rgba(31,41,51,0.20)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {hasImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ fontSize: 90, fontWeight: 1000 }}>HPD</div>
            )}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ fontSize: 34, lineHeight: 1.12, fontWeight: 800 }}>{description}</div>
            <div style={{ fontSize: 25, opacity: 0.75, fontWeight: 800 }}>Available on shirts, stickers, mugs, and gifts.</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 42, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 32, fontWeight: 900 }}>{productTitle}</div>
        <div style={{ fontSize: 28, fontWeight: 900 }}>Save for later</div>
      </div>
    </div>,
    {
      width: 1000,
      height: 1500,
    }
  );
}
