import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";
import readingTime from "reading-time";

const postsDirectory = path.join(process.cwd(), "content/posts");

export type Post = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  seoTitle: string;
  seoDescription: string;
  content: string;
  readTime: string;
};

function categorySlug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function getPosts(): Promise<Post[]> {
  if (!fs.existsSync(postsDirectory)) return [];

  const files = fs.readdirSync(postsDirectory).filter((file) => file.endsWith(".md"));

  const posts = await Promise.all(
    files.map(async (file) => {
      const rawSlug = file.replace(".md", "");
      const fullPath = path.join(postsDirectory, file);
      const fileContents = fs.readFileSync(fullPath, "utf8");
      const { data, content } = matter(fileContents);
      const processedContent = await remark().use(html).process(content);

      return {
        slug: String(data.slug || rawSlug),
        title: String(data.title || "Untitled"),
        excerpt: String(data.excerpt || ""),
        category: String(data.category || "Beginner Guide"),
        date: String(data.date || new Date().toISOString().slice(0, 10)),
        seoTitle: String(data.seoTitle || data.title || "HustlePath"),
        seoDescription: String(data.seoDescription || data.excerpt || "Beginner online income guide."),
        content: processedContent.toString(),
        readTime: String(data.readTime || readingTime(content).text),
      };
    })
  );

  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function getPost(slug: string) {
  const posts = await getPosts();
  return posts.find((post) => post.slug === slug);
}

export async function getCategories() {
  const posts = await getPosts();
  return Array.from(new Set(posts.map((post) => post.category)));
}

export async function getPostsByCategory(category: string) {
  const posts = await getPosts();
  return posts.filter((post) => categorySlug(post.category) === category);
}

export async function getRelatedPosts(currentSlug: string, category: string) {
  const posts = await getPosts();
  return posts.filter((post) => post.slug !== currentSlug && post.category === category).slice(0, 3);
}

export function toCategorySlug(category: string) {
  return categorySlug(category);
}
