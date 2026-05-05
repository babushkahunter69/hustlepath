import Link from "next/link";

export default function Header() {
  return (
    <header className="site-header">
      <nav className="site-nav">
        <Link href="/" className="logo">
          Hustle Path Daily<span>.</span>
        </Link>

        <div className="nav-links">
          <Link href="/">Home</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/topics">Topics</Link>
          <Link href="/newsletter">Newsletter</Link>
        </div>
      </nav>
    </header>
  );
}
