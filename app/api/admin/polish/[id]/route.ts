import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import slugify from 'slugify';
import { sql } from '@/lib/db';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function makeUniqueSlug(baseSlug: string, postId: string) {
  const cleanBaseSlug =
    slugify(baseSlug || 'hustlepath-draft', {
      lower: true,
      strict: true,
    }) || 'hustlepath-draft';

  let slug = cleanBaseSlug;
  let counter = 2;

  while (true) {
    const existing = await sql`
      select id
      from posts
      where slug = ${slug}
      and id != ${postId}
      limit 1
    `;

    if (existing.length === 0) return slug;

    slug = `${cleanBaseSlug}-${counter}`;
    counter++;
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.redirect(new URL(`/admin/drafts/${id}`, req.url), {
    status: 303,
  });
}

export async function POST(
  req: Request,
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

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `
You are an expert blog editor.

Improve the article so it is:
- SEO optimized
- Cleanly formatted
- Easy to scan
- Includes bullet lists
- Includes callouts (Pro tip, Quick win)

Return JSON only.
`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            title: post.title,
            excerpt: post.excerpt,
            body: post.body,
            category: post.category,
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const polished = JSON.parse(raw);

    const title = polished.title || post.title;

    const baseSlug = slugify(polished.slug || title, {
      lower: true,
      strict: true,
    });

    const slug = await makeUniqueSlug(baseSlug, id);

    await sql`
      update posts
      set
        title = ${title},
        slug = ${slug},
        excerpt = ${polished.excerpt || post.excerpt},
        body = ${polished.body || post.body},
        seo_title = ${polished.seo_title || title},
        seo_description = ${polished.seo_description || polished.excerpt || post.excerpt},
        category = ${polished.category || post.category},
        quality_score = 85,
        status = 'needs_review',
        updated_at = now()
      where id = ${id}
    `;

    return NextResponse.redirect(
      new URL(`/admin/drafts/${id}`, req.url),
      { status: 303 }
    );
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