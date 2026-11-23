-- ============================================================================
-- Local test fixture: reproduces the production access rules (RLS flags,
-- policies, grants, functions) as dumped from Supabase on 2026-11-23, on a
-- plain postgres:15 container. Columns are trimmed to what the tests touch.
-- Used by run.sh only. NEVER run this against Supabase.
-- ============================================================================

-- Supabase roles + auth.uid() stub (same resolution order as Supabase's)
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create function auth.uid() returns uuid
language sql stable as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
    ), ''
  )::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;

-- Supabase grants functions in public to these roles by default
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- ── profiles (unchanged by the lockdown) ────────────────────────────────────
create table public.profiles (
  id uuid primary key,
  email text,
  status text not null default 'pending',
  is_admin boolean not null default false,
  approved_at timestamptz,
  approved_by uuid
);
insert into public.profiles (id, email, status, is_admin) values
  ('11111111-1111-1111-1111-111111111111', 'approved@test.local', 'approved', false),
  ('22222222-2222-2222-2222-222222222222', 'pending@test.local',  'pending',  false),
  ('33333333-3333-3333-3333-333333333333', 'admin@test.local',    'approved', true);

create function public.current_is_admin()
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$function$;

alter table public.profiles enable row level security;
create policy "admins read all profiles" on public.profiles for select to authenticated using (current_is_admin());
create policy "admins update profiles"   on public.profiles for update to authenticated using (current_is_admin()) with check (current_is_admin());
create policy "users read own profile"   on public.profiles for select to authenticated using ((auth.uid() = id));

-- ── app tables ──────────────────────────────────────────────────────────────
create table public.uploads           (id uuid primary key default gen_random_uuid(), esp text);
create table public.ip_matrix         (id uuid primary key default gen_random_uuid(), esp text);
create table public.ip_matrix_uploads (id uuid primary key default gen_random_uuid(), filename text);
create table public.logs              (id uuid primary key default gen_random_uuid(), action text);
create table public.data_management   (id uuid primary key default gen_random_uuid(), raw_data jsonb);
create table public.esp_visibility    (esp text primary key, hidden boolean, updated_at timestamptz);
create table public.reg_ftds_uploads  (id uuid primary key default gen_random_uuid(), filename text, rows integer, dates text[], uploaded_at timestamptz default now());
create table public.reg_ftds_daily    (id uuid primary key default gen_random_uuid(), date text, esp text, ip text, registrations integer, ftds integer, uploaded_at timestamptz default now(), upload_id uuid);
create table public.throttle_matrix   (id uuid primary key default gen_random_uuid(), esp text);

-- ── legacy + backup tables ──────────────────────────────────────────────────
create table public.users      (id uuid primary key default gen_random_uuid(), username text, password_hash text);
create table public.dashboards (id uuid primary key default gen_random_uuid(), data jsonb);
create table public.reports    (id uuid primary key default gen_random_uuid(), data jsonb);
create table public.reg_ftds_daily_backup_20260624     (id uuid primary key default gen_random_uuid());
create table public.reg_ftds_daily_backup_feb_20260624 (id uuid primary key default gen_random_uuid());

-- rows (2-3 per table)
insert into public.uploads (esp) values ('Mailmodo'), ('Kenscio'), ('MAP');
insert into public.ip_matrix (esp) values ('Mailmodo'), ('Kenscio');
insert into public.ip_matrix_uploads (filename) values ('a.csv'), ('b.csv');
insert into public.logs (action) values ('upload'), ('download'), ('delete');
insert into public.data_management (raw_data) values ('{}'), ('{}');
insert into public.esp_visibility (esp, hidden, updated_at) values ('Mailmodo', false, now()), ('Kenscio', true, now());
insert into public.reg_ftds_uploads (filename, rows, dates) values ('r1.csv', 2, '{2026-10-01}'), ('r2.csv', 1, '{2026-10-02}');
insert into public.reg_ftds_daily (date, esp, ip, registrations, ftds) values
  ('2026-10-01', 'Mailmodo', '1.1.1.1', 5, 1), ('2026-10-01', 'Kenscio', '2.2.2.2', 3, 0), ('2026-10-02', 'MAP', '3.3.3.3', 1, 1);
insert into public.throttle_matrix (esp) values ('Mailmodo'), ('Kenscio');
insert into public.users (username, password_hash) values ('legacy1', 'hash1'), ('legacy2', 'hash2');
insert into public.dashboards (data) values ('{}'), ('{}');
insert into public.reports (data) values ('{}'), ('{}');
insert into public.reg_ftds_daily_backup_20260624 default values;
insert into public.reg_ftds_daily_backup_feb_20260624 default values;

-- ── RLS flags exactly as dumped ─────────────────────────────────────────────
alter table public.dashboards                          enable row level security;
alter table public.data_management                     enable row level security;
alter table public.esp_visibility                      enable row level security;
alter table public.ip_matrix                           enable row level security;
alter table public.ip_matrix_uploads                   enable row level security;
alter table public.logs                                enable row level security;
alter table public.reg_ftds_daily_backup_20260624      enable row level security;
alter table public.reg_ftds_daily_backup_feb_20260624  enable row level security;
alter table public.reports                             enable row level security;
alter table public.uploads                             enable row level security;
alter table public.users                               enable row level security;
-- reg_ftds_daily, reg_ftds_uploads, throttle_matrix: RLS OFF in production

-- ── policies exactly as dumped ──────────────────────────────────────────────
create policy "Enable read access for all users" on public.dashboards for select to public using (true);
create policy "allow_delete" on public.dashboards for delete to public using (true);
create policy "allow_read"   on public.dashboards for select to public using (true);
create policy "allow_update" on public.dashboards for update to public using (true) with check (true);
create policy "allow_write"  on public.dashboards for insert to public with check (true);

create policy "allow_anon_all" on public.data_management for all to anon using (true) with check (true);
create policy "authenticated all data_management" on public.data_management for all to authenticated using (true) with check (true);

create policy "anon read"   on public.esp_visibility for select to public using (true);
create policy "anon update" on public.esp_visibility for update to public using (true) with check (true);
create policy "anon upsert" on public.esp_visibility for insert to public with check (true);
create policy "authenticated all esp_visibility" on public.esp_visibility for all to authenticated using (true) with check (true);

create policy "allow anon all" on public.ip_matrix for all to anon using (true) with check (true);
create policy "authenticated all ip_matrix" on public.ip_matrix for all to authenticated using (true) with check (true);

create policy "allow_anon_all" on public.ip_matrix_uploads for all to anon using (true) with check (true);
create policy "authenticated all ip_matrix_uploads" on public.ip_matrix_uploads for all to authenticated using (true) with check (true);

create policy "allow_anon_all" on public.logs for all to anon using (true) with check (true);
create policy "authenticated insert logs" on public.logs for insert to authenticated with check (true);
create policy "authenticated read logs"   on public.logs for select to authenticated using (true);

create policy "allow anon upsert" on public.reports for all to anon using (true) with check (true);

create policy "allow_anon_all" on public.uploads for all to anon using (true) with check (true);
create policy "authenticated all uploads" on public.uploads for all to authenticated using (true) with check (true);

create policy "allow_anon_all" on public.users for all to anon using (true) with check (true);

-- ── grants exactly as dumped (ALL to anon + authenticated on every table) ───
grant all on all tables in schema public to anon, authenticated, service_role;

-- ── replace_reg_ftds_upload, body verbatim (security invoker) ───────────────
create or replace function public.replace_reg_ftds_upload(p_filename text, p_rows jsonb)
 returns uuid
 language plpgsql
as $function$
declare
  v_upload_id uuid;
  v_dates     text[];
begin
  -- distinct dates present in the payload
  select array_agg(distinct (r->>'date'))
    into v_dates
    from jsonb_array_elements(p_rows) r;

  -- 1) history record (count + dates derived from the payload itself)
  insert into reg_ftds_uploads (filename, rows, dates)
  values (p_filename, jsonb_array_length(p_rows), coalesce(v_dates, '{}'))
  returning id into v_upload_id;

  -- 2) clear existing daily rows for those dates
  delete from reg_ftds_daily where date::text = any(v_dates);

  -- 3) insert the new daily rows, linked to the new upload
  insert into reg_ftds_daily (date, esp, ip, registrations, ftds, upload_id)
  select r->>'date', r->>'esp', r->>'ip',
         (r->>'registrations')::int, (r->>'ftds')::int, v_upload_id
    from jsonb_array_elements(p_rows) r;

  return v_upload_id;
end;
$function$;
