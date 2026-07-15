-- Run this once in Supabase SQL Editor for existing White Glove Concierge projects.
-- It adds profile fields used by the member app settings screen.

alter table public.profiles
  add column if not exists username text;

alter table public.profiles
  add column if not exists notifications jsonb not null default
    '{"bookingUpdates": true, "feedActivity": true, "offers": true, "serviceReminders": true}'::jsonb;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, username, plan)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', 'Member'),
    new.raw_user_meta_data->>'username',
    coalesce(new.raw_user_meta_data->>'plan', 'Club Drive')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    username = excluded.username,
    plan = excluded.plan,
    updated_at = now();

  return new;
end;
$$;
