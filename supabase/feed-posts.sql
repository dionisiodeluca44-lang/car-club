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

create table if not exists public.feed_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('heart', 'fire', 'applause', 'wow')),
  created_at timestamptz not null default now(),
  unique (post_id, user_id, emoji)
);

create table if not exists public.feed_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'Member',
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists feed_reactions_post_idx
  on public.feed_reactions (post_id, created_at);

create index if not exists feed_comments_post_idx
  on public.feed_comments (post_id, created_at);

alter table public.feed_posts enable row level security;
alter table public.feed_reactions enable row level security;
alter table public.feed_comments enable row level security;

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

drop policy if exists "Members can read feed reactions" on public.feed_reactions;
drop policy if exists "Members can create own feed reactions" on public.feed_reactions;
drop policy if exists "Members can delete own feed reactions" on public.feed_reactions;

create policy "Members can read feed reactions"
  on public.feed_reactions for select
  using (public.has_active_membership());

create policy "Members can create own feed reactions"
  on public.feed_reactions for insert
  with check (auth.uid() = user_id and public.has_active_membership());

create policy "Members can delete own feed reactions"
  on public.feed_reactions for delete
  using (auth.uid() = user_id and public.has_active_membership());

drop policy if exists "Members can read feed comments" on public.feed_comments;
drop policy if exists "Members can create own feed comments" on public.feed_comments;
drop policy if exists "Members can delete own feed comments" on public.feed_comments;

create policy "Members can read feed comments"
  on public.feed_comments for select
  using (public.has_active_membership());

create policy "Members can create own feed comments"
  on public.feed_comments for insert
  with check (auth.uid() = user_id and public.has_active_membership());

create policy "Members can delete own feed comments"
  on public.feed_comments for delete
  using (auth.uid() = user_id and public.has_active_membership());

do $$
begin
  alter publication supabase_realtime add table public.feed_reactions;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.feed_comments;
exception
  when duplicate_object then null;
end;
$$;
