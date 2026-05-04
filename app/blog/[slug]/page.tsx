import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, getPosts, getRelatedPosts } from "@/lib/posts";

export async function generateStaticParams() {
  const posts = await getPosts();

  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) notFound();

  const relatedPosts = await getRelatedPosts(post.slug, post.category);

  return (
    <main className="page-shell">
      <article className="article-shell">
        <p className="eyebrow">{post.category}</p>
        <h1 className="article-title">{post.title}</h1>
        <p className="article-excerpt">{post.excerpt}</p>

        <div className="article-meta">
          <span>{post.date}</span>
          <span>{post.readTime}</span>
        </div>

        <div
          className="prose"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </article>

      {relatedPosts.length > 0 && (
        <section className="related-section">
          <div className="section-container">
            <h2>Related guides</h2>

            <div className="post-grid">
              {relatedPosts.map((related) => (
                <Link
                  key={related.slug}
                  href={`/blog/${related.slug}`}
                  className="post-card flat"
                >
                  <div className="post-card-body">
                    <p className="post-card-category">{related.category}</p>
                    <h3>{related.title}</h3>
                    <p>{related.excerpt}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) return {};

  return {
    title: post.seoTitle,
    description: post.seoDescription,
  };
}
