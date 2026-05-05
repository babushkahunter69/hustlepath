import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function slugifyCategory(category: string) {
  return category
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleCase(text: string) {
  return text
    .split('-')
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

  const categories = await sql`
    select distinct category
    from posts
    where status = 'published'
      and category is not null
      and slug is not null
      and body is not null
      and length(body) > 300
  `;

  const matchingCategory = (categories as any[])
    .map((row) => String(row.category || ''))
    .find((name) => slugifyCategory(name) === category);

  if (!matchingCategory) {
    notFound();
  }

  const posts = await sql`
    select id, title, slug, excerpt, category, body, published_at, created_at
    from posts
    where status = 'published'
      and category = ${matchingCategory}
      and slug is not null
      and body is not null
      and length(body) > 300
    order by published_at desc nulls last, created_at desc
  `;

  return (
    <main className="page-shell">
      <section className="section-container">
        <p className="eyebrow">Category</p>
        <h1 className="page-title">{matchingCategory || titleCase(category)}</h1>

        {(posts as any[]).length > 0 ? (
          <div className="post-grid">
            {(posts as any[]).map((post) => (
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
        ) : (
          <div className="empty-state">No published posts in this category yet.</div>
        )}
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

  return {
    title: `${titleCase(category)} Guides | HustlePathDaily`,
    description: `Read beginner-friendly guides about ${titleCase(category).toLowerCase()}.`,
  };
}