import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

function getPin(meta: any, index: number) {
  const source = meta && typeof meta === 'object' ? meta : {};
  const pins = Array.isArray(source.pins) ? source.pins : [];
  return pins[index] || null;
}

function withPinterestUtm(rawUrl: string, productId: string, pinIndex: number) {
  try {
    const url = new URL(rawUrl);
    if (!url.searchParams.has('utm_source')) url.searchParams.set('utm_source', 'pinterest');
    if (!url.searchParams.has('utm_medium')) url.searchParams.set('utm_medium', 'organic');
    if (!url.searchParams.has('utm_campaign')) url.searchParams.set('utm_campaign', `product_${productId}`);
    if (!url.searchParams.has('utm_content')) url.searchParams.set('utm_content', `pin_${pinIndex}`);
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ productId: string; pinIndex: string }> }) {
  const { productId, pinIndex } = await params;
  const index = Number(pinIndex);

  const [product] = await sql`
    select id, target_url, pinterest_meta
    from products
    where id = ${productId} and coalesce(status, 'active') = 'active'
    limit 1
  `;

  if (!product?.target_url || !Number.isFinite(index)) redirect('/');

  const pin = getPin(product.pinterest_meta, index);
  const pinTitle = pin?.title ? String(pin.title) : null;

  try {
    await sql`
      insert into product_clicks (product_id, referrer, user_agent, pin_index, pin_title)
      values (${productId}, ${request.headers.get('referer') || null}, ${request.headers.get('user-agent') || null}, ${index}, ${pinTitle})
    `;
  } catch {}

  redirect(withPinterestUtm(String(product.target_url), String(productId), index));
}
