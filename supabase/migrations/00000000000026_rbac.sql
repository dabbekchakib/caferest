-- 026_rbac
-- RBAC layer: permissions, role_permissions, evolution of roles/user_roles,
-- authorization SQL helpers + RLS policies and integrity triggers.
--
-- Design rules:
--  * permissions is a global catalog (slug is the stable key used in code).
--  * roles: `code` remains the canonical identifier (slug-equivalent) used by
--    policies and helpers; custom roles are establishment-scoped via the new
--    `establishment_id` (NULL = system/global role). `level` encodes the
--    hierarchy so a role can never manage a role at an equal or higher level.
--  * user_roles.row must always be backed by an establishment_members row
--    (composite FK), and only system or same-establishment roles may be
--    assigned (trigger `validate_user_roles_scope`).
--  * has_permission(est, slug) is security definer so RLS policies can reuse
--    it without recursion. Every helper also enforces an active profile so a
--    disabled user loses data access immediately (defense in depth on top of
--    the server-side `requireAuth` redirect).

-- ============================================================
-- permissions (global read-mostly catalog)
-- ============================================================
create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  module text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_permissions_module on public.permissions (module);

create trigger trg_permissions_updated_at
  before update on public.permissions
  for each row execute function public.set_updated_at();

-- ============================================================
-- role_permissions (role <-> permission join)
-- ============================================================
create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (role_id, permission_id)
);

create index if not exists idx_role_permissions_role on public.role_permissions (role_id);
create index if not exists idx_role_permissions_permission on public.role_permissions (permission_id);

-- ============================================================
-- roles evolution (keep `code`; add slug/is_system/is_active/level/scope)
-- ============================================================
alter table public.roles
  add column if not exists slug text,
  add column if not exists is_system boolean not null default false,
  add column if not exists is_active boolean not null default true,
  add column if not exists level integer not null default 0,
  add column if not exists establishment_id uuid references public.establishments (id) on delete cascade;

update public.roles set slug = code where slug is null;

-- Per-establishment uniqueness. System roles share the sentinel bucket so they
-- cannot be re-created as custom roles (and vice-versa).
drop index if exists uq_roles_code;
create unique index if not exists uq_roles_establishment_slug
  on public.roles (coalesce(establishment_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid), code);

create index if not exists idx_roles_establishment on public.roles (establishment_id);
create index if not exists idx_roles_slug on public.roles (slug);
create index if not exists idx_roles_level on public.roles (level);
create index if not exists idx_roles_active on public.roles (is_active);

-- ============================================================
-- user_roles evolution (audit actor + guaranteed membership)
-- ============================================================
alter table public.user_roles
  add column if not exists created_by uuid references auth.users (id) on delete set null;

-- Backfill memberships before enforcing the FK (defensive for existing data).
insert into public.establishment_members (user_id, establishment_id, is_active)
select distinct ur.user_id, ur.establishment_id, true
from public.user_roles ur
left join public.establishment_members em
  on em.user_id = ur.user_id and em.establishment_id = ur.establishment_id
where em.user_id is null
on conflict (user_id, establishment_id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fk_user_roles_membership'
      and conrelid = 'public.user_roles'::regclass
  ) then
    alter table public.user_roles
      add constraint fk_user_roles_membership
      foreign key (user_id, establishment_id)
      references public.establishment_members (user_id, establishment_id)
      on delete cascade;
  end if;
end;
$$;

create index if not exists idx_user_roles_created_by on public.user_roles (created_by);

-- ============================================================
-- Authorization SQL helpers (all security definer, active-profile aware)
-- ============================================================

create or replace function public.user_is_profile_active(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles pr
    where pr.id = p_user_id and pr.is_active
  );
$$;

create or replace function public.current_profile_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and user_is_profile_active(auth.uid());
$$;

create or replace function public.user_is_super_admin_by_id(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user_id and r.code = 'super_admin' and r.is_active
  );
$$;

create or replace function public.user_is_establishment_member(p_user_id uuid, p_est_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_user_id and ur.establishment_id = p_est_id
  ) or user_is_super_admin_by_id(p_user_id);
$$;

-- Core: does `p_user_id` hold `p_slug` inside `p_est_id`?
create or replace function public.user_has_permission(p_user_id uuid, p_est_id uuid, p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    user_is_profile_active(p_user_id)
    and exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      join public.role_permissions rp on rp.role_id = r.id
      join public.permissions p on p.id = rp.permission_id
      where ur.user_id = p_user_id
        and ur.establishment_id = p_est_id
        and r.is_active
        and p.slug = p_slug
    );
$$;

-- Auth-uid version, safe to call from RLS policies.
create or replace function public.has_permission(p_est_id uuid, p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_super_admin()
    or (p_est_id is not null and user_has_permission(auth.uid(), p_est_id, p_slug));
$$;

-- Permission anywhere across the user's memberships (catalog row visibility).
create or replace function public.user_has_permission_anywhere(p_user_id uuid, p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    user_is_profile_active(p_user_id)
    and exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      join public.role_permissions rp on rp.role_id = r.id
      join public.permissions p on p.id = rp.permission_id
      where ur.user_id = p_user_id
        and r.is_active
        and p.slug = p_slug
    );
$$;

create or replace function public.has_permission_anywhere(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_super_admin() or user_has_permission_anywhere(auth.uid(), p_slug);
$$;

-- Explicit-id versions used by the application service layer.
create or replace function public.user_get_permissions(p_user_id uuid, p_est_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct p.slug order by p.slug), '{}'::text[])
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  join public.role_permissions rp on rp.role_id = r.id
  join public.permissions p on p.id = rp.permission_id
  where ur.user_id = p_user_id
    and ur.establishment_id = p_est_id
    and r.is_active;
$$;

create or replace function public.user_get_role_codes(p_user_id uuid, p_est_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct r.code order by r.code), '{}'::text[])
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = p_user_id
    and ur.establishment_id = p_est_id
    and r.is_active;
$$;

create or replace function public.user_get_max_level(p_user_id uuid, p_est_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(max(r.level), 0)::integer
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = p_user_id
    and ur.establishment_id = p_est_id
    and r.is_active;
$$;

-- Number of distinct active admins/super-admins in an establishment (used by
-- the "last admin" protection). Security definer on purpose: profiles RLS
-- hides other users from non-super admins.
create or replace function public.user_count_active_admins(p_est_id uuid, p_exclude_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct ur.user_id)
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  join public.establishment_members em
    on em.user_id = ur.user_id and em.establishment_id = ur.establishment_id
  join public.profiles pr on pr.id = ur.user_id
  where ur.establishment_id = p_est_id
    and ur.user_id <> p_exclude_user_id
    and r.code in ('admin', 'super_admin')
    and r.is_active
    and em.is_active
    and pr.is_active;
$$;

-- Re-define the 022 helpers to be active-profile aware and ESLin role-aware.
create or replace function public.is_establishment_member(est_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.establishment_id = est_id
  );
$$;

create or replace function public.has_role(est_id uuid, role_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and ur.establishment_id = est_id
      and r.code = role_code
      and r.is_active
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.code = 'super_admin'
      and r.is_active
  );
$$;

create or replace function public.belongs_to_establishment(est_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    current_profile_is_active()
    and (is_super_admin() or (est_id is not null and is_establishment_member(est_id)));
$$;

-- ============================================================
-- Integrity triggers
-- ============================================================

-- A regular user may never flip their own profile status (req: "last admin"
-- and self-lock protection are server-side; this is the DB backstop).
create or replace function public.protect_profile_self_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id = auth.uid()
     and old.is_active is distinct from new.is_active
     and not is_super_admin() then
    raise exception using
      errcode = 'P0001',
      message = 'cannot_change_own_profile_status';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_self_status on public.profiles;
create trigger trg_protect_profile_self_status
  before update on public.profiles
  for each row execute function public.protect_profile_self_status();

-- System roles cannot be deleted, and their identity fields cannot be changed,
-- by anyone except a logged-in super admin (never the service role).
create or replace function public.protect_system_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_system then
    if tg_op = 'DELETE' then
      if auth.uid() is null or not is_super_admin() then
        raise exception using
          errcode = 'P0001',
          message = 'system_role_protected';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.code is distinct from old.code
         or new.name is distinct from old.name
         or new.slug is distinct from old.slug
         or new.establishment_id is distinct from old.establishment_id
         or new.is_system is distinct from old.is_system then
        if auth.uid() is null or not is_super_admin() then
          raise exception using
            errcode = 'P0001',
            message = 'system_role_modification_protected';
        end if;
      end if;
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_protect_system_roles on public.roles;
create trigger trg_protect_system_roles
  before update or delete on public.roles
  for each row execute function public.protect_system_roles();

-- user_roles may only link system roles or roles owned by the same
-- establishment as the assignment (applies to the service role as well).
create or replace function public.validate_user_roles_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_role_est uuid;
begin
  select r.establishment_id into v_role_est
  from public.roles r
  where r.id = new.role_id;

  if v_role_est is not null and v_role_est <> new.establishment_id then
    raise exception using
      errcode = 'P0001',
      message = 'user_roles_role_scope_mismatch';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_user_roles_validate_scope on public.user_roles;
create trigger trg_user_roles_validate_scope
  before insert or update on public.user_roles
  for each row execute function public.validate_user_roles_scope();

-- ============================================================
-- RLS
-- ============================================================
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

-- permissions: catalog readable by whoever can manage roles/users.
drop policy if exists permissions_read on public.permissions;
create policy "permissions_read" on public.permissions
  for select using (
    is_super_admin()
    or has_permission_anywhere('roles.view')
    or has_permission_anywhere('roles.update')
    or has_permission_anywhere('users.view')
  );

create policy "permissions_admin_write" on public.permissions
  for all using (is_super_admin()) with check (is_super_admin());

-- role_permissions
drop policy if exists role_permissions_read on public.role_permissions;
create policy "role_permissions_read" on public.role_permissions
  for select using (
    is_super_admin()
    or exists (
      select 1 from public.roles r
      where r.id = role_id
        and (
          (r.establishment_id is null and has_permission_anywhere('roles.view'))
          or (r.establishment_id is not null
              and (
                has_permission(r.establishment_id, 'roles.view')
                or has_permission(r.establishment_id, 'roles.update')
                or has_permission(r.establishment_id, 'users.view')
              ))
        )
    )
  );

drop policy if exists role_permissions_write on public.role_permissions;
create policy "role_permissions_write" on public.role_permissions
  for all
  using (
    exists (
      select 1 from public.roles r
      where r.id = role_id
        and (is_super_admin()
             or (r.establishment_id is not null
                 and has_permission(r.establishment_id, 'roles.update')))
    )
  )
  with check (
    exists (
      select 1 from public.roles r
      where r.id = role_id
        and (is_super_admin()
             or (r.establishment_id is not null
                 and has_permission(r.establishment_id, 'roles.update')))
    )
  );

-- roles: members see system + their own establishment roles; writes are
-- permission-gated (super-admin "all" policy from 023 is kept).
drop policy if exists roles_read on public.roles;
create policy "roles_read" on public.roles
  for select using (
    is_super_admin()
    or establishment_id is null
    or belongs_to_establishment(establishment_id)
  );

drop policy if exists roles_member_insert on public.roles;
create policy "roles_member_insert" on public.roles
  for insert with check (
    is_super_admin()
    or (establishment_id is not null
        and has_permission(establishment_id, 'roles.create'))
  );

drop policy if exists roles_member_update on public.roles;
create policy "roles_member_update" on public.roles
  for update using (
    is_super_admin()
    or (establishment_id is not null
        and has_permission(establishment_id, 'roles.update'))
  ) with check (
    is_super_admin()
    or (establishment_id is not null
        and has_permission(establishment_id, 'roles.update'))
  );

drop policy if exists roles_member_delete on public.roles;
create policy "roles_member_delete" on public.roles
  for delete using (
    is_super_admin()
    or (establishment_id is not null
        and has_permission(establishment_id, 'roles.delete'))
  );

-- user_roles: read (023) kept; writes permission + level aware.
-- A user can never assign/remove "higher or equal" roles, never touch the
-- super_admin capability, and never modify their own assignments.
drop policy if exists user_roles_admin_write on public.user_roles;
create policy "user_roles_member_insert" on public.user_roles
  for insert with check (
    (is_super_admin()
     or has_permission(establishment_id, 'users.create')
     or has_permission(establishment_id, 'users.invite')
     or has_permission(establishment_id, 'users.update'))
    and exists (
      select 1 from public.establishment_members em
      where em.user_id = user_id and em.establishment_id = establishment_id
    )
    and (
      is_super_admin()
      or not exists (
        select 1 from public.roles r
        where r.id = role_id
          and (r.code = 'super_admin' or r.level >= user_get_max_level(auth.uid(), establishment_id))
      )
    )
  );

create policy "user_roles_member_delete" on public.user_roles
  for delete using (
    is_super_admin()
    or (
      user_id <> auth.uid()
      and has_permission(establishment_id, 'users.update')
      and not exists (
        select 1 from public.roles r
        where r.id = role_id and r.level >= user_get_max_level(auth.uid(), establishment_id)
      )
    )
  );

-- establishment_members: admins may add members / manage membership inside
-- establishments where they hold the user-management permission.
drop policy if exists establishment_members_member_insert on public.establishment_members;
create policy "establishment_members_member_insert" on public.establishment_members
  for insert with check (
    is_super_admin()
    or (establishment_id is not null
        and (has_permission(establishment_id, 'users.create')
             or has_permission(establishment_id, 'users.invite')
             or has_permission(establishment_id, 'users.update')))
  );

drop policy if exists establishment_members_member_update on public.establishment_members;
create policy "establishment_members_member_update" on public.establishment_members
  for update using (
    is_super_admin()
    or (establishment_id is not null and has_permission(establishment_id, 'users.update'))
  ) with check (
    is_super_admin()
    or (establishment_id is not null and has_permission(establishment_id, 'users.update'))
  );

-- audit_logs: any active establishment member may append (server actions
-- verify the underlying permission before writing); super admin always.
drop policy if exists audit_logs_superadmin_write on public.audit_logs;
create policy "audit_logs_write" on public.audit_logs
  for insert with check (
    is_super_admin()
    or (
      establishment_id is not null
      and is_establishment_member(establishment_id)
      and current_profile_is_active()
    )
  );