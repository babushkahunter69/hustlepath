import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function slugifyCategory(category: string) {
  return String(category || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleCase(text: string) {
  return String(text || '')
    .replace(/-/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function estimateReadTime(body: string | null) {
  const words = String(body || '').split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 225))} min read`;
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const requestedSlug = slugifyCategory(decodeURIComponent(category));

  const publishedPosts = await sql`
    select id, title, slug, excerpt, category, body, published_at, created_at
    from posts
    where status = 'published'
      and category is not null
      and slug is not null
    order by published_at desc nulls last, created_at desc
  `;

  const matchingPosts = (publishedPosts as any[]).filter((post) => {
    return slugifyCategory(post.category) === requestedSlug;
  });

  if (matchingPosts.length === 0) {
    notFound();
  }

  const matchingCategory = String(matchingPosts[0].category || titleCase(requestedSlug));

  return (
    <main className="page-shell">
      <section className="section-container">
        <p className="eyebrow">Category</p>
        <h1 className="page-title">{matchingCategory}</h1>

        <div className="post-grid">
          {matchingPosts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`} className="post-card flat">
              <div className="post-card-body">
                <p className="post-card-category">{post.category}</p>
                <h3>{post.title}</h3>
                <p>{post.excerpt}</p>
                <span>{estimateReadTime(post.body)}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const label = titleCase(decodeURIComponent(category));

  return {
    title: `${label} Guides | HustlePathDaily`,
    description: `Read beginner-friendly guides about ${label.toLowerCase()}.`,
  };
}
