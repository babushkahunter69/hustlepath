import { generateDailyDraft } from '@/lib/draft-generator';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');

  if (secret && auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const post = await generateDailyDraft();
    return Response.json({ ok: true, post });
  } catch (error: any) {
    return Response.json({ ok: false, error: error.message || 'Draft generation failed.' }, { status: 500 });
  }
}
