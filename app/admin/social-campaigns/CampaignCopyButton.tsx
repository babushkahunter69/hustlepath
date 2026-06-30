'use client';

import { useState } from 'react';

type CampaignCopyButtonProps = {
  label: string;
  value: string;
};

export default function CampaignCopyButton({ label, value }: CampaignCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!value.trim()) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      className="secondary-link small"
      onClick={handleCopy}
      disabled={!value.trim()}
    >
      {copied ? 'Copied' : label}
    </button>
  );
}
