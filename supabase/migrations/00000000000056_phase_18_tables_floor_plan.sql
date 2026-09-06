-- 056_phase_18_tables_floor_plan
-- Phase 18 : Espaces (dining areas), tables & plan de salle (floor plan).
--
-- Evolves the tables created in 014 (dining_areas / tables) without
-- recreating them, adds the multilingual area descriptions, replaces the
-- legacy `code` column by `table_number`, extends the table geometry
-- (shape / width / height / rotation / color / sort_order) and the status
-- list (adds `disabled`), gates every policy behind the phase-18
-- permissions and seeds the permission catalog + role matrix.

-- ============================================================
-- 1) dining_areas evolution
-- ============================================================
alter table public.dining_areas
  add column if not exists slug text,
  add column if not exists description text,
  add column if not exists color text,
  add column if not exists icon text;

-- Backfill `slug` for pre-existing rows (dedup + arabic-safe fallback).
do $$
declare
  v_count bigint;
begin
  create temporary table _area_slugs on commit drop as
  select a.id,
         a.created_at,
         coalesce(nullif(lower(regexp_replace(trim(a.name), '[^a-z0-9]+', '-', 'gi')), ''), '') as base,
         row_number() over (
           partition by coalesce(nullif(lower(regexp_replace(trim(a.name), '[^a-z0-9]+', '-', 'gi')), ''), '')
           order by a.created_at asc, a.id
         ) as rn
    from public.dining_areas a;

  select count(*) into v_count from public.dining_areas;

  update public.dining_areas a
     set slug = (case
                   when s.base = '' then 'zone-' || left(a.id::text, 8)
                   else s.base
                 end) || case when s.rn = 1 then '' else '-' || s.rn end
    from _area_slugs s
   where s.id = a.id
     and a.slug is null;
end $$;

alter table public.dining_areas
  alter column slug set not null;

create unique index if not exists uq_dining_areas_establishment_slug
  on public.dining_areas (establishment_id, slug)
  where slug is not null;

create index if not exists idx_dining_areas_color on public.dining_areas (color);

-- ============================================================
-- 2) dining_area_translations
-- ============================================================
create table if not exists public.dining_area_translations (
  id uuid primary key default gen_random_uuid(),
  dining_area_id uuid not null references public.dining_areas (id) on delete cascade,
  locale text not null,
  name text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dining_area_translations_locale_check check (locale in ('fr', 'en', 'ar')),
  constraint dining_area_translations_unique unique (dining_area_id, locale)
);

create trigger trg_dining_area_translations_updated_at
  before update on public.dining_area_translations
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- 3) tables evolution
-- ============================================================
alter table public.tables
  add column if not exists slug text,
  add column if not exists table_number text,
  add column if not exists shape text not null default 'round',
  add column if not exists width numeric,
  add column if not exists height numeric,
  add column if not exists rotation numeric not null default 0,
  add column if not exists color text,
  add column if not exists sort_order integer not null default 0;

-- Backfill `slug` + `table_number` (from the legacy `code`) for existing rows.
do $$
begin
  create temporary table _dining_table_slugs on commit drop as
  select t.id,
         t.created_at,
         coalesce(nullif(lower(regexp_replace(trim(t.name), '[^a-z0-9]+', '-', 'gi')), ''), '') as base,
         row_number() over (
           partition by coalesce(nullif(lower(regexp_replace(trim(t.name), '[^a-z0-9]+', '-', 'gi')), ''), '')
           order by t.created_at asc, t.id
         ) as rn
    from public.tables t;

  update public.tables a
     set slug = (case
                   when s.base = '' then 'table-' || left(a.id::text, 8)
                   else s.base
                 end) || case when s.rn = 1 then '' else '-' || s.rn end
    from _dining_table_slugs s
   where s.id = a.id
     and a.slug is null;

  update public.tables
     set table_number = code
   where table_number is null
     and code is not null;
end $$;

alter table public.tables
  alter column slug set not null;

-- Constraints
alter table public.tables
  drop constraint if exists tables_status_check;

alter table public.tables
  add constraint tables_status_check check (
    status in ('available', 'occupied', 'reserved', 'cleaning', 'disabled', 'blocked')
  ),
  add constraint tables_shape_check check (shape in ('round', 'square', 'rectangle')),
  add constraint tables_width_min check (width is null or width >= 50),
  add constraint tables_height_min check (height is null or height >= 50),
  add constraint tables_rotation_check check (rotation >= 0 and rotation <= 360);

-- Rebuild the per-establishment number/slug uniqueness on the new columns.
drop index if exists uq_tables_establishment_code;

create unique index if not exists uq_tables_establishment_number
  on public.tables (establishment_id, table_number)
  where table_number is not null;

create unique index if not exists uq_tables_establishment_slug
  on public.tables (establishment_id, slug)
  where slug is not null;

create index if not exists idx_tables_sort on public.tables (sort_order);

-- Drop the legacy `code` column now that `table_number` carries the value.
alter table public.tables
  drop column if exists code;

-- ============================================================
-- 4) RLS — drop the legacy "for all" policies, recreate gated.
-- ============================================================
alter table public.dining_area_translations enable row level security;

drop policy if exists dining_areas_read on public.dining_areas;
create policy "dining_areas_read" on public.dining_areas
  for select using (
    is_super_admin()
    or (belongs_to_establishment(establishment_id)
        and (has_permission(establishment_id, 'dining_areas.view')
             or has_permission(establishment_id, 'tables.floor_plan')))
  );

drop policy if exists dining_areas_write on public.dining_areas;
create policy "dining_areas_member_insert" on public.dining_areas
  for insert with check (
    is_super_admin()
    or (belongs_to_establishment(establishment_id)
        and has_permission(establishment_id, 'dining_areas.create'))
  );

create policy "dining_areas_member_update" on public.dining_areas
  for update using (
    is_super_admin()
    or (belongs_to_establishment(establishment_id)
        and (has_permission(establishment_id, 'dining_areas.update')
             or has_permission(establishment_id, 'dining_areas.reorder')))
  ) with check (
    is_super_admin()
    or (belongs_to_establishment(establishment_id)
        and (has_permission(establishment_id, 'dining_areas.update')
             or has_permission(establishment_id, 'dining_areas.reorder')))
  );

create policy "dining_areas_member_delete" on public.dining_areas
  for delete using (
    is_super_admin()
    or (belongs_to_establishment(establishment_id)
        and has_permission(establishment_id, 'dining_areas.delete'))
  );

drop policy if exists tables_read on public.tables;
create policy "tables_read" on public.tables
  for select using (
    is_super_admin()
    or (belongs_to_establishment(establishment_id)
        and (has_permission(establishment_id, 'tables.view')
             or has_permission(establishment_id, 'tables.floor_plan')))
  );

drop policy if exists tables_write on public.tables;
create policy "tables_member_insert" on public.tables
  for insert with check (
    is_super_admin()
    or (belongs_to_establishment(establishment_id)
        and has_permission(establishment_id, 'tables.create'))
  );

create policy "tables_member_update" on public.tables
  for update using (
    is_super_admin()
    or (belongs_to_establishment(establishment_id)
        and (has_permission(establishment_id, 'tables.update')
             or has_permission(establishment_id, 'tables.reorder')
             or has_permission(establishment_id, 'tables.status')
             or has_permission(establishment_id, 'tables.floor_plan')))
  ) with check (
    is_super_admin()
    or (belongs_to_establishment(establishment_id)
        and (has_permission(establishment_id, 'tables.update')
             or has_permission(establishment_id, 'tables.reorder')
             or has_permission(establishment_id, 'tables.status')
             or has_permission(establishment_id, 'tables.floor_plan')))
  );

create policy "tables_member_delete" on public.tables
  for delete using (
    is_super_admin()
    or (belongs_to_establishment(establishment_id)
        and has_permission(establishment_id, 'tables.delete'))
  );

-- Translations: read when the parent area is readable, write with the
-- matching dining_areas.create/update permission.
create policy "dining_area_translations_read" on public.dining_area_translations
  for select using (
    is_super_admin()
    or exists (
      select 1
        from public.dining_areas a
       where a.id = dining_area_id
         and (belongs_to_establishment(a.establishment_id)
              and (has_permission(a.establishment_id, 'dining_areas.view')
                   or has_permission(a.establishment_id, 'tables.floor_plan')))
    )
  );

create policy "dining_area_translations_member_insert" on public.dining_area_translations
  for insert with check (
    is_super_admin()
    or exists (
      select 1
        from public.dining_areas a
       where a.id = dining_area_id
         and belongs_to_establishment(a.establishment_id)
         and has_permission(a.establishment_id, 'dining_areas.create')
    )
  );

create policy "dining_area_translations_member_update" on public.dining_area_translations
  for update using (
    is_super_admin()
    or exists (
      select 1
        from public.dining_areas a
       where a.id = dining_area_id
         and belongs_to_establishment(a.establishment_id)
         and has_permission(a.establishment_id, 'dining_areas.update')
    )
  ) with check (
    is_super_admin()
    or exists (
      select 1
        from public.dining_areas a
       where a.id = dining_area_id
         and belongs_to_establishment(a.establishment_id)
         and has_permission(a.establishment_id, 'dining_areas.update')
    )
  );

create policy "dining_area_translations_member_delete" on public.dining_area_translations
  for delete using (
    is_super_admin()
    or exists (
      select 1
        from public.dining_areas a
       where a.id = dining_area_id
         and belongs_to_establishment(a.establishment_id)
         and has_permission(a.establishment_id, 'dining_areas.update')
    )
  );

-- ============================================================
-- 5) Permission catalog — modules `dining_areas` + `tables`
-- ============================================================
insert into public.permissions (slug, module, name, description) values
  ('dining_areas.view',    'dining_areas', 'Voir les espaces',        'Consulter les espaces de la salle (zones, terrasses...)'),
  ('dining_areas.create',  'dining_areas', 'Créer un espace',         'Créer un espace de la salle'),
  ('dining_areas.update',  'dining_areas', 'Modifier un espace',      'Modifier un espace et sa traduction'),
  ('dining_areas.delete',  'dining_areas', 'Supprimer un espace',     'Supprimer un espace (les tables deviennent sans zone)'),
  ('dining_areas.reorder', 'dining_areas', 'Réorganiser les espaces', 'Réordonner l''affichage des espaces'),
  ('tables.view',          'tables',       'Voir les tables',         'Consulter la liste des tables'),
  ('tables.create',        'tables',       'Créer une table',         'Créer une table de la salle'),
  ('tables.update',        'tables',       'Modifier une table',      'Modifier les informations d''une table'),
  ('tables.delete',        'tables',       'Supprimer une table',     'Supprimer définitivement une table'),
  ('tables.reorder',       'tables',       'Réorganiser les tables',  'Réordonner la liste des tables'),
  ('tables.status',        'tables',       'Changer le statut',       'Changer le statut d''une table (disponible, occupée...)'),
  ('tables.floor_plan',    'tables',       'Éditer le plan de salle', 'Déplacer, redimensionner et pivoter les tables sur le plan')
on conflict (slug) do nothing;

-- ============================================================
-- 6) Role → permission matrix (super_admin/admin/manager full, others none)
-- ============================================================
do $$
declare
  v_super_admin uuid;
  v_admin       uuid;
  v_manager     uuid;
begin
  select id into v_super_admin from public.roles where code = 'super_admin' and is_system;
  select id into v_admin       from public.roles where code = 'admin' and is_system;
  select id into v_manager     from public.roles where code = 'manager' and is_system;

  insert into public.role_permissions (role_id, permission_id)
  select r.role_id, p.id from (
    select v_super_admin as role_id union all
    select v_admin union all
    select v_manager
  ) r
  cross join (select id from public.permissions
               where slug like 'dining_areas.%' or slug like 'tables.%') p
  on conflict (role_id, permission_id) do nothing;
end $$;