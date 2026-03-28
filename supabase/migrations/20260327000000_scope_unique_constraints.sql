-- Migration: Scope unique constraints by user_id
-- Prevents cross-user name conflicts while ensuring per-user deduplication.

ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_name_unique;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_user_id_name_unique UNIQUE (user_id, name);

ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_name_type_unique;
ALTER TABLE public.categories ADD CONSTRAINT categories_user_id_name_type_unique UNIQUE (user_id, name, type);
