import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { attachPinUrls, generatePinterestPins, normalizePinterestMeta } from '@/lib/pinterest';
import { parseKeywords } from '@/lib/monetization';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function pinsAction(formData: FormData) {
  'use server';

  const intent = String(formData.get('intent') || '');
  const postId = String(formData.get('post_id') || '');

  if (!postId) redirect('/admin/pins');

  const [post] = await sql`
    select id, title, slug, excerpt, category, primary_keyword, related_keywords, pinterest_meta
    from posts
    where id = ${postId}
    limit 1
  `;

  if (!post) redirect('/admin/pins');

  if (intent === 'generate_pins') {
    const pins = await generatePinterestPins({
      title: String(post.title || ''),
      excerpt: String(post.excerpt || ''),
      category: String(post.category || ''),
      primaryKeyword: String(post.primary_keyword || ''),
      relatedKeywords: parseKeywords(post.related_keywords),
      slug: String(post.slug || ''),
      count: 8,
    });

    const meta = normalizePinterestMeta(
      post.pinterest_meta,
      attachPinUrls(String(post.id), pins)
    );

    await sql`
      update posts
      set pinterest_meta = ${JSON.stringify(meta)}::jsonb,
          updated_at = now()
      where id = ${post.id}
    `;

    redirect('/admin/pins');
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

    redirect('/admin/pins');
  }

  if (intent === 'mark_pin_draft') {
    const pinIndex = Number(formData.get('pin_index'));
    const existingMeta = post.pinterest_meta && typeof post.pinterest_meta === 'object' ? post.pinterest_meta : {};
    const existingPins = Array.isArray(existingMeta.pins) ? existingMeta.pins : [];
    const updatedPins = existingPins.map((pin: any, index: number) => (
      index === pinIndex
        ? { ...pin, status: 'draft', posted_at: undefined }
        : pin
    ));

    await sql`
      update posts
      set pinterest_meta = ${JSON.stringify({ ...existingMeta, pins: updatedPins, updated_at: new Date().toISOString() })}::jsonb,
          updated_at = now()
      where id = ${post.id}
    `;

    redirect('/admin/pins');
  }

  redirect('/admin/pins');
}

function getPins(post: any) {
  const meta = post.pinterest_meta && typeof post.pinterest_meta === 'object' ? post.pinterest_meta : {};
  return Array.isArray(meta.pins) ? meta.pins : [];
}

export default async function AdminPinsPage() {
  let posts: any[] = [];
  let error = '';

  try {
    posts = await sql`
      select id, title, slug, status, category, pinterest_meta, published_at, updated_at, created_at
      from posts
      where slug is not null
      order by published_at desc nulls last, updated_at desc nulls last, created_at desc
    `;
  } catch (err: any) {
    error = err.message || 'Unable to load Pinterest pins.';
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://hustlepathdaily.com').replace(/\/$/, '');

  const totals = posts.reduce((acc, post) => {
    const pins = getPins(post);
    acc.total += pins.length;
    acc.draft += pins.filter((pin: any) => pin.status !== 'posted').length;
    acc.posted += pins.filter((pin: any) => pin.status === 'posted').length;
    return acc;
  }, { total: 0, draft: 0, posted: 0 });

  return (
    <main className="admin-shell">
      <section className="admin-panel wide">
        <div className="admin-row">
          <div>
            <div className="admin-topline">Pinterest workflow</div>
            <h1>Pin command center</h1>
            <p className="admin-muted">
              Generate pin metadata, open pin images, copy tracked links, and mark pins as posted.
            </p>
          </div>
          <Link href="/admin" className="secondary-link small">Dashboard</Link>
        </div>

        {error && <div className="notice">Database not ready: {error}</div>}

        <div className="stat-grid three">
          <div className="stat-card"><span>{totals.total}</span><p>Total pins</p></div>
          <div className="stat-card"><span>{totals.draft}</span><p>Draft pins</p></div>
          <div className="stat-card"><span>{totals.posted}</span><p>Posted pins</p></div>
        </div>

        <div className="pin-workflow-list">
          {!error && posts.length === 0 && (
            <div className="empty-state">No posts found yet.</div>
          )}

          {posts.map((post) => {
            const pins = getPins(post);
            const draftCount = pins.filter((pin: any) => pin.status !== 'posted').length;
            const postedCount = pins.filter((pin: any) => pin.status === 'posted').length;

            return (
              <article key={post.id} className="pin-workflow-post">
                <div className="pin-workflow-post-head">
                  <div>
                    <p className="eyebrow">{post.category || post.status || 'Article'}</p>
                    <h2>{post.title || 'Untitled post'}</h2>
                    <p className="admin-muted">
                      {pins.length} pins · {draftCount} draft · {postedCount} posted
                    </p>
                  </div>

                  <div className="pin-workflow-actions">
                    <Link href={`/blog/${post.slug}`} className="secondary-link small" target="_blank">
                      View article
                    </Link>
                    <Link href={`/admin/drafts/${post.id}`} className="secondary-link small">
                      Edit article
                    </Link>
                    <form action={pinsAction}>
                      <input type="hidden" name="post_id" value={post.id} />
                      <button type="submit" name="intent" value="generate_pins" className="primary-link small">
                        {pins.length ? 'Regenerate pins' : 'Generate pins'}
                      </button>
                    </form>
                  </div>
                </div>

                {pins.length === 0 && (
                  <div className="empty-state compact-empty">
                    No pins generated yet. Use Generate pins to create 8 Pinterest-ready drafts for this article.
                  </div>
                )}

                {pins.length > 0 && (
                  <div className="pin-grid">
                    {pins.map((pin: any, index: number) => {
                      const imagePath = `/api/pinterest/pin-image-png/${post.id}/${index}`;
                      const trackedPath = pin.tracked_url || `/go/pin/${post.id}/${index}`;
                      const imageUrl = `${siteUrl}${imagePath}?v=${encodeURIComponent(String(post.updated_at || post.published_at || post.created_at || index))}`;
                      const trackedUrl = trackedPath.startsWith('http') ? trackedPath : `${siteUrl}${trackedPath}`;
                      const pinterestDescription = [pin.title, pin.description].filter(Boolean).join(' - ');
                      const pinterestUrl = `https://www.pinterest.com/pin-builder/?url=${encodeURIComponent(trackedUrl)}&media=${encodeURIComponent(imageUrl)}&description=${encodeURIComponent(pinterestDescription)}`;
                      const posted = pin.status === 'posted';

                      return (
                        <div key={`${post.id}-${index}-${pin.title}`} className={`pin-card admin-pin-card ${posted ? 'posted' : ''}`}>
                          <span>{pin.angle || 'pin'} · {posted ? 'posted' : 'draft'}</span>
                          <strong>{pin.title}</strong>
                          <p>{pin.description}</p>

                          <div className="pin-tools">
                            <a href={imagePath} target="_blank" rel="noopener noreferrer" className="btn btn-light small">
                              Open image
                            </a>
                            <a href={trackedPath} target="_blank" rel="noopener noreferrer" className="btn btn-light small">
                              Test link
                            </a>
                            <a href={pinterestUrl} target="_blank" rel="noopener noreferrer" className="btn btn-dark small">
                              Open Pinterest
                            </a>
                          </div>

                          <div className="tracked-url-box">
                            <small>Tracked URL</small>
                            <code>{trackedPath}</code>
                          </div>

                          <form action={pinsAction} className="pin-status-form">
                            <input type="hidden" name="post_id" value={post.id} />
                            <input type="hidden" name="pin_index" value={index} />
                            {posted ? (
                              <button type="submit" name="intent" value="mark_pin_draft" className="btn btn-light small">
                                Move back to draft
                              </button>
                            ) : (
                              <button type="submit" name="intent" value="mark_pin_posted" className="btn btn-dark small">
                                Mark as posted
                              </button>
                            )}
                          </form>

                          <details>
                            <summary>Image prompt</summary>
                            <p>{pin.image_prompt}</p>
                          </details>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
