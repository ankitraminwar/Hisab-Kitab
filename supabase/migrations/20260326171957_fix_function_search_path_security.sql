-- Up
alter function public.set_updated_at() set search_path = public;
-- handle_updated_at() is only present on instances that ran the early notes migration;
-- guard with a DO block to avoid failure on instances where it does not exist.
do $$
begin
  if exists (
    select 1 from pg_proc
    where proname = 'handle_updated_at'
      and pronamespace = (select oid from pg_namespace where nspname = 'public')
  ) then
    execute 'alter function public.handle_updated_at() set search_path = public';
  end if;
end;
$$;
alter function public.handle_new_user() set search_path = public;

-- Down
alter function public.set_updated_at() reset search_path;
alter function public.handle_new_user() reset search_path;
