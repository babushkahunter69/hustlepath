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
    <main className="max-w-6xl mx-auto px-6 py-20">
      <p className="text-xs tracking-widest text-orange-600 font-semibold mb-3">
        CATEGORY
      </p>

      <h1 className="text-4xl font-bold mb-10">{titleCase(category)}</h1>

      <div className="grid md:grid-cols-3 gap-6">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="border rounded-2xl p-6 hover:shadow-lg transition"
          >
            <p className="text-xs text-orange-600 font-semibold mb-2">
              {post.category}
            </p>
            <h2 className="text-xl font-bold">{post.title}</h2>
            <p className="text-gray-600 text-sm mt-3">{post.excerpt}</p>
            <p className="text-xs text-gray-400 mt-5">{post.readTime}</p>
          </Link>
        ))}
      </div>
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