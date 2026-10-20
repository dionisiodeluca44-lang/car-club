-- Run once after membership-consultations.sql.
-- Allows public consultation requests and stores every vehicle separately.

alter table public.membership_consultations
  alter column user_id drop not null,
  add column if not exists lead_source text not null default 'membership_signup',
  add column if not exists vehicles jsonb not null default '[]'::jsonb;

create index if not exists membership_consultations_email_created_idx
  on public.membership_consultations (lower(email), created_at desc);
