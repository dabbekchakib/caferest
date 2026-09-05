-- 045_sync_system_role_catalog
-- Reconciles the system roles (super_admin, admin) with the full permission
-- catalog, restoring the contract expressed by:
--   * migration 027/029 (system roles held the entire catalog at seed time), and
--   * src/lib/authorization/permissions.ts — SYSTEM_ROLE_DEFAULT_PERMISSIONS
--     declares super_admin and admin = PERMISSION_SLUGS (full catalog).
--
-- Module permission seeds (031 categories, 034 products, 038 ingredients,
-- 042 recipes) only granted the module-specific roles and never re-granted
-- the system roles, so both accumulated drift (14 slugs). This migration
-- re-adds the missing grants idempotently; it only ever inserts, never
-- removes, and does not touch custom roles or role definitions.

do $$
declare
  v_role record;
begin
  for v_role in
    select id from public.roles
     where code in ('super_admin', 'admin')
       and is_system
       and is_active
  loop
    insert into public.role_permissions (role_id, permission_id)
    select v_role.id, p.id
      from public.permissions p
    on conflict (role_id, permission_id) do nothing;
  end loop;
end $$;