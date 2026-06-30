create table if not exists social_campaigns (
  id text primary key,
  design_id text not null,
  channel text not null,
  variant_index integer default 0,
  title text not null,
  caption text,
  hashtags jsonb default '[]'::jsonb,
  image_url text,
  generated_image_url text,
  target_url text,
  board_name text,
  keywords jsonb default '[]'::jsonb,
  carousel_ideas jsonb default '[]'::jsonb,
  status text default 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists social_campaigns_design_idx on social_campaigns(design_id);
create index if not exists social_campaigns_channel_idx on social_campaigns(channel);
create index if not exists social_campaigns_status_idx on social_campaigns(status);
create unique index if not exists social_campaigns_design_channel_variant_idx on social_campaigns(design_id, channel, variant_index);
