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
