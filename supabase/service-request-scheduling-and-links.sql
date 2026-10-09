-- Run once in Supabase SQL Editor before deploying the appointment, transport,
-- cancellation, and admin-created payment-link features.

alter table public.service_requests
  add column if not exists transport_date date,
  add column if not exists transport_time time,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text,
  add column if not exists payment_link_url text,
  add column if not exists payment_link_amount_cents integer check (payment_link_amount_cents is null or payment_link_amount_cents > 0),
  add column if not exists payment_link_label text,
  add column if not exists payment_link_created_at timestamptz;
