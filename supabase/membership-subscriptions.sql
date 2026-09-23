-- Run this once in Supabase SQL Editor to enable paid membership activation.

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

-- Keep subscription access under the service-role webhook's control.
revoke update on public.profiles from authenticated;
grant update (id, email, full_name, username, avatar_url, notifications, updated_at)
  on public.profiles to authenticated;

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

drop policy if exists "Members can read own vehicles" on public.vehicles;
drop policy if exists "Members can insert own vehicles" on public.vehicles;
drop policy if exists "Members can update own vehicles" on public.vehicles;
drop policy if exists "Members can delete own vehicles" on public.vehicles;
drop policy if exists "Members can read own service requests" on public.service_requests;
drop policy if exists "Members can insert own service requests" on public.service_requests;
drop policy if exists "Members can update own service requests" on public.service_requests;
drop policy if exists "Members can read all feed posts" on public.feed_posts;
drop policy if exists "Members can create own feed posts" on public.feed_posts;
drop policy if exists "Members can update own feed posts" on public.feed_posts;
drop policy if exists "Members can delete own feed posts" on public.feed_posts;
drop policy if exists "Members can upload vehicle photos" on storage.objects;
drop policy if exists "Members can update vehicle photos" on storage.objects;

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

create policy "Members can upload vehicle photos"
  on storage.objects for insert
  with check (
    bucket_id = 'vehicle-photos'
    and public.has_active_membership()
  );

create policy "Members can update vehicle photos"
  on storage.objects for update
  using (
    bucket_id = 'vehicle-photos'
    and public.has_active_membership()
  );

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
  ('Collector', 69900, '/month', 'For collections of up to three vehicles, with additional vehicles quoted separately.')
on conflict (plan_name) do nothing;
