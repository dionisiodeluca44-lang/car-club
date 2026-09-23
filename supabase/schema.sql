-- White Glove Concierge backend schema
-- Run this in the Supabase SQL editor after creating a new Supabase project.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  username text,
  avatar_url text,
  plan text not null default 'Club Drive',
  subscription_status text not null default 'pending',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_subscription_created_at timestamptz,
  stripe_subscription_event_id text,
  subscription_activated_at timestamptz,
  subscription_cancelled_at timestamptz,
  subscription_status_updated_at timestamptz,
  subscription_cancel_at_period_end boolean not null default false,
  notifications jsonb not null default '{"bookingUpdates": true, "feedActivity": true, "offers": true, "serviceReminders": true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists subscription_status text not null default 'pending',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_subscription_created_at timestamptz,
  add column if not exists stripe_subscription_event_id text,
  add column if not exists subscription_activated_at timestamptz,
  add column if not exists subscription_cancelled_at timestamptz,
  add column if not exists subscription_status_updated_at timestamptz,
  add column if not exists subscription_cancel_at_period_end boolean not null default false;

-- Members may edit their profile details, but only the service-role webhook may
-- change Stripe identity or entitlement fields.
revoke update on public.profiles from authenticated;
grant update (id, email, full_name, username, avatar_url, notifications, updated_at)
  on public.profiles to authenticated;

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year text,
  make text,
  model text,
  mileage text,
  usage text,
  status text not null default 'Active',
  market_value text,
  horsepower text,
  work_done jsonb not null default '[]'::jsonb,
  notes text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_label text not null,
  service_type text not null,
  preferred_date date,
  preferred_time time,
  notes text,
  status text not null default 'Requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.feed_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'Member',
  vehicle_label text,
  caption text,
  image_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_pricing (
  service_label text primary key,
  payment_mode text not null default 'deposit' check (payment_mode in ('deposit', 'full', 'free')),
  amount_cents integer not null default 0 check (amount_cents >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.membership_pricing (
  plan_name text primary key,
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  cadence text not null default '/month' check (cadence in ('/month', '/year')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, username, avatar_url, plan, subscription_status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', 'Member'),
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'plan', 'Club Drive'),
    'pending'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    username = excluded.username,
    avatar_url = excluded.avatar_url,
    plan = excluded.plan,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.service_requests enable row level security;
alter table public.membership_benefit_usage enable row level security;
revoke insert, update, delete on public.membership_benefit_usage from authenticated;
grant select on public.membership_benefit_usage to authenticated;
alter table public.feed_posts enable row level security;
alter table public.service_pricing enable row level security;
alter table public.membership_pricing enable row level security;

create or replace function public.has_active_membership()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and subscription_status in ('active', 'trialing')
  );
$$;

revoke all on function public.has_active_membership() from public;
grant execute on function public.has_active_membership() to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.feed_posts;
exception
  when duplicate_object then null;
end;
$$;

drop policy if exists "Members can read own profile" on public.profiles;
drop policy if exists "Members can insert own profile" on public.profiles;
drop policy if exists "Members can update own profile" on public.profiles;
drop policy if exists "Members can read own vehicles" on public.vehicles;
drop policy if exists "Members can insert own vehicles" on public.vehicles;
drop policy if exists "Members can update own vehicles" on public.vehicles;
drop policy if exists "Members can delete own vehicles" on public.vehicles;
drop policy if exists "Members can read own service requests" on public.service_requests;
drop policy if exists "Members can insert own service requests" on public.service_requests;
drop policy if exists "Members can update own service requests" on public.service_requests;
drop policy if exists "Members can read own membership benefits" on public.membership_benefit_usage;
drop policy if exists "Members can read all feed posts" on public.feed_posts;
drop policy if exists "Members can create own feed posts" on public.feed_posts;
drop policy if exists "Members can update own feed posts" on public.feed_posts;
drop policy if exists "Members can delete own feed posts" on public.feed_posts;
drop policy if exists "Members can read service pricing" on public.service_pricing;
drop policy if exists "Anyone can read membership pricing" on public.membership_pricing;
drop policy if exists "Members can upload vehicle photos" on storage.objects;
drop policy if exists "Vehicle photos are public" on storage.objects;
drop policy if exists "Members can update vehicle photos" on storage.objects;

create policy "Members can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Members can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Members can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Members can read own vehicles"
  on public.vehicles for select
  using (auth.uid() = user_id and public.has_active_membership());

create policy "Members can insert own vehicles"
  on public.vehicles for insert
  with check (auth.uid() = user_id and public.has_active_membership());

create policy "Members can update own vehicles"
  on public.vehicles for update
  using (auth.uid() = user_id and public.has_active_membership())
  with check (auth.uid() = user_id and public.has_active_membership());

create policy "Members can delete own vehicles"
  on public.vehicles for delete
  using (auth.uid() = user_id and public.has_active_membership());

create policy "Members can read own service requests"
  on public.service_requests for select
  using (auth.uid() = user_id and public.has_active_membership());

create policy "Members can insert own service requests"
  on public.service_requests for insert
  with check (auth.uid() = user_id and public.has_active_membership());

create policy "Members can update own service requests"
  on public.service_requests for update
  using (auth.uid() = user_id and public.has_active_membership())
  with check (auth.uid() = user_id and public.has_active_membership());

create policy "Members can read own membership benefits"
  on public.membership_benefit_usage for select
  using (auth.uid() = user_id and public.has_active_membership());

create policy "Members can read all feed posts"
  on public.feed_posts for select
  using (public.has_active_membership());

create policy "Members can create own feed posts"
  on public.feed_posts for insert
  with check (auth.uid() = user_id and public.has_active_membership());

create policy "Members can update own feed posts"
  on public.feed_posts for update
  using (auth.uid() = user_id and public.has_active_membership())
  with check (auth.uid() = user_id and public.has_active_membership());

create policy "Members can delete own feed posts"
  on public.feed_posts for delete
  using (auth.uid() = user_id and public.has_active_membership());

create policy "Members can read service pricing"
  on public.service_pricing for select
  using (auth.role() = 'authenticated');

create policy "Anyone can read membership pricing"
  on public.membership_pricing for select
  using (true);

insert into public.membership_pricing (plan_name, amount_cents, cadence, note)
values
  ('Silver', 9900, '/month', 'For owners who want the essentials managed with priority support.'),
  ('Club Drive', 14900, '/month', 'For owners who want pickup, delivery, and regular care coordination handled.'),
  ('Gold', 19900, '/month', 'For daily drivers and seasonal vehicles that need consistent care.'),
  ('Platinum', 39900, '/month', 'For owners who want complete white-glove vehicle management.'),
  ('Collector', 69900, '/month', 'For collections of up to three vehicles, with additional vehicles quoted separately.')
on conflict (plan_name) do nothing;

insert into storage.buckets (id, name, public)
values ('vehicle-photos', 'vehicle-photos', true)
on conflict (id) do nothing;

create policy "Members can upload vehicle photos"
  on storage.objects for insert
  with check (
    bucket_id = 'vehicle-photos'
    and public.has_active_membership()
  );

create policy "Vehicle photos are public"
  on storage.objects for select
  using (bucket_id = 'vehicle-photos');

create policy "Members can update vehicle photos"
  on storage.objects for update
  using (
    bucket_id = 'vehicle-photos'
    and public.has_active_membership()
  );
