import { sql } from '@/lib/db';
import Link from 'next/link';

export default async function Editor({ params }: { params: { id: string } }) {
  const [post] = await sql`select * from posts where id = ${params.id}`;

  if (!post) {
    return (
      <main className="admin-shell">
        <section className="admin-panel"><h1>Draft not found</h1></section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <section className="admin-panel wide">
        <div className="admin-row">
          <div>
            <div className="admin-topline">Editor</div>
            <h1>{post.title || 'Untitled draft'}</h1>
          </div>
          <Link href="/admin/drafts" className="secondary-link small">Back to queue</Link>
        </div>

        <form action={`/api/admin/save/${post.id}`} method="POST" className="editor-form">
          <label>Title<input name="title" defaultValue={post.title || ''} /></label>
          <label>Slug<input name="slug" defaultValue={post.slug || ''} /></label>
          <label>Excerpt<textarea name="excerpt" rows={3} defaultValue={post.excerpt || ''} /></label>
          <label>Body<textarea name="body" rows={18} defaultValue={post.body || ''} /></label>
          <div className="button-row">
            <button type="submit">Save draft</button>
            <button formAction={`/api/admin/publish/${post.id}`} type="submit" className="publish-button">Publish</button>
            <button formAction={`/api/admin/reject/${post.id}`} type="submit" className="danger-button">Reject</button>
          </div>
        </form>
      </section>
    </main>
  );
}
