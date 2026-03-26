-- Up
alter function public.set_updated_at() set search_path = public;
alter function public.handle_updated_at() set search_path = public;
alter function public.handle_new_user() set search_path = public;

-- Down
alter function public.set_updated_at() reset search_path;
alter function public.handle_updated_at() reset search_path;
alter function public.handle_new_user() reset search_path;
