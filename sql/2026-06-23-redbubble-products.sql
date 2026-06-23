create table if not exists redbubble_products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  redbubble_url text not null,
  image_url text,
  product_type text,
  niche text,
  tags jsonb default '[]'::jsonb,
  status text default 'ready',
  source text default 'google-sheets',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists redbubble_products_url_idx on redbubble_products(redbubble_url);
create index if not exists redbubble_products_status_idx on redbubble_products(status);
create index if not exists redbubble_products_product_type_idx on redbubble_products(product_type);
create index if not exists redbubble_products_niche_idx on redbubble_products(niche);
create index if not exists redbubble_products_tags_idx on redbubble_products using gin(tags);
