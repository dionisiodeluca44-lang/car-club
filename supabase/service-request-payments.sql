-- Run once in Supabase SQL Editor to enable service quotes, deposits, balances,
-- and a payment history for every booking in the admin portal.

alter table public.service_requests
  add column if not exists quoted_total_cents integer not null default 0 check (quoted_total_cents >= 0),
  add column if not exists payment_mode text not null default 'custom' check (payment_mode in ('deposit', 'full', 'free', 'custom')),
  add column if not exists payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'deposit_paid', 'partially_paid', 'paid', 'refunded')),
  add column if not exists transport_date date,
  add column if not exists transport_time time,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text,
  add column if not exists payment_link_url text,
  add column if not exists payment_link_amount_cents integer check (payment_link_amount_cents is null or payment_link_amount_cents > 0),
  add column if not exists payment_link_label text,
  add column if not exists payment_link_created_at timestamptz;

create table if not exists public.service_request_payments (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  payment_type text not null check (payment_type in ('deposit', 'balance', 'full', 'manual', 'refund')),
  payment_method text not null default 'Admin recorded',
  stripe_checkout_session_id text unique,
  note text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists service_request_payments_request_date_idx
  on public.service_request_payments (service_request_id, paid_at desc);

create index if not exists service_request_payments_member_date_idx
  on public.service_request_payments (user_id, paid_at desc);

alter table public.service_request_payments enable row level security;
revoke insert, update, delete on public.service_request_payments from authenticated;
grant select on public.service_request_payments to authenticated;

drop policy if exists "Members can read own service payments" on public.service_request_payments;
create policy "Members can read own service payments"
  on public.service_request_payments for select
  using (auth.uid() = user_id and public.has_active_membership());
