import Link from "next/link";

export default function Header() {
  return (
    <header className="border-b border-black/10 bg-[#f8f3ea]/95 sticky top-0 z-20 backdrop-blur">
      <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/" className="text-2xl font-black tracking-tight">
          HustlePath<span className="text-orange-600">.</span>
        </Link>
        <nav className="hidden sm:flex items-center gap-8 text-sm font-semibold text-black/70">
          <Link href="/">Home</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/#topics">Topics</Link>
          <Link href="/#newsletter">Newsletter</Link>
        </nav>
      </div>
    </header>
  );
}
