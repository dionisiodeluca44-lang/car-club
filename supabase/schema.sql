-- White Glove Concierge backend schema
-- Run this in the Supabase SQL editor after creating a new Supabase project.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  plan text not null default 'Club Drive',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, plan)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', 'Member'),
    coalesce(new.raw_user_meta_data->>'plan', 'Club Drive')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
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
alter table public.feed_posts enable row level security;

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
  using (auth.uid() = user_id);

create policy "Members can insert own vehicles"
  on public.vehicles for insert
  with check (auth.uid() = user_id);

create policy "Members can update own vehicles"
  on public.vehicles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Members can delete own vehicles"
  on public.vehicles for delete
  using (auth.uid() = user_id);

create policy "Members can read own service requests"
  on public.service_requests for select
  using (auth.uid() = user_id);

create policy "Members can insert own service requests"
  on public.service_requests for insert
  with check (auth.uid() = user_id);

create policy "Members can update own service requests"
  on public.service_requests for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Members can read all feed posts"
  on public.feed_posts for select
  using (auth.role() = 'authenticated');

create policy "Members can create own feed posts"
  on public.feed_posts for insert
  with check (auth.uid() = user_id);

create policy "Members can update own feed posts"
  on public.feed_posts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Members can delete own feed posts"
  on public.feed_posts for delete
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('vehicle-photos', 'vehicle-photos', true)
on conflict (id) do nothing;

create policy "Members can upload vehicle photos"
  on storage.objects for insert
  with check (
    bucket_id = 'vehicle-photos'
    and auth.role() = 'authenticated'
  );

create policy "Vehicle photos are public"
  on storage.objects for select
  using (bucket_id = 'vehicle-photos');

create policy "Members can update vehicle photos"
  on storage.objects for update
  using (
    bucket_id = 'vehicle-photos'
    and auth.role() = 'authenticated'
  );
