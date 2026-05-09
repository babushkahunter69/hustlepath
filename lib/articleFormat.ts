export function formatArticleMarkdown(markdown: string) {
  const source = String(markdown || '').replace(/\r\n/g, '\n').trim();
  if (!source) return source;

  return source
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^(\s*[-*]\s+)([a-z])/gm, (_, bullet, first) => `${bullet}${String(first).toUpperCase()}`)
    .replace(/^Pro tip:\s*/gim, '> **Pro tip:** ')
    .replace(/^Quick win:\s*/gim, '> **Quick win:** ')
    .replace(/^Important:\s*/gim, '> **Important:** ')
    .replace(/^Note:\s*/gim, '> **Note:** ')
    .replace(/^Example:\s*/gim, '> **Example:** ')
    .trim() + '\n';
}
