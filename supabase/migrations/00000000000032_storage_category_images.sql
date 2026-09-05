-- 032_storage_category_images
-- Supabase Storage: 'category-images' bucket for category icons/images.
-- Bucket is public (images are rendered in menus/selectors), reads are open;
-- writes require an authenticated member of the establishment encoded in the
-- path: establishments/{estId}/categories/{categoryId}/...

insert into storage.buckets (id, name, public)
values ('category-images', 'category-images', true)
on conflict (id) do nothing;

-- Public read: images rendered in POS/menus.
create policy "category_images_read" on storage.objects
  for select using (bucket_id = 'category-images');

-- Writes scoped to the actor's establishment via the path prefix.
create policy "category_images_insert" on storage.objects
  for insert with check (
    bucket_id = 'category-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = 'establishments'
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    and (
      is_super_admin()
      or belongs_to_establishment(((storage.foldername(name))[2])::uuid)
    )
  );

create policy "category_images_update" on storage.objects
  for update using (
    bucket_id = 'category-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = 'establishments'
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    and (
      is_super_admin()
      or belongs_to_establishment(((storage.foldername(name))[2])::uuid)
    )
  ) with check (
    bucket_id = 'category-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = 'establishments'
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    and (
      is_super_admin()
      or belongs_to_establishment(((storage.foldername(name))[2])::uuid)
    )
  );

create policy "category_images_delete" on storage.objects
  for delete using (
    bucket_id = 'category-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = 'establishments'
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    and (
      is_super_admin()
      or belongs_to_establishment(((storage.foldername(name))[2])::uuid)
    )
  );