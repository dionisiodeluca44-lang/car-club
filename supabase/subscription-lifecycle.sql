-- Run this once for an existing White Glove project that already has paid
-- membership activation enabled. New projects receive these fields from schema.sql.

alter table public.profiles
  add column if not exists stripe_subscription_created_at timestamptz,
  add column if not exists stripe_subscription_event_id text,
  add column if not exists subscription_status_updated_at timestamptz,
  add column if not exists subscription_cancel_at_period_end boolean not null default false;

update public.profiles
set subscription_status_updated_at = coalesce(
  subscription_status_updated_at,
  subscription_cancelled_at,
  subscription_activated_at,
  updated_at
)
where subscription_status_updated_at is null;

-- A signed-in member can still edit normal profile settings. Stripe entitlement
-- fields can only be changed with the Supabase service role used by the webhook.
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
