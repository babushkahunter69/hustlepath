import { ImageResponse } from 'next/og'
import { sql } from '../../../../../../lib/db'

export const runtime = 'edge'
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

function simplifyTitle(value: string, angle: string, articleTitle = '', index = 0) {
  const raw = cleanText(value, articleTitle || 'Make Money Online')
  const haystack = `${raw} ${articleTitle}`.toLowerCase()
  const a = angle.toLowerCase()

  if (haystack.includes('redbubble')) {
    const titles = [
      'Promote Redbubble Without Ads',
      'Stop These Redbubble Mistakes',
      'Redbubble Pinterest Checklist',
      'Pinterest SEO For Redbubble',
      'Why Redbubble Pins Get Clicks',
      'What Actually Gets Traffic',
      'Get More Redbubble Views',
      'Redbubble Traffic Starter Plan',
    ]
    if (a.includes('mistake')) return titles[1]
    if (a.includes('checklist')) return titles[2]
    if (a.includes('how-to')) return index > 5 ? titles[6] : titles[3]
    if (a.includes('curiosity')) return titles[4]
    if (a.includes('result')) return titles[5]
    return titles[index % titles.length]
  }

  if (haystack.includes('side hustle')) {
    const titles = [
      'Easy Side Hustles To Start',
      'Side Hustle Mistakes To Avoid',
      'Side Hustle Starter Checklist',
      'How To Pick A Side Hustle',
      'Most Beginners Miss This',
      'Realistic Side Hustle Results',
      'Start With No Experience',
      'Build A Simple Income Stream',
    ]
    return titles[index % titles.length]
  }

  if (a.includes('mistake')) return 'Avoid These Money Mistakes'
  if (a.includes('checklist')) return 'Your First Income Checklist'
  if (a.includes('result')) return 'What Happens When You Start'
  if (a.includes('curiosity') || haystack.includes('nobody')) return 'Nobody Tells Beginners This'
  if (haystack.includes('$100')) return 'Make Your First $100 Online'
  if (haystack.includes('first online income')) return 'Start Your First Income Stream'
  if (haystack.includes('pinterest')) return 'Pinterest Traffic For Beginners'

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

function templateForAngle(angle: string) {
  const a = angle.toLowerCase()

  if (a.includes('mistake')) {
    return {
      bg: '#fff3ef',
      accent: '#f04b18',
      badge: 'AVOID THIS',
      cta: 'READ BEFORE YOU START',
    }
  }

  if (a.includes('checklist')) {
    return {
      bg: '#f3f7ef',
      accent: '#255f3f',
      badge: 'SAVE THIS',
      cta: 'GET THE FULL CHECKLIST',
    }
  }

  if (a.includes('result')) {
    return {
      bg: '#f8f0df',
      accent: '#d99024',
      badge: 'REAL TALK',
      cta: 'SEE WHAT TO EXPECT',
    }
  }

  if (a.includes('curiosity')) {
    return {
      bg: '#eef3f8',
      accent: '#1f4f82',
      badge: 'MOST PEOPLE MISS THIS',
      cta: 'LEARN THE SIMPLE WAY',
    }
  }

  if (a.includes('how-to')) {
    return {
      bg: '#f5efe5',
      accent: '#255f3f',
      badge: 'HOW TO',
      cta: 'READ THE FULL GUIDE',
    }
  }

  return {
    bg: '#f5efe5',
    accent: '#255f3f',
    badge: 'START HERE',
    cta: 'READ THE FULL GUIDE',
  }
}

function splitHeadline(text: string) {
  const words = cleanText(text).split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const next = current ? `${current} ${word}` : word

    if (next.length > 16 && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }

    if (lines.length >= 4) break
  }

  if (current && lines.length < 4) lines.push(current)

  return lines
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

  const headline = simplifyTitle(
    cleanText(pin.title || post?.title, 'Make Money Online'),
    angle,
    cleanText(post?.title, ''),
    Number(index) || 0
  )

  const headlineLines = splitHeadline(headline)

  const fontSize =
    headlineLines.length >= 4 ? 68 : headlineLines.length === 3 ? 76 : 88

  return new ImageResponse(
    (
      <div
        style={{
          width: '1000px',
          height: '1500px',
          background: style.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Arial, Helvetica, sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 460,
            height: 460,
            borderRadius: 999,
            background: style.accent,
            opacity: 0.12,
            right: -130,
            top: 95,
          }}
        />

        <div
          style={{
            position: 'absolute',
            width: 460,
            height: 460,
            borderRadius: 999,
            background: style.accent,
            opacity: 0.08,
            left: -190,
            bottom: 95,
          }}
        />

        <div
          style={{
            width: 840,
            height: 1310,
            borderRadius: 56,
            background: '#fffaf2',
            border: '3px solid #eadfce',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
          }}
        >
          <div
            style={{
              marginTop: 90,
              fontSize: 36,
              fontWeight: 900,
              color: '#111111',
              display: 'flex',
            }}
          >
            HustlePathDaily<span style={{ color: '#f04b18' }}>.</span>
          </div>

          <div
            style={{
              marginTop: 78,
              width: 480,
              height: 72,
              borderRadius: 36,
              background: style.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: 2,
              textAlign: 'center',
            }}
          >
            {style.badge}
          </div>

          <div
            style={{
              marginTop: 48,
              width: 260,
              height: 10,
              borderRadius: 5,
              background: style.accent,
            }}
          />

          <div
            style={{
              marginTop: 120,
              width: 700,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              color: '#111111',
              fontWeight: 900,
              fontSize,
              lineHeight: 1.08,
            }}
          >
            {headlineLines.map((line, i) => (
              <div key={i} style={{ display: 'flex' }}>
                {line}
              </div>
            ))}
          </div>

          <div
            style={{
              position: 'absolute',
              bottom: 170,
              width: 650,
              height: 84,
              borderRadius: 42,
              background: '#111111',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: 3,
            }}
          >
            {style.cta}
          </div>

          <div
            style={{
              position: 'absolute',
              bottom: 78,
              color: style.accent,
              fontSize: 25,
              fontWeight: 900,
              letterSpacing: 5,
            }}
          >
            HUSTLEPATHDAILY.COM
          </div>
        </div>
      </div>
    ),
    {
      width: 1000,
      height: 1500,
    }
  )
}