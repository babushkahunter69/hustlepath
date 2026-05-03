import type { MetadataRoute } from "next";
import { getCategories, getPosts, toCategorySlug } from "@/lib/posts";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://example.com";
  const posts = await getPosts();
  const categories = await getCategories();

  return [
    { url: baseUrl, lastModified: new Date() },
    { url: `${baseUrl}/blog`, lastModified: new Date() },
    ...posts.map((post) => ({ url: `${baseUrl}/blog/${post.slug}`, lastModified: new Date(post.date) })),
    ...categories.map((category) => ({ url: `${baseUrl}/category/${toCategorySlug(category)}`, lastModified: new Date() })),
  ];
}
