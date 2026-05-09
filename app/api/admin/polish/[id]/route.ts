import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import slugify from 'slugify';
import { sql } from '@/lib/db';
import { scorePost } from '@/lib/seo';
import { formatArticleMarkdown } from '@/lib/articleFormat';

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

Do not add any /blog internal links unless they already exist in the current article.
Never invent URLs.

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

    const excerpt = polished.excerpt || post.excerpt;
    const formattedBody = formatArticleMarkdown(String(polished.body || post.body || ''));
    const seoTitle = polished.seo_title || title;
    const seoDescription = polished.seo_description || polished.excerpt || post.excerpt;
    const primaryKeyword = polished.primary_keyword || post.primary_keyword || '';
    const seo = scorePost({
      title,
      excerpt,
      body: formattedBody,
      seoTitle,
      seoDescription,
      primaryKeyword,
    });

    await sql`
      update posts
      set
        title = ${title},
        slug = ${slug},
        excerpt = ${excerpt},
        body = ${formattedBody},
        seo_title = ${seoTitle},
        seo_description = ${seoDescription},
        primary_keyword = ${primaryKeyword},
        category = ${polished.category || post.category},
        quality_score = ${seo.score},
        risk_level = ${seo.score >= 85 ? 'low' : seo.score >= 70 ? 'medium' : 'needs_work'},
        workflow_meta = coalesce(workflow_meta, '{}'::jsonb) || ${JSON.stringify({ seo_checks: seo.checks, polished_at: new Date().toISOString() })}::jsonb,
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