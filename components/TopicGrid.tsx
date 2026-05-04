import Link from "next/link";
import { getCategories, toCategorySlug } from "@/lib/posts";

export default async function TopicGrid() {
  const categories = await getCategories();

  return (
    <section id="topics" className="topics-section">
      <div className="section-container">
        <div className="section-heading">
          <p className="eyebrow">Explore Topics</p>
          <h2>Browse by category.</h2>
          <p>Focused guides for beginners who want practical next steps, not vague advice.</p>
        </div>

        <div className="topic-grid">
          {categories.map((category) => (
            <Link key={category} href={`/category/${toCategorySlug(category)}`} className="topic-card">
              <h3>{category}</h3>
              <p>See all guides about {category.toLowerCase()}.</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
