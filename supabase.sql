-- Execute este arquivo uma vez no SQL Editor do Supabase.

create table if not exists public.monthly_data (
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);

create table if not exists public.app_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.monthly_data enable row level security;
alter table public.app_config enable row level security;

revoke all on table public.monthly_data from anon;
revoke all on table public.app_config from anon;
grant select, insert, update, delete on table public.monthly_data to authenticated;
grant select, insert, update, delete on table public.app_config to authenticated;

drop policy if exists "monthly_data_owner" on public.monthly_data;
create policy "monthly_data_owner"
on public.monthly_data for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "app_config_owner" on public.app_config;
create policy "app_config_owner"
on public.app_config for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

do $$
begin
  alter publication supabase_realtime add table public.monthly_data;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.app_config;
exception
  when duplicate_object then null;
end $$;
