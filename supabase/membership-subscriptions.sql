-- Run this once in Supabase SQL Editor to enable paid membership activation.

alter table public.profiles
  add column if not exists subscription_status text not null default 'pending',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_activated_at timestamptz,
  add column if not exists subscription_cancelled_at timestamptz;

create table if not exists public.membership_pricing (
  plan_name text primary key,
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  cadence text not null default '/month' check (cadence in ('/month', '/year')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.membership_pricing enable row level security;

drop policy if exists "Anyone can read membership pricing" on public.membership_pricing;

create policy "Anyone can read membership pricing"
  on public.membership_pricing for select
  using (true);

insert into public.membership_pricing (plan_name, amount_cents, cadence, note)
values
  ('Silver', 9900, '/month', 'For owners who want the essentials managed with priority support.'),
  ('Club Drive', 14900, '/month', 'For owners who want pickup, delivery, and regular care coordination handled.'),
  ('Gold', 19900, '/month', 'For daily drivers and seasonal vehicles that need consistent care.'),
  ('Platinum', 39900, '/month', 'For owners who want complete white-glove vehicle management.'),
  ('Collector', null, '/month', 'For multi-car owners, collectors, and specialty storage needs.')
on conflict (plan_name) do nothing;
