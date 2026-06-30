function hasHeading(markdown: string, pattern: RegExp) {
  return pattern.test(markdown);
}

function firstParagraph(markdown: string) {
  return String(markdown || '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#') && !line.startsWith('>') && !line.startsWith('-')) || '';
}

function buildQuickAnswer(markdown: string) {
  const paragraph = firstParagraph(markdown);
  const answer = paragraph || 'This guide explains a practical beginner-friendly path, the risks to avoid, and the simple next steps to take before spending money.';
  return `## Quick Answer\n\n${answer}`;
}

function buildStarterPlan() {
  return `## Beginner Action Plan\n\n- Pick one clear path instead of chasing several ideas at once.\n- Set a small test goal for the next 7 days.\n- Use free or low-cost tools before paying for upgrades.\n- Track what you tried, what worked, and what you would improve next.`;
}

function buildRealityCheck() {
  return `## Reality Check\n\nThis is educational content, not a guaranteed income plan. Results depend on your skill level, consistency, niche, offer, audience, and how well you test your ideas. Start small, avoid debt, and do not spend money you cannot afford to lose.`;
}

function buildFaq(markdown: string) {
  const topic = firstParagraph(markdown).split(/[.!?]/)[0] || 'this beginner online income idea';
  return `## Frequently Asked Questions\n\n### Is ${topic.toLowerCase()} beginner-friendly?\n\nIt can be beginner-friendly when you start with a small, specific version and avoid expensive tools at the beginning.\n\n### How long should I test this before changing direction?\n\nGive one focused approach at least 7 to 14 days before judging it, unless it clearly requires money, skills, or time you do not have.\n\n### Do I need paid tools to start?\n\nUsually no. Free tools are enough for the first test. Upgrade only after you know what part of the process actually needs improvement.\n\n### What is the safest first step?\n\nThe safest first step is to create one small offer, post, product, or test project and measure whether real people respond to it.`;
}

export function formatArticleMarkdown(markdown: string) {
  let source = String(markdown || '').replace(/\r\n/g, '\n').trim();
  if (!source) return source;

  source = source
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^(\s*[-*]\s+)([a-z])/gm, (_, bullet, first) => `${bullet}${String(first).toUpperCase()}`)
    .replace(/^Pro tip:\s*/gim, '> **Pro tip:** ')
    .replace(/^Quick win:\s*/gim, '> **Quick win:** ')
    .replace(/^Important:\s*/gim, '> **Important:** ')
    .replace(/^Note:\s*/gim, '> **Note:** ')
    .replace(/^Example:\s*/gim, '> **Example:** ')
    .replace(/^Reality check:\s*/gim, '> **Reality check:** ')
    .trim();

  if (!hasHeading(source, /^##\s+Quick Answer\b/im)) {
    source = `${buildQuickAnswer(source)}\n\n${source}`;
  }

  if (!hasHeading(source, /^##\s+(Beginner Action Plan|Starter Plan|Action Plan|Next Steps)\b/im)) {
    const conclusionIndex = source.search(/^##\s+(Conclusion|Final Thoughts|Final Takeaway)\b/im);
    if (conclusionIndex >= 0) {
      source = `${source.slice(0, conclusionIndex).trim()}\n\n${buildStarterPlan()}\n\n${source.slice(conclusionIndex).trim()}`;
    } else {
      source = `${source}\n\n${buildStarterPlan()}`;
    }
  }

  if (!hasHeading(source, /^##\s+(Reality Check|Risk Check|Beginner Safety Check)\b/im)) {
    source = `${source}\n\n${buildRealityCheck()}`;
  }

  if (!hasHeading(source, /^##\s+(Frequently Asked Questions|FAQ|FAQs)\b/im)) {
    source = `${source}\n\n${buildFaq(source)}`;
  }

  return source.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
