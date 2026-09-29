-- Run this once in the Supabase SQL Editor to enable shared feed reactions.

create table if not exists public.feed_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('heart', 'fire', 'applause', 'wow')),
  created_at timestamptz not null default now(),
  unique (post_id, user_id, emoji)
);

create index if not exists feed_reactions_post_idx
  on public.feed_reactions (post_id, created_at);

alter table public.feed_reactions enable row level security;

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

do $$
begin
  alter publication supabase_realtime add table public.feed_reactions;
exception
  when duplicate_object then null;
end;
$$; 
