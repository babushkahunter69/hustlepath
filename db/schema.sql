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
  pinterest_meta jsonb default '{}'::jsonb,
  cluster_id text,
  cluster_role text,
  scheduled_for timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists posts_status_idx on posts(status);
create index if not exists posts_slug_idx on posts(slug);
create index if not exists posts_published_at_idx on posts(published_at);


alter table posts add column if not exists pinterest_meta jsonb default '{}'::jsonb;
alter table posts add column if not exists cluster_id text;
alter table posts add column if not exists cluster_role text;
alter table posts add column if not exists scheduled_for timestamptz;

create index if not exists posts_cluster_id_idx on posts(cluster_id);
create index if not exists posts_scheduled_for_idx on posts(scheduled_for);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  target_url text not null,
  cta_label text default 'View product',
  keywords jsonb default '[]'::jsonb,
  status text default 'active',
  source text default 'redbubble',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists products_status_idx on products(status);
create index if not exists products_keywords_idx on products using gin(keywords);

insert into products (title, description, target_url, cta_label, keywords, source)
select
  'InkWanderStudio Redbubble Shop',
  'Print-on-demand designs for creators, side hustlers, and beginner online-income projects.',
  'https://www.redbubble.com/people/InkWanderStudio/',
  'Browse Redbubble designs',
  '["redbubble", "print on demand", "canva", "design", "digital art", "side hustle", "creator", "online income"]'::jsonb,
  'redbubble'
where not exists (
  select 1 from products where target_url = 'https://www.redbubble.com/people/InkWanderStudio/'
);
