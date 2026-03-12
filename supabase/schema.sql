create table if not exists public.accounts (
  id text primary key,
  name text not null,
  type text not null,
  balance double precision not null default 0,
  currency text not null default 'INR',
  color text,
  icon text,
  "isDefault" integer default 0,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "userId" uuid,
  "syncStatus" text not null default 'synced',
  "lastSyncedAt" timestamptz,
  "deletedAt" timestamptz
);

create table if not exists public.categories (
  id text primary key,
  name text not null,
  type text not null,
  icon text not null,
  color text not null,
  "isCustom" integer default 0,
  "parentId" text,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "userId" uuid,
  "syncStatus" text not null default 'synced',
  "lastSyncedAt" timestamptz,
  "deletedAt" timestamptz
);

create table if not exists public.transactions (
  id text primary key,
  amount double precision not null,
  type text not null,
  "categoryId" text not null,
  "accountId" text not null,
  "toAccountId" text,
  merchant text,
  notes text,
  tags text not null default '[]',
  date date not null,
  "isRecurring" integer default 0,
  "recurringId" text,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "userId" uuid,
  "syncStatus" text not null default 'synced',
  "lastSyncedAt" timestamptz,
  "deletedAt" timestamptz
);

create table if not exists public.budgets (
  id text primary key,
  "categoryId" text not null,
  limit_amount double precision not null,
  spent double precision not null default 0,
  month text not null,
  year integer not null,
  "alertAt" integer default 80,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "userId" uuid,
  "syncStatus" text not null default 'synced',
  "lastSyncedAt" timestamptz,
  "deletedAt" timestamptz
);

create table if not exists public.goals (
  id text primary key,
  name text not null,
  "targetAmount" double precision not null,
  "currentAmount" double precision not null default 0,
  deadline date,
  icon text,
  color text,
  "accountId" text,
  "isCompleted" integer default 0,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "userId" uuid,
  "syncStatus" text not null default 'synced',
  "lastSyncedAt" timestamptz,
  "deletedAt" timestamptz
);

create table if not exists public.assets (
  id text primary key,
  name text not null,
  type text not null,
  value double precision not null,
  notes text,
  "lastUpdated" timestamptz not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "userId" uuid,
  "syncStatus" text not null default 'synced',
  "lastSyncedAt" timestamptz,
  "deletedAt" timestamptz
);

create table if not exists public.liabilities (
  id text primary key,
  name text not null,
  type text not null,
  amount double precision not null,
  "interestRate" double precision default 0,
  "dueDate" date,
  notes text,
  "lastUpdated" timestamptz not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "userId" uuid,
  "syncStatus" text not null default 'synced',
  "lastSyncedAt" timestamptz,
  "deletedAt" timestamptz
);

create table if not exists public.net_worth_history (
  id text primary key,
  "totalAssets" double precision not null,
  "totalLiabilities" double precision not null,
  "netWorth" double precision not null,
  date date not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "userId" uuid,
  "syncStatus" text not null default 'synced',
  "lastSyncedAt" timestamptz,
  "deletedAt" timestamptz
);

create index if not exists idx_transactions_updated_at on public.transactions ("updatedAt");
create index if not exists idx_transactions_deleted_at on public.transactions ("deletedAt");
create index if not exists idx_budgets_period on public.budgets (year, month);

alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;
alter table public.assets enable row level security;
alter table public.liabilities enable row level security;
alter table public.net_worth_history enable row level security;

create policy "authenticated users manage own accounts" on public.accounts for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
create policy "authenticated users manage own categories" on public.categories for all using (auth.uid() = "userId" or "userId" is null) with check (auth.uid() = "userId" or "userId" is null);
create policy "authenticated users manage own transactions" on public.transactions for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
create policy "authenticated users manage own budgets" on public.budgets for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
create policy "authenticated users manage own goals" on public.goals for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
create policy "authenticated users manage own assets" on public.assets for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
create policy "authenticated users manage own liabilities" on public.liabilities for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
create policy "authenticated users manage own net worth history" on public.net_worth_history for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
