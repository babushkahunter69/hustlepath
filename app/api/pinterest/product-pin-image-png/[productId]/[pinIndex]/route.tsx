import { ImageResponse } from 'next/og';
import { sql } from '@/lib/db';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

type Template = 'sticker' | 'shirt' | 'gift' | 'quote';

function getPin(meta: any, index: number) {
  const source = meta && typeof meta === 'object' ? meta : {};
  const pins = Array.isArray(source.pins) ? source.pins : [];
  return pins[index] || null;
}

function cleanText(value: unknown, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

function titleCase(value: string) {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function splitTitle(value: string, maxLine = 13, maxLines = 5) {
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

function emojiFor(text: string) {
  const value = text.toLowerCase();
  if (value.includes('raccoon')) return '🦝';
  if (value.includes('frog')) return '🐸';
  if (value.includes('goose')) return '🪿';
  if (value.includes('otter')) return '🦦';
  if (value.includes('beaver')) return '🦫';
  if (value.includes('coffee')) return '☕';
  if (value.includes('mug')) return '☕';
  if (value.includes('shirt') || value.includes('tee')) return '👕';
  if (value.includes('gift')) return '🎁';
  return '🏷️';
}

function themeFor(index: number) {
  const themes = [
    { bg: '#fff7ed', ink: '#171717', accent: '#ea580c', alt: '#111827', soft: '#fed7aa' },
    { bg: '#fdf2f8', ink: '#3b0764', accent: '#db2777', alt: '#4a044e', soft: '#fbcfe8' },
    { bg: '#ecfccb', ink: '#1a2e05', accent: '#65a30d', alt: '#365314', soft: '#bef264' },
    { bg: '#eff6ff', ink: '#172554', accent: '#2563eb', alt: '#1e3a8a', soft: '#bfdbfe' },
  ];
  return themes[Math.abs(index) % themes.length];
}

function strongerHeadline(pin: any, product: any) {
  const raw = cleanText(pin?.title || product.title, 'Funny Redbubble Find');
  return raw
    .replace(/\bRedbubble\b/gi, '')
    .replace(/\bUnique\b/gi, '')
    .replace(/\bStylish\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || raw;
}

function subhead(pin: any, product: any, template: Template) {
  const desc = cleanText(pin?.description || product.description || '', 'Save this funny design for your next gift idea.');
  if (template === 'sticker') return 'Sticker idea for laptops, water bottles, notebooks, and chaotic little gifts.';
  if (template === 'shirt') return 'Graphic tee idea for people with humor, attitude, and questionable patience.';
  if (template === 'gift') return 'Easy gift idea for friends who love funny, weird, oddly specific finds.';
  return desc.length > 92 ? `${desc.slice(0, 89).trim()}...` : desc;
}

function StickerMockup({ emoji, theme, hasImage, imageUrl }: any) {
  return (
    <div style={{ display: 'flex', width: 430, height: 430, alignItems: 'center', justifyContent: 'center', transform: 'rotate(-6deg)', filter: 'drop-shadow(0 28px 24px rgba(0,0,0,0.28))' }}>
      <div style={{ width: 330, height: 330, borderRadius: 54, background: '#fff', border: '18px solid #ffffff', outline: `8px solid ${theme.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ fontSize: 150 }}>{emoji}</div>
        )}
      </div>
    </div>
  );
}

function ShirtMockup({ emoji, theme, hasImage, imageUrl }: any) {
  return (
    <div style={{ width: 470, height: 390, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', top: 82, left: 22, width: 126, height: 190, background: theme.alt, borderRadius: 42, transform: 'rotate(24deg)' }} />
      <div style={{ position: 'absolute', top: 82, right: 22, width: 126, height: 190, background: theme.alt, borderRadius: 42, transform: 'rotate(-24deg)' }} />
      <div style={{ width: 280, height: 340, background: theme.alt, borderRadius: '48px 48px 34px 34px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 28px 45px rgba(0,0,0,0.28)', overflow: 'hidden' }}>
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" style={{ width: 190, height: 190, objectFit: 'cover', borderRadius: 24 }} />
        ) : (
          <div style={{ fontSize: 112 }}>{emoji}</div>
        )}
      </div>
      <div style={{ position: 'absolute', top: 42, width: 120, height: 58, borderRadius: '0 0 60px 60px', background: theme.bg }} />
    </div>
  );
}

function GiftMockup({ emoji, theme, hasImage, imageUrl }: any) {
  return (
    <div style={{ width: 430, height: 430, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <div style={{ position: 'absolute', width: 380, height: 300, borderRadius: 38, background: '#fff', boxShadow: '0 28px 50px rgba(0,0,0,0.26)', transform: 'rotate(4deg)' }} />
      <div style={{ position: 'absolute', width: 340, height: 260, borderRadius: 32, background: theme.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(-4deg)', border: `8px solid ${theme.ink}` }}>
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" style={{ width: 220, height: 220, objectFit: 'cover', borderRadius: 28 }} />
        ) : (
          <div style={{ fontSize: 134 }}>{emoji}</div>
        )}
      </div>
    </div>
  );
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
    return new ImageResponse(<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111827', color: '#fff', fontSize: 48, fontWeight: 900 }}>Pin not found</div>, { width: 1000, height: 1500 });
  }

  const pin = getPin(product.pinterest_meta, index);
  const fullText = `${pin?.title || ''} ${pin?.description || ''} ${product.title || ''} ${product.description || ''}`;
  const template = inferTemplate(fullText, index);
  const theme = themeFor(index);
  const emoji = emojiFor(fullText);
  const headline = strongerHeadline(pin, product);
  const lines = splitTitle(headline, template === 'quote' ? 10 : 12, 5);
  const caption = subhead(pin, product, template);
  const hasImage = Boolean(product.image_url);
  const imageUrl = product.image_url;
  const eyebrow = template === 'quote' ? 'RELATABLE FIND' : template === 'shirt' ? 'GRAPHIC TEE IDEA' : template === 'gift' ? 'FUNNY GIFT IDEA' : 'STICKER IDEA';

  const ProductVisual = template === 'shirt' ? ShirtMockup : template === 'gift' ? GiftMockup : StickerMockup;

  return new ImageResponse(
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: theme.bg,
      color: theme.ink,
      fontFamily: 'Arial, Helvetica, sans-serif',
      padding: 54,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -80, right: -120, width: 420, height: 420, borderRadius: 999, background: theme.soft, opacity: 0.9 }} />
      <div style={{ position: 'absolute', bottom: -120, left: -140, width: 520, height: 520, borderRadius: 999, background: theme.soft, opacity: 0.7 }} />
      <div style={{ position: 'absolute', top: 230, left: -46, right: -46, height: 88, background: theme.accent, transform: 'rotate(-7deg)', opacity: 0.95 }} />
      <div style={{ position: 'absolute', top: 328, left: -46, right: -46, height: 40, background: theme.ink, transform: 'rotate(-7deg)', opacity: 0.12 }} />

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 1000, letterSpacing: 3 }}>INKWANDERSTUDIO</div>
        <div style={{ fontSize: 26, fontWeight: 1000, background: theme.ink, color: theme.bg, borderRadius: 999, padding: '15px 22px' }}>{template.toUpperCase()}</div>
      </div>

      <div style={{ position: 'relative', zIndex: 2, marginTop: 80, display: 'flex', alignItems: 'center', gap: 28 }}>
        <div style={{ width: 82, height: 82, borderRadius: 26, background: '#fff', border: `7px solid ${theme.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, transform: 'rotate(-8deg)' }}>{emoji}</div>
        <div style={{ fontSize: 34, fontWeight: 1000, letterSpacing: 2, color: theme.ink }}>{eyebrow}</div>
      </div>

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 2, marginTop: 54 }}>
        {lines.map((line, lineIndex) => (
          <div key={`${line}-${lineIndex}`} style={{
            fontSize: lines.length >= 5 ? 88 : 104,
            lineHeight: 0.9,
            fontWeight: 1000,
            letterSpacing: -3,
            textTransform: 'uppercase',
            textShadow: `6px 6px 0 ${theme.soft}`,
          }}>
            {line}
          </div>
        ))}
      </div>

      <div style={{ position: 'relative', zIndex: 2, marginTop: 'auto', marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <ProductVisual emoji={emoji} theme={theme} hasImage={hasImage} imageUrl={imageUrl} />
          <div style={{ flex: 1, background: '#fff', border: `8px solid ${theme.ink}`, borderRadius: 38, padding: 28, transform: 'rotate(2deg)', boxShadow: '0 24px 0 rgba(0,0,0,0.16)' }}>
            <div style={{ fontSize: 34, lineHeight: 1.05, fontWeight: 1000 }}>{caption}</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 1000 }}>{titleCase(cleanText(product.title, 'InkWanderStudio'))}</div>
          <div style={{ fontSize: 30, fontWeight: 1000, color: '#fff', background: theme.accent, border: `6px solid ${theme.ink}`, borderRadius: 999, padding: '16px 24px', boxShadow: '0 10px 0 rgba(0,0,0,0.18)' }}>SAVE THIS</div>
        </div>
      </div>
    </div>,
    { width: 1000, height: 1500 }
  );
}
