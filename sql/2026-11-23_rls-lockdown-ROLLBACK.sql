-- ============================================================================
-- ROLLBACK for sql/2026-11-23_rls-lockdown.sql
--
-- Restores the access rules EXACTLY as they were dumped on 2026-11-23 before
-- the lockdown - including the insecure ones (anon could read, change and
-- delete nearly every table). Only run this if the lockdown broke something
-- and you need the old behaviour back while it's fixed.
--
-- DEPLOY: paste the whole file into the Supabase SQL editor and run it once.
-- One transaction: it applies fully or not at all. No table rows are changed.
-- Rehearsed locally: bash sql/test/rls-lockdown/run.sh rollback
-- ============================================================================

begin;

-- 1) Remove the lockdown's policies and helper -------------------------------
drop policy if exists "approved users full access" on public.uploads;
drop policy if exists "approved users full access" on public.ip_matrix;
drop policy if exists "approved users full access" on public.ip_matrix_uploads;
drop policy if exists "approved users full access" on public.reg_ftds_daily;
drop policy if exists "approved users full access" on public.reg_ftds_uploads;
drop policy if exists "approved users full access" on public.throttle_matrix;
drop policy if exists "approved users full access" on public.esp_visibility;
drop policy if exists "approved users full access" on public.data_management;
drop policy if exists "approved users read logs" on public.logs;
drop policy if exists "approved users add logs" on public.logs;
drop function if exists public.current_is_approved();

-- 2) RLS was OFF on these three -------------------------------------------
alter table public.reg_ftds_daily   disable row level security;
alter table public.reg_ftds_uploads disable row level security;
alter table public.throttle_matrix  disable row level security;

-- 3) Policies exactly as dumped ----------------------------------------------
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

-- 4) Grants as dumped (ALL to anon and authenticated) -------------------------
grant all on table
  public.uploads, public.ip_matrix, public.ip_matrix_uploads, public.reg_ftds_daily, public.reg_ftds_uploads,
  public.throttle_matrix, public.esp_visibility, public.data_management, public.logs,
  public.users, public.dashboards, public.reports,
  public.reg_ftds_daily_backup_20260624, public.reg_ftds_daily_backup_feb_20260624
  to anon;
grant all on table
  public.users, public.dashboards, public.reports,
  public.reg_ftds_daily_backup_20260624, public.reg_ftds_daily_backup_feb_20260624
  to authenticated;

-- 5) Reg & FTDs upload function callable by everyone again -------------------
grant execute on function public.replace_reg_ftds_upload(text, jsonb) to public, anon;

commit;
