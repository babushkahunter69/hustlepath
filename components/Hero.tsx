import Link from "next/link";

export default function Hero() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 md:py-24 grid md:grid-cols-[1.05fr_.95fr] gap-12 items-center">
      <div>
        <p className="text-xs tracking-[0.28em] text-orange-600 font-black mb-5">BEGINNER INCOME GUIDES</p>
        <h1 className="text-5xl md:text-6xl font-black leading-[0.98] tracking-tight max-w-3xl">
          Clear paths for your first online income stream.
        </h1>
        <p className="text-lg md:text-xl text-black/65 mt-6 leading-8 max-w-2xl">
          Practical guides, tool breakdowns, and Pinterest-friendly ideas for beginners who want useful steps without hype.
        </p>
        <div className="flex flex-wrap gap-4 mt-9">
          <Link href="/blog" className="bg-black text-white px-7 py-4 rounded-full font-bold hover:bg-black/80 transition">
            Read latest posts
          </Link>
          <Link href="#topics" className="border border-black/15 bg-white/50 text-black px-7 py-4 rounded-full font-bold hover:bg-white transition">
            Explore topics
          </Link>
        </div>
      </div>

      <div className="bg-white/70 border border-black/10 rounded-[2rem] p-5 shadow-2xl shadow-black/10">
        <div className="bg-[#2f5135] text-white rounded-[1.5rem] p-8 min-h-[260px] flex flex-col justify-between">
          <p className="text-xs uppercase tracking-[0.25em] text-white/55 font-bold">Featured guide</p>
          <div>
            <h2 className="text-3xl font-black leading-tight">How to make your first $100 online</h2>
            <p className="text-white/75 mt-4 leading-7">A simple starting plan for beginners with no audience, no product, and no complicated setup.</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4 text-sm font-bold text-center">
          <Link href="/category/side-hustles" className="bg-[#efe2d3] rounded-2xl py-4">Side hustles</Link>
          <Link href="/category/tools" className="bg-[#efe2d3] rounded-2xl py-4">Tools</Link>
          <Link href="/category/pinterest" className="bg-[#efe2d3] rounded-2xl py-4">Pinterest</Link>
        </div>
      </div>
    </section>
  );
}
