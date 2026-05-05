import OpenAI from 'openai';

export type PinterestPin = {
  title: string;
  description: string;
  image_prompt: string;
  angle: 'beginner' | 'mistake' | 'checklist' | 'results' | 'how-to' | 'curiosity';
  status: 'draft' | 'posted';
  url?: string;
  image_url?: string;
  tracked_url?: string;
  posted_at?: string;
  notes?: string;
  created_at: string;
};

type PinInput = {
  title: string;
  excerpt?: string;
  category?: string;
  primaryKeyword?: string;
  relatedKeywords?: string[];
  slug?: string;
  count?: number;
};

function cleanText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
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
    const key = pin.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fallbackPins(input: PinInput): PinterestPin[] {
  const keyword = cleanText(input.primaryKeyword || input.title);
  const base = cleanText(input.title).replace(/[?.!]+$/g, '');
  const now = new Date().toISOString();
  const angles: Array<{ angle: PinterestPin['angle']; title: string; description: string }> = [
    { angle: 'beginner', title: `${base}: Beginner-Friendly Guide`, description: `A simple beginner guide to ${keyword.toLowerCase()} with practical steps you can start using today.` },
    { angle: 'checklist', title: `${keyword}: Simple Checklist`, description: `Use this practical checklist to understand ${keyword.toLowerCase()} without hype, confusion, or expensive tools.` },
    { angle: 'how-to', title: `How to Start ${keyword} the Simple Way`, description: `Learn how to approach ${keyword.toLowerCase()} with clear steps, realistic expectations, and beginner-friendly tools.` },
    { angle: 'mistake', title: `${keyword} Mistakes Beginners Should Avoid`, description: `Avoid common beginner mistakes and build a cleaner plan for ${keyword.toLowerCase()} from the start.` },
    { angle: 'curiosity', title: `Most Beginners Overcomplicate ${keyword}`, description: `A clear breakdown of what matters, what does not, and how to make ${keyword.toLowerCase()} feel manageable.` },
    { angle: 'results', title: `A Realistic Plan for ${keyword}`, description: `A practical plan for beginners who want to make progress with ${keyword.toLowerCase()} without chasing fake promises.` },
  ];
  return uniquePins(angles).slice(0, input.count || 6).map((item) => ({
    ...item,
    image_prompt: `Vertical Pinterest pin, 2:3 ratio, warm neutral background, bold readable headline text: "${item.title}", clean blog graphic style, subtle laptop or notebook visual, no fake income screenshots`,
    status: 'draft' as const,
    url: input.slug ? `/blog/${input.slug}` : undefined,
    created_at: now,
  }));
}

function normalizePins(rawPins: any[], input: PinInput): PinterestPin[] {
  const now = new Date().toISOString();
  const allowedAngles: PinterestPin['angle'][] = ['beginner', 'mistake', 'checklist', 'results', 'how-to', 'curiosity'];

  const pins = rawPins.map((pin): PinterestPin => {
    const angle = allowedAngles.includes(pin.angle) ? pin.angle as PinterestPin['angle'] : 'how-to';

    return {
      title: cleanText(pin.title).slice(0, 100),
      description: cleanText(pin.description).slice(0, 480),
      image_prompt: cleanText(pin.image_prompt || pin.imagePrompt || pin.image).slice(0, 700),
      angle,
      status: pin.status === 'posted' ? 'posted' : 'draft',
      url: pin.url ? cleanText(pin.url) : input.slug ? `/blog/${input.slug}` : undefined,
      image_url: pin.image_url ? cleanText(pin.image_url) : undefined,
      tracked_url: pin.tracked_url ? cleanText(pin.tracked_url) : undefined,
      notes: pin.notes ? cleanText(pin.notes) : undefined,
      posted_at: pin.posted_at ? cleanText(pin.posted_at) : undefined,
      created_at: pin.created_at || now,
    };
  }).filter((pin) => pin.title && pin.description && pin.image_prompt);

  return uniquePins(pins);
}

export async function generatePinterestPins(input: PinInput): Promise<PinterestPin[]> {
  const count = Math.max(3, Math.min(input.count || 8, 12));
  if (!process.env.OPENAI_API_KEY) return fallbackPins({ ...input, count });
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You create Pinterest pin metadata for a beginner online-income blog. Return JSON only.' },
        { role: 'user', content: `Create ${count} Pinterest pins for this article.\n\nArticle title: ${input.title}\nSlug: ${input.slug || ''}\nCategory: ${input.category || ''}\nPrimary keyword: ${input.primaryKeyword || ''}\nRelated keywords: ${(input.relatedKeywords || []).join(', ')}\nExcerpt: ${input.excerpt || ''}\n\nRules:\n- Pinterest titles must be clickable, specific, and not scammy.\n- No fake income claims.\n- Use different angles: beginner, mistake, checklist, results, how-to, curiosity.\n- Descriptions should use natural Pinterest SEO keywords.\n- Image prompts must be 2:3 vertical pin concepts with clear headline text.\n- Return JSON with one key: pins.\n- Each pin needs: title, description, image_prompt, angle.` },
      ],
    });
    const data = safeJsonParse(completion.choices[0].message.content || '{}');
    const pins = normalizePins(Array.isArray(data.pins) ? data.pins : [], input).slice(0, count);
    return pins.length >= 3 ? pins : fallbackPins({ ...input, count });
  } catch {
    return fallbackPins({ ...input, count });
  }
}

export function attachPinUrls(postId: string, pins: PinterestPin[]) {
  return pins.map((pin, index) => ({
    ...pin,
    image_url: `/api/pinterest/pin-image/${postId}/${index}`,
    tracked_url: `/go/pin/${postId}/${index}`,
  }));
}

export function normalizePinterestMeta(meta: any, pins: PinterestPin[]) {
  const existing = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};
  return { ...existing, pins, generated_at: new Date().toISOString(), system: 'hustlepath-pinterest-v1' };
}
