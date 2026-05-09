import Link from 'next/link';
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

export default async function TopicsPage() {
  const categories = await sql`
    select
      category,
      count(*)::int as post_count
    from posts
    where status = 'published'
      and category is not null
      and slug is not null
      and body is not null
      and length(body) > 300
    group by category
    order by category asc
  `;

  return (
    <main className="page-shell">
      <section className="article-shell">
        <p className="eyebrow">Explore Topics</p>

        <h1 className="article-title">Browse by category.</h1>

        <p className="article-excerpt">
          Focused guides based on the published articles currently live on HustlePathDaily.
        </p>

        {categories.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '28px',
              marginTop: '48px',
            }}
          >
            {(categories as any[]).map((item) => {
              const category = String(item.category || 'Guide');
              const href = `/category/${slugifyCategory(category)}`;

              return (
                <Link
                  key={category}
                  href={href}
                  style={{
                    display: 'block',
                    border: '1px solid #ddd2c4',
                    borderRadius: '28px',
                    background: '#fff',
                    padding: '30px',
                    color: '#111',
                    textDecoration: 'none',
                  }}
                >
                  <h2
                    style={{
                      fontSize: '28px',
                      lineHeight: '1.05',
                      fontWeight: 900,
                      marginBottom: '20px',
                    }}
                  >
                    {category}
                  </h2>

                  <p
                    style={{
                      color: '#6f675e',
                      fontSize: '18px',
                      lineHeight: '1.55',
                      margin: 0,
                    }}
                  >
                    {item.post_count} published {item.post_count === 1 ? 'guide' : 'guides'}.
                  </p>
                </Link>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              marginTop: '48px',
              border: '1px solid #ddd2c4',
              borderRadius: '28px',
              background: '#fff',
              padding: '30px',
            }}
          >
            <p style={{ color: '#6f675e', fontWeight: 800 }}>
              No published categories yet.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}