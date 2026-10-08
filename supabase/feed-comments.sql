-- Run once in the Supabase SQL Editor to enable comments on member feed photos.

create table if not exists public.feed_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'Member',
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists feed_comments_post_idx
  on public.feed_comments (post_id, created_at);

alter table public.feed_comments enable row level security;

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
  alter publication supabase_realtime add table public.feed_comments;
exception
  when duplicate_object then null;
end;
$$;
