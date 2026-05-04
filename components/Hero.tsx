import Link from "next/link";

export default function Hero() {
  return (
    <section className="home-hero">
      <div className="home-hero-grid">
        <div>
          <p className="eyebrow">Beginner Income Guides</p>
          <h1 className="home-hero-title">
            Daily ideas for building your first online income stream.
          </h1>
          <p className="home-hero-copy">
            Practical guides, tool breakdowns, and Pinterest-friendly income ideas for beginners who want useful steps without hype.
          </p>

          <div className="home-actions">
            <Link href="/blog" className="btn btn-dark">Read latest posts</Link>
            <Link href="/topics" className="btn btn-light">Explore topics</Link>
          </div>
        </div>

        <div className="featured-guide-card">
          <div className="featured-guide-inner">
            <p>Featured Guide</p>
            <h2>How to make your first $100 online</h2>
            <span>A simple starting plan for beginners with no audience, no product, and no complicated setup.</span>
          </div>

          <div className="topic-pills">
            <span>Side hustles</span>
            <span>Tools</span>
            <span>Pinterest</span>
          </div>
        </div>
      </div>
    </section>
  );
}
