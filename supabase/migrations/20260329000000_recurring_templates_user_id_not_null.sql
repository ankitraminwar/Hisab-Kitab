-- Migration: Set recurring_templates.user_id NOT NULL
-- The original migration (20260326171937) created user_id as nullable.
-- RLS policies require auth.uid() = user_id, so nullable rows can never be
-- accessed or managed by any user. Enforce NOT NULL for consistent ownership.

-- Up
DELETE FROM public.recurring_templates WHERE user_id IS NULL;
ALTER TABLE public.recurring_templates ALTER COLUMN user_id SET NOT NULL;

-- Down
ALTER TABLE public.recurring_templates ALTER COLUMN user_id DROP NOT NULL;
