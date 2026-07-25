-- Run this once in Supabase SQL Editor to enable global service pricing.

create table if not exists public.service_pricing (
  service_label text primary key,
  payment_mode text not null default 'deposit' check (payment_mode in ('deposit', 'full', 'free')),
  amount_cents integer not null default 0 check (amount_cents >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_pricing enable row level security;

drop policy if exists "Members can read service pricing" on public.service_pricing;

create policy "Members can read service pricing"
  on public.service_pricing for select
  using (auth.role() = 'authenticated');
