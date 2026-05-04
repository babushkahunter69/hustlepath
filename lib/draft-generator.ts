import OpenAI from 'openai';
import slugify from 'slugify';
import { sql } from '@/lib/db';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type DraftPayload = {
  title?: string;
  excerpt?: string;
  body?: string;
  category?: string;
  seo_title?: string;
  seo_description?: string;
  primary_keyword?: string;
  related_keywords?: string[];
};

function normalizeBody(body: string) {
  return body
    .replace(/^```(?:html|markdown|md)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

export async function generateDailyDraft() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is missing.');
  }

  const today = new Date().toISOString().slice(0, 10);
  const prompt = `Create one original HustlePathDaily article draft for ${today}.
Audience: beginners who want realistic ways to make their first online income.
Tone: practical, simple, no hype, no guarantees.
Return JSON only with these keys:
title, excerpt, body, category, seo_title, seo_description, primary_keyword, related_keywords.
The body should be clean markdown with H2/H3 sections, short paragraphs, steps, and a realistic action checklist.`;

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    messages: [
      {
        role: 'system',
        content: 'You are the editor for HustlePathDaily. You create safe, practical beginner income guides. Avoid scams, income promises, medical/legal/financial advice, and fake urgency.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content || '{}';
  const data = JSON.parse(content) as DraftPayload;
  const title = data.title?.trim() || `HustlePathDaily Draft ${today}`;
  const baseSlug = slugify(title, { lower: true, strict: true }) || `daily-draft-${today}`;
  const slug = `${baseSlug}-${Date.now().toString(36)}`;
  const excerpt = data.excerpt?.trim() || 'A practical beginner-friendly online income draft.';
  const body = normalizeBody(data.body || '');

  const [post] = await sql`
    insert into posts (
      title, slug, excerpt, body, category, status,
      seo_title, seo_description, primary_keyword, related_keywords, workflow_meta
    ) values (
      ${title},
      ${slug},
      ${excerpt},
      ${body},
      ${data.category || 'Beginner Guide'},
      'draft',
      ${data.seo_title || title},
      ${data.seo_description || excerpt},
      ${data.primary_keyword || ''},
      ${JSON.stringify(data.related_keywords || [])}::jsonb,
      ${JSON.stringify({ source: 'daily-ai-generation', generated_at: new Date().toISOString() })}::jsonb
    ) returning id, title, slug
  `;

  return post;
}
