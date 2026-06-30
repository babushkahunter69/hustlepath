import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { ensureSocialCampaignsTable } from '@/lib/socialCampaigns';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function cleanText(value: unknown, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

function readStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => cleanText(item)).filter(Boolean);
  if (!value) return [];

  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map((item) => cleanText(item)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function csvCell(value: unknown) {
  const text = cleanText(value).replace(/"/g, '""');
  return `"${text}"`;
}

export async function GET(request: NextRequest) {
  await ensureSocialCampaignsTable();

  const ids = request.nextUrl.searchParams
    .getAll('campaign_id')
    .map((value) => cleanText(value))
    .filter(Boolean);

  if (!ids.length) {
    return new NextResponse('Select at least one campaign first.', { status: 400 });
  }

  const campaigns = await sql`
    select
      social_campaigns.*,
      design_library.title as design_title,
      design_library.niche as design_niche,
      design_library.product_type as design_product_type
    from social_campaigns
    join design_library on design_library.id = social_campaigns.design_id
    where social_campaigns.id = any(${ids}::uuid[])
    order by social_campaigns.updated_at desc nulls last, social_campaigns.created_at desc
  `;

  const header = [
    'id',
    'channel',
    'campaign_type',
    'status',
    'title',
    'caption',
    'hashtags',
    'image_url',
    'generated_image_url',
    'target_url',
    'board_name',
    'design_title',
    'design_niche',
    'design_product_type',
    'scheduled_at',
    'published_at',
  ];

  const lines = [
    header.join(','),
    ...campaigns.map((campaign: any) => [
      campaign.id,
      campaign.channel,
      campaign.campaign_type,
      campaign.status,
      campaign.title,
      campaign.caption,
      readStringArray(campaign.hashtags).join(' '),
      campaign.image_url,
      campaign.generated_image_url,
      campaign.target_url,
      campaign.board_name,
      campaign.design_title,
      campaign.design_niche,
      campaign.design_product_type,
      campaign.scheduled_at ? new Date(campaign.scheduled_at).toISOString() : '',
      campaign.published_at ? new Date(campaign.published_at).toISOString() : '',
    ].map(csvCell).join(',')),
  ];

  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="social-campaigns-export.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
