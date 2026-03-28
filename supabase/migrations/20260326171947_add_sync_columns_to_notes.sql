-- Up
alter table public.notes
  add column if not exists sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed')),
  add column if not exists last_synced_at timestamptz;

-- Down
alter table public.notes
  drop column if exists sync_status,
  drop column if exists last_synced_at;
