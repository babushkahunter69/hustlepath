import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ postId: string; index: string }> }) {
  const { postId, index } = await params;
  const url = new URL(request.url);
  const [post] = await sql`select slug, pinterest_meta from posts where id = ${postId} limit 1`;
  const pins = Array.isArray(post?.pinterest_meta?.pins) ? post.pinterest_meta.pins : [];
  const pin = pins[Number(index)] || {};
  try { await sql`insert into pin_clicks (post_id, pin_index, pin_title, source, referrer, user_agent) values (${postId}, ${Number(index)}, ${String(pin.title || '')}, ${url.searchParams.get('utm_source') || 'pinterest'}, ${request.headers.get('referer') || null}, ${request.headers.get('user-agent') || null})`; } catch {}
  redirect(post?.slug ? `/blog/${post.slug}?utm_source=pinterest&utm_medium=pin&utm_campaign=hustlepathdaily&utm_content=pin_${index}` : '/blog');
}
