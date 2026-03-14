-- Supabase Migration: Add Split Expenses
-- Uses TEXT ids to match local SQLite schema

CREATE TABLE IF NOT EXISTS public.split_expenses (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id text NOT NULL,
  paid_by_user_id text NOT NULL,
  total_amount double precision NOT NULL,
  split_method text NOT NULL CHECK (split_method IN ('equal', 'exact', 'percent')),
  notes text,
  sync_status text NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'failed')),
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.split_members (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  split_expense_id text NOT NULL REFERENCES public.split_expenses(id) ON DELETE CASCADE,
  name text NOT NULL,
  share_amount double precision NOT NULL,
  share_percent double precision,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'dismissed')),
  sync_status text NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'failed')),
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_split_expenses_user ON public.split_expenses (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_split_expenses_transaction ON public.split_expenses (transaction_id);
CREATE INDEX IF NOT EXISTS idx_split_members_split_id ON public.split_members (split_expense_id);
CREATE INDEX IF NOT EXISTS idx_split_members_user ON public.split_members (user_id, updated_at DESC);

-- RLS Policies
ALTER TABLE public.split_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_split_expenses" ON public.split_expenses;
DROP POLICY IF EXISTS "own_split_members" ON public.split_members;

CREATE POLICY "own_split_expenses" ON public.split_expenses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own_split_members" ON public.split_members
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Triggers
DROP TRIGGER IF EXISTS set_split_expenses_updated_at ON public.split_expenses;
CREATE TRIGGER set_split_expenses_updated_at BEFORE UPDATE ON public.split_expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_split_members_updated_at ON public.split_members;
CREATE TRIGGER set_split_members_updated_at BEFORE UPDATE ON public.split_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
