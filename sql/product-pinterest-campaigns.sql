alter table products add column if not exists pinterest_meta jsonb default '{}'::jsonb;

create index if not exists products_pinterest_meta_idx on products using gin(pinterest_meta);

alter table product_clicks add column if not exists pin_index integer;
alter table product_clicks add column if not exists pin_title text;

create index if not exists idx_product_clicks_pin_index on product_clicks(product_id, pin_index);
