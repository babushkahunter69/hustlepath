import Link from "next/link";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

function slugifyCategory(category: string) {
  return category
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function TopicGrid() {
  const categories = await sql`
    select category, count(*)::int as post_count
    from posts
    where status = 'published'
      and category is not null
      and slug is not null
      and body is not null
      and length(body) > 300
    group by category
    order by category asc
  `;

  if (categories.length === 0) {
    return null;
  }

  return (
    <section>
      <p className="eyebrow">Explore Topics</p>

      <h2 className="section-title">Browse by category.</h2>

      <p className="section-subtitle">
        Focused guides based on the published articles currently live on HustlePathDaily.
      </p>

      <div className="topic-grid">
        {(categories as any[]).map((item) => {
          const category = String(item.category || "Guide");

          return (
            <Link
              key={category}
              href={`/category/${slugifyCategory(category)}`}
              className="topic-card"
            >
              <h3>{category}</h3>
              <p>
                {item.post_count} published{" "}
                {item.post_count === 1 ? "guide" : "guides"}.
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}