import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import { injectMonetizationBlocks, parseKeywords, scoreProductMatch, type Product } from '@/lib/monetization';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function escapeHtml(value: string) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function splitMarkdownTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function escapeTableCell(value: string) {
  return escapeHtml(value)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

function convertMarkdownTables(markdown: string) {
  const tablePattern = /((?:^\s*\|.*\|\s*$\n?){2,})/gm;

  return String(markdown || '').replace(tablePattern, (tableBlock) => {
    const lines = tableBlock
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) return tableBlock;

    const separatorCells = splitMarkdownTableRow(lines[1]);
    const isSeparator = separatorCells.every((cell) => /^:?-{3,}:?$/.test(cell));

    if (!isSeparator) return tableBlock;

    const header = splitMarkdownTableRow(lines[0]);
    const rows = lines.slice(2).map(splitMarkdownTableRow);

    return `
<table>
  <thead>
    <tr>${header.map((cell) => `<th>${escapeTableCell(cell)}</th>`).join('')}</tr>
  </thead>
  <tbody>
    ${rows
      .map((row) => `<tr>${row.map((cell) => `<td>${escapeTableCell(cell)}</td>`).join('')}</tr>`)
      .join('')}
  </tbody>
</table>
`;
  });
}

function markdownToHtml(markdown: string, validSlugs: Set<string>) {
  const tableTokens: string[] = [];

  const withTablesProtected = convertMarkdownTables(markdown || '').replace(
    /<table>[\s\S]*?<\/table>/g,
    (tableHtml) => {
      const token = `@@TABLE_${tableTokens.length}@@`;
      tableTokens.push(tableHtml);
      return token;
    }
  );

  let html = escapeHtml(withTablesProtected);

  html = html
    .replace(/\[([^\]]+)\]\(#\)/g, '$1')
    .replace(/\[([^\]]+)\]\((\/blog\/([^)]+))\)/g, (_match, label, url, slug) => {
      return validSlugs.has(slug) ? `<a href="${url}">${label}</a>` : String(label);
    })

    // Headings, supports # through ######
    .replace(/^\s{0,3}######\s+(.*)$/gm, '<h6>$1</h6>')
    .replace(/^\s{0,3}#####\s+(.*)$/gm, '<h5>$1</h5>')
    .replace(/^\s{0,3}####\s+(.*)$/gm, '<h4>$1</h4>')
    .replace(/^\s{0,3}###\s+(.*)$/gm, '<h3>$1</h3>')
    .replace(/^\s{0,3}##\s+(.*)$/gm, '<h2>$1</h2>')
    .replace(/^\s{0,3}#\s+(.*)$/gm, '<h1>$1</h1>')

    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

    // Blockquotes after HTML escaping
    .replace(/^\s{0,3}&gt;\s?(.*)$/gm, '<blockquote>$1</blockquote>')

    // Horizontal rules
    .replace(/^\s{0,3}-{3,}\s*$/gm, '')

    // Lists
    .replace(/^\s{0,3}-\s+(.*)$/gm, '<li>$1</li>');

  html = html.replace(/(?:<li>[\s\S]*?<\/li>\s*)+/g, (match) => {
    const items = match.replace(/\n+/g, '');
    return `<ul>${items}</ul>`;
  });

  html = html.replace(/@@TABLE_(\d+)@@/g, (_match, index) => tableTokens[Number(index)] || '');

  return html
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();

      if (!trimmed) return '';

      if (
        trimmed.startsWith('<h1') ||
        trimmed.startsWith('<h2') ||
        trimmed.startsWith('<h3') ||
        trimmed.startsWith('<h4') ||
        trimmed.startsWith('<h5') ||
        trimmed.startsWith('<h6') ||
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<blockquote') ||
        trimmed.startsWith('<table') ||
        trimmed.startsWith('<hr')
      ) {
        return trimmed;
      }

      return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`;
    })
    .join('\n');
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const rows = await sql`
    select id, title, slug, excerpt, body, category, published_at, created_at, primary_keyword, related_keywords
    from posts
    where slug = ${slug}
      and status = 'published'
      and body is not null
      and length(body) > 300
    limit 1
  `;

  const post = rows[0];
  if (!post) notFound();

  const validRows = await sql`
    select slug
    from posts
    where status = 'published'
      and slug is not null
      and body is not null
      and length(body) > 300
  `;

  const validSlugs = new Set((validRows as any[]).map((row) => String(row.slug)));

  const relatedPosts = await sql`
    select title, slug, excerpt, category
    from posts
    where status = 'published'
      and slug is not null
      and slug != ${post.slug}
      and body is not null
      and length(body) > 300
    order by published_at desc nulls last, created_at desc
    limit 3
  `;

  let matchedProduct: Product | null = null;

  try {
    const products = await sql`
      select id, title, description, image_url, target_url, cta_label, keywords, status
      from products
      where status = 'active'
      order by updated_at desc nulls last, created_at desc
      limit 25
    `;

    const relatedKeywords = parseKeywords(post.related_keywords);
    const postText = [
      post.title,
      post.excerpt,
      post.category,
      post.primary_keyword,
      relatedKeywords.join(' '),
      String(post.body || '').slice(0, 2500),
    ].join(' ');

    matchedProduct = (products as Product[])
      .map((product) => ({ product, score: scoreProductMatch(product, postText) }))
      .sort((a, b) => b.score - a.score)[0]?.product || null;
  } catch {
    matchedProduct = null;
  }

  const articleHtml = injectMonetizationBlocks(
    markdownToHtml(String(post.body || ''), validSlugs),
    matchedProduct
  );

  const publishedDate = post.published_at || post.created_at;
  const formattedDate = publishedDate
    ? new Date(publishedDate).toISOString().slice(0, 10)
    : '';

  return (
    <main className="page-shell">
      <article className="article-shell">
        <p className="eyebrow">{post.category || 'Guide'}</p>

        <h1 className="article-title">{post.title}</h1>

        {post.excerpt && <p className="article-excerpt">{post.excerpt}</p>}

        {formattedDate && (
          <div className="article-meta">
            <span>{formattedDate}</span>
          </div>
        )}

        <div
          className="article-content"
          dangerouslySetInnerHTML={{
            __html: articleHtml,
          }}
        />

        {(relatedPosts as any[]).length > 0 && (
          <section style={{ marginTop: '56px' }}>
            <p className="eyebrow" style={{ marginBottom: '14px' }}>
              Keep Reading
            </p>

            <h2
              style={{
                fontSize: '36px',
                lineHeight: '1',
                fontWeight: 900,
                marginBottom: '24px',
              }}
            >
              Related Articles
            </h2>

            <div style={{ display: 'grid', gap: '16px' }}>
              {(relatedPosts as any[]).map((related) => (
                <Link
                  key={related.slug}
                  href={`/blog/${related.slug}`}
                  style={{
                    display: 'block',
                    border: '1px solid #ddd2c4',
                    borderRadius: '20px',
                    padding: '22px 24px',
                    background: '#fff',
                    textDecoration: 'none',
                    color: '#111',
                  }}
                >
                  <p
                    style={{
                      color: '#f04a00',
                      fontSize: '11px',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '0.18em',
                      marginBottom: '10px',
                    }}
                  >
                    {related.category || 'Guide'}
                  </p>

                  <h3
                    style={{
                      fontSize: '22px',
                      lineHeight: '1.1',
                      fontWeight: 900,
                      marginBottom: '10px',
                    }}
                  >
                    {related.title}
                  </h3>

                  {related.excerpt && (
                    <p style={{ color: '#6f675e', lineHeight: '1.55', margin: 0 }}>
                      {related.excerpt}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </main>
  );
}