alter table posts add column if not exists cluster_id text;
alter table posts add column if not exists cluster_role text;
alter table posts add column if not exists scheduled_for timestamptz;

create index if not exists posts_cluster_id_idx on posts(cluster_id);
create index if not exists posts_scheduled_for_idx on posts(scheduled_for);
