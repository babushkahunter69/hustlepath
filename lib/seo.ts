export type SeoScore = {
  score: number;
  checks: { label: string; passed: boolean; detail: string; points: number }[];
};

function wordCount(text: string) {
  return text.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
}

function countMatches(text: string, pattern: RegExp) {
  return (text.match(pattern) || []).length;
}

function includesKeyword(text: string, keyword: string) {
  return Boolean(keyword && text.toLowerCase().includes(keyword.toLowerCase()));
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
  const h2Count = countMatches(body, /^##\s+/gm);
  const h3Count = countMatches(body, /^###\s+/gm);
  const bulletCount = countMatches(body, /^[-*]\s+/gm);
  const hasNumberedList = /^\d+\.\s+/gm.test(body);
  const internalLinkCount = countMatches(body, /\[[^\]]+\]\(\/blog\//g);
  const hasFaq = /##\s+faq|frequently asked questions/i.test(body);

  const checks = [
    {
      label: 'Title length',
      passed: title.length >= 35 && title.length <= 70,
      detail: `${title.length} characters. Aim for 35 to 70.`,
      points: 10,
    },
    {
      label: 'SEO title',
      passed: seoTitle.length >= 35 && seoTitle.length <= 70,
      detail: `${seoTitle.length} characters. Keep it clear and clickable.`,
      points: 10,
    },
    {
      label: 'Meta description',
      passed: seoDescription.length >= 120 && seoDescription.length <= 160,
      detail: `${seoDescription.length} characters. Aim for 120 to 160.`,
      points: 10,
    },
    {
      label: 'Excerpt',
      passed: excerpt.length >= 120 && excerpt.length <= 240,
      detail: `${excerpt.length} characters. Aim for 120 to 240.`,
      points: 5,
    },
    {
      label: 'Article depth',
      passed: bodyWords >= 1200,
      detail: `${bodyWords} words. Aim for 1200+ for a legit guide.`,
      points: 15,
    },
    {
      label: 'Keyword usage',
      passed:
        Boolean(primaryKeyword) &&
        includesKeyword(title, primaryKeyword) &&
        includesKeyword(body.slice(0, 700), primaryKeyword) &&
        includesKeyword(body, primaryKeyword),
      detail: primaryKeyword ? `Primary keyword: ${primaryKeyword}` : 'Add a primary keyword.',
      points: 15,
    },
    {
      label: 'Heading structure',
      passed: h2Count >= 5 && h2Count <= 9 && h3Count >= 2,
      detail: `${h2Count} H2 sections and ${h3Count} H3 sections.`,
      points: 10,
    },
    {
      label: 'Helpful formatting',
      passed: bulletCount >= 8 && hasNumberedList,
      detail: `${bulletCount} bullets. Numbered list: ${hasNumberedList ? 'yes' : 'no'}.`,
      points: 10,
    },
    {
      label: 'Internal links',
      passed: internalLinkCount >= 2,
      detail: `${internalLinkCount} internal links. Aim for 2 to 4.`,
      points: 10,
    },
    {
      label: 'Trust and skimmability',
      passed: /Pro tip/i.test(body) && /Quick win/i.test(body) && hasFaq,
      detail: `Pro tip, Quick win, and FAQ present: ${/Pro tip/i.test(body) && /Quick win/i.test(body) && hasFaq ? 'yes' : 'no'}.`,
      points: 5,
    },
  ];

  const score = checks.reduce((total, check) => total + (check.passed ? check.points : 0), 0);
  return { score, checks };
}
