import Link from "next/link";
import { getPosts } from "@/lib/posts";

export default async function FeaturedPosts() {
  const posts = await getPosts();

  return (
    <section id="latest" className="bg-[#f8f3ea]">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex items-end justify-between gap-6 mb-10">
          <div>
            <p className="text-xs tracking-[0.25em] text-orange-600 font-black mb-3">LATEST GUIDES</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">Start with these.</h2>
          </div>
          <Link href="/blog" className="hidden md:inline-flex text-sm font-bold border border-black/15 rounded-full px-5 py-3 hover:bg-white transition">View all posts</Link>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {posts.slice(0, 3).map((post, index) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="group border border-black/10 rounded-[1.7rem] overflow-hidden hover:shadow-xl transition bg-white">
              <div className="h-44 bg-[#efe2d3] p-6 flex items-end">
                <div className="text-6xl font-black text-black/10">0{index + 1}</div>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between text-xs text-black/45 mb-4">
                  <span className="uppercase tracking-[0.18em] font-black text-orange-600">{post.category}</span>
                  <span>{post.readTime}</span>
                </div>
                <h3 className="text-xl font-black leading-tight group-hover:text-orange-600 transition">{post.title}</h3>
                <p className="text-black/60 text-sm leading-6 mt-3">{post.excerpt}</p>
                <span className="inline-flex mt-6 text-sm font-black">Read guide -</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
