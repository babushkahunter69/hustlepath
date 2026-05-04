import Link from "next/link";
import { getCategories, getPostsByCategory } from "@/lib/posts";

function titleCase(text: string) {
  return text
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function generateStaticParams() {
  const categories = await getCategories();

  return categories.map((category) => ({
    category: category.toLowerCase().replace(/\s+/g, "-"),
  }));
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const posts = await getPostsByCategory(category);

  return (
    <main className="page-shell">
      <section className="section-container">
        <p className="eyebrow">Category</p>
        <h1 className="page-title">{titleCase(category)}</h1>

        <div className="post-grid">
          {posts.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="post-card flat">
              <div className="post-card-body">
                <p className="post-card-category">{post.category}</p>
                <h3>{post.title}</h3>
                <p>{post.excerpt}</p>
                <span>{post.readTime}</span>
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

  return {
    title: `${titleCase(category)} Guides | HustlePath`,
    description: `Read beginner-friendly guides about ${titleCase(category).toLowerCase()}.`,
  };
}
