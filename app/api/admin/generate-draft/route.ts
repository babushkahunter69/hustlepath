import { NextResponse } from 'next/server';
import { generateDailyDraft } from '@/lib/aiDraft';

export async function POST() {
  try {
    const post = await generateDailyDraft();
    return NextResponse.json({ ok: true, post });
  } catch (err) {
    console.error('GENERATE DRAFT ERROR:', err);
    return NextResponse.json(
      { error: 'Failed to generate draft' },
      { status: 500 }
    );
  }
}