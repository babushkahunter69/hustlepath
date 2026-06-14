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

type ProductPinSeed = Pick<ProductPinterestPin, 'angle' | 'title'> & {
  descriptionLead: string;
  imageCue: string;
};

type ContentProfile = {
  primary: string;
  audience: string;
  mood: string;
  hook: string;
  productType: string;
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

function keywordFocus(input: ProductCampaignInput) {
  const keywords = normalizedKeywords(input);
  if (keywords.length) return keywords;
  return ['Redbubble design', 'sticker idea', 'gift idea', 'graphic tee', 'funny art'];
}

function keywordPhrase(input: ProductCampaignInput) {
  return keywordFocus(input).slice(0, 5).join(', ');
}

function shortTitle(value: string, maxLength = 42) {
  const words = cleanText(value).split(' ').filter(Boolean);
  const output: string[] = [];
  for (const word of words) {
    const next = [...output, word].join(' ');
    if (next.length > maxLength && output.length) break;
    output.push(word);
  }
  return output.join(' ') || cleanText(value).slice(0, maxLength);
}

function designFocus(input: ProductCampaignInput) {
  const cleaned = cleanText(input.title, 'InkWanderStudio Design')
    .replace(/\b(redbubble|sticker|stickers|shirt|shirts|tee|tees|mug|mugs|gift|gifts)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return shortTitle(cleaned || input.title || 'InkWanderStudio Design', 44);
}

function detectProfile(input: ProductCampaignInput): ContentProfile {
  const haystack = [input.title, input.description, ...normalizedKeywords(input)].join(' ').toLowerCase();

  if (haystack.includes('coffee') || haystack.includes('espresso') || haystack.includes('latte') || haystack.includes('caffeine')) {
    return {
      primary: 'coffee culture humor',
      audience: 'coffee lovers, bar cart decorators, and caffeine-fueled introverts',
      mood: 'cozy cafe energy with dry humor',
      hook: 'coffee-first personality art',
      productType: 'sticker, mug, and desk accessory',
    };
  }

  if (haystack.includes('introvert') || haystack.includes('social battery') || haystack.includes('homebody') || haystack.includes('awkward')) {
    return {
      primary: 'introvert humor',
      audience: 'quiet people, homebodies, and socially selective friends',
      mood: 'soft, self-aware, relatable humor',
      hook: 'social battery jokes that feel too real',
      productType: 'sticker, mug, and laptop decal',
    };
  }

  if (haystack.includes('millennial') || haystack.includes('adulting') || haystack.includes('burnout') || haystack.includes('nostalgia')) {
    return {
      primary: 'millennial humor',
      audience: 'millennials who love self-aware nostalgia and chaotic adulting jokes',
      mood: 'witty, tired, affectionate sarcasm',
      hook: 'adulting jokes with a nostalgic twist',
      productType: 'sticker, tee, and giftable art',
    };
  }

  if (
    haystack.includes('animal') ||
    haystack.includes('cat') ||
    haystack.includes('dog') ||
    haystack.includes('frog') ||
    haystack.includes('raccoon') ||
    haystack.includes('goose') ||
    haystack.includes('otter') ||
    haystack.includes('duck')
  ) {
    return {
      primary: 'sarcastic animal art',
      audience: 'animal lovers who want weird, expressive, slightly unhinged humor',
      mood: 'playful sarcasm with character-driven charm',
      hook: 'chaotic animal energy with a punchline',
      productType: 'sticker, tee, and funny gift',
    };
  }

  return {
    primary: 'funny graphic design',
    audience: 'gift shoppers, sticker collectors, and people who pin niche finds',
    mood: 'scroll-stopping, witty, giftable art',
    hook: 'design-led humor with Pinterest save appeal',
    productType: 'sticker, tee, mug, and gift idea',
  };
}

function productNiche(input: ProductCampaignInput) {
  return detectProfile(input).primary;
}

function pinSeedTitle(input: ProductCampaignInput, angle: ProductPinterestPin['angle']) {
  const design = designFocus(input);
  const profile = detectProfile(input);
  const nicheLead = shortTitle(profile.primary.replace(/ art$/i, '').replace(/ humor$/i, ' humor'), 24);

  const map: Record<ProductPinterestPin['angle'], string> = {
    product: `${design} Sticker`,
    gift: `${design} Gift Idea`,
    problem: `${design} For ${shortTitle(profile.audience.split(',')[0], 18)}`,
    trend: `${design} Redbubble Find`,
    collection: `Save ${design} Ideas`,
    curiosity: `Why ${design} Works`,
    style: `${nicheLead} Desk Decor`,
    seasonal: `${design} Cozy Gift Pick`,
  };

  return shortTitle(map[angle], 58);
}

function fallbackPins(input: ProductCampaignInput): ProductPinterestPin[] {
  const now = new Date().toISOString();
  const design = designFocus(input);
  const profile = detectProfile(input);
  const niche = productNiche(input);
  const keywords = keywordFocus(input);
  const keywordText = keywordPhrase(input);
  const designUrl = cleanText(input.target_url);

  const base: ProductPinSeed[] = [
    { angle: 'product', title: pinSeedTitle(input, 'product'), descriptionLead: `A design-specific ${profile.productType} pick for ${profile.audience}.`, imageCue: 'show the actual Redbubble artwork as the hero image with clean editorial text' },
    { angle: 'gift', title: pinSeedTitle(input, 'gift'), descriptionLead: `Giftable ${niche} art with a clear point of view instead of a generic category pin.`, imageCue: 'frame the design like a giftable Pinterest find with warm lifestyle styling' },
    { angle: 'problem', title: pinSeedTitle(input, 'problem'), descriptionLead: `Made for people searching for ${profile.hook} on Pinterest.`, imageCue: 'pair the artwork with a relatable text callout and bold save-worthy typography' },
    { angle: 'trend', title: pinSeedTitle(input, 'trend'), descriptionLead: `A saved-worthy InkWanderStudio design for people pinning niche Redbubble discoveries.`, imageCue: 'create a polished Pinterest card that feels like a curated product recommendation' },
    { angle: 'collection', title: pinSeedTitle(input, 'collection'), descriptionLead: `Works in boards about ${keywordText}.`, imageCue: 'show the design inside a collage-style pin layout with tidy supporting labels' },
    { angle: 'curiosity', title: pinSeedTitle(input, 'curiosity'), descriptionLead: `This specific design taps into ${profile.mood}.`, imageCue: 'make the design feel collectible with layered paper textures and a strong headline' },
    { angle: 'style', title: pinSeedTitle(input, 'style'), descriptionLead: `A Pinterest-friendly way to showcase ${design} as ${profile.productType}.`, imageCue: 'use a creator-brand moodboard layout with tags, notes, and the product image' },
    { angle: 'seasonal', title: pinSeedTitle(input, 'seasonal'), descriptionLead: `An easy pin for seasonal gift boards without losing the original design identity.`, imageCue: 'present the artwork in a cozy seasonal save-this-for-later layout' },
  ];

  return uniquePins(base)
    .slice(0, input.count || 8)
    .map((pin): ProductPinterestPin => ({
      title: pin.title,
      angle: pin.angle,
      description: `${pin.descriptionLead} ${design} fits ${niche} searches around ${keywordText}. Save this InkWanderStudio Redbubble design for later and use the linked Redbubble URL when you are ready to shop.`.slice(0, 480),
      image_prompt: `Create a polished 2:3 Pinterest product pin for the InkWanderStudio design "${design}". Niche: ${niche}. Audience: ${profile.audience}. Keywords: ${keywordText}. Redbubble URL: ${designUrl}. ${pin.imageCue}. Keep overlay text readable, use the real product image if available, avoid generic category-only messaging, and make it look like authentic Pinterest content rather than an ad banner.`.slice(0, 700),
      status: 'draft',
      niche,
      keyword_focus: keywords,
      design_focus: design,
      audience: profile.audience,
      target_url: designUrl,
      created_at: now,
    }));
}

function normalizeKeywordArray(value: unknown, input: ProductCampaignInput) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(item)).filter(Boolean).slice(0, 8);
  }
  const text = cleanText(value);
  if (!text) return keywordFocus(input);
  return text.split(',').map((item) => cleanText(item)).filter(Boolean).slice(0, 8);
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
          content: 'You create Pinterest marketing metadata for Redbubble products. Return JSON only.',
        },
        {
          role: 'user',
          content: `Create ${count} Pinterest pins for this exact Redbubble design.\n\nProduct title: ${input.title}\nDescription: ${input.description || ''}\nProduct keywords: ${parseKeywords(input.keywords).join(', ')}\nNiche: ${productNiche(input)}\nRedbubble URL: ${input.target_url}\nBrand voice: InkWanderStudio leans into millennial humor, introvert humor, sarcastic animals, and coffee culture when relevant.\n\nRules:\n- Make every pin title visibly different.\n- Use short overlay-friendly titles, usually 3 to 7 words.\n- Do not write broad category-only pins. Every pin must clearly point to this specific design or product angle.\n- Focus on search intent around stickers, shirts, mugs, gifts, notebooks, desk decor, funny art, and niche humor when relevant.\n- No fake discounts, guaranteed sales, or trademarked character names.\n- Use different angles: product, problem, gift, trend, collection, curiosity, style, seasonal.\n- Descriptions should sound natural for Pinterest SEO and mention the real design intent.\n- Image prompts must be 2:3 vertical product pin concepts that look like authentic Pinterest content.\n- Return JSON with one key: pins.\n- Each pin needs: title, description, image_prompt, angle, niche, keyword_focus, design_focus, audience.`,
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
    system: 'hustlepath-product-pinterest-v2',
  };
}
