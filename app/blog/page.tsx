import Link from "next/link";
import { getPosts } from "@/lib/posts";

export const metadata = {
  title: "Blog | HustlePath",
  description: "All beginner income guides from HustlePath.",
};

export default async function BlogPage() {
  const posts = await getPosts();

  return (
    <main className="page-shell">
      <section className="section-container">
        <p className="eyebrow">All Guides</p>
        <h1 className="page-title">Blog</h1>

        <div className="post-grid">
          {posts.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="post-card flat">
              <div className="post-card-body">
                <p className="post-card-category">{post.category}</p>
                <h3>{post.title}</h3>
                <p>{post.excerpt}</p>
                <span>{post.date} · {post.readTime}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
