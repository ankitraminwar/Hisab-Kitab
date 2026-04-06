-- ============================================================
-- Hisab Kitab — Supabase Production Schema v2
-- ============================================================
--
-- Single source of truth for all remote tables. No migration files.
--
-- FRESH INSTALL:
--   1. DROP SCHEMA public CASCADE;
--   2. CREATE SCHEMA public;
--   3. GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
--   4. GRANT ALL ON SCHEMA public TO postgres;
--   5. Run this file.
--
-- IDEMPOTENT: Uses IF NOT EXISTS / OR REPLACE — safe to re-run.
--
-- DESIGN RULES:
--   • Every row is user-scoped (user_id NOT NULL → auth.users).
--   • No inter-table FKs — allows out-of-order sync push.
--     SQLite enforces FK integrity locally.
--   • Soft delete via deleted_at (NULL = active).
--   • Partial unique indexes exclude soft-deleted rows.
--   • text PK = UUID generated client-side.
--   • float8 for all monetary values.
--   • timestamptz for all dates/times.
--   • Conflict resolution: latest updated_at wins.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. Extensions
-- ────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;


-- ────────────────────────────────────────────────────────────
-- 2. Utility Functions
-- ────────────────────────────────────────────────────────────

-- Auto-bump updated_at on every UPDATE
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Auto-create user_profile when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profile (
    id, user_id, name, email, currency, monthly_budget,
    theme_preference, notifications_enabled, biometric_enabled
  ) values (
    new.id::text,
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', 'Hisab Kitab User'),
    coalesce(new.email, ''),
    'INR', 0, 'system', false, false
  )
  on conflict (user_id) do update
    set email      = excluded.email,
        updated_at = timezone('utc', now());
  return new;
end;
$$;


-- ────────────────────────────────────────────────────────────
-- 3. Tables
-- ────────────────────────────────────────────────────────────
-- Column ordering convention per table:
--   PK → user_id → domain columns → device_id → sync metadata → timestamps

-- 3.1 User Profile ───────────────────────────────────────────

create table if not exists public.user_profile (
  id                     text        primary key,
  user_id                uuid        unique not null references auth.users(id) on delete cascade,
  name                   text        not null default 'Hisab Kitab User',
  email                  text        not null default '',
  phone                  text,
  currency               text        not null default 'INR',
  monthly_budget         float8      not null default 0   check (monthly_budget >= 0),
  theme_preference       text        not null default 'system'
                                     check (theme_preference in ('dark','light','system')),
  notifications_enabled  boolean     not null default false,
  biometric_enabled      boolean     not null default false,
  avatar                 text,
  device_id              text,
  sync_status            text        not null default 'synced'
                                     check (sync_status in ('synced','pending','failed')),
  last_synced_at         timestamptz,
  deleted_at             timestamptz,
  created_at             timestamptz not null default timezone('utc', now()),
  updated_at             timestamptz not null default timezone('utc', now())
);

-- 3.2 Accounts ───────────────────────────────────────────────

create table if not exists public.accounts (
  id             text        primary key,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  name           text        not null,
  type           text        not null check (type in ('cash','bank','upi','credit_card','wallet','investment')),
  balance        float8      not null default 0,
  currency       text        not null default 'INR',
  color          text        not null default '#7C3AED',
  icon           text        not null default 'wallet',
  is_default     boolean     not null default false,
  device_id      text,
  sync_status    text        not null default 'synced'
                             check (sync_status in ('synced','pending','failed')),
  last_synced_at timestamptz,
  deleted_at     timestamptz,
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now())
);

-- 3.3 Categories ─────────────────────────────────────────────

create table if not exists public.categories (
  id             text        primary key,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  name           text        not null,
  type           text        not null check (type in ('expense','income','both')),
  icon           text        not null,
  color          text        not null,
  is_custom      boolean     not null default false,
  parent_id      text,
  device_id      text,
  sync_status    text        not null default 'synced'
                             check (sync_status in ('synced','pending','failed')),
  last_synced_at timestamptz,
  deleted_at     timestamptz,
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now())
);

-- 3.4 Payment Methods ────────────────────────────────────────

create table if not exists public.payment_methods (
  id             text        primary key,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  name           text        not null,
  icon           text        not null default 'card',
  color          text        not null default '#8B5CF6',
  is_custom      boolean     not null default false,
  device_id      text,
  sync_status    text        not null default 'synced'
                             check (sync_status in ('synced','pending','failed')),
  last_synced_at timestamptz,
  deleted_at     timestamptz,
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now())
);

-- 3.5 Transactions ───────────────────────────────────────────

create table if not exists public.transactions (
  id               text        primary key,
  user_id          uuid        not null references auth.users(id) on delete cascade,
  amount           float8      not null check (amount >= 0),
  type             text        not null check (type in ('expense','income','transfer')),
  category_id      text        not null,
  account_id       text        not null,
  to_account_id    text,
  merchant         text,
  notes            text,
  tags             jsonb       not null default '[]'::jsonb,
  transaction_date timestamptz not null,
  payment_method   text        not null default 'other',
  is_recurring     boolean     not null default false,
  recurring_id     text,
  device_id        text,
  sync_status      text        not null default 'synced'
                               check (sync_status in ('synced','pending','failed')),
  last_synced_at   timestamptz,
  deleted_at       timestamptz,
  created_at       timestamptz not null default timezone('utc', now()),
  updated_at       timestamptz not null default timezone('utc', now())
);

-- 3.6 Budgets ────────────────────────────────────────────────

create table if not exists public.budgets (
  id             text        primary key,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  category_id    text        not null,
  limit_amount   float8      not null check (limit_amount > 0),
  spent          float8      not null default 0,
  month          text        not null,
  year           integer     not null check (year > 0),
  alert_at       integer     not null default 80 check (alert_at between 1 and 100),
  device_id      text,
  sync_status    text        not null default 'synced'
                             check (sync_status in ('synced','pending','failed')),
  last_synced_at timestamptz,
  deleted_at     timestamptz,
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now())
);

-- 3.7 Goals ──────────────────────────────────────────────────

create table if not exists public.goals (
  id             text        primary key,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  name           text        not null,
  target_amount  float8      not null check (target_amount > 0),
  current_amount float8      not null default 0 check (current_amount >= 0),
  deadline       date,
  icon           text        not null default 'flag',
  color          text        not null default '#7C3AED',
  account_id     text,
  is_completed   boolean     not null default false,
  device_id      text,
  sync_status    text        not null default 'synced'
                             check (sync_status in ('synced','pending','failed')),
  last_synced_at timestamptz,
  deleted_at     timestamptz,
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now())
);

-- 3.8 Assets ─────────────────────────────────────────────────

create table if not exists public.assets (
  id             text        primary key,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  name           text        not null,
  type           text        not null check (type in ('bank','cash','stocks','mutual_funds','crypto','gold','real_estate','other')),
  value          float8      not null check (value >= 0),
  notes          text,
  last_updated   timestamptz not null default timezone('utc', now()),
  device_id      text,
  sync_status    text        not null default 'synced'
                             check (sync_status in ('synced','pending','failed')),
  last_synced_at timestamptz,
  deleted_at     timestamptz,
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now())
);

-- 3.9 Liabilities ────────────────────────────────────────────

create table if not exists public.liabilities (
  id             text        primary key,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  name           text        not null,
  type           text        not null check (type in ('credit_card','loan','mortgage','other')),
  amount         float8      not null check (amount >= 0),
  interest_rate  float8      not null default 0 check (interest_rate >= 0),
  due_date       date,
  notes          text,
  last_updated   timestamptz not null default timezone('utc', now()),
  device_id      text,
  sync_status    text        not null default 'synced'
                             check (sync_status in ('synced','pending','failed')),
  last_synced_at timestamptz,
  deleted_at     timestamptz,
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now())
);

-- 3.10 Net Worth History ─────────────────────────────────────

create table if not exists public.net_worth_history (
  id                text        primary key,
  user_id           uuid        not null references auth.users(id) on delete cascade,
  total_assets      float8      not null,
  total_liabilities float8      not null,
  net_worth         float8      not null,
  transaction_date  timestamptz not null,
  device_id         text,
  sync_status       text        not null default 'synced'
                                check (sync_status in ('synced','pending','failed')),
  last_synced_at    timestamptz,
  deleted_at        timestamptz,
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now())
);

-- 3.11 Recurring Templates ───────────────────────────────────

create table if not exists public.recurring_templates (
  id             text        primary key,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  amount         float8      not null check (amount > 0),
  type           text        not null check (type in ('expense','income','transfer')),
  category_id    text        not null,
  account_id     text        not null,
  merchant       text,
  notes          text,
  tags           jsonb       not null default '[]'::jsonb,
  frequency      text        not null check (frequency in ('daily','weekly','monthly','yearly')),
  start_date     text        not null,
  next_due       text        not null,
  is_active      boolean     not null default true,
  device_id      text,
  sync_status    text        not null default 'synced'
                             check (sync_status in ('synced','pending','failed')),
  last_synced_at timestamptz,
  deleted_at     timestamptz,
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now())
);

-- 3.12 Split Expenses ────────────────────────────────────────

create table if not exists public.split_expenses (
  id               text        primary key,
  user_id          uuid        not null references auth.users(id) on delete cascade,
  transaction_id   text        not null,
  paid_by_user_id  text        not null,
  total_amount     float8      not null check (total_amount > 0),
  split_method     text        not null check (split_method in ('equal','exact','percent')),
  notes            text,
  device_id        text,
  sync_status      text        not null default 'synced'
                               check (sync_status in ('synced','pending','failed')),
  last_synced_at   timestamptz,
  deleted_at       timestamptz,
  created_at       timestamptz not null default timezone('utc', now()),
  updated_at       timestamptz not null default timezone('utc', now())
);

-- 3.13 Split Members ─────────────────────────────────────────

create table if not exists public.split_members (
  id               text        primary key,
  user_id          uuid        not null references auth.users(id) on delete cascade,
  split_expense_id text        not null,
  friend_id        text,
  name             text        not null,
  share_amount     float8      not null check (share_amount >= 0),
  share_percent    float8      check (share_percent is null or (share_percent >= 0 and share_percent <= 100)),
  status           text        not null default 'pending'
                               check (status in ('pending','paid','dismissed')),
  device_id        text,
  sync_status      text        not null default 'synced'
                               check (sync_status in ('synced','pending','failed')),
  last_synced_at   timestamptz,
  deleted_at       timestamptz,
  created_at       timestamptz not null default timezone('utc', now()),
  updated_at       timestamptz not null default timezone('utc', now())
);

-- 3.14 Split Friends ─────────────────────────────────────────

create table if not exists public.split_friends (
  id             text        primary key,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  name           text        not null,
  device_id      text,
  sync_status    text        not null default 'synced'
                             check (sync_status in ('synced','pending','failed')),
  last_synced_at timestamptz,
  deleted_at     timestamptz,
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now())
);

-- 3.15 Notes ─────────────────────────────────────────────────

create table if not exists public.notes (
  id             text        primary key,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  title          text        not null,
  content        text        not null,
  color          text        not null default '#7C3AED',
  is_pinned      boolean     not null default false,
  device_id      text,
  sync_status    text        not null default 'synced'
                             check (sync_status in ('synced','pending','failed')),
  last_synced_at timestamptz,
  deleted_at     timestamptz,
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now())
);


-- ────────────────────────────────────────────────────────────
-- 4. Indexes
-- ────────────────────────────────────────────────────────────

-- 4a. Sync pull — (user_id, updated_at DESC) per table
create index if not exists idx_user_profile_sync        on public.user_profile        (user_id, updated_at desc);
create index if not exists idx_accounts_sync            on public.accounts            (user_id, updated_at desc);
create index if not exists idx_categories_sync          on public.categories          (user_id, updated_at desc);
create index if not exists idx_payment_methods_sync     on public.payment_methods     (user_id, updated_at desc);
create index if not exists idx_transactions_sync        on public.transactions        (user_id, updated_at desc);
create index if not exists idx_budgets_sync             on public.budgets             (user_id, updated_at desc);
create index if not exists idx_goals_sync               on public.goals               (user_id, updated_at desc);
create index if not exists idx_assets_sync              on public.assets              (user_id, updated_at desc);
create index if not exists idx_liabilities_sync         on public.liabilities         (user_id, updated_at desc);
create index if not exists idx_net_worth_history_sync   on public.net_worth_history   (user_id, updated_at desc);
create index if not exists idx_recurring_templates_sync on public.recurring_templates (user_id, updated_at desc);
create index if not exists idx_split_expenses_sync      on public.split_expenses      (user_id, updated_at desc);
create index if not exists idx_split_members_sync       on public.split_members       (user_id, updated_at desc);
create index if not exists idx_split_friends_sync       on public.split_friends       (user_id, updated_at desc);
create index if not exists idx_notes_sync               on public.notes               (user_id, updated_at desc);

-- 4b. Partial unique indexes — soft-deleted rows excluded
create unique index if not exists uq_accounts_user_name
  on public.accounts (user_id, name)
  where deleted_at is null;

create unique index if not exists uq_categories_user_name_type
  on public.categories (user_id, name, type)
  where deleted_at is null;

create unique index if not exists uq_budgets_user_cat_month
  on public.budgets (user_id, category_id, month, year)
  where deleted_at is null;

-- 4c. Query-pattern indexes
create index if not exists idx_transactions_date        on public.transactions (transaction_date desc);
create index if not exists idx_transactions_category    on public.transactions (category_id);
create index if not exists idx_transactions_account     on public.transactions (account_id);
create index if not exists idx_transactions_type_date   on public.transactions (type, transaction_date desc);
create index if not exists idx_transactions_filter      on public.transactions (type, category_id, account_id);
create index if not exists idx_transactions_tags        on public.transactions using gin (tags);
create index if not exists idx_transactions_dashboard   on public.transactions (transaction_date desc, type)
  where deleted_at is null;

create index if not exists idx_split_expenses_txn       on public.split_expenses (transaction_id);
create index if not exists idx_split_members_expense    on public.split_members  (split_expense_id);
create index if not exists idx_split_members_friend     on public.split_members  (friend_id);
create index if not exists idx_split_friends_name       on public.split_friends  (name);

create index if not exists idx_notes_active             on public.notes (user_id, is_pinned desc, updated_at desc)
  where deleted_at is null;


-- ────────────────────────────────────────────────────────────
-- 5. Triggers — auto-update updated_at
-- ────────────────────────────────────────────────────────────

-- Drop all legacy + current trigger names for idempotent re-runs
drop trigger if exists trg_user_profile_updated_at        on public.user_profile;
drop trigger if exists trg_accounts_updated_at            on public.accounts;
drop trigger if exists trg_categories_updated_at          on public.categories;
drop trigger if exists trg_payment_methods_updated_at     on public.payment_methods;
drop trigger if exists trg_transactions_updated_at        on public.transactions;
drop trigger if exists trg_budgets_updated_at             on public.budgets;
drop trigger if exists trg_goals_updated_at               on public.goals;
drop trigger if exists trg_assets_updated_at              on public.assets;
drop trigger if exists trg_liabilities_updated_at         on public.liabilities;
drop trigger if exists trg_net_worth_history_updated_at   on public.net_worth_history;
drop trigger if exists trg_recurring_templates_updated_at on public.recurring_templates;
drop trigger if exists trg_split_expenses_updated_at      on public.split_expenses;
drop trigger if exists trg_split_members_updated_at       on public.split_members;
drop trigger if exists trg_split_friends_updated_at       on public.split_friends;
drop trigger if exists trg_notes_updated_at               on public.notes;
drop trigger if exists set_user_profile_updated_at        on public.user_profile;
drop trigger if exists set_accounts_updated_at            on public.accounts;
drop trigger if exists set_categories_updated_at          on public.categories;
drop trigger if exists set_payment_methods_updated_at     on public.payment_methods;
drop trigger if exists set_transactions_updated_at        on public.transactions;
drop trigger if exists set_budgets_updated_at             on public.budgets;
drop trigger if exists set_goals_updated_at               on public.goals;
drop trigger if exists set_assets_updated_at              on public.assets;
drop trigger if exists set_liabilities_updated_at         on public.liabilities;
drop trigger if exists set_net_worth_updated_at           on public.net_worth_history;
drop trigger if exists set_recurring_templates_updated_at on public.recurring_templates;
drop trigger if exists set_split_expenses_updated_at      on public.split_expenses;
drop trigger if exists set_split_members_updated_at       on public.split_members;
drop trigger if exists set_split_friends_updated_at       on public.split_friends;
drop trigger if exists update_notes_updated_at            on public.notes;
drop trigger if exists handle_updated_at                  on public.notes;

create trigger trg_user_profile_updated_at        before update on public.user_profile        for each row execute function public.set_updated_at();
create trigger trg_accounts_updated_at            before update on public.accounts            for each row execute function public.set_updated_at();
create trigger trg_categories_updated_at          before update on public.categories          for each row execute function public.set_updated_at();
create trigger trg_payment_methods_updated_at     before update on public.payment_methods     for each row execute function public.set_updated_at();
create trigger trg_transactions_updated_at        before update on public.transactions        for each row execute function public.set_updated_at();
create trigger trg_budgets_updated_at             before update on public.budgets             for each row execute function public.set_updated_at();
create trigger trg_goals_updated_at               before update on public.goals               for each row execute function public.set_updated_at();
create trigger trg_assets_updated_at              before update on public.assets              for each row execute function public.set_updated_at();
create trigger trg_liabilities_updated_at         before update on public.liabilities         for each row execute function public.set_updated_at();
create trigger trg_net_worth_history_updated_at   before update on public.net_worth_history   for each row execute function public.set_updated_at();
create trigger trg_recurring_templates_updated_at before update on public.recurring_templates for each row execute function public.set_updated_at();
create trigger trg_split_expenses_updated_at      before update on public.split_expenses      for each row execute function public.set_updated_at();
create trigger trg_split_members_updated_at       before update on public.split_members       for each row execute function public.set_updated_at();
create trigger trg_split_friends_updated_at       before update on public.split_friends       for each row execute function public.set_updated_at();
create trigger trg_notes_updated_at               before update on public.notes               for each row execute function public.set_updated_at();


-- ────────────────────────────────────────────────────────────
-- 6. Auth Trigger — auto-create user_profile on signup
-- ────────────────────────────────────────────────────────────

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill existing auth users missing a user_profile row
insert into public.user_profile (
  id, user_id, name, email, currency, monthly_budget,
  theme_preference, notifications_enabled, biometric_enabled,
  created_at, updated_at, sync_status
)
select
  u.id::text, u.id,
  coalesce(u.raw_user_meta_data ->> 'name', 'Hisab Kitab User'),
  coalesce(u.email, ''),
  'INR', 0, 'system', false, false,
  timezone('utc', now()), timezone('utc', now()), 'synced'
from auth.users u
left join public.user_profile p on p.user_id = u.id
where p.user_id is null;


-- ────────────────────────────────────────────────────────────
-- 7. Row Level Security
-- ────────────────────────────────────────────────────────────
-- Every table: SELECT/INSERT/UPDATE/DELETE scoped to auth.uid().
-- user_id is NOT NULL — no shared/public rows.
-- Service role bypasses RLS by design.

alter table public.user_profile        enable row level security;
alter table public.accounts            enable row level security;
alter table public.categories          enable row level security;
alter table public.payment_methods     enable row level security;
alter table public.transactions        enable row level security;
alter table public.budgets             enable row level security;
alter table public.goals               enable row level security;
alter table public.assets              enable row level security;
alter table public.liabilities         enable row level security;
alter table public.net_worth_history   enable row level security;
alter table public.recurring_templates enable row level security;
alter table public.split_expenses      enable row level security;
alter table public.split_members       enable row level security;
alter table public.split_friends       enable row level security;
alter table public.notes               enable row level security;

-- Drop existing policies (idempotent cleanup for re-runs)
do $$
declare
  _tbl text;
  _pol record;
begin
  for _tbl in select unnest(array[
    'user_profile','accounts','categories','payment_methods','transactions',
    'budgets','goals','assets','liabilities','net_worth_history',
    'recurring_templates','split_expenses','split_members','split_friends','notes'
  ]) loop
    for _pol in
      select policyname from pg_policies where schemaname = 'public' and tablename = _tbl
    loop
      execute format('drop policy if exists %I on public.%I', _pol.policyname, _tbl);
    end loop;
  end loop;
end$$;

-- Per-operation policies (60 total: 15 tables × 4 operations)

create policy "user_profile_select" on public.user_profile for select using (auth.uid() = user_id);
create policy "user_profile_insert" on public.user_profile for insert with check (auth.uid() = user_id);
create policy "user_profile_update" on public.user_profile for update using (auth.uid() = user_id);
create policy "user_profile_delete" on public.user_profile for delete using (auth.uid() = user_id);

create policy "accounts_select" on public.accounts for select using (auth.uid() = user_id);
create policy "accounts_insert" on public.accounts for insert with check (auth.uid() = user_id);
create policy "accounts_update" on public.accounts for update using (auth.uid() = user_id);
create policy "accounts_delete" on public.accounts for delete using (auth.uid() = user_id);

create policy "categories_select" on public.categories for select using (auth.uid() = user_id);
create policy "categories_insert" on public.categories for insert with check (auth.uid() = user_id);
create policy "categories_update" on public.categories for update using (auth.uid() = user_id);
create policy "categories_delete" on public.categories for delete using (auth.uid() = user_id);

create policy "payment_methods_select" on public.payment_methods for select using (auth.uid() = user_id);
create policy "payment_methods_insert" on public.payment_methods for insert with check (auth.uid() = user_id);
create policy "payment_methods_update" on public.payment_methods for update using (auth.uid() = user_id);
create policy "payment_methods_delete" on public.payment_methods for delete using (auth.uid() = user_id);

create policy "transactions_select" on public.transactions for select using (auth.uid() = user_id);
create policy "transactions_insert" on public.transactions for insert with check (auth.uid() = user_id);
create policy "transactions_update" on public.transactions for update using (auth.uid() = user_id);
create policy "transactions_delete" on public.transactions for delete using (auth.uid() = user_id);

create policy "budgets_select" on public.budgets for select using (auth.uid() = user_id);
create policy "budgets_insert" on public.budgets for insert with check (auth.uid() = user_id);
create policy "budgets_update" on public.budgets for update using (auth.uid() = user_id);
create policy "budgets_delete" on public.budgets for delete using (auth.uid() = user_id);

create policy "goals_select" on public.goals for select using (auth.uid() = user_id);
create policy "goals_insert" on public.goals for insert with check (auth.uid() = user_id);
create policy "goals_update" on public.goals for update using (auth.uid() = user_id);
create policy "goals_delete" on public.goals for delete using (auth.uid() = user_id);

create policy "assets_select" on public.assets for select using (auth.uid() = user_id);
create policy "assets_insert" on public.assets for insert with check (auth.uid() = user_id);
create policy "assets_update" on public.assets for update using (auth.uid() = user_id);
create policy "assets_delete" on public.assets for delete using (auth.uid() = user_id);

create policy "liabilities_select" on public.liabilities for select using (auth.uid() = user_id);
create policy "liabilities_insert" on public.liabilities for insert with check (auth.uid() = user_id);
create policy "liabilities_update" on public.liabilities for update using (auth.uid() = user_id);
create policy "liabilities_delete" on public.liabilities for delete using (auth.uid() = user_id);

create policy "net_worth_history_select" on public.net_worth_history for select using (auth.uid() = user_id);
create policy "net_worth_history_insert" on public.net_worth_history for insert with check (auth.uid() = user_id);
create policy "net_worth_history_update" on public.net_worth_history for update using (auth.uid() = user_id);
create policy "net_worth_history_delete" on public.net_worth_history for delete using (auth.uid() = user_id);

create policy "recurring_templates_select" on public.recurring_templates for select using (auth.uid() = user_id);
create policy "recurring_templates_insert" on public.recurring_templates for insert with check (auth.uid() = user_id);
create policy "recurring_templates_update" on public.recurring_templates for update using (auth.uid() = user_id);
create policy "recurring_templates_delete" on public.recurring_templates for delete using (auth.uid() = user_id);

create policy "split_expenses_select" on public.split_expenses for select using (auth.uid() = user_id);
create policy "split_expenses_insert" on public.split_expenses for insert with check (auth.uid() = user_id);
create policy "split_expenses_update" on public.split_expenses for update using (auth.uid() = user_id);
create policy "split_expenses_delete" on public.split_expenses for delete using (auth.uid() = user_id);

create policy "split_members_select" on public.split_members for select using (auth.uid() = user_id);
create policy "split_members_insert" on public.split_members for insert with check (auth.uid() = user_id);
create policy "split_members_update" on public.split_members for update using (auth.uid() = user_id);
create policy "split_members_delete" on public.split_members for delete using (auth.uid() = user_id);

create policy "split_friends_select" on public.split_friends for select using (auth.uid() = user_id);
create policy "split_friends_insert" on public.split_friends for insert with check (auth.uid() = user_id);
create policy "split_friends_update" on public.split_friends for update using (auth.uid() = user_id);
create policy "split_friends_delete" on public.split_friends for delete using (auth.uid() = user_id);

create policy "notes_select" on public.notes for select using (auth.uid() = user_id);
create policy "notes_insert" on public.notes for insert with check (auth.uid() = user_id);
create policy "notes_update" on public.notes for update using (auth.uid() = user_id);
create policy "notes_delete" on public.notes for delete using (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────
-- 8. Materialized View — Dashboard Monthly Stats
-- ────────────────────────────────────────────────────────────

drop materialized view if exists public.dashboard_monthly_stats;

create materialized view public.dashboard_monthly_stats as
select
  user_id,
  to_char(transaction_date, 'YYYY-MM') as month,
  sum(case when type = 'income'  then amount else 0 end) as total_income,
  sum(case when type = 'expense' then amount else 0 end) as total_expenses,
  sum(case when type = 'income'  then amount else 0 end) -
    sum(case when type = 'expense' then amount else 0 end) as net,
  count(*) as transaction_count
from public.transactions
where deleted_at is null
group by user_id, to_char(transaction_date, 'YYYY-MM');

create unique index if not exists idx_dashboard_monthly_stats_pk
  on public.dashboard_monthly_stats (user_id, month);

create or replace function public.get_dashboard_stats(
  p_month text default to_char(now(), 'YYYY-MM')
)
returns table(
  month text,
  total_income double precision,
  total_expenses double precision,
  net double precision,
  transaction_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select dms.month, dms.total_income, dms.total_expenses, dms.net, dms.transaction_count
  from public.dashboard_monthly_stats dms
  where dms.user_id = auth.uid()
    and dms.month = p_month;
$$;

create or replace function public.refresh_dashboard_stats()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.dashboard_monthly_stats;
end;
$$;


-- ────────────────────────────────────────────────────────────
-- 9. Grants
-- ────────────────────────────────────────────────────────────

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

grant usage on all sequences in schema public to authenticated;
alter default privileges in schema public grant usage on sequences to authenticated;

grant execute on function public.get_dashboard_stats(text) to authenticated;
grant execute on function public.refresh_dashboard_stats() to authenticated;


-- ────────────────────────────────────────────────────────────
-- 10. Schema Version
-- ────────────────────────────────────────────────────────────

create table if not exists public.schema_version (
  version     integer     primary key,
  applied_at  timestamptz not null default now(),
  description text
);

insert into public.schema_version (version, description) values
  (2, 'Production schema v2 — CHECK constraints, partial unique indexes, device_id, NOT NULL user_id')
on conflict do nothing;
