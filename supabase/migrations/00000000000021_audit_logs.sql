-- 021_audit_logs
-- Immutable audit trail.

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid references public.establishments (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_establishment on public.audit_logs (establishment_id);
create index if not exists idx_audit_logs_user on public.audit_logs (user_id);
create index if not exists idx_audit_logs_action on public.audit_logs (action);
create index if not exists idx_audit_logs_entity on public.audit_logs (entity_type, entity_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at);
