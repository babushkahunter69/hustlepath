import { pinterestProductImageDebugSummary, pinterestProductImageHeaders, resolvePinterestProductImage } from '@/lib/pinterestProductImage';
import { sql } from '@/lib/db';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

function toResponseBody(bytes: Uint8Array) {
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return body;
}

export async function GET(_request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;

  const [product] = await sql`
    select id, title, description, image_url, target_url, keywords, pinterest_meta, updated_at, created_at
    from products
    where id = ${productId}
    limit 1
  `;

  if (!product) {
    return Response.json(
      { error: 'Product not found', productId },
      {
        status: 404,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  }

  const result = await resolvePinterestProductImage(product);
  const debug = pinterestProductImageDebugSummary(result);
  console.info('Pinterest product source image debug', debug);
  const debugHeaders = pinterestProductImageHeaders(result);

  if (!result.bytes || !result.contentType) {
    return Response.json(
      {
        error: 'Unable to fetch product image',
        ...debug,
      },
      {
        status: 502,
        headers: debugHeaders,
      }
    );
  }

  return new Response(toResponseBody(result.bytes), {
    status: 200,
    headers: {
      ...debugHeaders,
      'Content-Type': result.contentType,
      'Content-Length': String(result.byteLength),
    },
  });
}
