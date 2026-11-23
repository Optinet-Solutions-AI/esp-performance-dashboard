-- Asserts the locked-down access rules hold. Raises on the first failed
-- expectation (so psql -v ON_ERROR_STOP=1 exits non-zero). Local tests only.
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
  blocked     boolean;
begin
  select id into approved_id from public.profiles where status = 'approved' and not is_admin limit 1;
  if approved_id is null then
    raise exception 'assert setup: no approved non-admin profile in fixture';
  end if;

  -- 1) anon (no login): permission error or 0 rows on EVERY public table
  for t in select tablename from pg_tables where schemaname = 'public' order by tablename loop
    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      execute 'set local role anon';
      execute format('select count(*) from public.%I', t) into n;
      execute 'reset role';
    exception when insufficient_privilege then
      n := 0;
    end;
    execute 'reset role';
    if n <> 0 then
      raise exception 'anon can read % (% rows)', t, n;
    end if;
  end loop;

  foreach t in array app_tables loop
    execute format('select count(*) from public.%I', t) into owner_n;

    -- 2) signed in but NOT approved: 0 rows
    perform set_config('request.jwt.claims',
      json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    execute format('select count(*) from public.%I', t) into n;
    execute 'reset role';
    if n <> 0 then
      raise exception 'not-approved user can read % (% rows)', t, n;
    end if;

    -- 3) approved: sees everything the owner sees
    perform set_config('request.jwt.claims',
      json_build_object('sub', approved_id, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    execute format('select count(*) from public.%I', t) into n;
    execute 'reset role';
    if n <> owner_n then
      raise exception 'approved user sees % of % rows in %', n, owner_n, t;
    end if;
  end loop;

  -- 4) legacy + backup tables: closed even to approved users
  foreach t in array closed_tables loop
    blocked := false;
    begin
      perform set_config('request.jwt.claims',
        json_build_object('sub', approved_id, 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
      execute format('select count(*) from public.%I', t) into n;
    exception when insufficient_privilege then
      blocked := true;
    end;
    execute 'reset role';
    if not blocked then
      raise exception 'approved user can still query closed table %', t;
    end if;
  end loop;

  -- 5) Review Focus: the app's real write paths still work for approved users
  perform set_config('request.jwt.claims',
    json_build_object('sub', approved_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- Reg & FTDs upload RPC (security invoker, so the new policies apply to it)
  declare
    v_upload uuid;
  begin
    execute 'select public.replace_reg_ftds_upload($1, $2)' into v_upload
      using 't.csv', '[{"date":"2026-11-01","esp":"X","ip":"1.1.1.1","registrations":1,"ftds":0}]'::jsonb;
    if v_upload is null then
      raise exception 'replace_reg_ftds_upload returned no upload id for approved user';
    end if;
    select count(*) into n from public.reg_ftds_daily where date = '2026-11-01';
    if n <> 1 then
      raise exception 'replace_reg_ftds_upload left % rows for 2026-11-01, expected 1', n;
    end if;
  end;

  -- ESP visibility toggle is an upsert: needs insert + update
  insert into public.esp_visibility (esp, hidden, updated_at) values ('Mailmodo', true, now())
    on conflict (esp) do update set hidden = excluded.hidden, updated_at = excluded.updated_at;

  -- logs: approved can add, cannot delete
  insert into public.logs (action) values ('upload');
  delete from public.logs;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'approved user deleted % log rows; logs must be add-only', n;
  end if;
  execute 'reset role';

  -- signed in but not approved: writes are rejected
  blocked := false;
  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    insert into public.uploads (esp) values ('intruder');
  exception when insufficient_privilege then
    blocked := true;
  end;
  execute 'reset role';
  if not blocked then
    raise exception 'not-approved user could insert into uploads';
  end if;

  raise notice 'assert-locked: all expectations hold';
end $$;
