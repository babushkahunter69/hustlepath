create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled',
  slug text unique,
  excerpt text,
  body text not null default '',
  category text default 'Beginner Guide',
  author text default 'HustlePath Editorial',
  cover_url text,
  status text default 'draft',
  seo_title text,
  seo_description text,
  primary_keyword text,
  related_keywords jsonb default '[]'::jsonb,
  quality_score int,
  risk_level text,
  review_notes text,
  workflow_meta jsonb default '{}'::jsonb,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists posts_status_idx on posts(status);
create index if not exists posts_slug_idx on posts(slug);
create index if not exists posts_updated_at_idx on posts(updated_at desc);
