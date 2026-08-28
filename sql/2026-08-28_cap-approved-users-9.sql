-- ============================================================================
-- Hard-cap the number of approved dashboard users at 9.
--
-- Enforced with a trigger on `profiles` rather than by editing
-- admin_approve_user() directly, since that RPC's body isn't tracked in this
-- repo (it lives only in Supabase) and its auto-confirm-email logic
-- shouldn't be touched blind. The trigger fires on ANY insert/update that
-- sets status = 'approved', regardless of which function does it, so it
-- stays correct even if the approval path changes later.
--
-- DEPLOY: run this in the Supabase SQL editor. Re-running is safe
-- (CREATE OR REPLACE + DROP TRIGGER IF EXISTS).
-- ============================================================================

create or replace function enforce_approved_user_cap()
returns trigger
language plpgsql
security definer
as $$
declare
  v_approved_count int;
begin
  -- only gate transitions INTO 'approved' (idempotent re-approves, and
  -- inserts/updates that don't touch status, are left alone)
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    select count(*) into v_approved_count from profiles where status = 'approved';
    if v_approved_count >= 9 then
      raise exception 'Approved user cap reached (9/9). Remove or demote an existing user before approving another.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_approved_user_cap on profiles;

create trigger trg_enforce_approved_user_cap
  before insert or update on profiles
  for each row
  execute function enforce_approved_user_cap();
