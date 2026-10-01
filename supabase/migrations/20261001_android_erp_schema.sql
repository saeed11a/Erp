-- HIKER ERP Android database
-- Android APK branch only.
-- Each user's ERP records are isolated by Supabase Auth.

create table if not exists public.erp_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  table_name text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists erp_records_user_table_idx
  on public.erp_records(user_id, table_name);

create index if not exists erp_records_user_created_idx
  on public.erp_records(user_id, created_at desc);

alter table public.erp_records enable row level security;

create policy "Users can read their ERP records"
  on public.erp_records
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their ERP records"
  on public.erp_records
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their ERP records"
  on public.erp_records
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their ERP records"
  on public.erp_records
  for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.set_erp_record_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger erp_records_updated_at
before update on public.erp_records
for each row
execute function public.set_erp_record_updated_at();

-- User profile information.
-- No passwords or secret keys are stored here.

create table if not exists public.erp_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  role text not null default 'Admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.erp_profiles enable row level security;

create policy "Users can read their ERP profile"
  on public.erp_profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their ERP profile"
  on public.erp_profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their ERP profile"
  on public.erp_profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
