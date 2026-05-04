import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";
import readingTime from "reading-time";
import { sql } from "@/lib/db";

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

async function renderBody(content: string) {
  if (/<[a-z][\s\S]*>/i.test(content)) return content;
  const processedContent = await remark().use(html).process(content);
  return processedContent.toString();
}

async function getFilePosts(): Promise<Post[]> {
  if (!fs.existsSync(postsDirectory)) return [];

  const files = fs.readdirSync(postsDirectory).filter((file) => file.endsWith(".md"));

  return Promise.all(
    files.map(async (file) => {
      const rawSlug = file.replace(".md", "");
      const fullPath = path.join(postsDirectory, file);
      const fileContents = fs.readFileSync(fullPath, "utf8");
      const { data, content } = matter(fileContents);

      return {
        slug: String(data.slug || rawSlug),
        title: String(data.title || "Untitled"),
        excerpt: String(data.excerpt || ""),
        category: String(data.category || "Beginner Guide"),
        date: String(data.date || new Date().toISOString().slice(0, 10)),
        seoTitle: String(data.seoTitle || data.title || "HustlePath"),
        seoDescription: String(data.seoDescription || data.excerpt || "Beginner online income guide."),
        content: await renderBody(content),
        readTime: String(data.readTime || readingTime(content).text),
      };
    })
  );
}

async function getDatabasePosts(): Promise<Post[]> {
  if (!process.env.DATABASE_URL) return [];

  try {
    const rows = await sql`
      select slug, title, excerpt, category, body, seo_title, seo_description, published_at, created_at
      from posts
      where status = 'published' and slug is not null
      order by published_at desc nulls last, created_at desc
    `;

    return Promise.all(rows.map(async (row: any) => {
      const body = String(row.body || "");
      return {
        slug: String(row.slug),
        title: String(row.title || "Untitled"),
        excerpt: String(row.excerpt || ""),
        category: String(row.category || "Beginner Guide"),
        date: String(row.published_at || row.created_at || new Date().toISOString()).slice(0, 10),
        seoTitle: String(row.seo_title || row.title || "HustlePath"),
        seoDescription: String(row.seo_description || row.excerpt || "Beginner online income guide."),
        content: await renderBody(body),
        readTime: readingTime(body).text,
      };
    }));
  } catch {
    return [];
  }
}

export async function getPosts(): Promise<Post[]> {
  const [filePosts, databasePosts] = await Promise.all([getFilePosts(), getDatabasePosts()]);
  const bySlug = new Map<string, Post>();

  for (const post of filePosts) bySlug.set(post.slug, post);
  for (const post of databasePosts) bySlug.set(post.slug, post);

  return Array.from(bySlug.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
