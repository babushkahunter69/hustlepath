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
  niche?: string;
  keyword_focus?: string[];
  design_focus?: string;
  audience?: string;
  target_url?: string;
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

type ProductPinSeed = Pick<ProductPinterestPin, 'angle'> & {
  titleSuffix: string;
  descriptionLead: string;
  imageCue: string;
};

type ContentProfile = {
  primary: string;
  audience: string;
  mood: string;
  hook: string;
  productType: string;
  tags: string[];
};

function cleanText(value: unknown, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

function safeJsonParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
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

function wordsUnder(value: string, maxLength = 48) {
  const words = cleanText(value).split(' ').filter(Boolean);
  const output: string[] = [];
  for (const word of words) {
    const next = [...output, word].join(' ');
    if (next.length > maxLength && output.length) break;
    output.push(word);
  }
  return output.join(' ') || cleanText(value).slice(0, maxLength);
}

function titleCase(value: string) {
  return cleanText(value).replace(/\w\S*/g, (word) => {
    if (word.length <= 3 && word === word.toUpperCase()) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

function normalizedKeywords(input: ProductCampaignInput) {
  const fallback = `${input.title || ''}, ${input.description || ''}`
    .split(/[,|]/)
    .map((value) => cleanText(value))
    .filter(Boolean);

  return Array.from(new Set([...parseKeywords(input.keywords), ...fallback]))
    .map((value) => cleanText(value))
    .filter(Boolean)
    .slice(0, 8);
}

function productTypeHint(input: ProductCampaignInput) {
  const haystack = [input.title, input.description, ...normalizedKeywords(input)].join(' ').toLowerCase();
  if (haystack.includes('mug')) return 'Mug';
  if (haystack.includes('shirt') || haystack.includes('tee')) return 'Graphic Tee';
  if (haystack.includes('notebook')) return 'Notebook Sticker';
  return 'Sticker';
}

function designFocus(input: ProductCampaignInput) {
  const cleaned = cleanText(input.title, 'InkWanderStudio Design')
    .replace(/\b(redbubble|stickers?|shirts?|tees?|mugs?|gifts?|designs?|prints?)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return titleCase(wordsUnder(cleaned || input.title || 'InkWanderStudio Design', 52));
}

function keywordFocus(input: ProductCampaignInput) {
  const keywords = normalizedKeywords(input).filter((keyword) => !/^redbubble design$/i.test(keyword));
  if (keywords.length) return keywords;
  return ['relatable stickers', 'gift idea', 'funny art'];
}

function keywordPhrase(input: ProductCampaignInput) {
  return keywordFocus(input).slice(0, 5).join(', ');
}

function detectProfile(input: ProductCampaignInput): ContentProfile {
  const haystack = [input.title, input.description, ...normalizedKeywords(input)].join(' ').toLowerCase();

  if (haystack.includes('coffee') || haystack.includes('espresso') || haystack.includes('latte') || haystack.includes('caffeine')) {
    return {
      primary: 'coffee culture humor',
      audience: 'coffee lovers, cafe people, desk decorators, and caffeine-fueled introverts',
      mood: 'cozy cafe energy with dry humor',
      hook: 'coffee-first personality art',
      productType: 'sticker, mug, and desk accessory',
      tags: ['coffee culture', 'cafe humor', 'mug idea'],
    };
  }

  if (haystack.includes('introvert') || haystack.includes('social battery') || haystack.includes('homebody') || haystack.includes('awkward')) {
    return {
      primary: 'introvert humor',
      audience: 'quiet people, homebodies, and socially selective friends',
      mood: 'soft, self-aware, relatable humor',
      hook: 'social battery jokes that feel too real',
      productType: 'sticker, mug, and laptop decal',
      tags: ['introvert humor', 'social battery', 'relatable sticker'],
    };
  }

  if (haystack.includes('millennial') || haystack.includes('adulting') || haystack.includes('burnout') || haystack.includes('nostalgia')) {
    return {
      primary: 'millennial humor',
      audience: 'millennials who love self-aware nostalgia and honest adulting jokes',
      mood: 'witty, tired, affectionate sarcasm',
      hook: 'adulting jokes with a nostalgic twist',
      productType: 'sticker, tee, and giftable art',
      tags: ['millennial humor', 'adulting joke', 'relatable gift'],
    };
  }

  if (
    haystack.includes('animal') ||
    haystack.includes('cat') ||
    haystack.includes('dog') ||
    haystack.includes('frog') ||
    haystack.includes('goose') ||
    haystack.includes('duck')
  ) {
    return {
      primary: 'sarcastic animal art',
      audience: 'animal lovers who want expressive, witty, slightly dramatic humor',
      mood: 'playful sarcasm with character-driven charm',
      hook: 'sarcastic character art with a punchline',
      productType: 'sticker, tee, and funny gift',
      tags: ['sarcastic animal', 'funny sticker', 'gift idea'],
    };
  }

  return {
    primary: 'relatable stickers',
    audience: 'gift shoppers, sticker collectors, and people who pin niche finds',
    mood: 'scroll-stopping, witty, giftable art',
    hook: 'specific relatable art with save appeal',
    productType: 'sticker, tee, mug, and gift idea',
    tags: ['relatable sticker', 'gift idea', 'funny art'],
  };
}

function productNiche(input: ProductCampaignInput) {
  return detectProfile(input).primary;
}

function pinTitle(input: ProductCampaignInput, suffix: string) {
  const design = designFocus(input);
  const productType = productTypeHint(input);
  const candidate = `${design} ${suffix || productType}`.replace(/\s+/g, ' ').trim();
  return wordsUnder(candidate, 64).replace(/\s+\b(for|on|and|with|of|to|in)$/i, '');
}

function fallbackPins(input: ProductCampaignInput): ProductPinterestPin[] {
  const now = new Date().toISOString();
  const design = designFocus(input);
  const profile = detectProfile(input);
  const niche = productNiche(input);
  const keywords = Array.from(new Set([...profile.tags, ...keywordFocus(input)])).slice(0, 8);
  const keywordText = keywordPhrase(input);
  const designUrl = cleanText(input.target_url);
  const productType = productTypeHint(input);

  const base: ProductPinSeed[] = [
    { angle: 'product', titleSuffix: productType, descriptionLead: `${design} is a specific InkWanderStudio ${profile.productType} pick for ${profile.audience}.`, imageCue: 'make the actual Redbubble product image the large center hero visual' },
    { angle: 'gift', titleSuffix: 'Gift Pick', descriptionLead: `${design} works as a design-specific ${niche} gift without drifting into generic category copy.`, imageCue: 'frame the product image as a polished save-worthy gift idea' },
    { angle: 'problem', titleSuffix: 'For Your Board', descriptionLead: `${design} fits Pinterest searches around ${profile.hook}.`, imageCue: 'use the product image as the hero with clean editorial text below it' },
    { angle: 'trend', titleSuffix: 'Redbubble Find', descriptionLead: `${design} is a concrete Redbubble find for people pinning niche InkWanderStudio artwork.`, imageCue: 'keep the product image dominant and the copy short, readable, and specific' },
    { angle: 'collection', titleSuffix: 'Sticker Idea', descriptionLead: `${design} belongs on boards about ${keywordText}.`, imageCue: 'show the product image prominently with two or three neat keyword tags' },
    { angle: 'curiosity', titleSuffix: 'Worth Saving', descriptionLead: `${design} leans into ${profile.mood}.`, imageCue: 'make the design look collectible with a clean Pinterest product layout' },
    { angle: 'style', titleSuffix: 'Desk Decor', descriptionLead: `${design} turns ${niche} into a visual product pin for stickers, mugs, notebooks, or tees.`, imageCue: 'center the real product image and leave text in a fixed lower panel' },
    { angle: 'seasonal', titleSuffix: 'Cozy Gift', descriptionLead: `${design} can work for seasonal gift boards while staying tied to the actual artwork.`, imageCue: 'build a polished product-first Pinterest image with no placeholder elements' },
  ];

  return uniquePins(
    base.map((pin): ProductPinterestPin => ({
      title: pinTitle(input, pin.titleSuffix),
      angle: pin.angle,
      description: `${pin.descriptionLead} Save this Redbubble design for ${keywordText} inspiration and use the linked product page when you are ready to shop.`.slice(0, 420),
      image_prompt: `Create a clean 1000x1500 Pinterest product pin for the exact InkWanderStudio design "${design}". Niche: ${niche}. Audience: ${profile.audience}. Keywords: ${keywordText}. Redbubble URL: ${designUrl}. ${pin.imageCue}. Layout must be top brand label and niche tag, middle hero product image, bottom title, short description, 2 to 3 tags, and CTA. Avoid broad category-only titles and never use placeholder skeleton art.`.slice(0, 700),
      status: 'draft',
      niche,
      keyword_focus: keywords,
      design_focus: design,
      audience: profile.audience,
      target_url: designUrl,
      created_at: now,
    }))
  ).slice(0, input.count || 8);
}

function normalizeKeywordArray(value: unknown, input: ProductCampaignInput) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(item)).filter(Boolean).slice(0, 8);
  }
  const text = cleanText(value);
  if (!text) return keywordFocus(input);
  return text.split(',').map((item) => cleanText(item)).filter(Boolean).slice(0, 8);
}

function normalizeTitle(value: unknown, input: ProductCampaignInput, fallback: ProductPinterestPin) {
  const raw = cleanText(value);
  const weak = !raw || /unique redbubble|perfect gifts|seasonal gift ideas|trending redbubble|sticker ideas to save/i.test(raw);
  return wordsUnder(weak ? fallback.title : raw, 74).replace(/\s+\b(for|on|and|with|of|to|in)$/i, '');
}

function normalizePins(rawPins: any[], input: ProductCampaignInput): ProductPinterestPin[] {
  const now = new Date().toISOString();
  const fallback = fallbackPins(input);
  const defaultNiche = productNiche(input);
  const defaultDesign = designFocus(input);
  const defaultAudience = detectProfile(input).audience;
  const defaultKeywords = keywordFocus(input);
  const allowed: ProductPinterestPin['angle'][] = ['product', 'problem', 'gift', 'trend', 'collection', 'curiosity', 'style', 'seasonal'];

  const pins = rawPins
    .map((pin, index): ProductPinterestPin => {
      const backup = fallback[index % fallback.length];
      const angle = allowed.includes(pin.angle) ? (pin.angle as ProductPinterestPin['angle']) : backup.angle;
      const title = normalizeTitle(pin.title, input, backup);
      return {
        title,
        description: cleanText(pin.description, backup.description).slice(0, 420),
        image_prompt: cleanText(pin.image_prompt || pin.imagePrompt, backup.image_prompt).slice(0, 700),
        angle,
        status: pin.status === 'posted' ? 'posted' : 'draft',
        image_url: pin.image_url ? cleanText(pin.image_url) : undefined,
        tracked_url: pin.tracked_url ? cleanText(pin.tracked_url) : undefined,
        posted_at: pin.posted_at ? cleanText(pin.posted_at) : undefined,
        clicks: Number.isFinite(Number(pin.clicks)) ? Number(pin.clicks) : 0,
        notes: pin.notes ? cleanText(pin.notes) : undefined,
        niche: cleanText(pin.niche, backup.niche || defaultNiche).slice(0, 120),
        keyword_focus: normalizeKeywordArray(pin.keyword_focus || pin.keywordFocus, input) || defaultKeywords,
        design_focus: cleanText(pin.design_focus || pin.designFocus, backup.design_focus || defaultDesign).slice(0, 120),
        audience: cleanText(pin.audience, backup.audience || defaultAudience).slice(0, 160),
        target_url: cleanText(pin.target_url || pin.targetUrl, input.target_url).slice(0, 400),
        created_at: pin.created_at || now,
      };
    })
    .filter((pin) => pin.title && pin.description && pin.image_prompt);

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
        {
          role: 'system',
          content: 'You create Pinterest marketing metadata for exact Redbubble product designs. Return JSON only.',
        },
        {
          role: 'user',
          content: `Create ${count} Pinterest pins for this exact Redbubble design.\n\nProduct title: ${input.title}\nDescription: ${input.description || ''}\nProduct keywords: ${parseKeywords(input.keywords).join(', ')}\nNiche: ${productNiche(input)}\nRedbubble URL: ${input.target_url}\nBrand voice: InkWanderStudio supports millennial humor, introvert humor, sarcastic animal art, coffee culture, and relatable stickers when relevant.\n\nRules:\n- Every title must include or clearly refer to the exact design/product, not a broad category.\n- Do not use generic titles like "Unique Redbubble Stickers", "Perfect Gifts", "Seasonal Gift Ideas", or "Trending Redbubble Find" unless the design name is also present.\n- Do not end titles with weak trailing words like for, on, and, with, of, or to.\n- Use short overlay-friendly titles, usually 3 to 7 words.\n- Focus on search intent around stickers, shirts, mugs, gifts, notebooks, desk decor, funny art, and niche humor when relevant.\n- No fake discounts, guaranteed sales, or trademarked character names.\n- Use different angles: product, problem, gift, trend, collection, curiosity, style, seasonal.\n- Descriptions should be short, natural Pinterest SEO copy and mention the real design intent.\n- Image prompts must describe a clean 1000x1500 product-first layout: top brand label and niche tag, middle hero product image, bottom title, short description, 2 to 3 tags, and CTA.\n- Return JSON with one key: pins.\n- Each pin needs: title, description, image_prompt, angle, niche, keyword_focus, design_focus, audience.`,
        },
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
    system: 'hustlepath-product-pinterest-v3',
  };
}
