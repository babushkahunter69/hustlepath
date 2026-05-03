import Link from "next/link";
import { getCategories, toCategorySlug } from "@/lib/posts";

export default async function TopicGrid() {
  const categories = await getCategories();

  return (
    <section id="topics" className="border-y border-black/10 bg-[#fffaf2]">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="max-w-xl mb-10">
          <p className="text-xs tracking-[0.25em] text-orange-600 font-black mb-3">EXPLORE TOPICS</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">Browse by category.</h2>
          <p className="text-black/60 mt-3 leading-7">Focused guides for beginners who want practical next steps, not vague advice.</p>
        </div>

        <div className="grid md:grid-cols-4 gap-5">
          {categories.map((category) => (
            <Link key={category} href={`/category/${toCategorySlug(category)}`} className="bg-white border border-black/10 rounded-3xl p-6 hover:-translate-y-1 hover:shadow-xl transition">
              <h3 className="font-black text-xl">{category}</h3>
              <p className="text-sm text-black/60 mt-3 leading-6">See all guides about {category.toLowerCase()}.</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
