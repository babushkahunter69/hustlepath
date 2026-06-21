import { ImageResponse } from 'next/og';
import { sql } from '@/lib/db';
import { normalizeMood, normalizeNiche, normalizeProductType, parseList, resolveDesignImage } from '@/lib/designLibrary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const contentType = 'image/png';

const PIN_WIDTH = 1000;
const PIN_HEIGHT = 1500;

function getPin(meta: any, index: number) {
  const source = meta && typeof meta === 'object' ? meta : {};
  const pins = Array.isArray(source.pins) ? source.pins : [];
  return pins[index] || null;
}

function cleanText(value: unknown, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

function trimSentence(value: string, maxLength: number) {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  const words = text.split(' ');
  const output: string[] = [];

  for (const word of words) {
    const next = [...output, word].join(' ');
    if (next.length > maxLength) break;
    output.push(word);
  }

  return `${output.join(' ').replace(/[,.!?;:]$/, '')}...`;
}

function wrapText(value: string, maxChars: number, maxLines: number) {
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
    } else {
      line = next;
    }
  }

  if (!truncated && line) lines.push(line);
  return {
    lines: lines.slice(0, maxLines),
    truncated,
  };
}

function themeFor(index: number) {
  const themes = [
    { page: '#f7efe5', card: '#fffdf8', ink: '#161616', accent: '#d8482f', chip: '#ffe1d4', soft: '#f4c7a5' },
    { page: '#eef5f2', card: '#ffffff', ink: '#172821', accent: '#217c67', chip: '#d7eee6', soft: '#b9ddd1' },
    { page: '#f6f0fa', card: '#ffffff', ink: '#241b30', accent: '#6b4ca1', chip: '#eadffd', soft: '#d4c3ef' },
    { page: '#f3f6ee', card: '#ffffff', ink: '#202411', accent: '#607b28', chip: '#e2ecc8', soft: '#cbdba3' },
  ];

  return themes[Math.abs(index) % themes.length];
}

function titleFor(pin: any, design: any) {
  return trimSentence(cleanText(pin?.title || design?.title || 'InkWanderStudio Design'), 68);
}

function descriptionFor(pin: any, design: any) {
  return trimSentence(
    cleanText(
      pin?.description
      || design?.ai_caption_seed
      || design?.notes
      || `${design?.title || 'This design'} is an InkWanderStudio visual made for Pinterest saves and niche creator boards.`
    ),
    160
  );
}

function tagsFor(pin: any, design: any) {
  const keywordFocus = Array.isArray(pin?.keyword_focus) ? pin.keyword_focus : [];
  const designTags = parseList(design?.tags);
  return Array.from(new Set([
    ...keywordFocus.map((value: unknown) => cleanText(value)),
    ...designTags,
    normalizeProductType(pin?.product_type || design?.product_type, design),
  ].filter(Boolean))).slice(0, 3);
}

function HeroImage({ imageSrc, title, theme }: { imageSrc: string | null; title: string; theme: ReturnType<typeof themeFor> }) {
  const titleLines = wrapText(title, 14, 3).lines;

  if (!imageSrc) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(145deg, ${theme.card} 0%, ${theme.chip} 48%, ${theme.soft} 100%)`,
          padding: 36,
        }}
      >
        <div style={{ width: 720, height: 720, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', width: 660, height: 660, borderRadius: 84, background: 'rgba(0,0,0,0.08)', transform: 'rotate(8deg)' }} />
          <div style={{ position: 'absolute', width: 640, height: 640, borderRadius: 84, background: theme.card, border: `8px solid ${theme.ink}`, transform: 'rotate(-4deg)', boxShadow: '0 34px 70px rgba(0,0,0,0.18)' }} />
          <div style={{ width: 420, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {titleLines.map((line, index) => (
              <div key={`${line}-${index}`} style={{ fontSize: titleLines.length >= 3 ? 48 : 58, lineHeight: 0.98, fontWeight: 1000, color: theme.ink, textAlign: 'center', textTransform: 'uppercase' }}>
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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
          background: 'rgba(255,255,255,0.52)',
          boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.6)',
          padding: 24,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt=""
          width="680"
          height="680"
          style={{
            width: 680,
            height: 680,
            objectFit: 'contain',
          }}
        />
      </div>
    </div>
  );
}

function buildPinMarkup(design: any, pin: any, imageSrc: string | null, theme: ReturnType<typeof themeFor>) {
  const title = titleFor(pin, design);
  const description = descriptionFor(pin, design);
  const niche = normalizeNiche(pin?.niche || design?.niche, design);
  const mood = normalizeMood(pin?.mood || design?.mood, design);
  const tags = tagsFor(pin, design);
  const titleWrap = wrapText(title, 22, 3);
  const descriptionWrap = wrapText(description, 44, 3);

  return (
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
      <div style={{ height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: theme.ink, letterSpacing: 0.5 }}>InkWanderStudio</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ borderRadius: 999, padding: '10px 16px', background: theme.chip, color: theme.ink, fontSize: 19, fontWeight: 800, whiteSpace: 'nowrap' }}>
            {niche}
          </div>
        </div>
      </div>

      <div
        style={{
          height: 860,
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
        <HeroImage imageSrc={imageSrc} title={title} theme={theme} />
      </div>

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 136 }}>
          {titleWrap.lines.map((line, index) => (
            <div key={`${line}-${index}`} style={{ fontSize: titleWrap.lines.length >= 3 ? 44 : 54, lineHeight: 0.96, fontWeight: 1000, color: theme.ink, textTransform: 'uppercase' }}>
              {line}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minHeight: 96, marginTop: 8 }}>
          {descriptionWrap.lines.map((line, index) => (
            <div key={`${line}-${index}`} style={{ fontSize: 25, lineHeight: 1.16, color: theme.ink }}>
              {line}{index === descriptionWrap.lines.length - 1 && descriptionWrap.truncated ? '...' : ''}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 14, minHeight: 38 }}>
          {tags.map((tag, index) => (
            <div key={`${tag}-${index}`} style={{ display: 'flex', alignItems: 'center', borderRadius: 999, padding: '7px 12px', background: theme.chip, color: theme.ink, fontSize: 18, fontWeight: 800, whiteSpace: 'nowrap' }}>
              {tag}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', gap: 22 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 18, color: theme.accent, fontWeight: 900, letterSpacing: 0.8 }}>SAVE FOR LATER</div>
            <div style={{ fontSize: 21, color: theme.ink, fontWeight: 800 }}>{mood}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, padding: '15px 22px', background: theme.accent, color: '#fff', fontSize: 22, fontWeight: 900, whiteSpace: 'nowrap' }}>
            View Design
          </div>
        </div>
      </div>
    </div>
  );
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

export async function GET(_request: Request, { params }: { params: Promise<{ designId: string; pinIndex: string }> }) {
  const { designId, pinIndex } = await params;
  const index = Number(pinIndex);

  const [design] = await sql`
    select id, title, image_url, product_url, redbubble_url, niche, tags, product_type, mood, notes, ai_caption_seed, pinterest_meta
    from design_library
    where id = ${designId}
      and coalesce(status, 'active') = 'active'
    limit 1
  `;

  if (!design || !Number.isFinite(index)) {
    return new ImageResponse(<NotFoundImage message="Design pin not found" />, { width: PIN_WIDTH, height: PIN_HEIGHT });
  }

  const pin = getPin(design.pinterest_meta, index);
  const theme = themeFor(index);
  const image = await resolveDesignImage(cleanText(design.image_url));
  const imageSrc = image.hasImage ? image.dataUrl : null;

  try {
    return new ImageResponse(
      buildPinMarkup(design, pin, imageSrc, theme),
      {
        width: PIN_WIDTH,
        height: PIN_HEIGHT,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Design-Image-Status': image.status,
          'X-Design-Image-Source': image.sourceUrl.slice(0, 240),
          'X-Design-Image-Reason': (image.reason || '').slice(0, 160),
          'X-Design-Image-Bytes': String(image.byteLength || 0),
          'X-Design-Image-Render-Mode': imageSrc ? 'inline-image-data' : 'fallback-card',
        },
      }
    );
  } catch (error: any) {
    console.error('Design pin image render failed, retrying without hero image', {
      designId,
      pinIndex,
      message: error?.message || String(error),
    });

    return new ImageResponse(
      buildPinMarkup(design, pin, null, theme),
      {
        width: PIN_WIDTH,
        height: PIN_HEIGHT,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Design-Image-Status': image.status,
          'X-Design-Image-Source': image.sourceUrl.slice(0, 240),
          'X-Design-Image-Reason': (image.reason || '').slice(0, 160),
          'X-Design-Image-Bytes': String(image.byteLength || 0),
          'X-Design-Image-Render-Mode': 'fallback-after-render-error',
        },
      }
    );
  }
}
