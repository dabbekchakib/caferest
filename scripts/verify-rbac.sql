-- ============================================================
-- CafeRest — RBAC verification checklist (PHASE 06)
-- ============================================================
-- Run against the target Supabase database once migrations 023→027 are
-- applied:
--   npm run db:push        (or: supabase db push --linked)
--   psql "$DATABASE_URL" -f scripts/verify-rbac.sql
--
-- The script is SAFE to re-run: every check is read-only and raises an
-- exception only when an expected object/behavior is missing. It does NOT
-- mutate data and does NOT require a specific tenant to exist.
-- ============================================================

\set ON_ERROR_STOP on

begin;

-- ------------------------------------------------------------
-- 1. Tables
-- ------------------------------------------------------------
do $$
begin
  foreach _table in array array['roles','user_roles','permissions','role_permissions','audit_logs'] loop
    if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = _table) then
      raise exception 'Table public.% does not exist', _table;
    end if;
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- 2. RLS is enabled on the authorization tables
-- ------------------------------------------------------------
do $$
declare
  _rel regclass;
begin
  foreach _rel in array array['public.roles','public.user_roles','public.permissions','public.role_permissions'] loop
    if not (select relrowsecurity from pg_class where oid = _rel::regclass) then
      raise exception 'RLS is not enabled on %', _rel;
    end if;
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- 3. Helpers exist (function names are stable across migrations)
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'is_super_admin' and pronamespace = 'public'::regnamespace) then
    raise exception 'missing function is_super_admin()';
  end if;
  if not exists (select 1 from pg_proc where proname = 'has_permission' and pronamespace = 'public'::regnamespace) then
    raise exception 'missing function has_permission(est_id, slug)';
  end if;
  if not exists (select 1 from pg_proc where proname = 'has_permission_anywhere' and pronamespace = 'public'::regnamespace) then
    raise exception 'missing function has_permission_anywhere(slug)';
  end if;
  if not exists (select 1 from pg_proc where proname = 'user_get_permissions' and pronamespace = 'public'::regnamespace) then
    raise exception 'missing function user_get_permissions(p_user_id, p_est_id)';
  end if;
  if not exists (select 1 from pg_proc where proname = 'user_get_role_codes' and pronamespace = 'public'::regnamespace) then
    raise exception 'missing function user_get_role_codes(p_user_id, p_est_id)';
  end if;
  if not exists (select 1 from pg_proc where proname = 'user_get_max_level' and pronamespace = 'public'::regnamespace) then
    raise exception 'missing function user_get_max_level(p_user_id, p_est_id)';
  end if;
  if not exists (select 1 from pg_proc where proname = 'user_count_active_admins' and pronamespace = 'public'::regnamespace) then
    raise exception 'missing function user_count_active_admins(p_est_id, p_exclude_user_id)';
  end if;
  if not exists (select 1 from pg_proc where proname = 'user_is_profile_active' and pronamespace = 'public'::regnamespace) then
    raise exception 'missing function user_is_profile_active(p_user_id)';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 4. Seed data: the 10 system roles and the permission catalog
-- ------------------------------------------------------------
do $$
declare
  _expected int := 10;
  _count int;
begin
  select count(*) into _count from public.roles where is_system;
  if _count < _expected then
    raise exception 'expected at least % system roles, found %', _expected, _count;
  end if;

  select count(*) into _count from public.permissions;
  if _count < 56 then
    raise exception 'expected >= 56 permissions in the catalog, found %', _count;
  end if;

  if not exists (select 1 from public.roles where code = 'super_admin' and is_system) then
    raise exception 'super_admin role missing';
  end if;
  if not exists (select 1 from public.roles where code = 'admin' and is_system) then
    raise exception 'admin role missing';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 5. Core behavior probes (security-definer, no tenant needed)
-- ------------------------------------------------------------
do $$
declare
  _perm uuid;
  _adm  uuid;
  _slug text;
begin
  -- Permissions are stored once (slug is unique).
  select id into _perm from public.permissions where slug = 'roles.update' limit 1;
  if _perm is null then
    raise exception 'permission roles.update missing from catalog';
  end if;

  select id into _adm from public.roles where code = 'admin' limit 1;
  if _adm is null then
    raise exception 'admin role missing';
  end if;

  -- A random user must not resolve as super admin.
  if public.user_is_super_admin_by_id('00000000-0000-0000-0000-000000000000') then
    raise exception 'user_is_super_admin_by_id must be false for an unknown user';
  end if;

  -- The permission grid of an unknown user is empty.
  select slug into _slug from public.user_get_permissions(
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000000'
  ) limit 1;
  if _slug is not null then
    raise exception 'unknown user must resolve to zero permissions';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 6. Guard triggers are installed
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_protect_profile_self_status'
  ) then
    raise exception 'trigger protect_profile_self_status missing (profiles)';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_protect_system_roles'
  ) then
    raise exception 'trigger protect_system_roles missing (roles)';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_user_roles_validate_scope'
  ) then
    raise exception 'trigger validate_user_roles_scope missing (user_roles)';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 7. Sample RLS policy checks (against names used by the app)
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roles'  and policyname = 'roles_read') then
    raise exception 'roles_read policy missing';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'permissions' and policyname = 'permissions_read') then
    raise exception 'permissions_read policy missing';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_roles' and policyname like 'user_roles_member_insert%') then
    raise exception 'user_roles_member_insert policy missing';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'establishment_members' and policyname like 'establishment_members_member_insert%') then
    raise exception 'establishment_members_member_insert policy missing';
  end if;
end;
$$;

commit;

\echo '✅ verify-rbac.sql: all RBAC checks passed'