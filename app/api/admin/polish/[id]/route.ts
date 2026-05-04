import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { sql } from '@/lib/db';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.redirect(new URL(`/admin/drafts/${id}`, _req.url));
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const [post] = await sql`
      select *
      from posts
      where id = ${id}
      limit 1
    `;

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Missing OPENAI_API_KEY' },
        { status: 500 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are an expert blog editor. Return valid JSON only. Improve the article for clarity, SEO, structure, bullets, callouts, pro tips, and internal linking.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            title: post.title,
            excerpt: post.excerpt,
            body: post.body,
            category: post.category,
            instructions:
              'Return JSON with title, slug, excerpt, body, seo_title, seo_description, category. Body should be clean markdown with headings, bullets, callout blocks, and pro tips.',
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const polished = JSON.parse(raw);

    await sql`
      update posts
      set
        title = ${polished.title || post.title},
        slug = ${polished.slug || post.slug},
        excerpt = ${polished.excerpt || post.excerpt},
        body = ${polished.body || post.body},
        seo_title = ${polished.seo_title || polished.title || post.seo_title},
        seo_description = ${polished.seo_description || polished.excerpt || post.seo_description},
        category = ${polished.category || post.category},
        quality_score = 85,
        status = 'needs_review',
        updated_at = now()
      where id = ${id}
    `;

    return NextResponse.redirect(new URL(`/admin/drafts/${id}`, _req.url));
  } catch (error: any) {
    console.error('Polish error:', error);

    return NextResponse.json(
      {
        error: 'Polish failed',
        detail: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}