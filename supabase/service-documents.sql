-- Run once in the Supabase SQL Editor.
-- Adds private receipts and service records that staff attach to completed requests.

create table if not exists public.service_documents (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_type text not null default 'application/octet-stream',
  file_size bigint not null default 0 check (file_size >= 0),
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists service_documents_member_request_idx
  on public.service_documents (user_id, service_request_id, created_at desc);

alter table public.service_documents enable row level security;

revoke insert, update, delete on public.service_documents from authenticated;
grant select on public.service_documents to authenticated;

drop policy if exists "Members can read own service documents" on public.service_documents;
create policy "Members can read own service documents"
  on public.service_documents for select
  using (auth.uid() = user_id and public.has_active_membership());

insert into storage.buckets (id, name, public)
values ('vehicle-documents', 'vehicle-documents', false)
on conflict (id) do update set public = false;

-- The existing private vehicle-document policy authorizes a member to read only
-- objects whose first folder is their Supabase user id. Recreate it safely here
-- so this migration also works when installed on its own.
drop policy if exists "Members can read own vehicle documents" on storage.objects;
create policy "Members can read own vehicle documents"
  on storage.objects for select
  using (
    bucket_id = 'vehicle-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
