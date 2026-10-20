-- Run once in the Supabase SQL Editor before deploying consultation booking.

create table if not exists public.membership_consultations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  phone text,
  plan text not null,
  consultation_date date not null,
  consultation_time time not null,
  timezone text not null default 'America/Toronto',
  call_method text not null check (call_method in ('Google Meet', 'FaceTime', 'Phone call', 'WhatsApp')),
  call_details text,
  notes text,
  status text not null default 'scheduled' check (status in ('scheduled', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists membership_consultations_date_time_idx
  on public.membership_consultations (consultation_date, consultation_time);

create index if not exists membership_consultations_user_idx
  on public.membership_consultations (user_id, created_at desc);

create unique index if not exists membership_consultations_open_slot_idx
  on public.membership_consultations (consultation_date, consultation_time)
  where status in ('scheduled', 'confirmed');

alter table public.membership_consultations enable row level security;

-- Consultation records are created and managed only by the Netlify functions
-- using the Supabase service role. Members never receive direct table access.
revoke all on public.membership_consultations from anon, authenticated;
