import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const token = process.env.N8N_QUEUE_TOKEN;

  if (token) {
    const supplied = request.headers.get('x-queue-token');
    if (supplied !== token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const rows = await sql`
    select id, title, pinterest_meta, target_url, image_url, source
    from products
    where pinterest_meta is not null
    order by updated_at desc nulls last
    limit 100
  `;

  const pins = rows.flatMap((product: any) => {
    const meta = product.pinterest_meta && typeof product.pinterest_meta === 'object' ? product.pinterest_meta : {};
    const items = Array.isArray(meta.pins) ? meta.pins : [];

    return items
      .map((pin: any, index: number) => ({ product, pin, index }))
      .filter(({ pin }: any) => pin?.status !== 'posted')
      .map(({ product, pin, index }: any) => ({
        product_id: product.id,
        product_title: product.title,
        source: product.source,
        pin_index: index,
        title: pin.title,
        description: pin.description,
        image_prompt: pin.image_prompt,
        image_url: pin.image_url,
        tracked_url: pin.tracked_url || `/go/product-pin/${product.id}/${index}`,
        target_url: product.target_url,
      }));
  });

  return NextResponse.json({ count: pins.length, pins });
}
