import { NextResponse } from 'next/server';
import { refillTopicBank } from '@/lib/aiDraft';
import { refillClusterBank } from '@/lib/contentClusters';

/**
 * POST /api/admin/refill-banks
 *
 * Manually pre-warm both the topic bank and the cluster bank.
 * Useful to run before a busy publishing day or to reset after many articles.
 *
 * Optional body:
 *   { topicBatch?: number, clusterBatch?: number }
 */
export async function POST(req: Request) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const topicBatch = Number(body.topicBatch || 40);
    const clusterBatch = Number(body.clusterBatch || 10);

    await Promise.all([
      refillTopicBank(topicBatch),
      refillClusterBank(clusterBatch),
    ]);

    return NextResponse.json({
      ok: true,
      message: `Refilled topic bank (~${topicBatch} topics) and cluster bank (~${clusterBatch} clusters).`,
    });
  } catch (error: any) {
    console.error('REFILL BANKS ERROR:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to refill banks' },
      { status: 500 },
    );
  }
}
