-- Run once in the Supabase SQL Editor.
-- Collector accounts include 10 vehicles. Admins can grant extra spots per member.
-- Window stickers are kept in a private storage bucket and can be read only by the owner.

alter table public.profiles
  add column if not exists extra_vehicle_slots integer not null default 0;

alter table public.profiles
  drop constraint if exists profiles_extra_vehicle_slots_check;

alter table public.profiles
  add constraint profiles_extra_vehicle_slots_check
  check (extra_vehicle_slots between 0 and 100);

alter table public.vehicles
  add column if not exists window_sticker_path text,
  add column if not exists window_sticker_name text,
  add column if not exists window_sticker_type text;

revoke update (extra_vehicle_slots) on public.profiles from authenticated;

create or replace function public.member_vehicle_limit(member_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when coalesce(collector_access_override, false) or plan = 'Collector' then 10
    else 1
  end + greatest(coalesce(extra_vehicle_slots, 0), 0)
  from public.profiles
  where id = member_id;
$$;

revoke all on function public.member_vehicle_limit(uuid) from public;
grant execute on function public.member_vehicle_limit(uuid) to authenticated;

create or replace function public.enforce_member_vehicle_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_vehicles integer;
  current_vehicles integer;
begin
  allowed_vehicles := coalesce(public.member_vehicle_limit(new.user_id), 1);
  select count(*) into current_vehicles
  from public.vehicles
  where user_id = new.user_id;

  if current_vehicles >= allowed_vehicles then
    raise exception 'Garage vehicle limit reached (% vehicles)', allowed_vehicles
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_vehicle_limit_before_insert on public.vehicles;
create trigger enforce_vehicle_limit_before_insert
  before insert on public.vehicles
  for each row execute function public.enforce_member_vehicle_limit();

insert into storage.buckets (id, name, public)
values ('vehicle-documents', 'vehicle-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "Members can upload own vehicle documents" on storage.objects;
drop policy if exists "Members can read own vehicle documents" on storage.objects;
drop policy if exists "Members can update own vehicle documents" on storage.objects;
drop policy if exists "Members can delete own vehicle documents" on storage.objects;

create policy "Members can upload own vehicle documents"
  on storage.objects for insert
  with check (
    bucket_id = 'vehicle-documents'
    and public.has_active_membership()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Members can read own vehicle documents"
  on storage.objects for select
  using (
    bucket_id = 'vehicle-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Members can update own vehicle documents"
  on storage.objects for update
  using (
    bucket_id = 'vehicle-documents'
    and public.has_active_membership()
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'vehicle-documents'
    and public.has_active_membership()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Members can delete own vehicle documents"
  on storage.objects for delete
  using (
    bucket_id = 'vehicle-documents'
    and public.has_active_membership()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

update public.membership_pricing
set
  note = 'For collections of up to 10 vehicles, with additional vehicle spots available through your concierge.',
  updated_at = now()
where plan_name = 'Collector';
