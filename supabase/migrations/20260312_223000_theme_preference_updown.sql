-- migration: theme preference up/down rollback template
-- Add this file to supabase/migrations to allow safe apply/revert in environments that support it.

-- Up
BEGIN;

-- This example ensures existing user profiles have theme_preference set and adds a default value.
ALTER TABLE IF EXISTS public.user_profile
  ALTER COLUMN theme_preference SET DEFAULT 'system';

UPDATE public.user_profile
  SET theme_preference = 'system'
  WHERE theme_preference IS NULL;

COMMIT;

-- Down
BEGIN;

-- Revert to previous behavior: remove default, keep the current set value.
ALTER TABLE IF EXISTS public.user_profile
  ALTER COLUMN theme_preference DROP DEFAULT;

COMMIT;
