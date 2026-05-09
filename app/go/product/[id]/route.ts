import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product] = await sql`select target_url from products where id = ${id} and status = 'active' limit 1`;
  if (!product?.target_url) redirect('/');
  try { await sql`insert into product_clicks (product_id, referrer, user_agent) values (${id}, ${request.headers.get('referer') || null}, ${request.headers.get('user-agent') || null})`; } catch {}
  redirect(product.target_url);
}
