export type SeoScore = {
  score: number;
  checks: { label: string; passed: boolean; detail: string }[];
};

function wordCount(text: string) {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#>*_\-[\]()`]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

function countMatches(text: string, pattern: RegExp) {
  return (text.match(pattern) || []).length;
}

export function scorePost(input: {
  title?: string | null;
  excerpt?: string | null;
  body?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  primaryKeyword?: string | null;
}): SeoScore {
  const title = input.title || '';
  const excerpt = input.excerpt || '';
  const body = input.body || '';
  const seoTitle = input.seoTitle || title;
  const seoDescription = input.seoDescription || excerpt;
  const primaryKeyword = (input.primaryKeyword || '').toLowerCase().trim();

  const bodyWords = wordCount(body);
  const fullText = `${title} ${excerpt} ${body}`.toLowerCase();
  const firstChunk = body.slice(0, 900).toLowerCase();

  const h2Count = countMatches(body, /^## /gm);
  const h3Count = countMatches(body, /^### /gm);
  const bulletCount = countMatches(body, /^- /gm);
  const internalLinkCount = countMatches(body, /\]\(\/blog\//g);

  const checks = [
    {
      label: 'Title length',
      passed: title.length >= 35 && title.length <= 75,
      detail: `${title.length} characters. Aim for 35 to 75.`,
    },
    {
      label: 'SEO title',
      passed: seoTitle.length >= 35 && seoTitle.length <= 75,
      detail: `${seoTitle.length} characters. Keep it clear and clickable.`,
    },
    {
      label: 'Meta description',
      passed: seoDescription.length >= 120 && seoDescription.length <= 165,
      detail: `${seoDescription.length} characters. Aim for 120 to 165.`,
    },
    {
      label: 'Article depth',
      passed: bodyWords >= 1200,
      detail: `${bodyWords} words. Aim for 1200+ for a strong guide.`,
    },
    {
      label: 'Keyword usage',
      passed:
        Boolean(primaryKeyword) &&
        fullText.includes(primaryKeyword) &&
        firstChunk.includes(primaryKeyword),
      detail: primaryKeyword
        ? `Primary keyword: ${primaryKeyword}`
        : 'Add a primary keyword.',
    },
    {
      label: 'H2 structure',
      passed: h2Count >= 5,
      detail: `${h2Count} H2 sections. Aim for at least 5.`,
    },
    {
      label: 'H3 structure',
      passed: h3Count >= 2,
      detail: `${h3Count} H3 sections. Aim for at least 2.`,
    },
    {
      label: 'Helpful bullets',
      passed: bulletCount >= 8,
      detail: `${bulletCount} bullet points. Aim for at least 8.`,
    },
    {
      label: 'FAQ section',
      passed: /## .*faq|## .*frequently asked questions/i.test(body),
      detail: 'Include a FAQ section.',
    },
    {
      label: 'Conclusion',
      passed: /## .*conclusion|## .*final thoughts|## .*next steps/i.test(body),
      detail: 'Include a conclusion or next steps section.',
    },
    {
      label: 'Internal links',
      passed: internalLinkCount >= 1,
      detail: `${internalLinkCount} internal links found.`,
    },
    {
      label: 'Callouts',
      passed: body.includes('> **Pro tip:**') && body.includes('> **Quick win:**'),
      detail: 'Include Pro tip and Quick win callouts.',
    },
  ];

  const passed = checks.filter((check) => check.passed).length;
  const score = Math.round((passed / checks.length) * 100);

  return { score, checks };
}