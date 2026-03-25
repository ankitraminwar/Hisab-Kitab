-- up
create table if not exists public.split_friends (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed')),
  last_synced_at timestamptz,
  deleted_at timestamptz
);

alter table public.split_members
  add column if not exists friend_id text;

create index if not exists idx_split_members_friend_id on public.split_members (friend_id);
create index if not exists idx_split_friends_user on public.split_friends (user_id, updated_at desc);
create index if not exists idx_split_friends_name on public.split_friends (name);

alter table public.split_friends enable row level security;

drop trigger if exists set_split_friends_updated_at on public.split_friends;
create trigger set_split_friends_updated_at
before update on public.split_friends
for each row execute function public.set_updated_at();

drop policy if exists "own_split_friends" on public.split_friends;
create policy "own_split_friends"
on public.split_friends
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- down
drop policy if exists "own_split_friends" on public.split_friends;
drop trigger if exists set_split_friends_updated_at on public.split_friends;
drop index if exists idx_split_friends_name;
drop index if exists idx_split_friends_user;
drop index if exists idx_split_members_friend_id;
alter table public.split_members
  drop column if exists friend_id;
drop table if exists public.split_friends;
