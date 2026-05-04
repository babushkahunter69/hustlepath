import { sql } from '@/lib/db';
import { redirect } from 'next/navigation';
import slugify from 'slugify';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const form = await req.formData();
  const title = String(form.get('title') || '').trim();
  const body = String(form.get('body') || '').trim();
  const excerpt = String(form.get('excerpt') || '').trim();
  const rawSlug = String(form.get('slug') || title).trim();
  const slug = slugify(rawSlug || title || id, { lower: true, strict: true });

  await sql`
    update posts
    set title = ${title},
        slug = ${slug},
        excerpt = ${excerpt},
        body = ${body},
        status = 'needs_review',
        updated_at = now()
    where id = ${id}
  `;

  redirect(`/admin/drafts/${id}`);
}
