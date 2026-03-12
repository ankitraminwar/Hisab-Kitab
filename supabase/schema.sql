create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profile (
    id,
    user_id,
    name,
    email,
    currency,
    monthly_budget,
    theme_preference,
    notifications_enabled,
    biometric_enabled
  )
  values (
    new.id::text,
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', 'Hisab Kitab User'),
    coalesce(new.email, ''),
    'INR',
    0,
    'dark',
    false,
    false
  )
  on conflict (user_id) do update
  set email = excluded.email,
      updated_at = timezone('utc', now());

  return new;
end;
$$;

create table if not exists public.accounts (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('cash', 'bank', 'upi', 'credit_card', 'wallet', 'investment')),
  balance double precision not null default 0,
  currency text not null default 'INR',
  color text,
  icon text,
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed')),
  last_synced_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.categories (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('expense', 'income', 'both')),
  icon text not null,
  color text not null,
  is_custom boolean not null default false,
  parent_id text references public.categories(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed')),
  last_synced_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.transactions (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  amount double precision not null,
  type text not null check (type in ('expense', 'income', 'transfer')),
  category_id text not null references public.categories(id),
  account_id text not null references public.accounts(id),
  to_account_id text references public.accounts(id),
  merchant text,
  notes text,
  tags jsonb not null default '[]'::jsonb,
  transaction_date date not null,
  payment_method text not null default 'other' check (payment_method in ('cash', 'bank_transfer', 'upi', 'wallet', 'credit_card', 'debit_card', 'other')),
  is_recurring boolean not null default false,
  recurring_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed')),
  last_synced_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.budgets (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  category_id text not null references public.categories(id),
  limit_amount double precision not null,
  spent double precision not null default 0,
  month text not null,
  year integer not null,
  alert_at integer not null default 80,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed')),
  last_synced_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.goals (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  target_amount double precision not null,
  current_amount double precision not null default 0,
  deadline date,
  icon text,
  color text,
  account_id text references public.accounts(id),
  is_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed')),
  last_synced_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.assets (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('bank', 'cash', 'stocks', 'mutual_funds', 'crypto', 'gold', 'real_estate', 'other')),
  value double precision not null,
  notes text,
  last_updated timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed')),
  last_synced_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.liabilities (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('credit_card', 'loan', 'mortgage', 'other')),
  amount double precision not null,
  interest_rate double precision not null default 0,
  due_date date,
  notes text,
  last_updated timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed')),
  last_synced_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.net_worth_history (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  total_assets double precision not null,
  total_liabilities double precision not null,
  net_worth double precision not null,
  transaction_date date not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed')),
  last_synced_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.user_profile (
  id text primary key,
  user_id uuid unique references auth.users(id) on delete cascade,
  name text not null default 'Hisab Kitab User',
  email text not null default '',
  phone text,
  currency text not null default 'INR',
  monthly_budget double precision not null default 0,
  theme_preference text not null default 'dark' check (theme_preference in ('dark', 'light', 'system')),
  notifications_enabled boolean not null default false,
  biometric_enabled boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed')),
  last_synced_at timestamptz,
  deleted_at timestamptz
);

create index if not exists idx_transactions_transaction_date on public.transactions (transaction_date desc);
create index if not exists idx_transactions_category_id on public.transactions (category_id);
create index if not exists idx_transactions_account_id on public.transactions (account_id);
create index if not exists idx_transactions_user_updated_at on public.transactions (user_id, updated_at desc);
create index if not exists idx_accounts_user_updated_at on public.accounts (user_id, updated_at desc);
create index if not exists idx_categories_user_updated_at on public.categories (user_id, updated_at desc);
create index if not exists idx_budgets_user_updated_at on public.budgets (user_id, updated_at desc);
create index if not exists idx_goals_user_updated_at on public.goals (user_id, updated_at desc);
create index if not exists idx_assets_user_updated_at on public.assets (user_id, updated_at desc);
create index if not exists idx_liabilities_user_updated_at on public.liabilities (user_id, updated_at desc);
create index if not exists idx_net_worth_history_user_updated_at on public.net_worth_history (user_id, updated_at desc);
create index if not exists idx_user_profile_user_updated_at on public.user_profile (user_id, updated_at desc);
create unique index if not exists idx_budgets_user_category_month_year
  on public.budgets (user_id, category_id, month, year)
  where deleted_at is null;

drop trigger if exists set_accounts_updated_at on public.accounts;
create trigger set_accounts_updated_at before update on public.accounts for each row execute function public.set_updated_at();
drop trigger if exists set_categories_updated_at on public.categories;
create trigger set_categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
drop trigger if exists set_transactions_updated_at on public.transactions;
create trigger set_transactions_updated_at before update on public.transactions for each row execute function public.set_updated_at();
drop trigger if exists set_budgets_updated_at on public.budgets;
create trigger set_budgets_updated_at before update on public.budgets for each row execute function public.set_updated_at();
drop trigger if exists set_goals_updated_at on public.goals;
create trigger set_goals_updated_at before update on public.goals for each row execute function public.set_updated_at();
drop trigger if exists set_assets_updated_at on public.assets;
create trigger set_assets_updated_at before update on public.assets for each row execute function public.set_updated_at();
drop trigger if exists set_liabilities_updated_at on public.liabilities;
create trigger set_liabilities_updated_at before update on public.liabilities for each row execute function public.set_updated_at();
drop trigger if exists set_net_worth_updated_at on public.net_worth_history;
create trigger set_net_worth_updated_at before update on public.net_worth_history for each row execute function public.set_updated_at();
drop trigger if exists set_user_profile_updated_at on public.user_profile;
create trigger set_user_profile_updated_at before update on public.user_profile for each row execute function public.set_updated_at();
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;
alter table public.assets enable row level security;
alter table public.liabilities enable row level security;
alter table public.net_worth_history enable row level security;
alter table public.user_profile enable row level security;

drop policy if exists "own_accounts" on public.accounts;
drop policy if exists "own_categories" on public.categories;
drop policy if exists "own_transactions" on public.transactions;
drop policy if exists "own_budgets" on public.budgets;
drop policy if exists "own_goals" on public.goals;
drop policy if exists "own_assets" on public.assets;
drop policy if exists "own_liabilities" on public.liabilities;
drop policy if exists "own_net_worth_history" on public.net_worth_history;
drop policy if exists "own_user_profile" on public.user_profile;

create policy "own_accounts" on public.accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_categories" on public.categories for all using (auth.uid() = user_id or user_id is null) with check (auth.uid() = user_id or user_id is null);
create policy "own_transactions" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_budgets" on public.budgets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_goals" on public.goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_assets" on public.assets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_liabilities" on public.liabilities for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_net_worth_history" on public.net_worth_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_user_profile" on public.user_profile for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
