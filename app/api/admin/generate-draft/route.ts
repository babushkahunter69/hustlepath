import { generateDailyDraft } from '@/lib/aiDraft';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  return NextResponse.redirect(new URL('/admin', req.url), {
    status: 303,
  });
}

export async function POST(req: Request) {
  try {
    const post = await generateDailyDraft();

    return NextResponse.redirect(
      new URL(`/admin/drafts/${post.id}`, req.url),
      { status: 303 }
    );
  } catch (err) {
    console.error('GENERATE DRAFT ERROR:', err);

    return NextResponse.json(
      { error: 'Failed to generate draft' },
      { status: 500 }
    );
  }
}