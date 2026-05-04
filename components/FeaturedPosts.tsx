import Link from "next/link";
import { getPosts } from "@/lib/posts";

export default async function FeaturedPosts() {
  const posts = await getPosts();

  return (
    <section id="latest" className="latest-section">
      <div className="section-container">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Latest Guides</p>
            <h2>Start with these.</h2>
          </div>
          <Link href="/blog" className="btn btn-light">View all posts</Link>
        </div>

        <div className="post-grid">
          {posts.slice(0, 3).map((post, index) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="post-card">
              <div className="post-card-number">0{index + 1}</div>
              <div className="post-card-body">
                <p className="post-card-category">{post.category}</p>
                <h3>{post.title}</h3>
                <p>{post.excerpt}</p>
                <span>Read guide</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
