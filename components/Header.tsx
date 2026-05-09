import Link from "next/link";

export default function Header() {
  return (
    <header className="border-b border-black/10 bg-[#f5f1e8]">
  <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">

    <a
      href="/"
      className="text-2xl font-black leading-none tracking-tight"
    >
      Hustle Path Daily<span className="text-orange-500">.</span>
    </a>

    <nav className="hidden gap-8 text-sm font-semibold md:flex">
      <a href="/">Home</a>
      <a href="/blog">Blog</a>
      <a href="/topics">Topics</a>
      <a href="/newsletter">Newsletter</a>
    </nav>

  </div>

  <div className="flex justify-center gap-6 border-t border-black/5 px-4 py-3 text-sm font-semibold md:hidden">
    <a href="/">Home</a>
    <a href="/blog">Blog</a>
    <a href="/topics">Topics</a>
    <a href="/newsletter">Newsletter</a>
  </div>
</header>
  );
}
