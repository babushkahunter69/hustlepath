import { sql } from '../../../../../../lib/db'

export const dynamic = 'force-dynamic'

type PinterestPin = {
  title?: string
  description?: string
  angle?: string
  status?: 'draft' | 'posted'
}

function cleanText(value: unknown, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim()
}

function escapeXml(value: unknown) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function simplifyTitle(value: string, angle: string) {
  const raw = cleanText(value, 'Make Money Online')
  const lower = raw.toLowerCase()
  const a = angle.toLowerCase()

  if (a.includes('mistake') || lower.includes('mistake')) return 'Avoid These Money Mistakes'
  if (a.includes('checklist') || lower.includes('checklist')) return 'Your First Income Checklist'
  if (a.includes('result') || lower.includes('result')) return 'What Happens When You Start'
  if (a.includes('curiosity') || lower.includes('nobody')) return 'Nobody Tells Beginners This'
  if (lower.includes('$100')) return 'Make Your First $100 Online'
  if (lower.includes('first online income')) return 'Start Your First Income Stream'
  if (lower.includes('redbubble')) return 'Promote Redbubble Without Ads'
  if (lower.includes('pinterest')) return 'Pinterest Traffic for Beginners'

  const cleaned = raw
    .replace(/:.*$/, '')
    .replace(/\bA Beginner[’']s Step-by-Step Guide\b/gi, '')
    .replace(/\bStep-by-Step Guide\b/gi, '')
    .replace(/\bBeginner[’']s Guide\b/gi, '')
    .replace(/\bOnline Income Journey\b/gi, 'Online Income')
    .replace(/\bMethods That Actually\b/gi, 'Methods That Work')
    .trim()
    .split(/\s+/)
    .slice(0, 7)
    .join(' ')

  return cleaned || 'Make Money Online'
}

function wrapText(text: string, maxChars = 16, maxLines = 4) {
  const words = cleanText(text).split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const next = current ? `${current} ${word}` : word

    if (next.length > maxChars && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }

    if (lines.length >= maxLines) break
  }

  if (current && lines.length < maxLines) lines.push(current)
  return lines.slice(0, maxLines)
}

function templateForAngle(angle: string) {
  const a = angle.toLowerCase()

  if (a.includes('mistake')) {
    return { bg: '#fff3ef', accent: '#f04b18', badge: 'AVOID THIS', cta: 'READ BEFORE YOU START' }
  }

  if (a.includes('checklist')) {
    return { bg: '#f3f7ef', accent: '#255f3f', badge: 'SAVE THIS', cta: 'GET THE FULL CHECKLIST' }
  }

  if (a.includes('result')) {
    return { bg: '#f8f0df', accent: '#d99024', badge: 'REAL TALK', cta: 'SEE WHAT TO EXPECT' }
  }

  if (a.includes('curiosity')) {
    return { bg: '#eef3f8', accent: '#1f4f82', badge: 'MOST PEOPLE MISS THIS', cta: 'LEARN THE SIMPLE WAY' }
  }

  if (a.includes('how-to')) {
    return { bg: '#f5efe5', accent: '#255f3f', badge: 'HOW TO', cta: 'READ THE FULL GUIDE' }
  }

  return { bg: '#f5efe5', accent: '#255f3f', badge: 'START HERE', cta: 'READ THE FULL GUIDE' }
}

function buildTextSvg(lines: string[], startY: number, fontSize: number, gap: number) {
  return lines
    .map(
      (line, i) => `
        <text
          x="500"
          y="${startY + i * (fontSize + gap)}"
          text-anchor="middle"
          font-size="${fontSize}"
          font-weight="900"
          fill="#111111"
          font-family="Arial, Helvetica, sans-serif"
        >${escapeXml(line)}</text>
      `
    )
    .join('')
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ postId: string; index: string }> }
) {
  const { postId, index } = await context.params

  const [post] = await sql`
    select title, category, pinterest_meta
    from posts
    where id = ${postId}
    limit 1
  `

  const pins: PinterestPin[] = Array.isArray(post?.pinterest_meta?.pins)
    ? post.pinterest_meta.pins
    : []

  const pin = pins[Number(index)] || {}
  const angle = cleanText(pin.angle || post?.category, 'beginner')
  const style = templateForAngle(angle)
  const headline = simplifyTitle(cleanText(pin.title || post?.title, 'Make Money Online'), angle)
  const headlineLines = wrapText(headline, 16, 4)

  const headlineFont = headlineLines.length >= 4 ? 72 : headlineLines.length === 3 ? 80 : 90
  const headlineStartY = headlineLines.length >= 4 ? 545 : headlineLines.length === 3 ? 585 : 640
  const headlineSvg = buildTextSvg(headlineLines, headlineStartY, headlineFont, 12)

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1500" viewBox="0 0 1000 1500">
  <rect width="1000" height="1500" fill="${style.bg}"/>

  <circle cx="900" cy="220" r="230" fill="${style.accent}" opacity="0.14"/>
  <circle cx="80" cy="1320" r="260" fill="${style.accent}" opacity="0.10"/>

  <rect x="80" y="95" width="840" height="1310" rx="56" fill="#fffaf2" stroke="#eadfce" stroke-width="3"/>

  <text x="500" y="190" text-anchor="middle" font-size="36" font-weight="900" fill="#111111" font-family="Arial, Helvetica, sans-serif">
    HustlePathDaily<tspan fill="#f04b18">.</tspan>
  </text>

  <rect x="260" y="270" width="480" height="72" rx="36" fill="${style.accent}"/>
  <text x="500" y="317" text-anchor="middle" font-size="29" font-weight="900" fill="#ffffff" letter-spacing="2" font-family="Arial, Helvetica, sans-serif">
    ${escapeXml(style.badge)}
  </text>

  <rect x="370" y="390" width="260" height="10" rx="5" fill="${style.accent}"/>

  ${headlineSvg}

  <rect x="350" y="985" width="300" height="14" rx="7" fill="${style.accent}"/>

  <rect x="175" y="1125" width="650" height="88" rx="44" fill="#111111"/>
  <text x="500" y="1181" text-anchor="middle" font-size="28" font-weight="900" letter-spacing="3" fill="#ffffff" font-family="Arial, Helvetica, sans-serif">
    ${escapeXml(style.cta)}
  </text>

  <text x="500" y="1362" text-anchor="middle" font-size="25" font-weight="900" letter-spacing="5" fill="${style.accent}" font-family="Arial, Helvetica, sans-serif">
    HUSTLEPATHDAILY.COM
  </text>
</svg>`.trim()

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
