import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { attachPinUrls, generatePinterestPins, normalizePinterestMeta } from '@/lib/pinterest';
import { parseKeywords } from '@/lib/monetization';

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

    if (intent === 'generate_pins') {
      const pins = await generatePinterestPins({
        title: title || String(post.title || ''),
        excerpt: excerpt || String(post.excerpt || ''),
        category: category || String(post.category || ''),
        primaryKeyword: String(post.primary_keyword || ''),
        relatedKeywords: parseKeywords(post.related_keywords),
        slug: slug || String(post.slug || ''),
        count: 8,
      });

      const meta = normalizePinterestMeta(post.pinterest_meta, attachPinUrls(String(post.id), pins));

      await sql`
        update posts
        set pinterest_meta = ${JSON.stringify(meta)}::jsonb,
            updated_at = now()
        where id = ${post.id}
      `;

      redirect(`/admin/drafts/${post.id}`);
    }


    if (intent === 'mark_pin_posted') {
      const pinIndex = Number(formData.get('pin_index'));
      const existingMeta = post.pinterest_meta && typeof post.pinterest_meta === 'object' ? post.pinterest_meta : {};
      const existingPins = Array.isArray(existingMeta.pins) ? existingMeta.pins : [];
      const updatedPins = existingPins.map((pin: any, index: number) => (
        index === pinIndex
          ? { ...pin, status: 'posted', posted_at: new Date().toISOString() }
          : pin
      ));

      await sql`
        update posts
        set pinterest_meta = ${JSON.stringify({ ...existingMeta, pins: updatedPins, updated_at: new Date().toISOString() })}::jsonb,
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

    if (intent === 'delete') {
      await sql`
        delete from posts
        where id = ${post.id}
      `;

      redirect('/admin/drafts');
    }
  }

  const score = Number(post.quality_score || 50);
  const pinterestMeta = post.pinterest_meta && typeof post.pinterest_meta === 'object' ? post.pinterest_meta : {};
  const pins = Array.isArray(pinterestMeta.pins) ? pinterestMeta.pins : [];

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
                value="generate_pins"
                className="btn btn-orange"
              >
                Generate pins
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
                className="btn btn-light"
              >
                Reject
              </button>

              <button
                type="submit"
                name="intent"
                value="delete"
                className="btn btn-danger"
              >
                Delete
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

            <div className="pin-panel">
              <div className="pin-panel-head">
                <div>
                  <h2>Pinterest pins</h2>
                  <p>{pins.length} draft pin{pins.length === 1 ? '' : 's'} ready</p>
                </div>
              </div>

              {pins.length === 0 && (
                <p className="muted">Generate pins after the article title, excerpt, and slug look right.</p>
              )}

              {pins.map((pin: any, index: number) => (
                <div key={`${pin.title}-${index}`} className="pin-card">
                  <span>{pin.angle || 'pin'} · {pin.status || 'draft'}</span>
                  <strong>{pin.title}</strong>
                  <p>{pin.description}</p>
                  <div className="pin-tools">
                    <a href={pin.image_url || `/api/pinterest/pin-image/${post.id}/${index}`} target="_blank" rel="noopener noreferrer" className="btn btn-light small">Open pin image</a>
                    <a href={pin.tracked_url || `/go/pin/${post.id}/${index}`} target="_blank" rel="noopener noreferrer" className="btn btn-light small">Test tracked link</a>
                  </div>
                  <form action={handleEditorAction} className="pin-status-form">
                    <input type="hidden" name="pin_index" value={index} />
                    <button type="submit" name="intent" value="mark_pin_posted" className="btn btn-dark small" disabled={pin.status === 'posted'}>
                      {pin.status === 'posted' ? 'Posted' : 'Mark as posted'}
                    </button>
                  </form>
                  <details>
                    <summary>Image prompt</summary>
                    <p>{pin.image_prompt}</p>
                  </details>
                  <details>
                    <summary>Pinterest fields</summary>
                    <p><strong>Destination:</strong> {pin.tracked_url || `/go/pin/${post.id}/${index}`}</p>
                    <p><strong>Image:</strong> {pin.image_url || `/api/pinterest/pin-image/${post.id}/${index}`}</p>
                  </details>
                </div>
              ))}
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