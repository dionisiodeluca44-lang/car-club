-- Run once in Supabase SQL Editor on existing projects.
-- Benefit redemptions are controlled by the admin Netlify function (service role).
-- Members can only read their own active membership-year ledger.

create extension if not exists "pgcrypto";

-- Membership tiers and their benefit allowances are controlled by Stripe/webhooks,
-- not by member profile edits.
revoke update (plan) on public.profiles from authenticated;

create table if not exists public.membership_benefit_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service_request_id uuid references public.service_requests(id) on delete set null,
  benefit_key text not null check (benefit_key in ('maintenance-wash', 'full-detail', 'transport', 'protection')),
  credit_cents integer not null check (credit_cents >= 0),
  description text not null,
  period_start date not null,
  period_end date not null,
  status text not null default 'redeemed' check (status in ('redeemed', 'reversed')),
  used_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_request_id, benefit_key),
  check (period_end > period_start)
);

create index if not exists membership_benefit_usage_member_period_idx
  on public.membership_benefit_usage (user_id, period_start, period_end, status);

alter table public.membership_benefit_usage enable row level security;
revoke insert, update, delete on public.membership_benefit_usage from authenticated;
grant select on public.membership_benefit_usage to authenticated;

drop policy if exists "Members can read own membership benefits" on public.membership_benefit_usage;

create policy "Members can read own membership benefits"
  on public.membership_benefit_usage for select
  using (auth.uid() = user_id and public.has_active_membership());

-- Promote the Collector package from quote-only to the recommended base price.
-- Existing non-null admin pricing is preserved.
update public.membership_pricing
set
  amount_cents = 69900,
  cadence = '/month',
  note = 'For collections of up to three vehicles, with additional vehicles quoted separately.',
  updated_at = now()
where plan_name = 'Collector'
  and amount_cents is null;
