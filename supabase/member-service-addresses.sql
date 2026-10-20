-- Run once in Supabase SQL Editor for existing White Glove Concierge projects.
-- Stores member contact details and service addresses where the admin and booking flow can use them.

alter table public.profiles
  add column if not exists phone text,
  add column if not exists addresses jsonb not null default '[]'::jsonb;

update public.profiles as profile
set
  phone = coalesce(nullif(profile.phone, ''), auth_user.raw_user_meta_data->>'phone'),
  addresses = case
    when jsonb_array_length(profile.addresses) > 0 then profile.addresses
    when jsonb_typeof(auth_user.raw_user_meta_data->'addresses') = 'array' then auth_user.raw_user_meta_data->'addresses'
    else '[]'::jsonb
  end,
  updated_at = now()
from auth.users as auth_user
where profile.id = auth_user.id;

revoke update on public.profiles from authenticated;
grant update (id, email, full_name, phone, addresses, username, avatar_url, notifications, updated_at)
  on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    phone,
    addresses,
    username,
    avatar_url,
    plan,
    subscription_status
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', 'Member'),
    new.raw_user_meta_data->>'phone',
    case when jsonb_typeof(new.raw_user_meta_data->'addresses') = 'array' then new.raw_user_meta_data->'addresses' else '[]'::jsonb end,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'plan', 'Club Drive'),
    'pending'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    phone = excluded.phone,
    addresses = excluded.addresses,
    username = excluded.username,
    avatar_url = excluded.avatar_url,
    plan = excluded.plan,
    updated_at = now();

  return new;
end;
$$;
