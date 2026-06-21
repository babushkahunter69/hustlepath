create table if not exists design_library (
  id text primary key,
  title text not null,
  image_url text not null,
  product_url text,
  redbubble_url text,
  niche text,
  tags jsonb default '[]'::jsonb,
  product_type text,
  mood text,
  notes text,
  ai_keywords jsonb default '[]'::jsonb,
  ai_caption_seed text,
  ai_article_ideas jsonb default '[]'::jsonb,
  auto_tag_status text default 'pending',
  pinterest_meta jsonb default '{}'::jsonb,
  source text default 'manual',
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists design_library_status_idx on design_library(status);
create index if not exists design_library_niche_idx on design_library(niche);
create index if not exists design_library_product_type_idx on design_library(product_type);
create index if not exists design_library_mood_idx on design_library(mood);
create index if not exists design_library_tags_idx on design_library using gin(tags);
create index if not exists design_library_ai_keywords_idx on design_library using gin(ai_keywords);
