-- White Glove Concierge — Vehicle Intelligence Phase 1
-- Safe, additive migration. Existing profiles, vehicles, bookings, and payments are preserved.

create extension if not exists "pgcrypto";

alter table public.vehicles
  add column if not exists vin text,
  add column if not exists trim text,
  add column if not exists engine text,
  add column if not exists transmission text,
  add column if not exists drivetrain text,
  add column if not exists fuel_type text,
  add column if not exists mileage_unit text not null default 'km',
  add column if not exists registration_date date,
  add column if not exists last_mileage_update timestamptz,
  add column if not exists estimated_annual_mileage integer,
  add column if not exists ownership_status text not null default 'owned',
  add column if not exists archived_at timestamptz,
  add column if not exists service_preferences jsonb not null default '{}'::jsonb,
  add column if not exists maintenance_schedule_source text,
  add column if not exists intelligence_notes text;

do $$
begin
  alter table public.vehicles
    add constraint vehicles_mileage_unit_check check (mileage_unit in ('km', 'mi'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.vehicles
    add constraint vehicles_estimated_annual_mileage_check
    check (estimated_annual_mileage is null or estimated_annual_mileage between 0 and 250000);
exception when duplicate_object then null;
end $$;

alter table public.service_requests
  add column if not exists vehicle_id uuid references public.vehicles(id) on delete set null;

create index if not exists service_requests_vehicle_date_idx
  on public.service_requests (vehicle_id, preferred_date desc);
create index if not exists vehicles_member_active_idx
  on public.vehicles (user_id, archived_at, updated_at desc);

create or replace function public.validate_service_request_vehicle_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.vehicle_id is not null and not exists (
    select 1 from public.vehicles v
    where v.id = new.vehicle_id and v.user_id = new.user_id and v.archived_at is null
  ) then
    raise exception 'The selected vehicle does not belong to this member.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_service_request_vehicle_before_write on public.service_requests;
create trigger validate_service_request_vehicle_before_write
  before insert or update of vehicle_id, user_id on public.service_requests
  for each row execute function public.validate_service_request_vehicle_owner();

-- Link older bookings only when the member has exactly one matching Garage
-- vehicle label. Ambiguous labels remain unlinked for administrator review.
with unique_vehicle_labels as (
  select
    user_id,
    lower(trim(concat_ws(' ', year, make, model))) as vehicle_label_key,
    min(id::text)::uuid as vehicle_id
  from public.vehicles
  group by user_id, lower(trim(concat_ws(' ', year, make, model)))
  having count(*) = 1
)
update public.service_requests request
set vehicle_id = match.vehicle_id
from unique_vehicle_labels match
where request.vehicle_id is null
  and request.user_id = match.user_id
  and lower(trim(request.vehicle_label)) = match.vehicle_label_key;

create table if not exists public.vehicle_mileage_readings (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  odometer_value integer not null check (odometer_value between 0 and 2000000),
  unit text not null default 'km' check (unit in ('km', 'mi')),
  recorded_at timestamptz not null default now(),
  source text not null default 'customer' check (source in ('customer', 'administrator', 'appointment', 'import')),
  submitted_by uuid references auth.users(id) on delete set null,
  verification_status text not null default 'self_reported'
    check (verification_status in ('self_reported', 'verified', 'estimated', 'corrected', 'rejected')),
  note text,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

create index if not exists vehicle_mileage_readings_vehicle_date_idx
  on public.vehicle_mileage_readings (vehicle_id, recorded_at desc);
create index if not exists vehicle_mileage_readings_member_date_idx
  on public.vehicle_mileage_readings (user_id, recorded_at desc);

create or replace function public.validate_vehicle_mileage_reading()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  latest public.vehicle_mileage_readings%rowtype;
  latest_km numeric;
  incoming_km numeric;
begin
  if new.idempotency_key is not null and exists (
    select 1 from public.vehicle_mileage_readings existing
    where existing.idempotency_key = new.idempotency_key
  ) then
    return new;
  end if;

  if new.recorded_at > now() + interval '1 day' then
    raise exception 'Mileage cannot be recorded with a future date.' using errcode = '22007';
  end if;

  select * into latest
  from public.vehicle_mileage_readings
  where vehicle_id = new.vehicle_id
  order by recorded_at desc
  limit 1;

  if found and new.source = 'customer' and new.recorded_at >= latest.recorded_at then
    latest_km := latest.odometer_value * case when latest.unit = 'mi' then 1.609344 else 1 end;
    incoming_km := new.odometer_value * case when new.unit = 'mi' then 1.609344 else 1 end;
    if incoming_km < latest_km then
      raise exception 'A lower current odometer requires an administrator correction.' using errcode = '22003';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_vehicle_mileage_before_insert on public.vehicle_mileage_readings;
create trigger validate_vehicle_mileage_before_insert
  before insert on public.vehicle_mileage_readings
  for each row execute function public.validate_vehicle_mileage_reading();

create table if not exists public.vehicle_service_history (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  service_type text not null,
  appointment_id uuid references public.service_requests(id) on delete set null,
  service_date date not null,
  service_mileage integer check (service_mileage is null or service_mileage between 0 and 2000000),
  mileage_unit text not null default 'km' check (mileage_unit in ('km', 'mi')),
  provider text,
  service_description text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'member_reported', 'rejected', 'corrected')),
  invoice_reference text,
  correction_of uuid references public.vehicle_service_history(id) on delete set null,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

create index if not exists vehicle_service_history_vehicle_date_idx
  on public.vehicle_service_history (vehicle_id, service_date desc);
create index if not exists vehicle_service_history_appointment_idx
  on public.vehicle_service_history (appointment_id)
  where appointment_id is not null;

create or replace function public.validate_vehicle_service_history_date()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.service_date > current_date then
    raise exception 'Completed service history cannot use a future date.' using errcode = '22007';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_vehicle_service_history_before_insert on public.vehicle_service_history;
create trigger validate_vehicle_service_history_before_insert
  before insert on public.vehicle_service_history
  for each row execute function public.validate_vehicle_service_history_date();

create table if not exists public.crm_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'administrator'
    check (actor_type in ('customer', 'administrator', 'system', 'import')),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists crm_audit_logs_entity_date_idx
  on public.crm_audit_logs (entity_type, entity_id, created_at desc);

-- Preserve an existing numeric odometer as the first imported reading. The
-- idempotency key prevents duplicate entries if this migration is rerun.
insert into public.vehicle_mileage_readings (
  vehicle_id, user_id, odometer_value, unit, recorded_at, source,
  verification_status, note, idempotency_key
)
select
  v.id,
  v.user_id,
  regexp_replace(v.mileage, '[^0-9]', '', 'g')::integer,
  case when lower(coalesce(v.mileage, '')) ~ '(mi|mile)' then 'mi' else 'km' end,
  coalesce(v.updated_at, v.created_at, now()),
  'import',
  'self_reported',
  'Imported from the existing Garage odometer field.',
  'legacy-mileage:' || v.id::text
from public.vehicles v
where regexp_replace(coalesce(v.mileage, ''), '[^0-9]', '', 'g') ~ '^[0-9]+$'
  and regexp_replace(v.mileage, '[^0-9]', '', 'g')::numeric between 0 and 2000000
on conflict (idempotency_key) do nothing;

update public.vehicles vehicle
set last_mileage_update = latest.recorded_at,
    mileage_unit = latest.unit
from (
  select distinct on (vehicle_id) vehicle_id, recorded_at, unit
  from public.vehicle_mileage_readings
  order by vehicle_id, recorded_at desc
) latest
where vehicle.id = latest.vehicle_id
  and vehicle.last_mileage_update is null;

create or replace function public.sync_vehicle_from_mileage_reading()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.vehicles
  set mileage = new.odometer_value::text,
      mileage_unit = new.unit,
      last_mileage_update = new.recorded_at,
      updated_at = now()
  where id = new.vehicle_id
    and (last_mileage_update is null or new.recorded_at >= last_mileage_update);
  return new;
end;
$$;

drop trigger if exists sync_vehicle_after_mileage_insert on public.vehicle_mileage_readings;
create trigger sync_vehicle_after_mileage_insert
  after insert on public.vehicle_mileage_readings
  for each row execute function public.sync_vehicle_from_mileage_reading();

alter table public.vehicle_mileage_readings enable row level security;
alter table public.vehicle_service_history enable row level security;
alter table public.crm_audit_logs enable row level security;

revoke update, delete on public.vehicle_mileage_readings from authenticated;
revoke update, delete on public.vehicle_service_history from authenticated;
revoke all on public.crm_audit_logs from anon, authenticated;
grant select, insert on public.vehicle_mileage_readings to authenticated;
grant select, insert on public.vehicle_service_history to authenticated;

drop policy if exists "Members can read own mileage history" on public.vehicle_mileage_readings;
drop policy if exists "Members can submit own mileage" on public.vehicle_mileage_readings;
create policy "Members can read own mileage history"
  on public.vehicle_mileage_readings for select
  using (
    auth.uid() = user_id
    and exists (select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = auth.uid())
  );
create policy "Members can submit own mileage"
  on public.vehicle_mileage_readings for insert
  with check (
    auth.uid() = user_id
    and source = 'customer'
    and verification_status = 'self_reported'
    and submitted_by = auth.uid()
    and exists (select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = auth.uid())
  );
drop policy if exists "Members can read own service history" on public.vehicle_service_history;
drop policy if exists "Members can submit external service history" on public.vehicle_service_history;
create policy "Members can read own service history"
  on public.vehicle_service_history for select
  using (
    auth.uid() = user_id
    and exists (select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = auth.uid())
  );
create policy "Members can submit external service history"
  on public.vehicle_service_history for insert
  with check (
    auth.uid() = user_id
    and verification_status = 'member_reported'
    and appointment_id is null
    and exists (select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = auth.uid())
  );
