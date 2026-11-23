#!/usr/bin/env bash
# Local rehearsal of the RLS lockdown against a throwaway postgres:15 container
# seeded with the production access rules (fixture.sql). Never touches Supabase.
#
#   bash sql/test/rls-lockdown/run.sh [red] [lock] [abort] [rollback]
#
# Each step starts from a fresh container + fixture. Prints PASS/FAIL per step,
# exits non-zero if any step fails. SQL is piped over stdin (no volume mounts,
# so it works the same from Git Bash on Windows).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
SQL_DIR="$(cd "$HERE/../.." && pwd)"
IMAGE="postgres:15-alpine"
STEPS=("$@")
[ ${#STEPS[@]} -eq 0 ] && STEPS=(red lock abort rollback)

CONTAINER=""
cleanup() { [ -n "$CONTAINER" ] && docker rm -f "$CONTAINER" >/dev/null 2>&1; CONTAINER=""; }
trap cleanup EXIT

start_db() {
  cleanup
  CONTAINER="rls-lockdown-test-$$-$RANDOM"
  docker run -d --name "$CONTAINER" -e POSTGRES_HOST_AUTH_METHOD=trust "$IMAGE" >/dev/null || return 1
  # TCP only answers after initdb's temporary server has stopped and the real one is up
  for _ in $(seq 1 60); do
    docker exec "$CONTAINER" pg_isready -q -U postgres -h 127.0.0.1 && return 0
    sleep 1
  done
  echo "  database did not become ready" >&2
  return 1
}

# psql reading SQL from stdin; extra args passed through
pg() { docker exec -i "$CONTAINER" psql -X -q -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }

load_fixture() { pg < "$HERE/fixture.sql" >/dev/null; }

step_red() {
  # Production as it is today must FAIL the lockdown assertions.
  load_fixture || { echo "  fixture failed to load"; return 1; }
  local out
  if out=$(pg < "$HERE/assert-locked.sql" 2>&1); then
    echo "  assert-locked unexpectedly passed on today's rules"; return 1
  fi
  echo "  assert-locked failed as expected: $(echo "$out" | grep -o 'ERROR:.*' | head -1)"
}

LOCKDOWN="$SQL_DIR/2026-11-23_rls-lockdown.sql"

step_lock() {
  # Lockdown applies cleanly (its own self-check passes) and the assertions hold.
  load_fixture || { echo "  fixture failed to load"; return 1; }
  [ -f "$LOCKDOWN" ] || { echo "  missing $LOCKDOWN"; return 1; }
  pg < "$LOCKDOWN" >/dev/null || { echo "  lockdown script failed"; return 1; }
  pg < "$HERE/assert-locked.sql" 2>&1 | grep -o 'ERROR:.*\|assert-locked:.*' | head -1 | sed 's/^/  /'
  return "${PIPESTATUS[0]}"
}

step_abort() {
  # Break the approval helper so approved users would see nothing: the
  # self-check must refuse, and NOTHING may be committed.
  load_fixture || { echo "  fixture failed to load"; return 1; }
  [ -f "$LOCKDOWN" ] || { echo "  missing $LOCKDOWN"; return 1; }
  local out rls
  if out=$(sed "s/select status = 'approved'/select status = 'nope'/" "$LOCKDOWN" | pg 2>&1); then
    echo "  broken lockdown was NOT refused"; return 1
  fi
  echo "  refused: $(echo "$out" | grep -o 'ERROR:.*' | head -1)"
  rls=$(pg -At -c "select relrowsecurity from pg_class where oid = 'public.reg_ftds_daily'::regclass")
  [ "$rls" = "f" ] || { echo "  partial apply: reg_ftds_daily RLS is '$rls'"; return 1; }
  echo "  nothing committed (reg_ftds_daily RLS still off)"
}

ROLLBACK="$SQL_DIR/2026-11-23_rls-lockdown-ROLLBACK.sql"

step_rollback() {
  # lockdown + rollback must restore the access rules exactly.
  load_fixture || { echo "  fixture failed to load"; return 1; }
  [ -f "$ROLLBACK" ] || { echo "  missing $ROLLBACK"; return 1; }
  local before after
  before=$(pg -At < "$HERE/snapshot.sql") || return 1
  pg < "$LOCKDOWN" >/dev/null || { echo "  lockdown script failed"; return 1; }
  pg < "$ROLLBACK" >/dev/null || { echo "  rollback script failed"; return 1; }
  after=$(pg -At < "$HERE/snapshot.sql") || return 1
  if [ "$before" != "$after" ]; then
    echo "  access rules differ after rollback:"
    diff <(echo "$before") <(echo "$after") | sed 's/^/    /'
    return 1
  fi
  echo "  identical to before ($(echo "$before" | wc -l) rules compared)"
}

FAILED=0
for s in "${STEPS[@]}"; do
  if ! declare -F "step_$s" >/dev/null; then
    echo "FAIL $s (unknown step)"; FAILED=1; continue
  fi
  if start_db && "step_$s"; then echo "PASS $s"; else echo "FAIL $s"; FAILED=1; fi
  cleanup
done
exit $FAILED
