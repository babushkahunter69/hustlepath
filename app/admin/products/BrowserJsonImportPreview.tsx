'use client';

import { useMemo, useState } from 'react';

const BAD_TITLES = new Set(['favorite', 'add to favorites', 'add to cart', 'cart', 'redbubble', 'inkwanderstudio']);
const PRODUCT_IMAGE_RE = /^https?:\/\/(?:ih\d?\.redbubble\.net|[^/]+\.redbubble\.net)\/.*\.(?:png|jpe?g|webp)(?:[?#].*)?$/i;

function cleanText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function splitJsonValues(input: string) {
  const chunks: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '[' || char === '{') {
      if (depth === 0) start = index;
      depth += 1;
    } else if (char === ']' || char === '}') {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        chunks.push(input.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return chunks;
}

function parseRows(json: string) {
  if (!json.trim()) return [];
  const chunks = splitJsonValues(json);
  const values = chunks.length ? chunks.map((chunk) => JSON.parse(chunk)) : [JSON.parse(json)];
  return values.flatMap((value) => Array.isArray(value) ? value : [value]).filter((row) => row && typeof row === 'object') as Record<string, unknown>[];
}

function isProductUrl(value: string) {
  try {
    const url = new URL(value);
    return /(^|\.)redbubble\.com$/i.test(url.hostname) && url.pathname.split('/').includes('i');
  } catch {
    return false;
  }
}

function rowStatus(row: Record<string, unknown>) {
  const title = cleanText(row.title);
  const productUrl = cleanText(row.product_url || row.target_url || row.url);
  const imageUrl = cleanText(row.image_url || row.image);

  if (!title || BAD_TITLES.has(title.toLowerCase())) return 'Bad title';
  if (!isProductUrl(productUrl)) return 'Bad product URL';
  if (!PRODUCT_IMAGE_RE.test(imageUrl) || /avatar|logo|icon|heart|favorite|placeholder/i.test(imageUrl)) return 'Bad image URL';
  return 'Ready';
}

export default function BrowserJsonImportPreview() {
  const [json, setJson] = useState('');

  const preview = useMemo(() => {
    try {
      const rows = parseRows(json);
      return { rows, error: '' };
    } catch {
      return { rows: [] as Record<string, unknown>[], error: json.trim() ? 'JSON could not be parsed yet.' : '' };
    }
  }, [json]);

  const readyCount = preview.rows.filter((row) => rowStatus(row) === 'Ready').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <label className="field">
        <span>Browser JSON</span>
        <textarea
          name="browser_json"
          rows={8}
          value={json}
          onChange={(event) => setJson(event.target.value)}
          placeholder={'[{\n  "title": "Financially Flexible Morally Exhausted",\n  "product_url": "https://www.redbubble.com/i/sticker/...",\n  "image_url": "https://ih1.redbubble.net/image...",\n  "product_type": "",\n  "niche": "",\n  "tags": "",\n  "source_shop": "InkWanderStudio"\n}]'}
        />
      </label>
      {preview.error && <div className="notice">{preview.error}</div>}
      {preview.rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <p className="admin-muted">Preview: {readyCount} Ready of {preview.rows.length} rows. Check this before importing.</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 8 }}>Image</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Title</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Product URL</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.slice(0, 80).map((row, index) => {
                const title = cleanText(row.title);
                const productUrl = cleanText(row.product_url || row.target_url || row.url);
                const imageUrl = cleanText(row.image_url || row.image);
                const status = rowStatus(row);
                return (
                  <tr key={`${productUrl}-${index}`} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={{ padding: 8 }}>
                      {PRODUCT_IMAGE_RE.test(imageUrl) ? <img src={imageUrl} alt="" style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 10 }} /> : <span className="admin-muted">No product image</span>}
                    </td>
                    <td style={{ padding: 8, maxWidth: 260 }}>{title || 'Missing title'}</td>
                    <td style={{ padding: 8, maxWidth: 360, overflowWrap: 'anywhere' }}>{productUrl}</td>
                    <td style={{ padding: 8, fontWeight: 800, color: status === 'Ready' ? '#166534' : '#991b1b' }}>{status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {preview.rows.length > 80 && <p className="admin-muted">Showing first 80 rows.</p>}
        </div>
      )}
    </div>
  );
}
