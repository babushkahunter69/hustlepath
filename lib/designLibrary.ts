import OpenAI from 'openai';
import { sql } from '@/lib/db';

const MAX_IMAGE_BYTES = 10_000_000;
const FETCH_TIMEOUT_MS = 8000;
const SUPPORTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

export const INKWANDER_NICHES = [
  'millennial humor',
  'introvert humor',
  'sarcastic animals',
  'coffee culture',
  'relatable stickers',
] as const;

export type InkWanderNiche = typeof INKWANDER_NICHES[number];

export type DesignRecord = {
  id: string;
  title: string;
  image_url: string;
  product_url?: string | null;
  redbubble_url?: string | null;
  niche?: string | null;
  tags?: unknown;
  product_type?: string | null;
  mood?: string | null;
  notes?: string | null;
  ai_keywords?: unknown;
  ai_caption_seed?: string | null;
  ai_article_ideas?: unknown;
  auto_tag_status?: string | null;
  pinterest_meta?: unknown;
  status?: string | null;
  source?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DesignPin = {
  title: string;
  description: string;
  angle: 'product' | 'gift' | 'trend' | 'collection' | 'mood' | 'style' | 'seasonal' | 'workspace';
  status: 'draft' | 'posted';
  niche?: string;
  keyword_focus?: string[];
  product_type?: string;
  mood?: string;
  image_url?: string;
  tracked_url?: string;
  target_url?: string;
  created_at: string;
};

export type DesignImageResult = {
  sourceUrl: string;
  status: string;
  contentType: string;
  byteLength: number;
  hasImage: boolean;
  reason?: string;
  dataUrl: string | null;
};

function cleanText(value: unknown, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

export function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

export function parseCsvRows(csv: string) {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase().trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return headers.reduce((row: Record<string, string>, header, index) => {
      row[header] = cells[index] || '';
      return row;
    }, {});
  });
}

export function parseList(input: unknown) {
  if (Array.isArray(input)) {
    return Array.from(new Set(input.map((value) => cleanText(value)).filter(Boolean)));
  }

  const text = cleanText(input);
  if (!text) return [];
  return Array.from(new Set(
    text
      .split(/[\n,|]/)
      .map((value) => cleanText(value))
      .filter(Boolean)
  ));
}

function titleCase(value: string) {
  return cleanText(value).replace(/\w\S*/g, (word) => {
    if (word.length <= 3 && word === word.toUpperCase()) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

function detectNiche(value: Partial<DesignRecord>) {
  const haystack = [
    value.title,
    value.niche,
    value.product_type,
    value.mood,
    ...(parseList(value.tags)),
    ...(parseList(value.ai_keywords)),
    value.notes,
  ].join(' ').toLowerCase();

  if (/coffee|espresso|latte|caffeine|cafe/.test(haystack)) return 'coffee culture';
  if (/introvert|social battery|homebody|awkward|stay home/.test(haystack)) return 'introvert humor';
  if (/millennial|adulting|burnout|nostalgia|financially flexible|morally exhausted/.test(haystack)) return 'millennial humor';
  if (/animal|cat|dog|frog|goose|duck|bird|bear|raccoon/.test(haystack)) return 'sarcastic animals';
  return 'relatable stickers';
}

export function normalizeNiche(value: unknown, fallback?: Partial<DesignRecord>) {
  const normalized = cleanText(value).toLowerCase();
  const matched = INKWANDER_NICHES.find((item) => item === normalized);
  return matched || detectNiche({ ...(fallback || {}), niche: normalized });
}

export function normalizeProductType(value: unknown, fallback?: Partial<DesignRecord>) {
  const raw = cleanText(value);
  if (raw) return titleCase(raw);

  const haystack = [fallback?.title, fallback?.notes, ...(parseList(fallback?.tags))].join(' ').toLowerCase();
  if (/sticker/.test(haystack)) return 'Sticker';
  if (/mug/.test(haystack)) return 'Mug';
  if (/shirt|tee|t-shirt/.test(haystack)) return 'T-Shirt';
  if (/pillow/.test(haystack)) return 'Throw Pillow';
  if (/mouse pad|mousepad/.test(haystack)) return 'Mouse Pad';
  if (/poster|print|art/.test(haystack)) return 'Art Print';
  return 'Design';
}

export function normalizeMood(value: unknown, fallback?: Partial<DesignRecord>) {
  const raw = cleanText(value);
  if (raw) return titleCase(raw);

  const niche = normalizeNiche(fallback?.niche, fallback);
  const moodMap: Record<string, string> = {
    'millennial humor': 'Witty burnout',
    'introvert humor': 'Quiet cozy',
    'sarcastic animals': 'Playful sarcasm',
    'coffee culture': 'Cafe cozy',
    'relatable stickers': 'Soft relatable',
  };

  return moodMap[niche] || 'Giftable';
}

export function normalizeTags(value: unknown, fallback?: Partial<DesignRecord>) {
  const tags = parseList(value);
  if (tags.length) return tags;

  const niche = normalizeNiche(fallback?.niche, fallback);
  const productType = normalizeProductType(fallback?.product_type, fallback);
  return Array.from(new Set([niche, productType.toLowerCase(), 'InkWanderStudio']));
}

export function buildArticleIdeas(value: Partial<DesignRecord>) {
  const title = cleanText(value.title, 'InkWanderStudio design');
  const niche = normalizeNiche(value.niche, value);
  const productType = normalizeProductType(value.product_type, value);

  return [
    `Best ${niche} design ideas to save from InkWanderStudio`,
    `How to turn ${title} into Pinterest traffic and gift-board clicks`,
    `Why ${productType.toLowerCase()} designs like ${title} work for niche visual content`,
  ];
}

function weakTitle(value: string) {
  const title = cleanText(value).toLowerCase();
  return !title || title.length < 10 || /untitled|design|artwork/.test(title);
}

function conciseTitle(value: string, maxLength = 58) {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  const words = text.split(' ');
  const output: string[] = [];

  for (const word of words) {
    const next = [...output, word].join(' ');
    if (next.length > maxLength) break;
    output.push(word);
  }

  return output.join(' ').replace(/[,.!?;:]$/, '');
}

function descriptionText(value: string, maxLength = 160) {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  return `${conciseTitle(text, maxLength - 3)}...`;
}

function uniquePins<T extends { title: string }>(pins: T[]) {
  const seen = new Set<string>();
  return pins.filter((pin) => {
    const key = cleanText(pin.title).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildFallbackPins(record: Partial<DesignRecord>, count = 8): DesignPin[] {
  const now = new Date().toISOString();
  const title = weakTitle(cleanText(record.title)) ? 'InkWanderStudio Design' : cleanText(record.title);
  const shortTitle = conciseTitle(title, 52);
  const niche = normalizeNiche(record.niche, record);
  const mood = normalizeMood(record.mood, record);
  const productType = normalizeProductType(record.product_type, record);
  const tags = normalizeTags(record.tags, record).slice(0, 6);
  const targetUrl = cleanText(record.product_url || record.redbubble_url);

  const seeds = [
    { angle: 'product' as const, suffix: productType, lead: `${shortTitle} is a design-specific ${productType.toLowerCase()} pin for ${niche}.` },
    { angle: 'gift' as const, suffix: 'Gift Idea', lead: `${shortTitle} makes a save-worthy gift pin with ${mood.toLowerCase()} energy.` },
    { angle: 'trend' as const, suffix: 'Trend', lead: `${shortTitle} fits Pinterest boards built around ${niche} and InkWanderStudio art.` },
    { angle: 'collection' as const, suffix: 'Collection', lead: `${shortTitle} belongs in a niche creator collection with tags people actually search.` },
    { angle: 'mood' as const, suffix: mood, lead: `${shortTitle} turns ${mood.toLowerCase()} into a visual Pinterest save.` },
    { angle: 'style' as const, suffix: `${productType} Style`, lead: `${shortTitle} keeps the design image front and center instead of relying on generic category copy.` },
    { angle: 'workspace' as const, suffix: 'Desk Decor', lead: `${shortTitle} works for mood boards, desk setups, and niche product inspiration.` },
    { angle: 'seasonal' as const, suffix: 'Save This', lead: `${shortTitle} is a scroll-stopping InkWanderStudio design worth pinning for later.` },
  ];

  return uniquePins(
    seeds.map((seed) => ({
      title: conciseTitle(`${shortTitle} ${seed.suffix}`.replace(/\s+/g, ' '), 64),
      description: descriptionText(`${seed.lead} Use the uploaded design image as the hero visual, keep the text clean, and make the pin feel like real Pinterest content.`),
      angle: seed.angle,
      status: 'draft' as const,
      niche,
      keyword_focus: tags,
      product_type: productType,
      mood,
      target_url: targetUrl || undefined,
      created_at: now,
    }))
  ).slice(0, count);
}

export async function generateDesignPinterestPins(record: Partial<DesignRecord>, count = 8) {
  const safeCount = Math.max(4, Math.min(count, 12));
  const fallbackPins = buildFallbackPins(record, safeCount);

  if (!process.env.OPENAI_API_KEY) return fallbackPins;

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const title = cleanText(record.title, 'InkWanderStudio design');
    const niche = normalizeNiche(record.niche, record);
    const mood = normalizeMood(record.mood, record);
    const productType = normalizeProductType(record.product_type, record);
    const tags = normalizeTags(record.tags, record).join(', ');

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      temperature: 0.8,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You create Pinterest pin metadata for creator design libraries. Return JSON only.',
        },
        {
          role: 'user',
          content: `Create ${safeCount} Pinterest pins for this InkWanderStudio design.\n\nTitle: ${title}\nNiche: ${niche}\nMood: ${mood}\nProduct type: ${productType}\nTags: ${tags}\nNotes: ${cleanText(record.notes)}\nCaption seed: ${cleanText(record.ai_caption_seed)}\n\nRules:\n- Use the uploaded design image as the hero visual.\n- Titles must stay specific to the design and avoid broad generic category language.\n- Keep titles short enough for Pinterest overlays.\n- Each pin needs title, description, angle, niche, keyword_focus, product_type, mood.\n- Angles can be: product, gift, trend, collection, mood, style, seasonal, workspace.\n- Return JSON with one key named pins.`,
        },
      ],
    });

    const raw = JSON.parse(completion.choices[0].message.content || '{"pins":[]}');
    const pins = Array.isArray(raw.pins)
      ? raw.pins.map((pin: any, index: number) => {
          const backup = fallbackPins[index % fallbackPins.length];
          return {
            title: conciseTitle(cleanText(pin.title, backup.title), 64),
            description: descriptionText(cleanText(pin.description, backup.description), 220),
            angle: backup.angle,
            status: 'draft' as const,
            niche: cleanText(pin.niche, backup.niche),
            keyword_focus: parseList(pin.keyword_focus).slice(0, 6),
            product_type: cleanText(pin.product_type, backup.product_type),
            mood: cleanText(pin.mood, backup.mood),
            target_url: cleanText(pin.target_url || record.product_url || record.redbubble_url),
            created_at: backup.created_at,
          } satisfies DesignPin;
        })
      : [];

    return uniquePins([...pins, ...fallbackPins]).slice(0, safeCount);
  } catch {
    return fallbackPins;
  }
}

export function attachDesignPinUrls(designId: string, pins: DesignPin[]) {
  return pins.map((pin, index) => ({
    ...pin,
    image_url: `/api/pinterest/design-pin-image-png/${designId}/${index}`,
    tracked_url: pin.target_url || undefined,
  }));
}

export function normalizeDesignPinterestMeta(meta: unknown, pins: DesignPin[], articleIdeas: string[]) {
  const existing = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta as Record<string, unknown> : {};
  return {
    ...existing,
    pins,
    article_ideas: articleIdeas,
    generated_at: new Date().toISOString(),
    system: 'hustlepath-design-library-v1',
  };
}

export async function ensureDesignLibraryTable() {
  await sql`
    create table if not exists design_library (
      id text primary key,
      title text not null,
      image_url text not null,
      product_url text,
      redbubble_url text,
      niche text,
      tags jsonb default '[]'::jsonb,
      product_type text,
      mood text,
      notes text,
      ai_keywords jsonb default '[]'::jsonb,
      ai_caption_seed text,
      ai_article_ideas jsonb default '[]'::jsonb,
      auto_tag_status text default 'pending',
      pinterest_meta jsonb default '{}'::jsonb,
      source text default 'manual',
      status text default 'active',
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`create index if not exists design_library_status_idx on design_library(status)`;
  await sql`create index if not exists design_library_niche_idx on design_library(niche)`;
  await sql`create index if not exists design_library_product_type_idx on design_library(product_type)`;
  await sql`create index if not exists design_library_mood_idx on design_library(mood)`;
  await sql`create index if not exists design_library_tags_idx on design_library using gin(tags)`;
  await sql`create index if not exists design_library_ai_keywords_idx on design_library using gin(ai_keywords)`;
}

export function validateDesignImageUrl(value: string) {
  const imageUrl = cleanText(value);
  if (!imageUrl) return 'Design image is required.';

  const lower = imageUrl.toLowerCase();
  if (lower.startsWith('data:image/')) return '';
  if (!/^https?:\/\//i.test(imageUrl)) return 'Design image must be an absolute image URL or uploaded file.';
  if (/(\/boom\/client\/|avatar|logo|icon|placeholder|sprite|heart|favorite)/i.test(lower)) return 'Design image looks like a UI asset instead of real artwork.';
  if (/\.svg(\?|#|$)/i.test(lower)) return 'SVG UI assets are not allowed as design library images.';
  return '';
}

function imageDataToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
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

export async function resolveDesignImage(imageUrl: string): Promise<DesignImageResult> {
  const cleaned = cleanText(imageUrl);
  const validationError = validateDesignImageUrl(cleaned);

  if (validationError) {
    return {
      sourceUrl: cleaned,
      status: 'invalid',
      contentType: '',
      byteLength: 0,
      hasImage: false,
      reason: validationError,
      dataUrl: null,
    };
  }

  if (cleaned.toLowerCase().startsWith('data:image/')) {
    return {
      sourceUrl: cleaned.slice(0, 64),
      status: 'inline-data',
      contentType: cleaned.slice(5, cleaned.indexOf(';')) || 'image/png',
      byteLength: cleaned.length,
      hasImage: true,
      dataUrl: cleaned,
    };
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(cleaned, {
      signal: controller.signal,
      headers: {
        accept: 'image/png,image/jpeg,image/webp,image/*;q=0.7,*/*;q=0.4',
        'accept-language': 'en-US,en;q=0.9',
        referer: 'https://hustlepathdaily.com/',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      },
      cache: 'no-store',
    });

    const declaredType = cleanText(response.headers.get('content-type')).split(';')[0].toLowerCase();
    if (!response.ok) {
      return {
        sourceUrl: cleaned,
        status: `http-${response.status}`,
        contentType: declaredType,
        byteLength: 0,
        hasImage: false,
        reason: 'non-ok-image-response',
        dataUrl: null,
      };
    }

    if (declaredType.startsWith('text/html')) {
      return {
        sourceUrl: cleaned,
        status: 'html-response',
        contentType: declaredType,
        byteLength: 0,
        hasImage: false,
        reason: 'image-url-returned-html',
        dataUrl: null,
      };
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    const contentType = sniffImageType(bytes, declaredType);

    if (!bytes.byteLength) {
      return {
        sourceUrl: cleaned,
        status: 'empty',
        contentType: declaredType,
        byteLength: 0,
        hasImage: false,
        reason: 'empty-image-response',
        dataUrl: null,
      };
    }

    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      return {
        sourceUrl: cleaned,
        status: 'too-large',
        contentType: declaredType,
        byteLength: bytes.byteLength,
        hasImage: false,
        reason: 'image-too-large',
        dataUrl: null,
      };
    }

    if (!contentType) {
      return {
        sourceUrl: cleaned,
        status: 'unsupported',
        contentType: declaredType,
        byteLength: bytes.byteLength,
        hasImage: false,
        reason: 'unsupported-image-content-type',
        dataUrl: null,
      };
    }

    return {
      sourceUrl: cleaned,
      status: 'ok',
      contentType,
      byteLength: bytes.byteLength,
      hasImage: true,
      dataUrl: `data:${contentType};base64,${imageDataToBase64(bytes)}`,
    };
  } catch (error: any) {
    return {
      sourceUrl: cleaned,
      status: error?.name === 'AbortError' ? 'timeout' : 'fetch-error',
      contentType: '',
      byteLength: 0,
      hasImage: false,
      reason: error?.message || 'image-fetch-failed',
      dataUrl: null,
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
