-- Run once in Supabase SQL Editor on existing projects.
-- Feed post rows already use owner-only update/delete policies. These policies
-- let active members replace or remove only files inside their own user folder.

drop policy if exists "Members can upload vehicle photos" on storage.objects;
drop policy if exists "Members can update vehicle photos" on storage.objects;
drop policy if exists "Members can delete own vehicle photos" on storage.objects;

create policy "Members can upload vehicle photos"
  on storage.objects for insert
  with check (
    bucket_id = 'vehicle-photos'
    and public.has_active_membership()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Members can update vehicle photos"
  on storage.objects for update
  using (
    bucket_id = 'vehicle-photos'
    and public.has_active_membership()
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'vehicle-photos'
    and public.has_active_membership()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Members can delete own vehicle photos"
  on storage.objects for delete
  using (
    bucket_id = 'vehicle-photos'
    and public.has_active_membership()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
