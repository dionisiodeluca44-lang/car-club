-- Run this after the main membership schema in Supabase SQL Editor to make the member feed shared.

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

alter table public.feed_posts enable row level security;

drop policy if exists "Members can read all feed posts" on public.feed_posts;
drop policy if exists "Members can create own feed posts" on public.feed_posts;
drop policy if exists "Members can update own feed posts" on public.feed_posts;
drop policy if exists "Members can delete own feed posts" on public.feed_posts;

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
