'use client';

import { useEffect, useState } from 'react';

type ProductPinPreviewImageProps = {
  src: string;
  title: string;
  niche?: string;
  description?: string;
};

function cleanPreviewText(value: unknown, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

function shortText(value: unknown, maxLength: number) {
  const text = cleanPreviewText(value);
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

export default function ProductPinPreviewImage({ src, title, niche, description }: ProductPinPreviewImageProps) {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [blobUrl, setBlobUrl] = useState('');
  const previewTitle = shortText(title, 58) || 'InkWanderStudio Pinterest Pin';
  const previewNiche = shortText(niche, 34) || 'Relatable sticker';
  const previewDescription = shortText(description, 120) || 'A complete Pinterest product pin preview will render from the generated image route.';

  useEffect(() => {
    let revokedUrl = '';
    const controller = new AbortController();

    setFailed(false);
    setLoading(true);
    setBlobUrl('');

    fetch(src, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const contentType = response.headers.get('content-type') || '';
        if (!response.ok || !contentType.toLowerCase().startsWith('image/')) {
          throw new Error(`preview-image-invalid:${response.status}:${contentType}`);
        }
        const blob = await response.blob();
        revokedUrl = URL.createObjectURL(blob);
        setBlobUrl(revokedUrl);
        setLoading(false);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.warn('Product pin preview image failed', { src, error: error instanceof Error ? error.message : String(error) });
        setFailed(true);
        setLoading(false);
      });

    return () => {
      controller.abort();
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [src]);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={previewTitle}
        style={{
          width: '100%',
          aspectRatio: '2 / 3',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderRadius: 8,
          border: '1px solid rgba(15, 23, 42, 0.12)',
          background: 'linear-gradient(150deg, #fff8ed 0%, #f4efe7 54%, #e9f3ef 100%)',
          padding: 18,
          color: '#17211b',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
          <strong style={{ fontSize: 12, letterSpacing: 0.5 }}>InkWanderStudio</strong>
          <span style={{ maxWidth: '58%', borderRadius: 999, background: '#dff0e9', padding: '5px 8px', fontSize: 10, fontWeight: 800, textAlign: 'right' }}>
            {previewNiche}
          </span>
        </div>

        <div style={{ minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 110, height: 110, borderRadius: 24, background: '#fffaf3', border: '4px solid #17211b', transform: 'rotate(-5deg)', boxShadow: '0 16px 24px rgba(23, 33, 27, 0.16)' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <strong style={{ fontSize: 22, lineHeight: 1.05, textTransform: 'uppercase' }}>{previewTitle}</strong>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.35 }}>{previewDescription}</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#b6422e' }}>PINTEREST PIN</span>
          <span style={{ borderRadius: 999, background: '#d94b32', color: '#fff', padding: '7px 10px', fontSize: 11, fontWeight: 900 }}>View design</span>
        </div>
      </div>
    );
  }

  if (loading || !blobUrl) {
    return (
      <div
        aria-hidden="true"
        style={{
          width: '100%',
          aspectRatio: '2 / 3',
          borderRadius: 8,
          border: '1px solid rgba(15, 23, 42, 0.1)',
          background: 'linear-gradient(145deg, #fff8ed 0%, #f5efe6 55%, #edf5ef 100%)',
        }}
      />
    );
  }

  return (
    <img
      src={blobUrl}
      alt={previewTitle}
      loading="lazy"
      onError={() => setFailed(true)}
      style={{
        width: '100%',
        aspectRatio: '2 / 3',
        objectFit: 'cover',
        borderRadius: 8,
        border: '1px solid rgba(15, 23, 42, 0.1)',
        background: '#f8fafc',
      }}
    />
  );
}
