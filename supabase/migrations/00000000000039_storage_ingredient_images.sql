-- 039_storage_ingredient_images
-- Supabase Storage: 'ingredient-images' bucket for ingredient images.
-- Bucket is public (images rendered in menus/POS selectors), reads are open;
-- writes require an authenticated member of the establishment encoded in the
-- path: establishments/{estId}/ingredients/{ingredientId}/...

insert into storage.buckets (id, name, public)
values ('ingredient-images', 'ingredient-images', true)
on conflict (id) do nothing;

-- Public read: images rendered in POS/menus/cards.
create policy "ingredient_images_read" on storage.objects
  for select using (bucket_id = 'ingredient-images');

-- Writes scoped to the actor's establishment via the path prefix.
create policy "ingredient_images_insert" on storage.objects
  for insert with check (
    bucket_id = 'ingredient-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = 'establishments'
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    and (storage.foldername(name))[3] ~ '^[0-9a-fA-F-]{36}$'
    and (
      is_super_admin()
      or belongs_to_establishment(((storage.foldername(name))[2])::uuid)
    )
  );

create policy "ingredient_images_update" on storage.objects
  for update using (
    bucket_id = 'ingredient-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = 'establishments'
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    and (storage.foldername(name))[3] ~ '^[0-9a-fA-F-]{36}$'
    and (
      is_super_admin()
      or belongs_to_establishment(((storage.foldername(name))[2])::uuid)
    )
  ) with check (
    bucket_id = 'ingredient-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = 'establishments'
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    and (storage.foldername(name))[3] ~ '^[0-9a-fA-F-]{36}$'
    and (
      is_super_admin()
      or belongs_to_establishment(((storage.foldername(name))[2])::uuid)
    )
  );

create policy "ingredient_images_delete" on storage.objects
  for delete using (
    bucket_id = 'ingredient-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = 'establishments'
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    and (storage.foldername(name))[3] ~ '^[0-9a-fA-F-]{36}$'
    and (
      is_super_admin()
      or belongs_to_establishment(((storage.foldername(name))[2])::uuid)
    )
  );