-- 028_units_v2
-- Evolves `units` + `unit_conversions` to the PHASE 07 model:
--   - dimensions (mass|volume|count|service|custom) with a per-dimension base
--   - slug, description, precision, is_base, is_system, is_active
--   - global (system) rows vs establishment-scoped rows
--   - conversion offset (default 0), scope validation, system protection

-- ============================================================
-- units: new columns + nullable establishment (NULL = system/global)
-- ============================================================
alter table public.units
  alter column establishment_id drop not null;

alter table public.units
  add column if not exists slug text,
  add column if not exists type text not null default 'custom',
  add column if not exists description text,
  add column if not exists is_base boolean not null default false,
  add column if not exists is_system boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'units_type_check' and conrelid = 'public.units'::regclass
  ) then
    alter table public.units
      add constraint units_type_check check (
        type in ('mass', 'volume', 'count', 'service', 'custom')
      );
  end if;
end;
$$;

-- Map legacy `category` values onto the new dimension and fill the slug.
update public.units set
  slug = coalesce(slug, lower(symbol)),
  type = case
    when category = 'weight'    then 'mass'
    when category = 'volume'    then 'volume'
    when category = 'quantity'  then 'count'
    when category = 'portion'   then 'service'
    when category = 'packaging' then 'custom'
    when category = 'length'    then 'custom'
    else 'custom'
  end;

-- Canonical symbol names for the count/service families.
update public.units set symbol = 'piece' where symbol = 'pc' and category = 'quantity';
update public.units set symbol = 'bottle' where symbol = 'btl' and category = 'packaging';

-- Promote the seeded metric/service units to global system rows and mark the
-- canonical base unit of each dimension (g, ml, piece).
update public.units
  set is_system = true,
      establishment_id = null,
      is_base = (symbol in ('g', 'ml', 'piece'))
  where symbol in ('kg', 'g', 'mg', 'L', 'cl', 'ml', 'piece', 'cup', 'glass', 'bottle');

create unique index if not exists uq_units_system_symbol
  on public.units (symbol)
  where establishment_id is null;

create index if not exists idx_units_slug on public.units (slug);
create index if not exists idx_units_type on public.units (type);

-- ============================================================
-- unit_conversions: new columns (NULL establishment = system)
-- ============================================================
alter table public.unit_conversions
  add column if not exists establishment_id uuid references public.establishments (id) on delete cascade,
  add column if not exists offset_value numeric not null default 0,
  add column if not exists is_system boolean not null default false,
  add column if not exists is_active boolean not null default true;

-- Existing metadata conversions (only between system units) become global.
update public.unit_conversions uc
  set is_system = true,
      establishment_id = null
  where not exists (
    select 1 from public.units u
    where u.id in (uc.from_unit_id, uc.to_unit_id)
      and u.establishment_id is not null
  );

create index if not exists idx_unit_conversions_establishment
  on public.unit_conversions (establishment_id);

-- ============================================================
-- System-unit protection (mirrors the system-role guard of phase 06)
-- ============================================================
create or replace function public.protect_system_units()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Guards below only apply to authenticated app users (auth.uid() is NULL
  -- for migration/service-role writes, which are allowed): system units must
  -- never be created/deleted/mutated by a logged-in non-super-admin.
  if tg_op = 'INSERT' and new.is_system then
    if auth.uid() is not null and not is_super_admin() then
      raise exception using
        errcode = 'P0001',
        message = 'system_unit_protected';
    end if;
    return new;
  end if;

  if not old.is_system then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if auth.uid() is not null and not is_super_admin() then
      raise exception using
        errcode = 'P0001',
        message = 'system_unit_protected';
    end if;
    return old;
  end if;

  -- UPDATE on a system unit: identity fields require a super admin.
  if new.symbol is distinct from old.symbol
     or new.slug is distinct from old.slug
     or new.type is distinct from old.type
     or new.is_base is distinct from old.is_base
     or new.is_system is distinct from old.is_system
     or new.establishment_id is distinct from old.establishment_id then
    if auth.uid() is not null and not is_super_admin() then
      raise exception using
        errcode = 'P0001',
        message = 'system_unit_protected';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_system_units on public.units;
create trigger trg_protect_system_units
  before insert or update or delete on public.units
  for each row execute function public.protect_system_units();

-- ============================================================
-- Conversion scope validation (system rows stay global; custom rows must
-- belong to the same establishment as the units they link)
-- ============================================================
create or replace function public.validate_unit_conversion_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from uuid;
  v_to   uuid;
begin
  select u.establishment_id into v_from from public.units u where u.id = new.from_unit_id;
  select u.establishment_id into v_to   from public.units u where u.id = new.to_unit_id;

  if v_from is not null and v_to is not null and v_from <> v_to then
    raise exception using
      errcode = 'P0001',
      message = 'unit_conversion_scope_mismatch';
  end if;

  if new.is_system then
    if v_from is not null or v_to is not null or new.establishment_id is not null then
      raise exception using
        errcode = 'P0001',
        message = 'unit_conversion_scope_mismatch';
    end if;
  else
    if new.establishment_id is null then
      raise exception using
        errcode = 'P0001',
        message = 'unit_conversion_scope_mismatch';
    end if;
    if (v_from is not null and v_from <> new.establishment_id)
       or (v_to is not null and v_to <> new.establishment_id) then
      raise exception using
        errcode = 'P0001',
        message = 'unit_conversion_scope_mismatch';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_unit_conversions_validate_scope on public.unit_conversions;
create trigger trg_unit_conversions_validate_scope
  before insert or update on public.unit_conversions
  for each row execute function public.validate_unit_conversion_scope();

-- ============================================================
-- RLS: units / unit_conversions
--   read   -> system rows (global) or your own establishment (or super admin)
--   write  -> permission-gated, non-system rows only (members)
-- ============================================================
alter table public.units enable row level security;
alter table public.unit_conversions enable row level security;

drop policy if exists units_read on public.units;
create policy "units_read" on public.units
  for select using (
    is_super_admin()
    or establishment_id is null
    or belongs_to_establishment(establishment_id)
  );

drop policy if exists units_write on public.units;
create policy "units_member_insert" on public.units
  for insert with check (
    is_super_admin()
    or (establishment_id is not null and not is_system
        and has_permission(establishment_id, 'units.create'))
  );
create policy "units_member_update" on public.units
  for update using (
    is_super_admin()
    or (establishment_id is not null and not is_system
        and has_permission(establishment_id, 'units.update'))
  ) with check (
    is_super_admin()
    or (establishment_id is not null and not is_system
        and has_permission(establishment_id, 'units.update'))
  );
create policy "units_member_delete" on public.units
  for delete using (
    is_super_admin()
    or (establishment_id is not null and not is_system
        and has_permission(establishment_id, 'units.delete'))
  );

drop policy if exists unit_conversions_read on public.unit_conversions;
create policy "unit_conversions_read" on public.unit_conversions
  for select using (
    is_super_admin()
    or establishment_id is null
    or belongs_to_establishment(establishment_id)
  );

drop policy if exists unit_conversions_write on public.unit_conversions;
create policy "unit_conversions_member_insert" on public.unit_conversions
  for insert with check (
    is_super_admin()
    or (establishment_id is not null and not is_system
        and has_permission(establishment_id, 'unit_conversions.create'))
  );
create policy "unit_conversions_member_update" on public.unit_conversions
  for update using (
    is_super_admin()
    or (establishment_id is not null and not is_system
        and has_permission(establishment_id, 'unit_conversions.update'))
  ) with check (
    is_super_admin()
    or (establishment_id is not null and not is_system
        and has_permission(establishment_id, 'unit_conversions.update'))
  );
create policy "unit_conversions_member_delete" on public.unit_conversions
  for delete using (
    is_super_admin()
    or (establishment_id is not null and not is_system
        and has_permission(establishment_id, 'unit_conversions.delete'))
  );