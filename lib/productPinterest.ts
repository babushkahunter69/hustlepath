import OpenAI from 'openai';
import { parseKeywords } from '@/lib/monetization';

export type ProductPinterestPin = {
  title: string;
  description: string;
  image_prompt: string;
  angle: 'product' | 'problem' | 'gift' | 'trend' | 'collection' | 'curiosity' | 'style' | 'seasonal';
  status: 'draft' | 'posted';
  image_url?: string;
  tracked_url?: string;
  posted_at?: string;
  clicks?: number;
  notes?: string;
  created_at: string;
};

export type ProductCampaignInput = {
  id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  target_url: string;
  keywords?: unknown;
  source?: string | null;
  count?: number;
};

type ProductPinSeed = Pick<ProductPinterestPin, 'angle' | 'title'>;

function cleanText(value: unknown, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

function safeJsonParse(raw: string) {
  try { return JSON.parse(raw); } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try { return JSON.parse(match[0]); } catch { return {}; }
  }
}

function uniquePins<T extends { title: string }>(pins: T[]): T[] {
  const seen = new Set<string>();
  return pins.filter((pin) => {
    const key = cleanText(pin.title).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function keywordPhrase(input: ProductCampaignInput) {
  const keywords = parseKeywords(input.keywords).filter(Boolean).slice(0, 5);
  if (keywords.length) return keywords.join(', ');
  return 'stickers, gifts, shirts, mugs, redbubble';
}

function productNiche(input: ProductCampaignInput) {
  const haystack = [input.title, input.description, ...parseKeywords(input.keywords)].join(' ').toLowerCase();
  if (haystack.includes('kawaii')) return 'cute kawaii stickers and comfort gifts';
  if (haystack.includes('travel') || haystack.includes('adventure')) return 'travel stickers and adventure gifts';
  if (haystack.includes('millennial') || haystack.includes('sarcastic') || haystack.includes('funny')) return 'sarcastic millennial stickers and gifts';
  if (haystack.includes('notebook') || haystack.includes('school')) return 'school labels and notebook stickers';
  return 'Redbubble stickers, shirts, mugs, and gift ideas';
}

function fallbackPins(input: ProductCampaignInput): ProductPinterestPin[] {
  const now = new Date().toISOString();
  const title = cleanText(input.title, 'Redbubble Design');
  const niche = productNiche(input);
  const keywords = keywordPhrase(input);
  const base: ProductPinSeed[] = [
    { angle: 'product', title: `${title} Sticker Idea` },
    { angle: 'gift', title: 'Funny Gift For Creatives' },
    { angle: 'problem', title: 'Need A Small Gift Idea?' },
    { angle: 'trend', title: 'Trending Redbubble Find' },
    { angle: 'collection', title: 'Sticker Ideas To Save' },
    { angle: 'curiosity', title: 'This Design Feels Personal' },
    { angle: 'style', title: 'Cute Gift Shop Find' },
    { angle: 'seasonal', title: 'Easy Gift Idea To Pin' },
  ];

  return uniquePins<ProductPinSeed>(base).slice(0, input.count || 8).map((pin): ProductPinterestPin => ({
    title: pin.title,
    angle: pin.angle,
    description: `${pin.title}: discover a ${niche} design for people searching Pinterest for ${keywords}. Save this Redbubble find for sticker, shirt, mug, notebook, and gift inspiration.`.slice(0, 480),
    image_prompt: `Vertical 2:3 Pinterest product pin for ${title}. Use the product image if available, clean lifestyle layout, bold readable overlay text: "${pin.title}", warm neutral HustlePathDaily style, no fake discounts, no income claims.`,
    status: 'draft',
    created_at: now,
  }));
}

function normalizePins(rawPins: any[], input: ProductCampaignInput): ProductPinterestPin[] {
  const now = new Date().toISOString();
  const fallback = fallbackPins(input);
  const allowed: ProductPinterestPin['angle'][] = ['product', 'problem', 'gift', 'trend', 'collection', 'curiosity', 'style', 'seasonal'];
  const pins = rawPins.map((pin, index): ProductPinterestPin => {
    const backup = fallback[index % fallback.length];
    const angle = allowed.includes(pin.angle) ? pin.angle as ProductPinterestPin['angle'] : backup.angle;
    const title = cleanText(pin.title, backup.title).slice(0, 100);
    return {
      title,
      description: cleanText(pin.description, backup.description).slice(0, 480),
      image_prompt: cleanText(pin.image_prompt || pin.imagePrompt, backup.image_prompt).slice(0, 700),
      angle,
      status: pin.status === 'posted' ? 'posted' : 'draft',
      image_url: pin.image_url ? cleanText(pin.image_url) : undefined,
      tracked_url: pin.tracked_url ? cleanText(pin.tracked_url) : undefined,
      posted_at: pin.posted_at ? cleanText(pin.posted_at) : undefined,
      clicks: Number.isFinite(Number(pin.clicks)) ? Number(pin.clicks) : 0,
      notes: pin.notes ? cleanText(pin.notes) : undefined,
      created_at: pin.created_at || now,
    };
  }).filter((pin) => pin.title && pin.description && pin.image_prompt);

  return uniquePins([...pins, ...fallback]).slice(0, Math.max(input.count || 8, 8));
}

export async function generateProductPinterestPins(input: ProductCampaignInput): Promise<ProductPinterestPin[]> {
  const count = Math.max(4, Math.min(input.count || 8, 12));
  if (!process.env.OPENAI_API_KEY) return fallbackPins({ ...input, count });

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      temperature: 0.85,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You create Pinterest marketing metadata for Redbubble products. Return JSON only.' },
        { role: 'user', content: `Create ${count} Pinterest pins for this Redbubble product.\n\nProduct title: ${input.title}\nDescription: ${input.description || ''}\nProduct keywords: ${parseKeywords(input.keywords).join(', ')}\nNiche: ${productNiche(input)}\n\nRules:\n- Make every pin title visibly different.\n- Use short overlay-friendly titles, usually 3 to 7 words.\n- Focus on search intent: stickers, shirts, mugs, gifts, notebook, aesthetic, funny, cute, sarcastic, travel, kawaii when relevant.\n- No fake discounts, guaranteed sales, or trademarked character names.\n- Use different angles: product, problem, gift, trend, collection, curiosity, style, seasonal.\n- Descriptions should sound natural for Pinterest SEO.\n- Image prompts must be 2:3 vertical product pin concepts.\n- Return JSON with one key: pins.\n- Each pin needs: title, description, image_prompt, angle.` },
      ],
    });

    const data = safeJsonParse(completion.choices[0].message.content || '{}');
    const pins = normalizePins(Array.isArray(data.pins) ? data.pins : [], { ...input, count }).slice(0, count);
    return pins.length >= 4 ? pins : fallbackPins({ ...input, count });
  } catch {
    return fallbackPins({ ...input, count });
  }
}

export function attachProductPinUrls(productId: string, pins: ProductPinterestPin[]) {
  return pins.map((pin, index) => ({
    ...pin,
    image_url: `/api/pinterest/product-pin-image-png/${productId}/${index}`,
    tracked_url: `/go/product-pin/${productId}/${index}`,
  }));
}

export function normalizeProductPinterestMeta(meta: any, pins: ProductPinterestPin[]) {
  const existing = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};
  return {
    ...existing,
    pins,
    generated_at: new Date().toISOString(),
    system: 'hustlepath-product-pinterest-v1',
  };
}
