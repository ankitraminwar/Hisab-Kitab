-- Migration: Consolidate notes & recurring_templates RLS policies
-- The original notes migration created 4 per-operation policies.
-- schema.sql uses a single "own_*" ALL policy. On existing DBs both sets
-- coexist. This migration drops the legacy policies so only the canonical
-- "own_notes" and "own_recurring_templates" policies remain.

-- Up
DROP POLICY IF EXISTS "Users can create their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notes;

-- Recreate as a single consolidated ALL policy (idempotent)
DROP POLICY IF EXISTS "own_notes" ON public.notes;
CREATE POLICY "own_notes" ON public.notes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Consolidate recurring_templates policies
DROP POLICY IF EXISTS "recurring_templates_select_own" ON public.recurring_templates;
DROP POLICY IF EXISTS "recurring_templates_insert_own" ON public.recurring_templates;
DROP POLICY IF EXISTS "recurring_templates_update_own" ON public.recurring_templates;
DROP POLICY IF EXISTS "recurring_templates_delete_own" ON public.recurring_templates;

DROP POLICY IF EXISTS "own_recurring_templates" ON public.recurring_templates;
CREATE POLICY "own_recurring_templates" ON public.recurring_templates
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fix the notes updated_at trigger to use the canonical set_updated_at()
-- function (the original migration used handle_updated_at() which is identical
-- in behavior but differs in name).
DROP TRIGGER IF EXISTS handle_updated_at ON public.notes;
DROP TRIGGER IF EXISTS update_notes_updated_at ON public.notes;
CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Down
-- Restoring legacy per-operation policies is intentionally omitted.
-- Re-run the original migration to restore them if needed.
