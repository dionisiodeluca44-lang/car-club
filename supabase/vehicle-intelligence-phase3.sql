-- White Glove Concierge — Vehicle Intelligence Phase 3
-- CRM opportunities, consent-aware outreach, mandatory approval, and delivery history.
-- Run after vehicle-intelligence-phase2.sql. This migration is additive and idempotent.

create extension if not exists "pgcrypto";

alter table public.vehicles
  add column if not exists outreach_recalculation_required boolean not null default true,
  add column if not exists outreach_recalculation_requested_at timestamptz not null default now();

create table if not exists public.communication_preferences (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references auth.users(id) on delete cascade,
  preferred_language text not null default 'en-CA' check (preferred_language in ('en-CA', 'fr-CA')),
  email_enabled boolean not null default false,
  sms_enabled boolean not null default false,
  transactional_consent boolean not null default false,
  promotional_consent boolean not null default false,
  consent_source text,
  consent_timestamp timestamptz,
  promotional_consent_expires_at timestamptz,
  unsubscribe_timestamp timestamptz,
  suppressed_at timestamptz,
  suppression_reason text,
  quiet_hours_start time not null default '21:00',
  quiet_hours_end time not null default '09:00',
  timezone text not null default 'America/Toronto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not (promotional_consent or transactional_consent) or consent_timestamp is not null)
);

create index if not exists communication_preferences_contact_idx
  on public.communication_preferences (promotional_consent, transactional_consent, suppressed_at, updated_at desc);

create table if not exists public.outreach_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null default 'default',
  version integer not null check (version > 0),
  draft_generation_enabled boolean not null default true,
  approval_required boolean not null default true check (approval_required),
  max_customer_contacts_per_30_days integer not null default 4 check (max_customer_contacts_per_30_days between 1 and 30),
  minimum_days_between_contacts integer not null default 7 check (minimum_days_between_contacts between 1 and 90),
  opportunity_min_confidence text not null default 'Medium' check (opportunity_min_confidence in ('High', 'Medium', 'Low')),
  default_channel text not null default 'email' check (default_channel in ('email', 'sms')),
  booking_url text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (setting_key, version)
);

create unique index if not exists outreach_settings_active_key_idx
  on public.outreach_settings (setting_key) where active;

insert into public.outreach_settings (setting_key, version)
values ('default', 1)
on conflict (setting_key, version) do nothing;

create table if not exists public.service_opportunities (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  forecast_id uuid references public.vehicle_maintenance_forecasts(id) on delete set null,
  service_type text not null,
  service_category text not null default 'mechanical',
  reason text not null,
  evidence_source jsonb not null default '{}'::jsonb,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  estimated_due_date date,
  estimated_revenue_cents integer check (estimated_revenue_cents is null or estimated_revenue_cents >= 0),
  currency text not null default 'CAD' check (currency ~ '^[A-Z]{3}$'),
  quote_required boolean not null default true,
  pricing_source text,
  confidence text not null default 'Low' check (confidence in ('High', 'Medium', 'Low')),
  contact_status text not null default 'not_contacted'
    check (contact_status in ('not_contacted', 'drafted', 'approved', 'contacted', 'responded', 'suppressed')),
  booking_status text not null default 'not_booked'
    check (booking_status in ('not_booked', 'requested', 'booked', 'completed', 'cancelled')),
  status text not null default 'open'
    check (status in ('open', 'qualified', 'contacted', 'won', 'lost', 'dismissed', 'expired')),
  assigned_admin_id uuid references auth.users(id) on delete set null,
  related_appointment_id uuid references public.service_requests(id) on delete set null,
  idempotency_key text not null unique,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_opportunities_queue_idx
  on public.service_opportunities (status, priority, estimated_due_date, created_at desc)
  where archived_at is null;
create index if not exists service_opportunities_customer_idx
  on public.service_opportunities (customer_id, created_at desc);
create index if not exists service_opportunities_forecast_idx
  on public.service_opportunities (forecast_id) where forecast_id is not null;

alter table public.crm_tasks drop constraint if exists crm_tasks_task_type_check;
alter table public.crm_tasks add constraint crm_tasks_task_type_check
  check (task_type in (
    'maintenance_follow_up', 'mileage_update', 'manual_review',
    'outreach_approval', 'customer_follow_up', 'opportunity_review', 'appointment_follow_up'
  ));

create table if not exists public.outreach_messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  task_id uuid references public.crm_tasks(id) on delete set null,
  opportunity_id uuid references public.service_opportunities(id) on delete set null,
  forecast_id uuid references public.vehicle_maintenance_forecasts(id) on delete set null,
  outreach_type text not null,
  purpose text not null default 'transactional' check (purpose in ('transactional', 'promotional')),
  channel text not null check (channel in ('email', 'sms')),
  language text not null default 'en-CA' check (language in ('en-CA', 'fr-CA')),
  trigger_reason text not null,
  subject text,
  message_body text not null,
  generated_by_ai boolean not null default false,
  draft_method text not null default 'verified_template' check (draft_method in ('verified_template', 'ai_provider', 'administrator')),
  generation_metadata jsonb not null default '{}'::jsonb,
  revision integer not null default 1 check (revision > 0),
  approval_status text not null default 'draft'
    check (approval_status in ('draft', 'pending_approval', 'approved', 'rejected', 'cancelled')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_by_label text,
  approved_at timestamptz,
  rejected_reason text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  delivery_status text not null default 'not_scheduled'
    check (delivery_status in ('not_scheduled', 'scheduled', 'sending', 'sent', 'delivered', 'failed', 'cancelled')),
  delivery_error text,
  delivery_provider text,
  provider_message_id text,
  response_status text not null default 'none'
    check (response_status in ('none', 'replied', 'booked', 'declined', 'no_response')),
  customer_response text,
  responded_at timestamptz,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (approval_status <> 'approved' or approved_at is not null),
  check (delivery_status not in ('sent', 'delivered') or sent_at is not null)
);

create index if not exists outreach_messages_approval_queue_idx
  on public.outreach_messages (approval_status, created_at desc)
  where approval_status in ('draft', 'pending_approval');
create index if not exists outreach_messages_delivery_idx
  on public.outreach_messages (delivery_status, scheduled_at, created_at)
  where delivery_status in ('scheduled', 'sending', 'failed');
create index if not exists outreach_messages_customer_idx
  on public.outreach_messages (customer_id, created_at desc);

create table if not exists public.outreach_events (
  id uuid primary key default gen_random_uuid(),
  outreach_message_id uuid not null references public.outreach_messages(id) on delete cascade,
  event_type text not null,
  actor_type text not null default 'administrator'
    check (actor_type in ('administrator', 'system', 'provider', 'customer')),
  actor_id uuid references auth.users(id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists outreach_events_message_date_idx
  on public.outreach_events (outreach_message_id, created_at desc);

create table if not exists public.outreach_job_runs (
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

create or replace function public.enforce_outreach_approval()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.subject is distinct from old.subject or new.message_body is distinct from old.message_body)
    and old.approval_status in ('approved') then
    new.approval_status := 'pending_approval';
    new.approved_by := null;
    new.approved_by_label := null;
    new.approved_at := null;
    new.scheduled_at := null;
    new.delivery_status := 'not_scheduled';
    new.revision := old.revision + 1;
  end if;
  if new.delivery_status in ('sending', 'sent', 'delivered') and new.approval_status <> 'approved' then
    raise exception 'Outreach must be explicitly approved before delivery.' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists enforce_outreach_approval_before_update on public.outreach_messages;
create trigger enforce_outreach_approval_before_update
  before update on public.outreach_messages
  for each row execute function public.enforce_outreach_approval();

create or replace function public.request_vehicle_outreach_recalculation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_vehicle_id uuid;
begin
  target_vehicle_id := coalesce(new.vehicle_id, old.vehicle_id);
  if target_vehicle_id is not null then
    update public.vehicles
    set outreach_recalculation_required = true,
        outreach_recalculation_requested_at = now()
    where id = target_vehicle_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists queue_outreach_after_forecast_change on public.vehicle_maintenance_forecasts;
create trigger queue_outreach_after_forecast_change
  after insert or update of status, confidence, next_due_date, archived_at on public.vehicle_maintenance_forecasts
  for each row execute function public.request_vehicle_outreach_recalculation();

drop trigger if exists queue_outreach_after_appointment_insert on public.service_requests;
drop trigger if exists queue_outreach_after_appointment_update on public.service_requests;
create trigger queue_outreach_after_appointment_insert
  after insert on public.service_requests
  for each row when (new.vehicle_id is not null)
  execute function public.request_vehicle_outreach_recalculation();
create trigger queue_outreach_after_appointment_update
  after update of status, service_type, preferred_date, vehicle_id on public.service_requests
  for each row when (coalesce(new.vehicle_id, old.vehicle_id) is not null)
  execute function public.request_vehicle_outreach_recalculation();

alter table public.communication_preferences enable row level security;
alter table public.outreach_settings enable row level security;
alter table public.service_opportunities enable row level security;
alter table public.outreach_messages enable row level security;
alter table public.outreach_events enable row level security;
alter table public.outreach_job_runs enable row level security;

revoke all on public.communication_preferences from anon, authenticated;
revoke all on public.outreach_settings from anon, authenticated;
revoke all on public.service_opportunities from anon, authenticated;
revoke all on public.outreach_messages from anon, authenticated;
revoke all on public.outreach_events from anon, authenticated;
revoke all on public.outreach_job_runs from anon, authenticated;

-- Phase 3 is administrator-only. Customer preference controls are exposed in
-- Phase 4 after ownership policies and the member UI are added.
-- No message delivery trigger is created. Delivery always requires an explicit
-- administrator action after approval, and the backend rechecks consent.
