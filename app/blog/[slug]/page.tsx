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
    <main>
      <article className="max-w-3xl mx-auto px-6 py-20">
        <p className="text-xs tracking-widest text-orange-600 font-semibold mb-4">
          {post.category}
        </p>

        <h1 className="text-4xl md:text-5xl font-bold leading-tight text-black">
          {post.title}
        </h1>

        <p className="text-xl text-gray-600 mt-6 leading-8">{post.excerpt}</p>

        <div className="flex gap-4 text-sm text-gray-500 mt-6 border-y py-4">
          <span>{post.date}</span>
          <span>-</span>
          <span>{post.readTime}</span>
        </div>

        <div
          className="prose prose-lg max-w-none mt-10"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </article>

      {relatedPosts.length > 0 && (
        <section className="bg-[#faf7f2] border-t">
          <div className="max-w-6xl mx-auto px-6 py-16">
            <h2 className="text-3xl font-bold mb-8">Related guides</h2>

            <div className="grid md:grid-cols-3 gap-6">
              {relatedPosts.map((related) => (
                <Link
                  key={related.slug}
                  href={`/blog/${related.slug}`}
                  className="bg-white border rounded-2xl p-6 hover:shadow-lg transition"
                >
                  <p className="text-xs text-orange-600 font-semibold mb-2">
                    {related.category}
                  </p>
                  <h3 className="text-xl font-bold">{related.title}</h3>
                  <p className="text-gray-600 text-sm mt-3">{related.excerpt}</p>
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