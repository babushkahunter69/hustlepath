import { pinterestProductImageHeaders, resolvePinterestProductImage } from '@/lib/pinterestProductImage';
import { sql } from '@/lib/db';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

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
  console.info('Pinterest product source image debug', result);
  const debugHeaders = pinterestProductImageHeaders(result);

  if (!result.bytes || !result.contentType) {
    return Response.json(
      {
        error: 'Unable to fetch product image',
        productId,
        productImageUrl: result.productImageUrl,
        productImageUrlIsAbsolute: result.productImageUrlIsAbsolute,
        productTargetUrl: result.productTargetUrl,
        productTargetUrlIsAbsolute: result.productTargetUrlIsAbsolute,
        candidates: result.candidates,
        sourceUrl: result.sourceUrl,
        status: result.status,
        httpStatus: result.httpStatus,
        contentType: result.contentType,
        byteLength: result.byteLength,
        reason: result.reason,
      },
      {
        status: 502,
        headers: debugHeaders,
      }
    );
  }

  return new Response(result.bytes, {
    status: 200,
    headers: {
      ...debugHeaders,
      'Content-Type': result.contentType,
      'Content-Length': String(result.byteLength),
    },
  });
}
