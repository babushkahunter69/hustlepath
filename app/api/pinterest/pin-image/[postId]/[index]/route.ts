import { sql } from '../../../../../../lib/db'

export const dynamic = 'force-dynamic'

type PinterestPin = {
  title?: string
  description?: string
  angle?: string
  status?: 'draft' | 'posted'
}

function escapeXml(value: unknown) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function cleanText(value: unknown, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim()
}

function simplifyTitle(value: string, angle: string) {
  const raw = cleanText(value)
  const lower = raw.toLowerCase()
  const a = angle.toLowerCase()

  if (a.includes('mistake') || lower.includes('mistake')) return 'Avoid These Money Mistakes'
  if (a.includes('checklist') || lower.includes('checklist')) return 'Your First Income Checklist'
  if (a.includes('result') || lower.includes('result')) return 'What Happens When You Start'
  if (a.includes('curiosity')) return 'Nobody Tells Beginners This'
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
    .slice(0, 6)
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
  return lines
}

function getStyle(angle: string) {
  const a = angle.toLowerCase()

  if (a.includes('mistake')) {
    return { bg: '#fff3ef', accent: '#f04b18', badge: 'AVOID THIS', footer: 'READ BEFORE YOU START' }
  }

  if (a.includes('checklist')) {
    return { bg: '#f3f7ef', accent: '#255f3f', badge: 'SAVE THIS', footer: 'GET THE FULL CHECKLIST' }
  }

  if (a.includes('result')) {
    return { bg: '#f8f0df', accent: '#d99024', badge: 'REAL TALK', footer: 'SEE WHAT TO EXPECT' }
  }

  if (a.includes('curiosity')) {
    return { bg: '#eef3f8', accent: '#1f4f82', badge: 'MOST PEOPLE MISS THIS', footer: 'LEARN THE SIMPLE WAY' }
  }

  return { bg: '#f5efe5', accent: '#255f3f', badge: 'START HERE', footer: 'READ THE FULL GUIDE' }
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
  const style = getStyle(angle)

  const headline = simplifyTitle(
    cleanText(pin.title || post?.title, 'Make Money Online'),
    angle
  )

  const description = cleanText(
    pin.description,
    'Simple, realistic steps for beginners who want to start earning online.'
  )

  const headlineLines = wrapText(headline, 15, 4)
  const descLines = wrapText(description, 38, 3)

  const headlineFont = headlineLines.length >= 4 ? 76 : 88
  const headlineStartY = headlineLines.length >= 4 ? 515 : 560

  const headlineSvg = headlineLines
    .map(
      (line, i) => `
        <text x="500" y="${headlineStartY + i * (headlineFont + 10)}"
          text-anchor="middle"
          font-size="${headlineFont}"
          font-weight="900"
          fill="#111111"
          font-family="Arial, Helvetica, sans-serif">
          ${escapeXml(line)}
        </text>
      `
    )
    .join('')

  const descSvg = descLines
    .map(
      (line, i) => `
        <text x="500" y="${1045 + i * 42}"
          text-anchor="middle"
          font-size="31"
          font-weight="600"
          fill="#6b6258"
          font-family="Arial, Helvetica, sans-serif">
          ${escapeXml(line)}
        </text>
      `
    )
    .join('')

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1500" viewBox="0 0 1000 1500">
  <rect width="1000" height="1500" fill="${style.bg}"/>

  <circle cx="900" cy="220" r="230" fill="${style.accent}" opacity="0.14"/>
  <circle cx="80" cy="1320" r="260" fill="${style.accent}" opacity="0.10"/>

  <rect x="70" y="85" width="860" height="1330" rx="58" fill="#fffaf2" stroke="#eadfce" stroke-width="3"/>

  <text x="500" y="185" text-anchor="middle" font-size="36" font-weight="900" fill="#111111" font-family="Arial, Helvetica, sans-serif">
    HustlePathDaily<tspan fill="#f04b18">.</tspan>
  </text>

  <rect x="230" y="255" width="540" height="78" rx="39" fill="${style.accent}"/>
  <text x="500" y="306" text-anchor="middle" font-size="31" font-weight="900" fill="#ffffff" letter-spacing="2" font-family="Arial, Helvetica, sans-serif">
    ${escapeXml(style.badge)}
  </text>

  <rect x="360" y="390" width="280" height="12" rx="6" fill="${style.accent}"/>

  ${headlineSvg}

  <rect x="350" y="940" width="300" height="14" rx="7" fill="${style.accent}"/>

  <g>
    ${descSvg}
  </g>

  <rect x="165" y="1245" width="670" height="84" rx="42" fill="#111111"/>
  <text x="500" y="1300" text-anchor="middle" font-size="29" font-weight="900" letter-spacing="3" fill="#ffffff" font-family="Arial, Helvetica, sans-serif">
    ${escapeXml(style.footer)}
  </text>

  <text x="500" y="1408" text-anchor="middle" font-size="26" font-weight="900" letter-spacing="5" fill="${style.accent}" font-family="Arial, Helvetica, sans-serif">
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