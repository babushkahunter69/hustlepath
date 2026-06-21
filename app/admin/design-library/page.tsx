import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import DesignPinPreviewImage from './DesignPinPreviewImage';
import {
  attachDesignPinUrls,
  buildArticleIdeas,
  ensureDesignLibraryTable,
  generateDesignPinterestPins,
  INKWANDER_NICHES,
  normalizeDesignPinterestMeta,
  normalizeMood,
  normalizeNiche,
  normalizeProductType,
  normalizeTags,
  parseCsvRows,
  parseList,
  validateDesignImageUrl,
} from '@/lib/designLibrary';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function flashRedirect(message: string) {
  redirect(`/admin/design-library?notice=${encodeURIComponent(message)}`);
}

function cleanText(value: unknown, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

function compactText(value: unknown, maxLength = 140) {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  const words = text.split(' ');
  const output: string[] = [];

  for (const word of words) {
    const next = [...output, word].join(' ');
    if (next.length > maxLength) break;
    output.push(word);
  }

  return `${output.join(' ').replace(/[,.!?;:]$/, '')}...`;
}

function readJsonArray(value: unknown) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function pinsFor(design: any) {
  const source = design?.pinterest_meta && typeof design.pinterest_meta === 'object' ? design.pinterest_meta : {};
  return Array.isArray(source.pins) ? source.pins : [];
}

function articleIdeasFor(design: any) {
  const sourceIdeas = readJsonArray(design?.ai_article_ideas);
  if (sourceIdeas.length) return sourceIdeas.map((value) => cleanText(value)).filter(Boolean);

  const meta = design?.pinterest_meta && typeof design.pinterest_meta === 'object' ? design.pinterest_meta : {};
  const metaIdeas = Array.isArray(meta.article_ideas) ? meta.article_ideas : [];
  if (metaIdeas.length) return metaIdeas.map((value: unknown) => cleanText(value)).filter(Boolean);

  return buildArticleIdeas(design);
}

async function uploadedFileToDataUrl(file: File) {
  const contentType = cleanText(file.type).toLowerCase();
  if (!contentType.startsWith('image/')) throw new Error('Uploaded file must be an image.');
  if (!/image\/(png|jpeg|jpg|webp)/.test(contentType)) throw new Error('Only PNG, JPG, JPEG, and WebP uploads are supported.');
  if (file.size > 4_500_000) throw new Error('Uploaded design images must be 4.5MB or smaller.');

  const bytes = Buffer.from(await file.arrayBuffer());
  const normalizedType = contentType === 'image/jpg' ? 'image/jpeg' : contentType;
  return `data:${normalizedType};base64,${bytes.toString('base64')}`;
}

async function designExists(input: { imageUrl: string; productUrl: string; redbubbleUrl: string; title: string }) {
  if (input.redbubbleUrl) {
    const rows = await sql`select id from design_library where redbubble_url = ${input.redbubbleUrl} limit 1`;
    if (rows.length) return true;
  }

  if (input.productUrl) {
    const rows = await sql`select id from design_library where product_url = ${input.productUrl} limit 1`;
    if (rows.length) return true;
  }

  const rows = await sql`select id from design_library where image_url = ${input.imageUrl} and title = ${input.title} limit 1`;
  return rows.length > 0;
}

async function insertDesignRecord(input: {
  title: string;
  imageUrl: string;
  productUrl?: string;
  redbubbleUrl?: string;
  niche?: string;
  tags?: string[];
  productType?: string;
  mood?: string;
  notes?: string;
  aiKeywords?: string[];
  aiCaptionSeed?: string;
  aiArticleIdeas?: string[];
  source?: string;
}) {
  const title = cleanText(input.title);
  const imageUrl = cleanText(input.imageUrl);
  const productUrl = cleanText(input.productUrl);
  const redbubbleUrl = cleanText(input.redbubbleUrl);

  if (!title) return { inserted: false, reason: 'missing title' };

  const imageValidation = validateDesignImageUrl(imageUrl);
  if (imageValidation) return { inserted: false, reason: imageValidation };

  if (await designExists({ imageUrl, productUrl, redbubbleUrl, title })) {
    return { inserted: false, reason: 'duplicate design import' };
  }

  const record = {
    title,
    imageUrl,
    productUrl,
    redbubbleUrl,
    niche: normalizeNiche(input.niche, { title, notes: input.notes, tags: input.tags }),
    productType: normalizeProductType(input.productType, { title, notes: input.notes, tags: input.tags }),
    mood: normalizeMood(input.mood, { title, notes: input.notes, tags: input.tags, niche: input.niche }),
    tags: normalizeTags(input.tags, { title, notes: input.notes, tags: input.tags, niche: input.niche, product_type: input.productType }),
    notes: cleanText(input.notes),
    aiKeywords: normalizeTags(input.aiKeywords, { title, notes: input.notes, tags: input.tags, niche: input.niche }),
    aiCaptionSeed: cleanText(input.aiCaptionSeed),
    aiArticleIdeas: input.aiArticleIdeas?.length ? input.aiArticleIdeas : buildArticleIdeas({ title, niche: input.niche, product_type: input.productType }),
    source: cleanText(input.source, 'manual'),
  };

  await sql`
    insert into design_library (
      id,
      title,
      image_url,
      product_url,
      redbubble_url,
      niche,
      tags,
      product_type,
      mood,
      notes,
      ai_keywords,
      ai_caption_seed,
      ai_article_ideas,
      auto_tag_status,
      source,
      status
    )
    values (
      ${crypto.randomUUID()},
      ${record.title},
      ${record.imageUrl},
      ${record.productUrl || null},
      ${record.redbubbleUrl || null},
      ${record.niche},
      ${JSON.stringify(record.tags)}::jsonb,
      ${record.productType},
      ${record.mood},
      ${record.notes || null},
      ${JSON.stringify(record.aiKeywords)}::jsonb,
      ${record.aiCaptionSeed || null},
      ${JSON.stringify(record.aiArticleIdeas)}::jsonb,
      'ready',
      ${record.source},
      'active'
    )
  `;

  return { inserted: true };
}

async function createDesignAction(formData: FormData) {
  'use server';

  await ensureDesignLibraryTable();

  const title = cleanText(formData.get('title'));
  const imageUrlInput = cleanText(formData.get('image_url'));
  const productUrl = cleanText(formData.get('product_url'));
  const redbubbleUrl = cleanText(formData.get('redbubble_url'));
  const niche = cleanText(formData.get('niche'));
  const productType = cleanText(formData.get('product_type'));
  const mood = cleanText(formData.get('mood'));
  const notes = cleanText(formData.get('notes'));
  const aiCaptionSeed = cleanText(formData.get('ai_caption_seed'));
  const tags = parseList(formData.get('tags'));
  const aiKeywords = parseList(formData.get('ai_keywords'));
  const file = formData.get('image_file');

  let imageUrl = imageUrlInput;
  try {
    if (file instanceof File && file.size > 0) {
      imageUrl = await uploadedFileToDataUrl(file);
    }
  } catch (error: any) {
    flashRedirect(error?.message || 'Unable to read uploaded design image.');
  }

  const result = await insertDesignRecord({
    title,
    imageUrl,
    productUrl,
    redbubbleUrl,
    niche,
    productType,
    mood,
    notes,
    tags,
    aiKeywords,
    aiCaptionSeed,
    source: file instanceof File && file.size > 0 ? 'upload' : 'manual',
  });

  if (!result.inserted) flashRedirect(`Design import skipped: ${result.reason}`);
  flashRedirect(`Saved ${title || 'design'} to the visual design library.`);
}

async function csvDesignImportAction(formData: FormData) {
  'use server';

  await ensureDesignLibraryTable();

  let csv = String(formData.get('csv_data') || '').trim();
  const csvFile = formData.get('csv_file');

  if (!csv && csvFile instanceof File && csvFile.size > 0) {
    csv = (await csvFile.text()).trim();
  }

  const rows = parseCsvRows(csv);
  if (!rows.length) flashRedirect('Upload a CSV file or paste CSV text with title, image_url, redbubble_url, niche, and tags.');

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const title = cleanText(row.title || row.name);
    const imageUrl = cleanText(row.image_url || row.image);
    const productUrl = cleanText(row.product_url || row.url);
    const redbubbleUrl = cleanText(row.redbubble_url);
    const result = await insertDesignRecord({
      title,
      imageUrl,
      productUrl,
      redbubbleUrl,
      niche: cleanText(row.niche),
      productType: cleanText(row.product_type),
      mood: cleanText(row.mood),
      tags: parseList(row.tags),
      notes: cleanText(row.notes),
      aiKeywords: parseList(row.ai_keywords),
      aiCaptionSeed: cleanText(row.ai_caption_seed),
      source: 'csv',
    });

    if (result.inserted) inserted += 1;
    else {
      skipped += 1;
      errors.push(`${title || imageUrl || 'row'}: ${result.reason}`);
    }
  }

  const suffix = errors.length ? ` First issues: ${errors.slice(0, 3).join(' | ')}` : '';
  flashRedirect(`Design CSV import added ${inserted} library records and skipped ${skipped}.${suffix}`);
}

async function designPinsAction(formData: FormData) {
  'use server';

  await ensureDesignLibraryTable();

  const designId = cleanText(formData.get('design_id'));
  if (!designId) redirect('/admin/design-library');

  const [design] = await sql`
    select *
    from design_library
    where id = ${designId}
    limit 1
  `;

  if (!design) flashRedirect('Design not found.');

  const pins = await generateDesignPinterestPins(design, 8);
  const attachedPins = attachDesignPinUrls(design.id, pins);
  const articleIdeas = articleIdeasFor(design);

  await sql`
    update design_library
    set pinterest_meta = ${JSON.stringify(normalizeDesignPinterestMeta(design.pinterest_meta, attachedPins, articleIdeas))}::jsonb,
        ai_article_ideas = ${JSON.stringify(articleIdeas)}::jsonb,
        updated_at = now()
    where id = ${design.id}
  `;

  flashRedirect(`Generated ${attachedPins.length} Pinterest pin drafts for ${design.title}.`);
}

function tagPills(tags: string[]) {
  return tags.map((tag) => (
    <span key={tag} className="design-tag-pill">{tag}</span>
  ));
}

export default async function DesignLibraryPage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string; q?: string; niche?: string; product_type?: string; mood?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  let designs: any[] = [];
  let error = '';

  try {
    await ensureDesignLibraryTable();
    designs = await sql`
      select *
      from design_library
      where coalesce(status, 'active') = 'active'
      order by updated_at desc nulls last, created_at desc
    `;
  } catch (err: any) {
    error = err.message || 'Unable to load design library.';
  }

  const query = cleanText(params.q).toLowerCase();
  const selectedNiche = cleanText(params.niche).toLowerCase();
  const selectedProductType = cleanText(params.product_type).toLowerCase();
  const selectedMood = cleanText(params.mood).toLowerCase();

  const filteredDesigns = designs.filter((design) => {
    const niche = normalizeNiche(design.niche, design).toLowerCase();
    const productType = normalizeProductType(design.product_type, design).toLowerCase();
    const mood = normalizeMood(design.mood, design).toLowerCase();
    const haystack = [
      design.title,
      design.niche,
      design.product_type,
      design.mood,
      design.notes,
      ...(parseList(design.tags)),
      ...(parseList(design.ai_keywords)),
    ].join(' ').toLowerCase();

    if (selectedNiche && niche !== selectedNiche) return false;
    if (selectedProductType && productType !== selectedProductType) return false;
    if (selectedMood && mood !== selectedMood) return false;
    if (query && !haystack.includes(query)) return false;
    return true;
  });

  const totals = designs.reduce((acc, design) => {
    const pins = pinsFor(design);
    acc.designs += 1;
    acc.pins += pins.length;
    if (cleanText(design.image_url).startsWith('data:image/')) acc.uploaded += 1;
    return acc;
  }, { designs: 0, pins: 0, uploaded: 0 });

  const productTypes = Array.from(new Set(designs.map((design) => normalizeProductType(design.product_type, design)))).sort();
  const moods = Array.from(new Set(designs.map((design) => normalizeMood(design.mood, design)))).sort();

  return (
    <main className="admin-shell">
      <section className="admin-panel wide">
        <div className="admin-row">
          <div>
            <div className="admin-topline">Visual design workflow</div>
            <h1>Design library</h1>
            <p className="admin-muted">
              Upload or import InkWanderStudio design images directly, then generate Pinterest-ready visuals, searchable tags, captions, and future article hooks.
            </p>
          </div>
          <Link href="/admin" className="secondary-link">Back to admin</Link>
        </div>

        {error && <div className="notice">{error}</div>}
        {params.notice && <div className="notice">{params.notice}</div>}

        <div className="stat-grid three">
          <div className="stat-card"><span>{totals.designs}</span><p>Total designs</p></div>
          <div className="stat-card"><span>{totals.pins}</span><p>Generated pin drafts</p></div>
          <div className="stat-card"><span>{totals.uploaded}</span><p>Direct uploads</p></div>
        </div>

        <form method="get" className="product-form admin-section">
          <h2>Search and filter</h2>
          <p className="admin-muted">Search by title, keyword, notes, niche, mood, or product type.</p>
          <div className="design-filter-grid">
            <label className="field">
              <span>Keyword search</span>
              <input name="q" defaultValue={params.q || ''} placeholder="pancakes, coffee, introvert, sarcastic cat" />
            </label>
            <label className="field">
              <span>Niche</span>
              <select name="niche" defaultValue={params.niche || ''}>
                <option value="">All niches</option>
                {INKWANDER_NICHES.map((niche) => <option key={niche} value={niche}>{niche}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Product type</span>
              <select name="product_type" defaultValue={params.product_type || ''}>
                <option value="">All product types</option>
                {productTypes.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Mood</span>
              <select name="mood" defaultValue={params.mood || ''}>
                <option value="">All moods</option>
                {moods.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>
          <div className="editor-actions">
            <button type="submit" className="primary-link">Apply filters</button>
            <Link href="/admin/design-library" className="secondary-link">Clear filters</Link>
          </div>
        </form>

        <form action={createDesignAction} encType="multipart/form-data" className="product-form admin-section">
          <h2>Add design</h2>
          <p className="admin-muted">Upload a source image or paste an absolute image URL. Redbubble links are optional, and future AI metadata fields are ready now for later auto-tagging.</p>
          <div className="field-row">
            <label className="field">
              <span>Design title</span>
              <input name="title" placeholder="All You Need Is Pancakes" required />
            </label>
            <label className="field">
              <span>Niche</span>
              <select name="niche" defaultValue="relatable stickers">
                {INKWANDER_NICHES.map((niche) => <option key={niche} value={niche}>{niche}</option>)}
              </select>
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Upload image</span>
              <input name="image_file" type="file" accept="image/png,image/jpeg,image/webp" />
            </label>
            <label className="field">
              <span>Or image URL</span>
              <input name="image_url" placeholder="https://... or leave blank when uploading a file" />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Product URL</span>
              <input name="product_url" placeholder="Optional storefront or product landing page" />
            </label>
            <label className="field">
              <span>Redbubble URL</span>
              <input name="redbubble_url" placeholder="Optional Redbubble product page" />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Product type</span>
              <input name="product_type" placeholder="Sticker, Mug, Tee, Mouse Pad" />
            </label>
            <label className="field">
              <span>Mood</span>
              <input name="mood" placeholder="Cozy, witty, sarcastic, giftable" />
            </label>
          </div>
          <label className="field">
            <span>Tags</span>
            <input name="tags" placeholder="breakfast humor, relatable stickers, cute food art" />
          </label>
          <label className="field">
            <span>Notes</span>
            <textarea name="notes" rows={3} placeholder="Optional notes about how this design should be positioned, sold, or grouped." />
          </label>
          <div className="field-row">
            <label className="field">
              <span>AI keyword seed</span>
              <input name="ai_keywords" placeholder="adulting, introvert humor, cozy coffee" />
            </label>
            <label className="field">
              <span>AI caption seed</span>
              <input name="ai_caption_seed" placeholder="Use for future auto-tagging and caption refinement" />
            </label>
          </div>
          <button type="submit" className="primary-link">Save design</button>
        </form>

        <form action={csvDesignImportAction} encType="multipart/form-data" className="product-form admin-section">
          <h2>CSV bulk import</h2>
          <p className="admin-muted">Upload or paste CSV with <code>title</code>, <code>image_url</code>, <code>redbubble_url</code>, <code>niche</code>, and <code>tags</code>. Optional columns: <code>product_url</code>, <code>product_type</code>, <code>mood</code>, <code>notes</code>, <code>ai_keywords</code>, and <code>ai_caption_seed</code>.</p>
          <label className="field"><span>Upload CSV file</span><input name="csv_file" type="file" accept=".csv,text/csv" /></label>
          <label className="field"><span>Or paste CSV data</span><textarea name="csv_data" rows={8} placeholder={'title,image_url,redbubble_url,niche,tags\nAll You Need Is Pancakes,https://example.com/pancakes.jpg,https://www.redbubble.com/i/sticker/...,relatable stickers,"cute breakfast, sticker"'} /></label>
          <button type="submit" className="primary-link">Import CSV designs</button>
        </form>

        <div className="admin-section design-library-grid">
          <h2>Design records</h2>
          {!error && filteredDesigns.length === 0 && (
            <div className="empty-state">No designs match the current filters yet.</div>
          )}

          {filteredDesigns.map((design) => {
            const pins = pinsFor(design);
            const articleIdeas = articleIdeasFor(design);
            const tags = normalizeTags(design.tags, design);
            const aiKeywords = parseList(design.ai_keywords);
            const niche = normalizeNiche(design.niche, design);
            const productType = normalizeProductType(design.product_type, design);
            const mood = normalizeMood(design.mood, design);

            return (
              <article key={design.id} className="design-library-card">
                <div className="pin-workflow-post-head">
                  <div>
                    <p className="eyebrow">{cleanText(design.source, 'manual')} · active</p>
                    <h2>{design.title}</h2>
                    <p className="admin-muted">
                      {niche} · {productType} · {mood}
                    </p>
                  </div>

                  <div className="pin-workflow-actions">
                    {(design.product_url || design.redbubble_url) && (
                      <Link
                        href={design.product_url || design.redbubble_url}
                        className="secondary-link small"
                        target="_blank"
                      >
                        Open link
                      </Link>
                    )}
                    <form action={designPinsAction}>
                      <input type="hidden" name="design_id" value={design.id} />
                      <button type="submit" className="primary-link small">
                        {pins.length ? 'Regenerate pins' : 'Generate pins'}
                      </button>
                    </form>
                  </div>
                </div>

                <div className="design-library-layout">
                  <div className="design-library-source">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={design.image_url}
                      alt={design.title}
                      className="design-library-image"
                    />

                    <div className="tracked-url-box">
                      <small>Library source</small>
                      <code>{cleanText(design.image_url).startsWith('data:image/') ? 'Uploaded image stored inline' : cleanText(design.image_url)}</code>
                    </div>

                    <div className="design-meta-stack">
                      <div>
                        <strong>Tags</strong>
                        <div className="design-tag-row">{tagPills(tags)}</div>
                      </div>
                      <div>
                        <strong>AI-ready fields</strong>
                        <p className="admin-muted">
                          {aiKeywords.length ? aiKeywords.join(', ') : 'No AI keywords yet'} · {cleanText(design.ai_caption_seed, 'No caption seed yet')}
                        </p>
                      </div>
                      {design.notes && (
                        <div>
                          <strong>Notes</strong>
                          <p className="admin-muted">{compactText(design.notes, 220)}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="design-library-pins">
                    {pins.length === 0 ? (
                      <div className="empty-card">
                        <p>No Pinterest pin drafts yet. Generate pins to turn this uploaded design into Pinterest-ready visuals and captions.</p>
                      </div>
                    ) : (
                      <div className="pin-grid">
                        {pins.map((pin: any, index: number) => {
                          const imagePath = `/api/pinterest/design-pin-image-png/${design.id}/${index}`;
                          return (
                            <div key={`${design.id}-${index}-${pin.title}`} className="pin-card admin-pin-card">
                              <DesignPinPreviewImage
                                src={imagePath}
                                title={pin.title}
                                niche={pin.niche}
                                description={pin.description}
                              />
                              <span>{pin.angle || 'draft'} · pin</span>
                              <strong>{pin.title}</strong>
                              <p className="admin-muted">{pin.description}</p>
                              <p className="admin-muted">Keywords: {Array.isArray(pin.keyword_focus) ? pin.keyword_focus.join(', ') : ''}</p>
                              <div className="pin-tools">
                                <Link href={imagePath} className="secondary-link small" target="_blank">Open image</Link>
                                {(pin.target_url || design.product_url || design.redbubble_url) && (
                                  <Link
                                    href={pin.target_url || design.product_url || design.redbubble_url}
                                    className="secondary-link small"
                                    target="_blank"
                                  >
                                    Open product
                                  </Link>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <details className="design-article-box" open={articleIdeas.length <= 2}>
                      <summary>Article ideas and future AI hooks</summary>
                      <ul className="design-idea-list">
                        {articleIdeas.map((idea) => <li key={idea}>{idea}</li>)}
                      </ul>
                    </details>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
