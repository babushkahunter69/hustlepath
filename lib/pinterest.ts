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

function titleCase(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function keywordList(input: PinInput) {
  return [input.primaryKeyword, ...(input.relatedKeywords || []), input.category]
    .map((item) => cleanText(item).toLowerCase())
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index)
    .slice(0, 5);
}

function joinKeywords(keywords: string[]) {
  if (keywords.length === 0) return 'online income ideas';
  if (keywords.length === 1) return keywords[0];
  if (keywords.length === 2) return `${keywords[0]} and ${keywords[1]}`;
  return `${keywords.slice(0, -1).join(', ')}, and ${keywords[keywords.length - 1]}`;
}

function topicFromInput(input: PinInput) {
  const haystack = [input.title, input.primaryKeyword, input.category, ...(input.relatedKeywords || [])]
    .map(cleanText)
    .join(' ')
    .toLowerCase();

  if (haystack.includes('redbubble')) return 'Redbubble';
  if (haystack.includes('pinterest')) return 'Pinterest';
  if (haystack.includes('freelanc')) return 'Freelancing';
  if (haystack.includes('side hustle')) return 'Side Hustles';
  if (haystack.includes('tool')) return 'Online Tools';
  if (haystack.includes('$100') || haystack.includes('first online income')) return 'First Online Income';

  return titleCase(cleanText(input.primaryKeyword || input.category || input.title || 'Online Income'))
    .replace(/:.*$/, '')
    .split(/\s+/)
    .slice(0, 4)
    .join(' ');
}

function titleTemplates(input: PinInput): Array<{ angle: PinterestPin['angle']; title: string }> {
  const topic = topicFromInput(input);
  const t = topic.toLowerCase();

  if (t.includes('redbubble')) {
    return [
      { angle: 'beginner', title: 'Promote Redbubble Without Ads' },
      { angle: 'mistake', title: 'Stop These Redbubble Mistakes' },
      { angle: 'checklist', title: 'Redbubble Pinterest Checklist' },
      { angle: 'how-to', title: 'Pinterest SEO For Redbubble' },
      { angle: 'curiosity', title: 'Why Redbubble Pins Get Clicks' },
      { angle: 'results', title: 'What Actually Gets Traffic' },
      { angle: 'how-to', title: 'Get More Redbubble Views' },
      { angle: 'beginner', title: 'Redbubble Traffic Starter Plan' },
    ];
  }

  if (t.includes('side hustle')) {
    return [
      { angle: 'beginner', title: 'Easy Side Hustles To Start' },
      { angle: 'mistake', title: 'Side Hustle Mistakes To Avoid' },
      { angle: 'checklist', title: 'Side Hustle Starter Checklist' },
      { angle: 'how-to', title: 'How To Pick A Side Hustle' },
      { angle: 'curiosity', title: 'Most Beginners Miss This' },
      { angle: 'results', title: 'Realistic Side Hustle Results' },
      { angle: 'beginner', title: 'Start With No Experience' },
      { angle: 'how-to', title: 'Build A Simple Income Stream' },
    ];
  }

  if (t.includes('pinterest')) {
    return [
      { angle: 'beginner', title: 'Pinterest Traffic For Beginners' },
      { angle: 'mistake', title: 'Pinterest Mistakes To Avoid' },
      { angle: 'checklist', title: 'Pinterest SEO Checklist' },
      { angle: 'how-to', title: 'How To Get Pinterest Clicks' },
      { angle: 'curiosity', title: 'Why Some Pins Get Traffic' },
      { angle: 'results', title: 'What Pinterest Can Actually Do' },
      { angle: 'how-to', title: 'Create Pins That Get Clicks' },
      { angle: 'beginner', title: 'Pinterest Growth Starter Plan' },
    ];
  }

  if (t.includes('first online income')) {
    return [
      { angle: 'beginner', title: 'Start Your First Income Stream' },
      { angle: 'mistake', title: 'Avoid These Money Mistakes' },
      { angle: 'checklist', title: 'Your First Income Checklist' },
      { angle: 'how-to', title: 'How To Make Your First $100' },
      { angle: 'curiosity', title: 'Nobody Tells Beginners This' },
      { angle: 'results', title: 'What Happens When You Start' },
      { angle: 'beginner', title: 'Beginner Income Ideas That Work' },
      { angle: 'how-to', title: 'Simple Ways To Start Online' },
    ];
  }

  return [
    { angle: 'beginner', title: `${topic} Starter Plan` },
    { angle: 'mistake', title: `${topic} Mistakes To Avoid` },
    { angle: 'checklist', title: `${topic} Checklist` },
    { angle: 'how-to', title: `How To Start ${topic}` },
    { angle: 'curiosity', title: `What Beginners Miss About ${topic}` },
    { angle: 'results', title: `Realistic ${topic} Results` },
    { angle: 'beginner', title: `${topic} For Beginners` },
    { angle: 'how-to', title: `Simple ${topic} Steps` },
  ];
}

export function optimizePinterestDescription(params: {
  angle: PinterestPin['angle'] | string;
  title: string;
  articleTitle?: string;
  excerpt?: string;
  primaryKeyword?: string;
  relatedKeywords?: string[];
  category?: string;
}) {
  const angle = cleanText(params.angle || 'beginner').toLowerCase();
  const title = cleanText(params.title || params.articleTitle || 'online income guide');
  const keywords = [params.primaryKeyword, ...(params.relatedKeywords || []), params.category]
    .map((item) => cleanText(item).toLowerCase())
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index)
    .slice(0, 5);
  const keywordPhrase = joinKeywords(keywords);

  const shortTitle = title.replace(/[.!?]+$/g, '');
  let lead = `${shortTitle}: a simple beginner guide for ${keywordPhrase}.`;
  let cta = 'Open the full article for practical next steps.';

  if (angle.includes('mistake')) {
    lead = `${shortTitle}: avoid common beginner mistakes with ${keywordPhrase}.`;
    cta = 'Read this before wasting time on the wrong steps.';
  } else if (angle.includes('checklist')) {
    lead = `${shortTitle}: save this checklist for ${keywordPhrase}.`;
    cta = 'Use it as a quick starting point when planning your next move.';
  } else if (angle.includes('results')) {
    lead = `${shortTitle}: see what realistic progress with ${keywordPhrase} can look like.`;
    cta = 'Read the guide for clear expectations without hype.';
  } else if (angle.includes('how-to')) {
    lead = `${shortTitle}: learn the simple steps behind ${keywordPhrase}.`;
    cta = 'Open the article for the full beginner-friendly breakdown.';
  } else if (angle.includes('curiosity')) {
    lead = `${shortTitle}: most beginners miss this part of ${keywordPhrase}.`;
    cta = 'Read the full guide to see what actually matters.';
  }

  const details = params.excerpt
    ? cleanText(params.excerpt).slice(0, 100)
    : 'Built for beginners who want practical steps, not hype or fake promises.';

  return `${lead} ${details} ${cta}`.replace(/\s+/g, ' ').slice(0, 480).trim();
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
  const now = new Date().toISOString();
  return uniquePins(titleTemplates(input)).slice(0, input.count || 8).map((item) => ({
    ...item,
    description: optimizePinterestDescription({
      angle: item.angle,
      title: item.title,
      articleTitle: input.title,
      excerpt: input.excerpt,
      primaryKeyword: input.primaryKeyword,
      relatedKeywords: input.relatedKeywords,
      category: input.category,
    }),
    image_prompt: `Vertical Pinterest pin, 2:3 ratio, HustlePathDaily brand style, bold readable headline text: "${item.title}", clean neutral background, simple visual accents, no fake income screenshots`,
    status: 'draft' as const,
    url: input.slug ? `/blog/${input.slug}` : undefined,
    created_at: now,
  }));
}

function normalizePins(rawPins: any[], input: PinInput): PinterestPin[] {
  const now = new Date().toISOString();
  const allowedAngles: PinterestPin['angle'][] = ['beginner', 'mistake', 'checklist', 'results', 'how-to', 'curiosity'];
  const fallback = fallbackPins(input);

  const pins = rawPins.map((pin, index): PinterestPin => {
    const angle = allowedAngles.includes(pin.angle) ? pin.angle as PinterestPin['angle'] : fallback[index % fallback.length].angle;
    const title = cleanText(pin.title) || fallback[index % fallback.length].title;
    const tooGeneric = title.toLowerCase().includes('beginner') && title.toLowerCase().includes('guide') && index > 0;
    const finalTitle = tooGeneric ? fallback[index % fallback.length].title : title;

    return {
      title: finalTitle.slice(0, 100),
      description: optimizePinterestDescription({
        angle,
        title: finalTitle,
        articleTitle: input.title,
        excerpt: input.excerpt,
        primaryKeyword: input.primaryKeyword,
        relatedKeywords: input.relatedKeywords,
        category: input.category,
      }),
      image_prompt: cleanText(pin.image_prompt || pin.imagePrompt || pin.image || fallback[index % fallback.length].image_prompt).slice(0, 700),
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

  const combined = uniquePins([...pins, ...fallback]);
  return combined.slice(0, Math.max(input.count || 8, 8));
}

export async function generatePinterestPins(input: PinInput): Promise<PinterestPin[]> {
  const count = Math.max(3, Math.min(input.count || 8, 12));
  if (!process.env.OPENAI_API_KEY) return fallbackPins({ ...input, count });

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      temperature: 0.85,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You create varied Pinterest pin metadata for a beginner online-income blog. Return JSON only.' },
        { role: 'user', content: `Create ${count} Pinterest pins for this article.\n\nArticle title: ${input.title}\nSlug: ${input.slug || ''}\nCategory: ${input.category || ''}\nPrimary keyword: ${input.primaryKeyword || ''}\nRelated keywords: ${(input.relatedKeywords || []).join(', ')}\nExcerpt: ${input.excerpt || ''}\n\nRules:\n- Make every pin title visibly different. Do not reuse the same phrase pattern.\n- Use short overlay-friendly titles, usually 3 to 6 words.\n- No fake income claims and no guaranteed results.\n- Use different angles: beginner, mistake, checklist, results, how-to, curiosity.\n- Descriptions should use natural Pinterest SEO keywords.\n- Image prompts must be 2:3 vertical pin concepts with clear headline text.\n- Return JSON with one key: pins.\n- Each pin needs: title, description, image_prompt, angle.` },
      ],
    });

    const data = safeJsonParse(completion.choices[0].message.content || '{}');
    const pins = normalizePins(Array.isArray(data.pins) ? data.pins : [], { ...input, count }).slice(0, count);
    return pins.length >= 3 ? pins : fallbackPins({ ...input, count });
  } catch {
    return fallbackPins({ ...input, count });
  }
}

export function attachPinUrls(postId: string, pins: PinterestPin[]) {
  return pins.map((pin, index) => ({
    ...pin,
    image_url: `/api/pinterest/pin-image-png/${postId}/${index}`,
    tracked_url: `/go/pin/${postId}/${index}`,
  }));
}

export function normalizePinterestMeta(meta: any, pins: PinterestPin[]) {
  const existing = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};
  return { ...existing, pins, generated_at: new Date().toISOString(), system: 'hustlepath-pinterest-v2' };
}
