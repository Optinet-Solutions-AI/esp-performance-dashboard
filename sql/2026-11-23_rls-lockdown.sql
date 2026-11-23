-- ============================================================================
-- Lock database access down to signed-in, APPROVED users.
--
-- Why: an audit on 2026-11-23 found that the public anon key (shipped in the
-- site's JavaScript) could read, change and delete nearly every table with no
-- login, and signed-in users who were never approved had the same access. The
-- approval gate (profiles.status = 'approved') only existed in the browser.
--
-- What this does (access rules only; no table rows are changed):
--   * adds public.current_is_approved() (same shape as current_is_admin())
--   * app tables: RLS on, every old policy dropped, ONE policy giving approved
--     users the same full access they have today; anon access revoked
--   * logs: approved users can read and add, never change or delete
--   * legacy users / dashboards / reports + the two reg_ftds_daily backups:
--     closed to anon and authenticated (nothing in this app uses them)
--   * replace_reg_ftds_upload(): callable by signed-in users only
--   * profiles, the admin_* functions, triggers and portal SSO: untouched
--
-- DEPLOY: paste the whole file into the Supabase SQL editor and run it once.
--   * It runs in ONE transaction and checks itself before committing: it
--     simulates an approved user, a signed-in user who is not approved, and an
--     anonymous visitor. If any of them gets the wrong access it raises
--     "RLS lockdown self-check failed: ..." and NOTHING is applied.
--   * Success = a results table where every row says PASS.
--   * The self-check needs: at least one approved profile; the SQL editor's
--     postgres role able to SET ROLE anon/authenticated and to see every row
--     (table owner). If either is not true, the check fails safely (nothing
--     applied) - send the error message back for a look.
--   * Undo: sql/2026-11-23_rls-lockdown-ROLLBACK.sql restores the exact
--     previous rules.
--   * Signed-in dashboard users are unaffected; anyone else gets nothing.
-- Rehearsed locally: bash sql/test/rls-lockdown/run.sh
-- ============================================================================

begin;

-- 1) Approval helper ---------------------------------------------------------
create or replace function public.current_is_approved()
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select coalesce((select status = 'approved' from public.profiles where id = auth.uid()), false);
$function$;

revoke execute on function public.current_is_approved() from public, anon;
grant execute on function public.current_is_approved() to authenticated;

-- 2) Drop every existing policy on the tables this script governs ------------
do $$
declare
  pol record;
begin
  for pol in
    select tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in ('uploads', 'ip_matrix', 'ip_matrix_uploads', 'reg_ftds_daily', 'reg_ftds_uploads',
                         'throttle_matrix', 'esp_visibility', 'data_management', 'logs',
                         'users', 'dashboards', 'reports')
  loop
    execute format('drop policy %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- 3) App tables: approved users keep full access, nobody else gets any -------
do $$
declare
  t text;
begin
  foreach t in array array['uploads', 'ip_matrix', 'ip_matrix_uploads', 'reg_ftds_daily', 'reg_ftds_uploads',
                           'throttle_matrix', 'esp_visibility', 'data_management']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "approved users full access" on public.%I for all to authenticated '
      'using ((select public.current_is_approved())) with check ((select public.current_is_approved()))', t);
    execute format('revoke all on table public.%I from anon', t);
  end loop;
end $$;

-- 4) logs: approved users can read and add; nobody can change or delete ------
alter table public.logs enable row level security;
create policy "approved users read logs" on public.logs
  for select to authenticated using ((select public.current_is_approved()));
create policy "approved users add logs" on public.logs
  for insert to authenticated with check ((select public.current_is_approved()));
revoke all on table public.logs from anon;

-- 5) Legacy tables (unused by this app) and backups: closed -----------------
alter table public.users      enable row level security;
alter table public.dashboards enable row level security;
alter table public.reports    enable row level security;
revoke all on table public.users, public.dashboards, public.reports from anon, authenticated;
revoke all on table public.reg_ftds_daily_backup_20260624, public.reg_ftds_daily_backup_feb_20260624
  from anon, authenticated;

-- 6) Reg & FTDs upload function: signed-in users only ------------------------
--    (it runs as the caller, so the policies above already limit it to
--    approved users)
revoke execute on function public.replace_reg_ftds_upload(text, jsonb) from public, anon;
grant execute on function public.replace_reg_ftds_upload(text, jsonb) to authenticated;

-- 7) Self-check: refuse to commit unless access is exactly right -------------
create temp table _rls_lockdown_check (
  seq      serial,
  who      text,
  tbl      text,
  expected text,
  got      text
);

do $$
declare
  app_tables    text[] := array['uploads', 'ip_matrix', 'ip_matrix_uploads', 'reg_ftds_daily', 'reg_ftds_uploads',
                                'throttle_matrix', 'esp_visibility', 'data_management', 'logs'];
  closed_tables text[] := array['users', 'dashboards', 'reports',
                                'reg_ftds_daily_backup_20260624', 'reg_ftds_daily_backup_feb_20260624'];
  t           text;
  n           bigint;
  owner_n     bigint;
  approved_id uuid;
  got         text;
begin
  select id into approved_id
    from public.profiles
   where status = 'approved'
   order by is_admin, id
   limit 1;
  if approved_id is null then
    raise exception 'RLS lockdown self-check failed: no approved profile to test with';
  end if;

  -- anonymous visitor: blocked or 0 rows on every table, view, materialized
  -- view and foreign table in public (views run as their owner, so RLS alone
  -- does not protect them)
  for t in select c.relname from pg_class c
            where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'f')
            order by c.relname loop
    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      execute 'set local role anon';
      execute format('select count(*) from public.%I', t) into n;
      execute 'reset role';
      got := n::text;
    exception when insufficient_privilege then
      got := 'blocked';
    end;
    execute 'reset role';
    insert into _rls_lockdown_check (who, tbl, expected, got) values ('anon (no login)', t, '0 or blocked', got);
    if got not in ('0', 'blocked') then
      raise exception 'RLS lockdown self-check failed: anon/% expected 0 or blocked got %', t, got;
    end if;
  end loop;

  foreach t in array app_tables loop
    execute format('select count(*) from public.%I', t) into owner_n;

    -- signed in, not approved: 0 rows
    perform set_config('request.jwt.claims',
      json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    execute format('select count(*) from public.%I', t) into n;
    execute 'reset role';
    insert into _rls_lockdown_check (who, tbl, expected, got) values ('signed in, not approved', t, '0', n::text);
    if n <> 0 then
      raise exception 'RLS lockdown self-check failed: not-approved/% expected 0 got %', t, n;
    end if;

    -- approved: every row
    perform set_config('request.jwt.claims',
      json_build_object('sub', approved_id, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    execute format('select count(*) from public.%I', t) into n;
    execute 'reset role';
    insert into _rls_lockdown_check (who, tbl, expected, got) values ('approved user', t, owner_n::text, n::text);
    if n <> owner_n then
      raise exception 'RLS lockdown self-check failed: approved/% expected % got %', t, owner_n, n;
    end if;
  end loop;

  -- legacy + backup tables: closed even to approved users
  foreach t in array closed_tables loop
    begin
      perform set_config('request.jwt.claims',
        json_build_object('sub', approved_id, 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
      execute format('select count(*) from public.%I', t) into n;
      got := n::text || ' rows';
    exception when insufficient_privilege then
      got := 'blocked';
    end;
    execute 'reset role';
    insert into _rls_lockdown_check (who, tbl, expected, got) values ('approved user', t, 'blocked', got);
    if got <> 'blocked' then
      raise exception 'RLS lockdown self-check failed: approved/% expected blocked got %', t, got;
    end if;
  end loop;
end $$;

commit;

-- 8) Result (only reached if everything above passed and was committed) -----
select 'PASS' as result, who, tbl as "table", expected, got
  from _rls_lockdown_check
 order by seq;
