import { NextResponse } from 'next/server';
import { generateDailyDraft } from '@/lib/aiDraft';
import { getClusterTopics, getTodaysClusterSeed } from '@/lib/contentClusters';

export async function POST(req: Request) {
  try {
    let body: any = {};

    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const seed = body.seed || getTodaysClusterSeed();
    const topics = getClusterTopics(seed).slice(0, Number(body.limit || 6));
    const clusterId = String(body.clusterId || seed.niche)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const posts = [];

    for (const topic of topics) {
      const post = await generateDailyDraft({
        topic: topic.title,
        category: topic.category,
        niche: topic.niche,
        clusterId,
        clusterRole: topic.clusterRole as 'pillar' | 'supporting',
        source: 'admin-cluster-generator',
      });

      posts.push(post);
    }

    return NextResponse.json({ ok: true, clusterId, posts });
  } catch (error: any) {
    console.error('GENERATE CLUSTER ERROR:', error);

    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to generate cluster' },
      { status: 500 }
    );
  }
}
