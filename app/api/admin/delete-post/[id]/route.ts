import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await sql`
      delete from posts
      where id = ${id}
    `;

    return NextResponse.redirect(new URL('/admin/published', req.url), {
      status: 303,
    });
  } catch (error: any) {
    console.error('DELETE POST ERROR:', error);

    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to delete post' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await sql`
      delete from posts
      where id = ${id}
    `;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('DELETE POST ERROR:', error);

    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to delete post' },
      { status: 500 }
    );
  }
}
