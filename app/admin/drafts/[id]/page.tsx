import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';

export default async function DraftEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [post] = await sql`
    select *
    from posts
    where id = ${id}
    limit 1
  `;

  if (!post) {
    return (
      <main className="admin-page">
        <section className="admin-card">
          <p className="eyebrow">Article editor</p>
          <h1>Draft not found</h1>
          <p className="muted">ID: {id}</p>
          <Link href="/admin/drafts" className="btn btn-dark">
            Back to queue
          </Link>
        </section>
      </main>
    );
  }

  async function handleEditorAction(formData: FormData) {
    'use server';

    const intent = String(formData.get('intent') || 'save');

    const title = String(formData.get('title') || '');
    const slug = String(formData.get('slug') || '');
    const category = String(formData.get('category') || '');
    const excerpt = String(formData.get('excerpt') || '');
    const body = String(formData.get('body') || '');
    const seoTitle = String(formData.get('seo_title') || '');
    const seoDescription = String(formData.get('seo_description') || '');

    if (intent === 'save') {
      await sql`
        update posts
        set
          title = ${title},
          slug = ${slug},
          category = ${category},
          excerpt = ${excerpt},
          body = ${body},
          seo_title = ${seoTitle},
          seo_description = ${seoDescription},
          updated_at = now()
        where id = ${post.id}
      `;

      redirect(`/admin/drafts/${post.id}`);
    }

    if (intent === 'approve') {
      await sql`
        update posts
        set status = 'approved', updated_at = now()
        where id = ${post.id}
      `;

      redirect(`/admin/drafts/${post.id}`);
    }

    if (intent === 'publish') {
      await sql`
        update posts
        set status = 'published', published_at = now(), updated_at = now()
        where id = ${post.id}
      `;

      redirect('/admin');
    }

    if (intent === 'reject') {
      await sql`
        update posts
        set status = 'rejected', updated_at = now()
        where id = ${post.id}
      `;

      redirect('/admin/drafts');
    }
  }

  const score = Number(post.quality_score || 50);

  return (
    <main className="admin-page">
      <section className="editor-card">
        <div className="editor-top">
          <div>
            <p className="eyebrow">Article editor</p>
            <h1>{post.title}</h1>
            <p className="muted">
              Status: {post.status || 'draft'} · SEO score: {score}/100
            </p>
          </div>

          <Link href="/admin/drafts" className="btn btn-light">
            Back to queue
          </Link>
        </div>

        <div className="editor-layout">
          <form action={handleEditorAction} className="editor-form">
            <label className="field">
              <span>Title</span>
              <input name="title" defaultValue={post.title || ''} />
            </label>

            <div className="field-row">
              <label className="field">
                <span>Slug</span>
                <input name="slug" defaultValue={post.slug || ''} />
              </label>

              <label className="field">
                <span>Category</span>
                <input name="category" defaultValue={post.category || ''} />
              </label>
            </div>

            <label className="field">
              <span>Excerpt</span>
              <textarea
                name="excerpt"
                rows={4}
                defaultValue={post.excerpt || ''}
              />
            </label>

            <label className="field">
              <span>SEO title</span>
              <input name="seo_title" defaultValue={post.seo_title || ''} />
            </label>

            <label className="field">
              <span>SEO description</span>
              <textarea
                name="seo_description"
                rows={3}
                defaultValue={post.seo_description || ''}
              />
            </label>

            <label className="field">
              <span>Article body</span>
              <textarea
                name="body"
                rows={26}
                defaultValue={post.body || ''}
                className="body-textarea"
              />
            </label>

            <div className="editor-actions">
              <button
                type="submit"
                name="intent"
                value="save"
                className="btn btn-dark"
              >
                Save and score
              </button>

              <button
                type="submit"
                name="intent"
                value="approve"
                className="btn btn-light"
              >
                Approve
              </button>

              <button
                type="submit"
                name="intent"
                value="publish"
                className="btn btn-dark"
              >
                Publish now
              </button>

              <button
                type="submit"
                name="intent"
                value="reject"
                className="btn btn-danger"
              >
                Reject
              </button>
            </div>
          </form>

          <aside className="seo-sidebar">
            <form
              action={`/api/admin/polish/${post.id}`}
              method="POST"
              className="polish-form"
            >
              <button type="submit" className="btn btn-orange full-width">
                Polish with AI
              </button>
            </form>

            <div className="score-card">
              <div className="score-circle">{score}</div>
              <h2>{score >= 85 ? 'Ready to publish' : 'Needs polish'}</h2>
              <p>
                Use Polish with AI to improve formatting, SEO, bullets,
                callouts, pro tips, and internal links.
              </p>
            </div>

            <div className="checklist">
              <div className={post.title?.length >= 35 ? 'check good' : 'check warn'}>
                <strong>Title length</strong>
                <span>{post.title?.length || 0} characters. Aim for 35 to 70.</span>
              </div>

              <div className={post.seo_title ? 'check good' : 'check warn'}>
                <strong>SEO title</strong>
                <span>Add a clear clickable search title.</span>
              </div>

              <div className={post.seo_description ? 'check good' : 'check warn'}>
                <strong>Meta description</strong>
                <span>Add a short summary for search results.</span>
              </div>

              <div className={String(post.body || '').includes('[') ? 'check good' : 'check warn'}>
                <strong>Internal links</strong>
                <span>Link to related articles where useful.</span>
              </div>

              <div className={String(post.body || '').includes('Pro tip') ? 'check good' : 'check warn'}>
                <strong>Callouts and pro tips</strong>
                <span>Add helpful highlights for skimming.</span>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}