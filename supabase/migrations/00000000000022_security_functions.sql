-- 022_security_functions
-- RLS helper functions to centralize access rules (no duplication in frontend).

-- Determine whether the current user belongs to the given establishment.
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

-- Verify the current user holds a given role code within the establishment.
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
  );
$$;

-- Is the current user a super_admin (global, cross-establishment)?
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
  );
$$;

-- Generic "belongs to my establishment" guard used in RLS policies.
create or replace function public.belongs_to_establishment(est_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    is_super_admin()
    or is_establishment_member(est_id)
$$;

-- Retrieve a single setting value for the current user's establishment.
create or replace function public.get_setting(p_key text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select s.value
  from public.settings s
  where s.key = p_key
    and s.establishment_id in (
      select ur.establishment_id
      from public.user_roles ur
      where ur.user_id = auth.uid()
    )
  limit 1;
$$;

-- Retrieve all settings for an establishment as a key -> value jsonb object.
create or replace function public.get_establishment_settings(p_establishment_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_object_agg(s.key, s.value),
    '{}'::jsonb
  )
  from public.settings s
  where s.establishment_id = p_establishment_id
    and (s.is_public or is_establishment_member(p_establishment_id));
$$;
