import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, getPosts, getRelatedPosts } from "@/lib/posts";

export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);

  if (!post) notFound();

  const relatedPosts = await getRelatedPosts(post.slug, post.category);

  return (
    <main>
      <article className="max-w-3xl mx-auto px-6 py-20">
        <p className="text-xs tracking-[0.25em] text-orange-600 font-black mb-4 uppercase">{post.category}</p>
        <h1 className="text-4xl md:text-5xl font-black leading-tight tracking-tight">{post.title}</h1>
        <p className="text-xl text-black/60 mt-6 leading-8">{post.excerpt}</p>
        <div className="flex gap-4 text-sm text-black/45 mt-7 border-y border-black/10 py-4">
          <span>{post.date}</span>
          <span>-</span>
          <span>{post.readTime}</span>
        </div>
        <div className="prose max-w-none mt-10" dangerouslySetInnerHTML={{ __html: post.content }} />
      </article>

      {relatedPosts.length > 0 && (
        <section className="bg-[#fffaf2] border-t border-black/10">
          <div className="max-w-6xl mx-auto px-6 py-16">
            <h2 className="text-3xl font-black mb-8">Related guides</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {relatedPosts.map((related) => (
                <Link key={related.slug} href={`/blog/${related.slug}`} className="bg-white border border-black/10 rounded-3xl p-6 hover:shadow-xl transition">
                  <p className="text-xs text-orange-600 font-black mb-2 uppercase tracking-[0.18em]">{related.category}</p>
                  <h3 className="text-xl font-black">{related.title}</h3>
                  <p className="text-black/60 text-sm mt-3 leading-6">{related.excerpt}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  if (!post) return {};

  return {
    title: post.seoTitle,
    description: post.seoDescription,
    openGraph: {
      title: post.seoTitle,
      description: post.seoDescription,
      type: "article",
    },
  };
}
