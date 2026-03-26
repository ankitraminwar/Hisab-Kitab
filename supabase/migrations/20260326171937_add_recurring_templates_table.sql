-- Up
create table if not exists public.recurring_templates (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  amount double precision not null,
  type text not null,
  category_id text not null,
  account_id text not null,
  merchant text,
  notes text,
  tags jsonb not null default '[]'::jsonb,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly', 'yearly')),
  start_date text not null,
  next_due text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed')),
  last_synced_at timestamptz,
  deleted_at timestamptz
);

alter table public.recurring_templates enable row level security;

create policy "recurring_templates_select_own" on public.recurring_templates for select using (auth.uid() = user_id);
create policy "recurring_templates_insert_own" on public.recurring_templates for insert with check (auth.uid() = user_id);
create policy "recurring_templates_update_own" on public.recurring_templates for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "recurring_templates_delete_own" on public.recurring_templates for delete using (auth.uid() = user_id);

create trigger set_recurring_templates_updated_at before update on public.recurring_templates for each row execute function public.set_updated_at();

-- Down
drop table if exists public.recurring_templates;
