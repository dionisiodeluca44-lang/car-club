-- Run once to give every member who is active today permanent Collector app access.
-- This changes app access and benefit allowances only. It does not change an
-- existing Stripe subscription's billing amount.

alter table public.profiles
  add column if not exists collector_access_override boolean not null default false;

update public.profiles
set
  collector_access_override = true,
  plan = 'Collector',
  updated_at = now()
where subscription_status in ('active', 'trialing');
