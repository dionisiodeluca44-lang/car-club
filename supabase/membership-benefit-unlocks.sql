-- Run once in Supabase SQL Editor on existing projects.
-- Successful Stripe membership invoices fund the earned-benefit unlock budget.
-- Members can read only their own revenue summary; only the service-role webhook writes it.

create extension if not exists "pgcrypto";

create table if not exists public.membership_revenue_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_invoice_id text not null unique,
  stripe_subscription_id text,
  amount_paid_cents integer not null default 0 check (amount_paid_cents >= 0),
  amount_refunded_cents integer not null default 0 check (amount_refunded_cents >= 0),
  currency text not null default 'cad',
  paid_at timestamptz not null,
  service_period_start timestamptz,
  service_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount_refunded_cents <= amount_paid_cents)
);

create index if not exists membership_revenue_events_member_paid_idx
  on public.membership_revenue_events (user_id, paid_at);

alter table public.membership_revenue_events enable row level security;
revoke insert, update, delete on public.membership_revenue_events from authenticated;
grant select on public.membership_revenue_events to authenticated;

drop policy if exists "Members can read own membership revenue" on public.membership_revenue_events;

create policy "Members can read own membership revenue"
  on public.membership_revenue_events for select
  using (auth.uid() = user_id and public.has_active_membership());

