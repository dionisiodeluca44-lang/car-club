-- White Glove Concierge complete platform update
-- Run once in the Supabase SQL editor. It is safe to run more than once.

create extension if not exists "pgcrypto";

-- Preserve active Stripe subscriptions while moving legacy package names to the
-- new entitlement names. No Stripe subscription or vehicle record is changed.
update public.profiles
set plan = case
  when plan in ('Silver', 'Club Drive', 'Gold') then 'Essential'
  when plan = 'Platinum' then 'Premium'
  else plan
end,
updated_at = now()
where plan in ('Silver', 'Club Drive', 'Gold', 'Platinum');

alter table public.profiles
  add column if not exists vehicle_allowance integer,
  add column if not exists concierge_24_7 boolean not null default false,
  add column if not exists fleet_management boolean not null default false,
  add column if not exists custom_membership_price_cents integer,
  add column if not exists custom_membership_cadence text,
  add column if not exists included_services jsonb not null default '[]'::jsonb;

update public.profiles
set
  vehicle_allowance = case when plan = 'Collector' then greatest(coalesce(vehicle_allowance, 2), 2) else 1 end,
  concierge_24_7 = plan in ('Premium', 'Collector'),
  fleet_management = plan = 'Collector'
where vehicle_allowance is null;

-- A billing cadence is intentionally nullable. Checkout stays disabled until an
-- administrator confirms monthly or annual billing.
alter table if exists public.membership_pricing
  alter column cadence drop not null,
  alter column cadence drop default;

alter table if exists public.membership_pricing
  drop constraint if exists membership_pricing_cadence_check;

alter table if exists public.membership_pricing
  add constraint membership_pricing_cadence_check
  check (cadence is null or cadence in ('/month', '/year'));

insert into public.membership_pricing (plan_name, amount_cents, cadence, note, updated_at)
values
  ('Essential', 14999, null, 'One vehicle with standard concierge services and the complete members app.' , now()),
  ('Premium', 19999, null, 'One vehicle with Essential access plus 24/7 concierge support.', now()),
  ('Collector', null, null, 'Pricing, vehicle allowance, and included services are configured after a private consultation.', now())
on conflict (plan_name) do update set
  amount_cents = excluded.amount_cents,
  cadence = coalesce(public.membership_pricing.cadence, excluded.cadence),
  note = excluded.note,
  updated_at = now();

delete from public.membership_pricing
where plan_name not in ('Essential', 'Premium', 'Collector');

-- Benefits are explicitly assigned by an administrator. New members therefore
-- start with no benefits and no implicit monetary allowance.
create table if not exists public.membership_benefit_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  benefit_key text not null,
  label text not null,
  description text,
  quantity_total integer not null check (quantity_total > 0),
  quantity_redeemed integer not null default 0 check (quantity_redeemed >= 0),
  credit_cents integer not null default 0 check (credit_cents >= 0),
  expires_at timestamptz,
  status text not null default 'active' check (status in ('active', 'expired', 'removed')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity_redeemed <= quantity_total)
);

create index if not exists membership_benefit_assignments_member_idx
  on public.membership_benefit_assignments (user_id, status, expires_at);

create table if not exists public.membership_benefit_audit_logs (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.membership_benefit_assignments(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  service_request_id uuid references public.service_requests(id) on delete set null,
  action text not null,
  quantity_delta integer not null default 0,
  actor text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (service_request_id, assignment_id, action)
);

alter table public.membership_benefit_assignments enable row level security;
alter table public.membership_benefit_audit_logs enable row level security;
revoke insert, update, delete on public.membership_benefit_assignments from authenticated;
revoke insert, update, delete on public.membership_benefit_audit_logs from authenticated;
grant select on public.membership_benefit_assignments to authenticated;
grant select on public.membership_benefit_audit_logs to authenticated;

drop policy if exists "Members can read own assigned benefits" on public.membership_benefit_assignments;
create policy "Members can read own assigned benefits"
  on public.membership_benefit_assignments for select
  using (auth.uid() = user_id);

drop policy if exists "Members can read own benefit audit" on public.membership_benefit_audit_logs;
create policy "Members can read own benefit audit"
  on public.membership_benefit_audit_logs for select
  using (auth.uid() = user_id);

-- In-app notification history and provider-neutral device registrations.
create table if not exists public.member_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete cascade,
  category text not null check (category in ('service_recommendation', 'maintenance_reminder', 'mileage_reminder', 'benefit_update', 'appointment_update')),
  title text not null,
  body text not null,
  deep_link text,
  dedupe_key text not null unique,
  scheduled_for timestamptz not null default now(),
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'in_app', 'sent', 'failed', 'cancelled')),
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  read_at timestamptz,
  dismissed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists member_notifications_member_idx
  on public.member_notifications (user_id, scheduled_for desc);

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  provider text not null default 'onesignal',
  provider_device_id text not null,
  enabled boolean not null default true,
  timezone text not null default 'America/Toronto',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_device_id)
);

create table if not exists public.notification_settings (
  id boolean primary key default true check (id),
  recommendation_enabled boolean not null default true,
  maintenance_enabled boolean not null default true,
  mileage_enabled boolean not null default true,
  benefit_enabled boolean not null default true,
  appointment_enabled boolean not null default true,
  reminder_days integer[] not null default array[7, 3, 0],
  overdue_repeat_days integer not null default 3 check (overdue_repeat_days between 1 and 30),
  mileage_interval_days integer not null default 60 check (mileage_interval_days between 7 and 365),
  timezone text not null default 'America/Toronto',
  updated_by text,
  updated_at timestamptz not null default now()
);
insert into public.notification_settings (id) values (true) on conflict (id) do nothing;

alter table public.member_notifications enable row level security;
alter table public.push_devices enable row level security;
alter table public.notification_settings enable row level security;
grant select, update on public.member_notifications to authenticated;
grant select, insert, update, delete on public.push_devices to authenticated;

drop policy if exists "Members can read own notifications" on public.member_notifications;
create policy "Members can read own notifications"
  on public.member_notifications for select using (auth.uid() = user_id);
drop policy if exists "Members can update own notification state" on public.member_notifications;
create policy "Members can update own notification state"
  on public.member_notifications for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Members manage own push devices" on public.push_devices;
create policy "Members manage own push devices"
  on public.push_devices for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Collector inquiries remain distinct from payment checkout.
create table if not exists public.collector_membership_inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  vehicle_count integer not null check (vehicle_count between 2 and 100),
  message text,
  status text not null default 'new' check (status in ('new', 'contacted', 'configured', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.collector_membership_inquiries enable row level security;
grant insert, select on public.collector_membership_inquiries to authenticated;
drop policy if exists "Members create collector inquiry" on public.collector_membership_inquiries;
create policy "Members create collector inquiry"
  on public.collector_membership_inquiries for insert
  with check (auth.uid() = user_id);
drop policy if exists "Members read own collector inquiries" on public.collector_membership_inquiries;
create policy "Members read own collector inquiries"
  on public.collector_membership_inquiries for select
  using (auth.uid() = user_id);
