-- White Glove Concierge — Vehicle Intelligence Phase 2
-- Maintenance rules, forecasting, confidence, statuses, tasks, and job monitoring.
-- Run after vehicle-intelligence-phase1.sql. This migration is additive and idempotent.

create extension if not exists "pgcrypto";

alter table public.vehicles
  add column if not exists maintenance_recalculation_required boolean not null default true,
  add column if not exists maintenance_recalculation_requested_at timestamptz not null default now();

create table if not exists public.vehicle_maintenance_rules (
  id uuid primary key default gen_random_uuid(),
  stable_key text not null,
  version integer not null check (version > 0),
  rule_name text not null,
  service_type text not null,
  service_aliases text[] not null default '{}'::text[],
  service_category text not null check (service_category in ('mechanical', 'tires', 'preventative', 'concierge')),
  recommendation_type text not null default 'scheduled_maintenance'
    check (recommendation_type in ('scheduled_maintenance', 'inspection', 'customer_issue', 'optional_concierge', 'promotion')),
  vehicle_applicability jsonb not null default '{}'::jsonb,
  mileage_interval_km integer check (mileage_interval_km is null or mileage_interval_km > 0),
  time_interval_months integer check (time_interval_months is null or time_interval_months > 0),
  severe_service_conditions jsonb not null default '{}'::jsonb,
  source_type text not null
    check (source_type in ('manufacturer', 'verified_provider', 'internal_inspection', 'optional_concierge')),
  source_reference text not null,
  source_version text,
  confidence_level text not null default 'Low' check (confidence_level in ('High', 'Medium', 'Low')),
  customer_explanation text not null,
  requires_inspection boolean not null default false,
  safety_related boolean not null default false,
  approval_status text not null default 'draft' check (approval_status in ('draft', 'approved', 'retired')),
  active boolean not null default false,
  supersedes_rule_id uuid references public.vehicle_maintenance_rules(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stable_key, version),
  check (
    mileage_interval_km is not null
    or time_interval_months is not null
    or requires_inspection
    or recommendation_type in ('customer_issue', 'optional_concierge', 'promotion')
  ),
  check (approval_status <> 'approved' or (active and approved_at is not null)),
  check (source_type <> 'manufacturer' or source_version is not null)
);

create unique index if not exists vehicle_maintenance_rules_active_key_idx
  on public.vehicle_maintenance_rules (stable_key)
  where active and approval_status = 'approved' and archived_at is null;
create index if not exists vehicle_maintenance_rules_status_idx
  on public.vehicle_maintenance_rules (approval_status, active, service_category, updated_at desc);

create or replace function public.approve_vehicle_maintenance_rule(p_rule_id uuid)
returns public.vehicle_maintenance_rules
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.vehicle_maintenance_rules%rowtype;
begin
  select * into target
  from public.vehicle_maintenance_rules
  where id = p_rule_id
  for update;

  if not found then
    raise exception 'Maintenance rule not found.' using errcode = 'P0002';
  end if;
  if target.approval_status <> 'draft' then
    raise exception 'Only a draft maintenance rule can be approved.' using errcode = '23514';
  end if;

  update public.vehicle_maintenance_rules
  set active = false,
      approval_status = 'retired',
      archived_at = coalesce(archived_at, now()),
      updated_at = now()
  where stable_key = target.stable_key
    and id <> target.id
    and approval_status = 'approved';

  update public.vehicle_maintenance_rules
  set active = true,
      approval_status = 'approved',
      approved_at = now(),
      archived_at = null,
      updated_at = now()
  where id = target.id
  returning * into target;

  return target;
end;
$$;

revoke all on function public.approve_vehicle_maintenance_rule(uuid) from public, anon, authenticated;
grant execute on function public.approve_vehicle_maintenance_rule(uuid) to service_role;

create table if not exists public.maintenance_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null default 'default',
  version integer not null check (version > 0),
  approaching_days integer not null default 30 check (approaching_days between 1 and 365),
  due_days integer not null default 7 check (due_days between 0 and 90),
  approaching_km integer not null default 1500 check (approaching_km between 1 and 50000),
  due_km integer not null default 500 check (due_km between 0 and 10000),
  high_usage_reminder_days integer not null default 30 check (high_usage_reminder_days between 7 and 365),
  average_usage_reminder_days integer not null default 60 check (average_usage_reminder_days between 7 and 365),
  low_usage_reminder_days integer not null default 90 check (low_usage_reminder_days between 7 and 365),
  insufficient_data_reminder_days integer not null default 60 check (insufficient_data_reminder_days between 7 and 365),
  high_usage_annual_km integer not null default 20000 check (high_usage_annual_km > 0),
  low_usage_annual_km integer not null default 8000 check (low_usage_annual_km >= 0),
  high_confidence_min_verified_readings integer not null default 3 check (high_confidence_min_verified_readings between 2 and 20),
  high_confidence_min_span_days integer not null default 60 check (high_confidence_min_span_days between 7 and 730),
  recent_verified_mileage_days integer not null default 120 check (recent_verified_mileage_days between 7 and 730),
  medium_confidence_min_readings integer not null default 2 check (medium_confidence_min_readings between 1 and 20),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (setting_key, version),
  check (due_days <= approaching_days),
  check (due_km <= approaching_km),
  check (low_usage_annual_km < high_usage_annual_km)
);

create unique index if not exists maintenance_settings_active_key_idx
  on public.maintenance_settings (setting_key)
  where active;

insert into public.maintenance_settings (setting_key, version)
values ('default', 1)
on conflict (setting_key, version) do nothing;

create table if not exists public.vehicle_maintenance_forecasts (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  rule_id uuid not null references public.vehicle_maintenance_rules(id) on delete restrict,
  rule_version integer not null,
  last_service_history_id uuid references public.vehicle_service_history(id) on delete set null,
  current_mileage_snapshot_km integer check (current_mileage_snapshot_km is null or current_mileage_snapshot_km between 0 and 3218688),
  estimated_daily_km numeric(12, 2) check (estimated_daily_km is null or estimated_daily_km >= 0),
  next_due_mileage_km integer check (next_due_mileage_km is null or next_due_mileage_km >= 0),
  mileage_due_date date,
  calendar_due_date date,
  next_due_date date,
  confidence text not null check (confidence in ('High', 'Medium', 'Low')),
  reason jsonb not null default '{}'::jsonb,
  status text not null check (status in (
    'Not Yet Due', 'Approaching', 'Due', 'Overdue', 'Inspection Required',
    'Awaiting Mileage', 'Scheduled', 'Completed', 'Dismissed', 'Not Applicable'
  )),
  needs_manual_review boolean not null default false,
  calculated_at timestamptz not null default now(),
  idempotency_key text not null unique,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists vehicle_maintenance_forecasts_active_rule_idx
  on public.vehicle_maintenance_forecasts (vehicle_id, rule_id)
  where archived_at is null;
create index if not exists vehicle_maintenance_forecasts_status_due_idx
  on public.vehicle_maintenance_forecasts (status, next_due_date, confidence)
  where archived_at is null;
create index if not exists vehicle_maintenance_forecasts_vehicle_idx
  on public.vehicle_maintenance_forecasts (vehicle_id, updated_at desc)
  where archived_at is null;

create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references auth.users(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete cascade,
  related_forecast_id uuid references public.vehicle_maintenance_forecasts(id) on delete cascade,
  task_type text not null check (task_type in ('maintenance_follow_up', 'mileage_update', 'manual_review')),
  title text not null,
  detail text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_admin_id uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open', 'in_progress', 'snoozed', 'completed', 'dismissed')),
  snoozed_until timestamptz,
  completed_at timestamptz,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_tasks_work_queue_idx
  on public.crm_tasks (status, priority, due_at, created_at)
  where status in ('open', 'in_progress', 'snoozed');
create index if not exists crm_tasks_vehicle_idx
  on public.crm_tasks (vehicle_id, created_at desc);

create table if not exists public.maintenance_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  idempotency_key text not null unique,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  stats jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists maintenance_job_runs_date_idx
  on public.maintenance_job_runs (job_name, started_at desc);

-- Recalculation is queued by data changes and processed by the Phase 2 job.
create or replace function public.request_vehicle_maintenance_recalculation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_vehicle_id uuid;
begin
  target_vehicle_id := coalesce(new.vehicle_id, old.vehicle_id, new.id, old.id);
  update public.vehicles
  set maintenance_recalculation_required = true,
      maintenance_recalculation_requested_at = now()
  where id = target_vehicle_id;
  if tg_op = 'UPDATE' and old.vehicle_id is distinct from new.vehicle_id and old.vehicle_id is not null then
    update public.vehicles
    set maintenance_recalculation_required = true,
        maintenance_recalculation_requested_at = now()
    where id = old.vehicle_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists queue_forecast_after_mileage_change on public.vehicle_mileage_readings;
create trigger queue_forecast_after_mileage_change
  after insert or update or delete on public.vehicle_mileage_readings
  for each row execute function public.request_vehicle_maintenance_recalculation();

drop trigger if exists queue_forecast_after_service_change on public.vehicle_service_history;
create trigger queue_forecast_after_service_change
  after insert or update or delete on public.vehicle_service_history
  for each row execute function public.request_vehicle_maintenance_recalculation();

drop trigger if exists queue_forecast_after_appointment_change on public.service_requests;
create trigger queue_forecast_after_appointment_change
  after insert or update of status, preferred_date, service_type, vehicle_id on public.service_requests
  for each row when (coalesce(new.vehicle_id, old.vehicle_id) is not null)
  execute function public.request_vehicle_maintenance_recalculation();

create or replace function public.queue_all_vehicle_maintenance_recalculations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.approval_status = 'approved' or old.approval_status = 'approved' then
    update public.vehicles
    set maintenance_recalculation_required = true,
        maintenance_recalculation_requested_at = now()
    where archived_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists queue_forecasts_after_rule_change on public.vehicle_maintenance_rules;
create trigger queue_forecasts_after_rule_change
  after insert or update of approval_status, active, archived_at on public.vehicle_maintenance_rules
  for each row execute function public.queue_all_vehicle_maintenance_recalculations();

create or replace function public.mark_vehicle_maintenance_recalculation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.maintenance_recalculation_required := true;
  new.maintenance_recalculation_requested_at := now();
  return new;
end;
$$;

drop trigger if exists queue_forecast_after_vehicle_change on public.vehicles;
create trigger queue_forecast_after_vehicle_change
  before update of year, make, model, trim, engine, drivetrain, fuel_type, registration_date, service_preferences
  on public.vehicles
  for each row execute function public.mark_vehicle_maintenance_recalculation();

-- Phase 2 intelligence is administrator/system managed. Customer display is
-- intentionally deferred until the Phase 4 portal is implemented.
alter table public.vehicle_maintenance_rules enable row level security;
alter table public.maintenance_settings enable row level security;
alter table public.vehicle_maintenance_forecasts enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.maintenance_job_runs enable row level security;

revoke all on public.vehicle_maintenance_rules from anon, authenticated;
revoke all on public.maintenance_settings from anon, authenticated;
revoke all on public.vehicle_maintenance_forecasts from anon, authenticated;
revoke all on public.crm_tasks from anon, authenticated;
revoke all on public.maintenance_job_runs from anon, authenticated;

-- No maintenance intervals are seeded here. An administrator must create a
-- sourced rule, review its exact applicability, and approve it before any
-- forecast can be generated.
