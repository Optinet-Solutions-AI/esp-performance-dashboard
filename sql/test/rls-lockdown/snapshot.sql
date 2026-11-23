-- Deterministic dump of the access-control state of schema public, for diffing
-- before-lockdown vs after-rollback. Run with: psql -At
select 'rls|' || c.relname || '|' || c.relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
 order by c.relname;

select 'policy|' || tablename || '|' || policyname || '|' || permissive || '|' || roles::text || '|' || cmd
       || '|' || coalesce(qual, '') || '|' || coalesce(with_check, '')
  from pg_policies
 where schemaname = 'public'
 order by tablename, policyname;

select 'grant|' || table_name || '|' || grantee || '|' || privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public' and grantee in ('anon', 'authenticated')
 order by table_name, grantee, privilege_type;

select 'func|' || p.proname || '|' || coalesce(r.rolname, 'PUBLIC') || '|' || a.privilege_type
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  left join pg_roles r on r.oid = a.grantee
 where n.nspname = 'public'
 order by p.proname, coalesce(r.rolname, 'PUBLIC'), a.privilege_type;
