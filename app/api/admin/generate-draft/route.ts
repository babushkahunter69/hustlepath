import { NextResponse } from 'next/server';
import { generateDailyDraft } from '@/lib/aiDraft';

export async function GET(req: Request) {
  try {
    const post = await generateDailyDraft();
    return NextResponse.redirect(new URL(`/admin/drafts/${post.id}`, req.url));
  } catch (error) {
    console.error('GENERATE DRAFT ERROR:', error);
    return NextResponse.json(
      { error: 'Failed to generate draft' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const post = await generateDailyDraft();

    const accept = req.headers.get('accept') || '';

    if (accept.includes('text/html')) {
      return NextResponse.redirect(new URL(`/admin/drafts/${post.id}`, req.url));
    }

    return NextResponse.json({ ok: true, post });
  } catch (error) {
    console.error('GENERATE DRAFT ERROR:', error);
    return NextResponse.json(
      { error: 'Failed to generate draft' },
      { status: 500 }
    );
  }
}