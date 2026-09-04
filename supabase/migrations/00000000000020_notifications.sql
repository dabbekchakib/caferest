-- 020_notifications
-- In-app notifications (Realtime compatible: publish via Supabase Realtime).

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  establishment_id uuid references public.establishments (id) on delete cascade,
  type text not null default 'info',
  title text not null,
  message text,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications (user_id);
create index if not exists idx_notifications_user_read on public.notifications (user_id, read_at);
create index if not exists idx_notifications_establishment on public.notifications (establishment_id);
create index if not exists idx_notifications_type on public.notifications (type);
create index if not exists idx_notifications_created_at on public.notifications (created_at);
