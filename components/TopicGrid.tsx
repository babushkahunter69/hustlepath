import Link from "next/link";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const FEATURED_TOPICS = [
  {
    title: "Beginner Guide",
    slug: "beginner-guide",
    description:
      "Simple step-by-step guides for beginners who want a practical starting point.",
  },
  {
    title: "Beginner Online Income",
    slug: "beginner-online-income",
    description:
      "Realistic ways to start earning online without hype, big promises, or confusing setup.",
  },
  {
    title: "Freelancing",
    slug: "freelancing",
    description:
      "Beginner freelance skills, service offers, client outreach, pricing, and portfolio tips.",
  },
  {
    title: "Pinterest",
    slug: "pinterest",
    description:
      "Pinterest SEO, pin strategy, board planning, and organic traffic ideas for beginners.",
  },
  {
    title: "Side Hustles",
    slug: "side-hustles",
    description:
      "Beginner-friendly side hustle ideas you can test without overcomplicating the process.",
  },
  {
    title: "Tools",
    slug: "tools",
    description:
      "Useful tools, AI workflows, templates, and simple systems for building online income.",
  },
];

function slugifyCategory(category: string) {
  return category
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function TopicGrid() {
  const rows = await sql`
    select category, count(*)::int as post_count
    from posts
    where status = 'published'
      and category is not null
      and slug is not null
      and body is not null
      and length(body) > 300
    group by category
  `;

  const counts = new Map(
    (rows as any[]).map((row) => [
      slugifyCategory(String(row.category || "")),
      Number(row.post_count || 0),
    ]),
  );

  return (
    <section>
      <p className="eyebrow">Explore Topics</p>

      <h2 className="section-title">Browse by category.</h2>

      <p className="section-subtitle">
        Beginner-friendly guides organized by the type of income path you want to explore.
      </p>

      <div className="topic-grid">
        {FEATURED_TOPICS.map((topic) => {
          const count = counts.get(topic.slug) || 0;

          return (
            <Link
              key={topic.slug}
              href={`/category/${topic.slug}`}
              className="topic-card"
            >
              <div>
                <h3>{topic.title}</h3>
                <p>{topic.description}</p>
              </div>

              <span className="topic-link">
                {count > 0 ? "Explore guides" : "Coming soon"} →
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
