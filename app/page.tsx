import Link from "next/link";
import Hero from "@/components/Hero";
import TopicGrid from "@/components/TopicGrid";
import Newsletter from "@/components/Newsletter";
import { sql } from "@/lib/db";

export const metadata = {
  title: "Hustle Path Daily | Beginner Online Income & Pinterest Guides",
  description:
    "Beginner-friendly guides for online income, Pinterest growth, side hustles, and practical ways to start making money online.",
};

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category: string | null;
};

export default async function HomePage() {
  const posts = (await sql`
    select id, title, slug, excerpt, category
    from posts
    where status = 'published'
      and slug is not null
      and body is not null
      and length(body) > 300
    order by published_at desc nulls last, created_at desc
    limit 3
  `) as Post[];

  return (
    <main>
      <section className="section">
        <div className="container">
          <Hero />
        </div>
      </section>

      <section style={{ padding: "70px 0" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: "24px",
              marginBottom: "40px",
            }}
          >
            <div>
              <p
                style={{
                  color: "#f04a00",
                  fontSize: "14px",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  marginBottom: "12px",
                }}
              >
                Latest Guides
              </p>

              <h2
                style={{
                  fontSize: "52px",
                  lineHeight: "0.95",
                  letterSpacing: "-0.06em",
                  fontWeight: 900,
                  margin: 0,
                }}
              >
                Start with these.
              </h2>
            </div>

            <Link
              href="/blog"
              style={{
                border: "1px solid #ddd2c4",
                background: "#fff",
                borderRadius: "999px",
                padding: "16px 28px",
                fontWeight: 900,
                textDecoration: "none",
                color: "#111",
              }}
            >
              View all posts
            </Link>
          </div>

          {posts.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "30px",
              }}
            >
              {posts.map((post, index) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  style={{
                    display: "block",
                    overflow: "hidden",
                    border: "1px solid #ddd2c4",
                    borderRadius: "32px",
                    background: "#fff",
                    textDecoration: "none",
                    color: "#111",
                  }}
                >
                  <div style={{ background: "#eee2d2", padding: "36px" }}>
                    <span
                      style={{
                        fontSize: "64px",
                        lineHeight: 1,
                        fontWeight: 900,
                        color: "#d8cdbc",
                      }}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <div style={{ padding: "32px" }}>
                    <p
                      style={{
                        color: "#f04a00",
                        fontSize: "12px",
                        fontWeight: 900,
                        textTransform: "uppercase",
                        letterSpacing: "0.2em",
                        marginBottom: "18px",
                      }}
                    >
                      {post.category || "Guide"}
                    </p>

                    <h3
                      style={{
                        fontSize: "26px",
                        lineHeight: "1.05",
                        fontWeight: 900,
                        marginBottom: "22px",
                      }}
                    >
                      {post.title}
                    </h3>

                    <p
                      style={{
                        color: "#6f675e",
                        fontSize: "18px",
                        lineHeight: "1.55",
                        marginBottom: "36px",
                      }}
                    >
                      {post.excerpt}
                    </p>

                    <span style={{ fontWeight: 900, color: "#6f675e" }}>
                      Read guide
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div
              style={{
                border: "1px solid #ddd2c4",
                borderRadius: "32px",
                background: "#fff",
                padding: "40px",
              }}
            >
              <p style={{ fontWeight: 800, color: "#6f675e" }}>
                No published posts yet.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <TopicGrid />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Newsletter />
        </div>
      </section>
    </main>
  );
}