-- Topic bank: stores AI-generated article topic ideas
create table if not exists topic_bank (
  id         uuid primary key default gen_random_uuid(),
  topic      text not null unique,
  category   text not null,
  used       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists topic_bank_used_idx on topic_bank(used);

-- Cluster bank: stores AI-generated content cluster seeds
create table if not exists cluster_bank (
  id              uuid primary key default gen_random_uuid(),
  niche           text not null unique,
  category        text not null,
  pillar_title    text not null,
  supporting_json jsonb not null default '[]'::jsonb,
  used            boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists cluster_bank_used_idx on cluster_bank(used);
