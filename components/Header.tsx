import Link from "next/link";

export default function Header() {
  return (
    <header className="border-b border-black/10 bg-[#f7f1e8]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-2xl font-black tracking-tight text-black">
          Hustle Path Daily<span className="text-orange-600">.</span>
        </Link>

        <nav className="flex items-center gap-8 text-sm font-semibold text-neutral-700">
          <Link href="/">Home</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/#topics">Topics</Link>
          <Link href="/#newsletter">Newsletter</Link>
          <Link href="/admin/login" className="rounded-full bg-black px-4 py-2 text-white transition hover:bg-orange-600">Admin</Link>
        </nav>
      </div>
    </header>
  );
}