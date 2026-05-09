create table if not exists pin_clicks (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  pin_index integer not null default 0,
  pin_title text,
  source text default 'pinterest',
  referrer text,
  user_agent text,
  created_at timestamptz default now()
);
create index if not exists idx_pin_clicks_post_id on pin_clicks(post_id);
create index if not exists idx_pin_clicks_created_at on pin_clicks(created_at desc);
create table if not exists product_clicks (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  referrer text,
  user_agent text,
  created_at timestamptz default now()
);
create index if not exists idx_product_clicks_product_id on product_clicks(product_id);
create index if not exists idx_product_clicks_created_at on product_clicks(created_at desc);
