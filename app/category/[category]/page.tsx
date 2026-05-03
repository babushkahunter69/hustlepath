import Link from "next/link";
import { getCategories, getPostsByCategory, toCategorySlug } from "@/lib/posts";

function titleCase(text: string) {
  return text.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((category) => ({ category: toCategorySlug(category) }));
}

export default async function CategoryPage({ params }: { params: { category: string } }) {
  const posts = await getPostsByCategory(params.category);

  return (
    <main className="max-w-6xl mx-auto px-6 py-20">
      <p className="text-xs tracking-[0.25em] text-orange-600 font-black mb-3">CATEGORY</p>
      <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-10">{titleCase(params.category)}</h1>
      <div className="grid md:grid-cols-3 gap-6">
        {posts.map((post) => (
          <Link key={post.slug} href={`/blog/${post.slug}`} className="bg-white border border-black/10 rounded-3xl p-6 hover:shadow-xl transition">
            <p className="text-xs tracking-[0.18em] text-orange-600 font-black mb-3 uppercase">{post.category}</p>
            <h2 className="text-xl font-black leading-tight">{post.title}</h2>
            <p className="text-black/60 text-sm mt-3 leading-6">{post.excerpt}</p>
            <p className="text-xs text-black/45 mt-5">{post.readTime}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}

export async function generateMetadata({ params }: { params: { category: string } }) {
  return {
    title: `${titleCase(params.category)} Guides | HustlePath`,
    description: `Read beginner-friendly guides about ${titleCase(params.category).toLowerCase()}.`,
  };
}
