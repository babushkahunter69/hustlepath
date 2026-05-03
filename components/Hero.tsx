import Link from "next/link";

export default function Hero() {
  return (
    <section className="border-b border-black/10 bg-[#f7f1e8]">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 md:grid-cols-2">
        
        <div>
          <p className="mb-6 text-xs font-bold uppercase tracking-[0.35em] text-orange-600">
            Beginner Income Guides
          </p>

          <h1 className="max-w-2xl text-5xl font-black leading-[0.95] tracking-tight text-black md:text-6xl">
            Daily ideas for building your first online income stream.
          </h1>

          <p className="mt-8 max-w-xl text-lg leading-8 text-neutral-600">
            Practical guides, tool breakdowns, and Pinterest-friendly income ideas for beginners who want useful steps without hype.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/blog"
              style={{ color: "#ffffff" }}
              className="inline-flex items-center justify-center rounded-full bg-black px-8 py-4 text-sm font-semibold hover:bg-neutral-800"
            >
              Read latest posts
            </Link>

            <Link
              href="/#topics"
              className="inline-flex items-center justify-center rounded-full border border-black/20 bg-white px-8 py-4 text-sm font-semibold text-black hover:bg-neutral-100"
            >
              Explore topics
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="rounded-2xl bg-[#2f5d3a] p-6 text-white">
            <p className="text-xs uppercase tracking-widest text-white/70">
              Featured Guide
            </p>

            <h3 className="mt-4 text-2xl font-bold">
              How to make your first $100 online
            </h3>

            <p className="mt-4 text-white/80">
              A simple starting plan for beginners with no audience, no product, and no complicated setup.
            </p>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <span className="rounded-xl bg-[#efe1ce] px-4 py-3 text-center text-sm font-semibold text-black">
              Side hustles
            </span>
            <span className="rounded-xl bg-[#efe1ce] px-4 py-3 text-center text-sm font-semibold text-black">
              Tools
            </span>
            <span className="rounded-xl bg-[#efe1ce] px-4 py-3 text-center text-sm font-semibold text-black">
              Pinterest
            </span>
          </div>
        </div>

      </div>
    </section>
  );
}