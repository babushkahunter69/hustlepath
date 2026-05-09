import OpenAI from 'openai';
import { sql } from '@/lib/db';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClusterSeed = {
  niche: string;
  category: string;
  pillarTitle: string;
  supportingTitles: string[];
};

// ---------------------------------------------------------------------------
// Static seed clusters — used as fallback and for initial seeding.
// ---------------------------------------------------------------------------

export const contentClusters: ClusterSeed[] = [
  {
    niche: 'Pinterest traffic for beginner side hustle blogs',
    category: 'Pinterest',
    pillarTitle: 'How to Use Pinterest to Get Blog Traffic as a Beginner',
    supportingTitles: [
      'Pinterest SEO Tips for Beginner Bloggers',
      'Best Pinterest Niches for New Blog Traffic',
      'How to Create Pinterest Pin Titles That Get Clicks',
      'Pinterest Board Strategy for a New Blog',
      'How Many Pins Should a Beginner Create Per Blog Post',
    ],
  },
  {
    niche: 'beginner online income without an audience',
    category: 'Beginner Guide',
    pillarTitle: 'How to Make Your First Online Income Without an Audience',
    supportingTitles: [
      'Beginner Services You Can Sell Online With No Audience',
      'How to Package One Skill Into a Simple Freelance Offer',
      'Best Free Tools for Starting an Online Income Project',
      'How to Get Your First Client Without Paid Ads',
      'Simple Weekly Plan for Building an Online Income Stream',
    ],
  },
  {
    niche: 'AI tools for simple side hustles',
    category: 'Tools',
    pillarTitle: 'Best AI Tools for Starting a Simple Online Side Hustle',
    supportingTitles: [
      'How to Use AI to Plan a Beginner Side Hustle',
      'AI Writing Tools for Blog Posts, Pins, and Product Ideas',
      'Free AI Tools Beginners Can Use to Save Time',
      'How to Turn AI Research Into Helpful Blog Content',
      'AI Side Hustle Mistakes Beginners Should Avoid',
    ],
  },
  {
    niche: 'print on demand for absolute beginners',
    category: 'Side Hustles',
    pillarTitle: 'How to Start a Print on Demand Side Hustle From Scratch',
    supportingTitles: [
      'Best Print on Demand Platforms for Beginners',
      'How to Design Simple Products That Actually Sell',
      'Canva Print on Demand Tutorial for Complete Beginners',
      'How to Pick a Profitable Niche for Print on Demand',
      'Pinterest Marketing for Your Print on Demand Shop',
    ],
  },
  {
    niche: 'digital products for beginners',
    category: 'Side Hustles',
    pillarTitle: 'How Beginners Can Create and Sell Digital Products Online',
    supportingTitles: [
      'Best Digital Product Ideas for Beginners With No Experience',
      'How to Make a Simple Digital Download With Free Tools',
      'Where to Sell Digital Products Without a Website',
      'How to Price Digital Products as a Beginner',
      'How to Promote Digital Products on Pinterest',
    ],
  },
  {
    niche: 'freelancing for beginners with no portfolio',
    category: 'Side Hustles',
    pillarTitle: 'How to Start Freelancing With No Portfolio or Experience',
    supportingTitles: [
      'How to Write a Simple Freelance Service Offer',
      'Best Beginner Freelance Skills You Can Learn in a Week',
      'How to Find Your First Freelance Client for Free',
      'Fiverr vs Upwork: Which Is Better for Beginners',
      'How to Build a Simple Portfolio From Scratch',
    ],
  },
];

// ---------------------------------------------------------------------------
// Cluster bank — persisted in the `cluster_bank` DB table
// ---------------------------------------------------------------------------

async function ensureClusterBankTable() {
  await sql`
    create table if not exists cluster_bank (
      id              uuid primary key default gen_random_uuid(),
      niche           text not null unique,
      category        text not null,
      pillar_title    text not null,
      supporting_json jsonb not null default '[]'::jsonb,
      used            boolean not null default false,
      created_at      timestamptz not null default now()
    )
  `;
  await sql`create index if not exists cluster_bank_used_idx on cluster_bank(used)`;
}

async function countUnusedClusters(): Promise<number> {
  await ensureClusterBankTable();
  const [row] = await sql`select count(*) as n from cluster_bank where used = false`;
  return Number((row as any).n ?? 0);
}

async function loadUnusedClusters(): Promise<ClusterSeed[]> {
  await ensureClusterBankTable();
  const rows = await sql`
    select niche, category, pillar_title, supporting_json
    from cluster_bank
    where used = false
    order by created_at asc
  `;
  return rows.map((r: any) => ({
    niche: String(r.niche),
    category: String(r.category),
    pillarTitle: String(r.pillar_title),
    supportingTitles: Array.isArray(r.supporting_json) ? r.supporting_json : [],
  }));
}

async function markClusterUsed(niche: string) {
  await sql`update cluster_bank set used = true where niche = ${niche}`;
}

// ---------------------------------------------------------------------------
// Deduplication helpers
// ---------------------------------------------------------------------------

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordSet(value: string): Set<string> {
  return new Set(normalise(value).split(' ').filter((w) => w.length > 3));
}

function similarity(a: string, b: string): number {
  const aW = wordSet(a);
  const bW = wordSet(b);
  if (!aW.size || !bW.size) return 0;
  let overlap = 0;
  for (const w of aW) if (bW.has(w)) overlap++;
  return overlap / Math.min(aW.size, bW.size);
}

// ---------------------------------------------------------------------------
// AI cluster expander
// ---------------------------------------------------------------------------

async function getAllKnownNiches(): Promise<string[]> {
  await ensureClusterBankTable();
  const bankRows = await sql`select niche, pillar_title from cluster_bank`;
  const bankNiches = bankRows.flatMap((r: any) => [
    String(r.niche),
    String(r.pillar_title),
  ]);

  // Also check existing cluster_ids from posts
  const postRows = await sql`
    select distinct cluster_id from posts where cluster_id is not null
  `;
  const postNiches = postRows.map((r: any) => String(r.cluster_id || ''));

  return [...bankNiches, ...postNiches].filter(Boolean);
}

async function generateNewClusters(
  existingNiches: string[],
  batchSize = 8,
): Promise<ClusterSeed[]> {
  const categories = ['Beginner Guide', 'Side Hustles', 'Tools', 'Pinterest', 'Beginner Online Income', 'Freelancing'];

  const existingList = existingNiches
    .slice(-40)
    .map((n) => `- ${n}`)
    .join('\n');

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    temperature: 0.9,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a senior content strategist for HustlePathDaily, a beginner-friendly blog about online income, side hustles, tools, and Pinterest traffic.

Generate content cluster seeds — each cluster has one pillar article and 5 supporting articles that together cover a niche topic in depth.

Return JSON only. No markdown outside JSON.`,
      },
      {
        role: 'user',
        content: `Generate exactly ${batchSize} UNIQUE content cluster ideas for HustlePathDaily.

SITE NICHE: Beginner online income, side hustles, Pinterest marketing, helpful tools.

ALLOWED CATEGORIES: ${categories.join(', ')}

RULES:
- Each cluster must be a distinct niche angle NOT covered by these existing clusters:
${existingList || '(none yet — this is the first batch)'}
- Clusters should span: Etsy, Ko-fi, Gumroad, Substack, Fiverr, Upwork, Pinterest, print-on-demand, blogging, digital products, freelancing, content creation, email lists, affiliate marketing (beginner), reselling, social media side hustles, Redbubble, etc.
- Beginner-friendly only — no advanced or overly technical topics
- No hype or income promises
- Each pillar title should be 40–70 characters
- Each supporting title should be 40–70 characters

Return JSON:
{
  "clusters": [
    {
      "niche": "short niche identifier (3-8 words)",
      "category": "Side Hustles",
      "pillarTitle": "...",
      "supportingTitles": ["...", "...", "...", "...", "..."]
    }
  ]
}`,
      },
    ],
  });

  const raw = safeJsonParse(completion.choices[0].message.content || '{}');
  if (!Array.isArray(raw?.clusters)) return [];

  return (raw.clusters as any[])
    .filter(
      (c) =>
        c?.niche &&
        c?.category &&
        c?.pillarTitle &&
        Array.isArray(c?.supportingTitles) &&
        c.supportingTitles.length >= 3,
    )
    .map((c) => ({
      niche: String(c.niche).trim(),
      category: String(c.category),
      pillarTitle: String(c.pillarTitle).trim(),
      supportingTitles: (c.supportingTitles as string[]).map((t) => String(t).trim()),
    }));
}

async function expandClusterBank(minUnused = 3, batchSize = 8) {
  const unusedCount = await countUnusedClusters();
  if (unusedCount >= minUnused) return;

  const known = await getAllKnownNiches();
  const newClusters = await generateNewClusters(known, batchSize);

  const knownNorm = new Set(known.map(normalise));

  for (const cluster of newClusters) {
    const norm = normalise(cluster.niche);

    const isDuplicate =
      knownNorm.has(norm) ||
      [...knownNorm].some((k) => similarity(cluster.niche, k) >= 0.55);

    if (isDuplicate) continue;

    try {
      await sql`
        insert into cluster_bank (niche, category, pillar_title, supporting_json)
        values (
          ${cluster.niche},
          ${cluster.category},
          ${cluster.pillarTitle},
          ${JSON.stringify(cluster.supportingTitles)}::jsonb
        )
        on conflict (niche) do nothing
      `;
      knownNorm.add(norm);
    } catch {
      // ignore unique-constraint violations
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function safeJsonParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

/**
 * Returns today's cluster seed.
 * Pulls from the DB bank (auto-expanding when low), falls back to static seeds.
 */
export async function getTodaysClusterSeed(date = new Date()): Promise<ClusterSeed> {
  // Keep bank topped up
  await expandClusterBank(3, 8);

  const unused = await loadUnusedClusters();
  if (unused.length > 0) {
    const candidates = shuffle(unused);
    const chosen = candidates[0];
    await markClusterUsed(chosen.niche);
    return chosen;
  }

  // Fallback to static list
  return contentClusters[date.getUTCDate() % contentClusters.length];
}

/**
 * Synchronous version for compatibility — returns from static list only.
 * Use getTodaysClusterSeed() (async) for the AI-powered version.
 */
export function getTodaysClusterSeedSync(date = new Date()): ClusterSeed {
  return contentClusters[date.getUTCDate() % contentClusters.length{
    niche: 'beginner online income from zero',
    category: 'Beginner Online Income',
    pillarTitle: 'How to Start Making Money Online as a Complete Beginner',
    supportingTitles: [
      'Realistic Online Income Ideas for Beginners With No Audience',
      'How to Earn Your First Dollar Online With No Experience',
      'Common Beginner Online Income Mistakes and How to Avoid Them',
      'How to Set Realistic Goals for Your First Online Income',
      'How to Track and Grow Your Online Income as a Beginner',
    ],
  },
  {
    niche: 'freelancing for beginners with no portfolio',
    category: 'Freelancing',
    pillarTitle: 'How to Start Freelancing With No Portfolio or Experience',
    supportingTitles: [
      'Best Beginner Freelance Skills You Can Learn in a Week',
      'How to Write a Freelance Proposal That Gets Replies',
      'How to Find Your First Freelance Client Without Paid Ads',
      'Fiverr vs Upwork: Which Is Better for Absolute Beginners',
      'How to Set Your Freelance Rates When You Are Just Starting Out',
    ],
  },
];
}

export function getClusterTopics(seed: ClusterSeed) {
  return [seed.pillarTitle, ...seed.supportingTitles].map((title, index) => ({
    title,
    category: seed.category,
    niche: seed.niche,
    clusterRole: index === 0 ? 'pillar' : 'supporting',
  }));
}

/**
 * Manually pre-warm the cluster bank.
 * Call from an admin route or scheduled job.
 */
export async function refillClusterBank(batchSize = 10) {
  await expandClusterBank(0, batchSize);
}
