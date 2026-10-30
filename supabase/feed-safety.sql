-- Run once in the Supabase SQL Editor before releasing the feed safety update.

create table if not exists public.feed_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 1 and 100),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists feed_reports_status_created_idx on public.feed_reports (status, created_at desc);
create index if not exists feed_reports_reporter_idx on public.feed_reports (reporter_id, created_at desc);

create table if not exists public.feed_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  blocked_name text not null default 'Member',
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_user_id),
  check (blocker_id <> blocked_user_id)
);

alter table public.feed_reports enable row level security;
alter table public.feed_blocks enable row level security;

drop policy if exists "Members can create own feed reports" on public.feed_reports;
drop policy if exists "Members can read own feed reports" on public.feed_reports;
create policy "Members can create own feed reports" on public.feed_reports for insert
  with check (auth.uid() = reporter_id and public.has_active_membership());
create policy "Members can read own feed reports" on public.feed_reports for select
  using (auth.uid() = reporter_id and public.has_active_membership());

drop policy if exists "Members can read own feed blocks" on public.feed_blocks;
drop policy if exists "Members can create own feed blocks" on public.feed_blocks;
drop policy if exists "Members can delete own feed blocks" on public.feed_blocks;
create policy "Members can read own feed blocks" on public.feed_blocks for select
  using (auth.uid() = blocker_id and public.has_active_membership());
create policy "Members can create own feed blocks" on public.feed_blocks for insert
  with check (auth.uid() = blocker_id and public.has_active_membership());
create policy "Members can delete own feed blocks" on public.feed_blocks for delete
  using (auth.uid() = blocker_id and public.has_active_membership());

-- Existing vehicle-photos storage policies also cover video files stored under
-- each member's own user-id/feed folder. Increase the vehicle-photos bucket file
-- size limit to at least 50 MB in Storage settings if it is currently lower.
