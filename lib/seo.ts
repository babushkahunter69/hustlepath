export type SeoScore = {
  score: number;
  checks: { label: string; passed: boolean; detail: string }[];
};

function wordCount(text: string) {
  return text.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
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

  const checks = [
    {
      label: 'Title length',
      passed: title.length >= 35 && title.length <= 70,
      detail: `${title.length} characters. Aim for 35 to 70.`,
    },
    {
      label: 'SEO title',
      passed: seoTitle.length >= 35 && seoTitle.length <= 70,
      detail: `${seoTitle.length} characters. Keep it clear and clickable.`,
    },
    {
      label: 'Meta description',
      passed: seoDescription.length >= 120 && seoDescription.length <= 160,
      detail: `${seoDescription.length} characters. Aim for 120 to 160.`,
    },
    {
      label: 'Article depth',
      passed: bodyWords >= 900,
      detail: `${bodyWords} words. Aim for 900+ for a legit guide.`,
    },
    {
      label: 'Keyword usage',
      passed: Boolean(primaryKeyword && fullText.includes(primaryKeyword)),
      detail: primaryKeyword ? `Primary keyword: ${primaryKeyword}` : 'Add a primary keyword.',
    },
    {
      label: 'Helpful structure',
      passed: /## |<h2/i.test(body) && (/\n- |<ul/i.test(body) || /step/i.test(body.toLowerCase())),
      detail: 'Use sections, steps, bullets, or examples.',
    },
  ];

  const score = Math.round((checks.filter((check) => check.passed).length / checks.length) * 100);
  return { score, checks };
}
