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
    <main className="bg-[#f7f1e8]">
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-orange-600">Explore topics</p>
        <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-tight md:text-6xl">Browse guides by category.</h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-black/60">Pick the lane that fits where you are right now, from simple side hustles to tools and traffic systems.</p>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {data.map(({ category, slug, posts }) => (
            <Link key={category} href={`/category/${slug}`} className="rounded-[1.7rem] border border-black/10 bg-white p-6 transition hover:-translate-y-1 hover:shadow-xl">
              <p className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-orange-600">{posts.length} guides</p>
              <h2 className="text-2xl font-black tracking-tight">{category}</h2>
              <p className="mt-3 text-sm leading-6 text-black/60">See practical articles about {category.toLowerCase()}.</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
