import Link from "next/link";
import Hero from "@/components/Hero";
import TopicGrid from "@/components/TopicGrid";
import Newsletter from "@/components/Newsletter";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

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
      <Hero />

      <section className="latest-section">
        <div className="section-container">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Latest Guides</p>
              <h2>Start with these.</h2>
            </div>

            <Link href="/blog" className="btn btn-light">
              View all posts
            </Link>
          </div>

          {posts.length > 0 ? (
            <div className="post-grid">
              {posts.map((post, index) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="post-card flat"
                >
                  <div className="post-card-number">
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  <div className="post-card-body">
                    <p className="post-card-category">
                      {post.category || "Guide"}
                    </p>

                    <h3>{post.title}</h3>

                    <p>{post.excerpt}</p>

                    <span>Read guide</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-card">
              <p>No published posts yet.</p>
            </div>
          )}
        </div>
      </section>

      <section className="topics-section">
        <div className="section-container">
          <TopicGrid />
        </div>
      </section>

      <Newsletter />
    </main>
  );
}