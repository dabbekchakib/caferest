-- Phase 07 sanity checks (run via `db query --file scripts/verify-units.sql --output-format text`).

select 'system_units' as check,
       count(*) as value
  from public.units
 where establishment_id is null and is_system;

select 'base_units' as check,
       string_agg(symbol, ',' order by symbol) as value
  from public.units
 where is_base;

select 'system_conversions' as check,
       count(*) as value
  from public.unit_conversions
 where is_system;

select 'units_rows' as check,
       count(*) as value
  from public.units;

select 'units_rls' as check,
       count(*) as value
  from pg_policies
 where tablename = 'units'
   and schemaname = 'public';

select 'unit_conversions_rls' as check,
       count(*) as value
  from pg_policies
 where tablename = 'unit_conversions'
   and schemaname = 'public';

select 'protection_triggers' as check,
       string_agg(tgname, ',' order by tgname) as value
  from pg_trigger
 where tgname in ('trg_protect_system_units', 'trg_unit_conversions_validate_scope')
   and not tgisinternal;

select 'units_permissions' as check,
       count(*) as value
  from public.permissions
 where module in ('units', 'unit_conversions');