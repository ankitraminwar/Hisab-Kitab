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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.user_profile (
  id,
  user_id,
  name,
  email,
  currency,
  monthly_budget,
  theme_preference,
  notifications_enabled,
  biometric_enabled,
  created_at,
  updated_at,
  sync_status
)
select
  u.id::text,
  u.id,
  coalesce(u.raw_user_meta_data ->> 'name', 'Hisab Kitab User'),
  coalesce(u.email, ''),
  'INR',
  0,
  'dark',
  false,
  false,
  timezone('utc', now()),
  timezone('utc', now()),
  'synced'
from auth.users u
left join public.user_profile p on p.user_id = u.id
where p.user_id is null;
