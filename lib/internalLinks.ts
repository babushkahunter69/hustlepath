import { sql } from '@/lib/db';

export type InternalLinkCandidate = {
  title: string;
  slug: string;
  category: string | null;
  excerpt: string | null;
  primary_keyword: string | null;
};

function words(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3);
}

function overlapScore(seed: string, post: InternalLinkCandidate) {
  const seedWords = new Set(words(seed));
  const haystack = words(
    `${post.title || ''} ${post.category || ''} ${post.excerpt || ''} ${post.primary_keyword || ''}`
  );

  return haystack.reduce((score, word) => score + (seedWords.has(word) ? 1 : 0), 0);
}

export async function getInternalLinkCandidates(input: {
  topic: string;
  category?: string;
  limit?: number;
  excludeSlug?: string;
}) {
  const rows = await sql`
    select title, slug, category, excerpt, primary_keyword
    from posts
    where status = 'published'
      and slug is not null
      and (${input.excludeSlug || null}::text is null or slug != ${input.excludeSlug || null})
    order by published_at desc nulls last, created_at desc
    limit 40
  `;

  const ranked = (rows as InternalLinkCandidate[])
    .map((post) => ({
      ...post,
      score:
        overlapScore(`${input.topic} ${input.category || ''}`, post) +
        (input.category && post.category === input.category ? 4 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit || 5);

  return ranked.map((post) => ({
    title: post.title,
    url: `/blog/${post.slug}`,
    category: post.category || 'Beginner Guide',
    primaryKeyword: post.primary_keyword || '',
  }));
}

export function internalLinksForPrompt(links: Awaited<ReturnType<typeof getInternalLinkCandidates>>) {
  if (!links.length) return 'No internal links available yet. Do not invent URLs.';

  return links
    .map((link) => `- ${link.title} (${link.category}): ${link.url}`)
    .join('\n');
}
