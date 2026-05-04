import Link from "next/link";
import { getCategories, getPostsByCategory, toCategorySlug } from "@/lib/posts";

export const metadata = {
  title: "Topics | Hustle Path Daily",
  description: "Browse beginner income guides by topic.",
};

export default async function TopicsPage() {
  const categories = await getCategories();
  const data = await Promise.all(
    categories.map(async (category) => ({
      category,
      slug: toCategorySlug(category),
      posts: await getPostsByCategory(toCategorySlug(category)),
    }))
  );

  return (
    <main className="page-shell">
      <section className="section-container">
        <p className="eyebrow">Explore Topics</p>
        <h1 className="page-title">Browse guides by category.</h1>
        <p className="page-subtitle">
          Pick the lane that fits where you are right now, from simple side hustles to tools and traffic systems.
        </p>

        <div className="topic-grid spacious">
          {data.map(({ category, slug, posts }) => (
            <Link key={category} href={`/category/${slug}`} className="topic-card">
              <p className="post-card-category">{posts.length} guides</p>
              <h3>{category}</h3>
              <p>See practical articles about {category.toLowerCase()}.</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
