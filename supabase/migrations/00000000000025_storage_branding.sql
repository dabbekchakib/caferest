-- 025_storage_branding
-- Supabase Storage: 'branding' bucket for logo/favicon uploads.
-- Bucket is private by default; policies grant authenticated members access.

insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload to branding bucket.
create policy "branding_read" on storage.objects
  for select using (bucket_id = 'branding');

create policy "branding_insert" on storage.objects
  for insert with check (bucket_id = 'branding' and auth.role() = 'authenticated');

create policy "branding_update" on storage.objects
  for update using (bucket_id = 'branding' and auth.role() = 'authenticated')
  with check (bucket_id = 'branding' and auth.role() = 'authenticated');

create policy "branding_delete" on storage.objects
  for delete using (bucket_id = 'branding' and auth.role() = 'authenticated');
