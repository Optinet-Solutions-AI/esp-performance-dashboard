# MAP MP-## Code → IP Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve MAP campaigns that carry no sending domain to their sending domain via a registered `MP-##` code, so the ESP Deliverability Matrix can show per-IP rows for MAP.

**Architecture:** Add an optional `mpCode` to each IP Matrix row (`IpmRecord` + `ip_matrix.mp_code`). The parser's `extractSendingDomain` gains a new boundary-delimited MP-code match, placed **after** the existing registered-subdomain match (subdomain is authoritative per client) and **before** the regex fallback. `UploadView` builds a `code → domain` map from the ESP's IP Matrix rows and threads it into `parseFile`.

**Tech Stack:** TypeScript, Next.js/React, Zustand, Supabase, Vitest.

## Global Constraints

- **Subdomain is authoritative.** When a campaign contains both a registered subdomain and an MP-code, the subdomain wins. MP-code only resolves when no registered subdomain is found. (Client-confirmed 2026-07-03.)
- **Boundary-delimited match.** `MP-86` must not match inside `MP-861`. Case-insensitive.
- **Blank-domain fallthrough.** A code whose mapped row has an empty domain must NOT resolve; fall through to the next step.
- **`mp_code` column is nullable.** Existing rows and non-MAP ESPs leave it blank; no behavior change when unset.
- **Manual DB change convention.** The `ALTER TABLE` is run by the maintainer against Supabase, not by code/migration tooling.
- **Path alias:** `@/*` → `./src/*`.

---

### Task 1: MP-code resolver in the parser

Self-contained, fully unit-testable. No DB or UI. Adds the `matchMpCode` helper, wires it into `extractSendingDomain`, and threads a `mpCodeMap` param through `parseFile`.

**Files:**
- Modify: `src/lib/parsers.ts` (add `matchMpCode`; edit `extractSendingDomain` signature + body; edit `parseFile` signature; edit the two `extractSendingDomain` call sites)
- Test: `src/lib/__tests__/parsers-mpcode.test.ts` (create)

**Interfaces:**
- Produces: `export function matchMpCode(campaignName: string, mpCodeMap?: Record<string, string>): string | null`
- Produces: `parseFile(file, espName?, knownDomains?, mapDateOrder?, mpCodeMap?: Record<string, string>)` — `mpCodeMap` appended last so existing positional calls are unaffected.
- Consumes: existing `findKnownDomain`, `normalizeDomainForEsp`.

- [ ] **Step 1: Write failing unit tests for `matchMpCode`**

Create `src/lib/__tests__/parsers-mpcode.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { matchMpCode, parseFile } from '../parsers'

describe('matchMpCode', () => {
  const map = { 'MP-86': 'brand86.com', 'MP-16': 'brand16.com' }

  it('matches a boundary-delimited code in a campaign name', () => {
    expect(matchMpCode('BLA-RB-WO-NZ-ACT-D1-MP-86-07-15-2026', map)).toBe('brand86.com')
  })

  it('is case-insensitive', () => {
    expect(matchMpCode('promo_mp-16_july', map)).toBe('brand16.com')
  })

  it('does NOT match a code embedded in a longer number (MP-86 vs MP-861)', () => {
    expect(matchMpCode('BLA-MP-861-07-15-2026', map)).toBeNull()
  })

  it('does NOT match a code glued to letters (xMP-86)', () => {
    expect(matchMpCode('BLAxMP-86y', map)).toBeNull()
  })

  it('returns null when the matched code maps to a blank domain', () => {
    expect(matchMpCode('BLA-MP-86-2026', { 'MP-86': '' })).toBeNull()
  })

  it('returns null with no map or no campaign name', () => {
    expect(matchMpCode('BLA-MP-86', undefined)).toBeNull()
    expect(matchMpCode('', map)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/parsers-mpcode.test.ts`
Expected: FAIL — `matchMpCode is not a function` / not exported.

- [ ] **Step 3: Add the `matchMpCode` helper**

In `src/lib/parsers.ts`, add directly above `function extractSendingDomain(`:

```ts
/**
 * Match a MAP campaign name to a registered MP-## code (MAP convention).
 *
 * Codes are matched case-insensitively and must be boundary-delimited: the code
 * is preceded by start-of-string or a non-[a-z0-9] char and followed by
 * end-of-string or a non-[a-z0-9] char, so "MP-86" matches in "...-MP-86-..."
 * but NOT inside "MP-861" or "xMP-86y". Returns the code's mapped sending
 * domain, or null when nothing matches or the matched code maps to a blank
 * domain (callers should fall through to domain/regex extraction).
 */
export function matchMpCode(campaignName: string, mpCodeMap?: Record<string, string>): string | null {
  if (!mpCodeMap || !campaignName) return null
  const haystack = campaignName.toLowerCase()
  for (const [code, domain] of Object.entries(mpCodeMap)) {
    const c = code.toLowerCase().trim()
    const d = (domain || '').toLowerCase().trim()
    if (!c || !d) continue
    const esc = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(?:^|[^a-z0-9])${esc}(?![a-z0-9])`, 'i')
    if (re.test(haystack)) return d
  }
  return null
}
```

- [ ] **Step 4: Wire `matchMpCode` into `extractSendingDomain`**

Change the `extractSendingDomain` signature and insert the MP-code step between the `findKnownDomain` match and the regex fallback. Replace:

```ts
function extractSendingDomain(campaignName: string, knownDomains?: string[]): string {
  // 1. Highest priority: match against domains registered in the IP Matrix.
  //    This is the most reliable approach because it relies on user-curated data,
  //    not pattern guessing. Adding a domain to IP Matrix automatically improves
  //    parsing — no code changes needed.
  const matched = findKnownDomain(campaignName, knownDomains || [])
  if (matched) return matched

  // 2. Fall back to regex extraction for campaigns where the domain isn't registered yet.
```

with:

```ts
function extractSendingDomain(campaignName: string, knownDomains?: string[], mpCodeMap?: Record<string, string>): string {
  // 1. Highest priority: match against domains registered in the IP Matrix.
  //    This is the most reliable approach because it relies on user-curated data,
  //    not pattern guessing. Adding a domain to IP Matrix automatically improves
  //    parsing — no code changes needed. Subdomain is authoritative: if a
  //    registered domain is present it wins even when an MP-code is also present.
  const matched = findKnownDomain(campaignName, knownDomains || [])
  if (matched) return matched

  // 2. MAP convention: resolve a registered MP-## code to its sending domain.
  //    Only reached when no registered subdomain matched above.
  const byCode = matchMpCode(campaignName, mpCodeMap)
  if (byCode) return byCode

  // 3. Fall back to regex extraction for campaigns where the domain isn't registered yet.
```

> Note: the two remaining fallback comments in this function currently read "2." and are cosmetic; leave the regex/underscore fallback code unchanged.

- [ ] **Step 5: Add `mpCodeMap` param to `parseFile` and pass it at both call sites**

Change the signature (line ~403):

```ts
export async function parseFile(file: File, espName?: string, knownDomains?: string[], mapDateOrder?: MapDateOrder, mpCodeMap?: Record<string, string>): Promise<ParseResult> {
```

In the MAP aggregate block, change:

```ts
      const rawSendingDomain = extractSendingDomain(row['campaign-name'] || '', knownDomains)
```

to:

```ts
      const rawSendingDomain = extractSendingDomain(row['campaign-name'] || '', knownDomains, mpCodeMap)
```

In the per-email (Mailmodo) block, change:

```ts
          ? extractSendingDomain(row['campaign-name'] || '', knownDomains)
```

to:

```ts
          ? extractSendingDomain(row['campaign-name'] || '', knownDomains, mpCodeMap)
```

- [ ] **Step 6: Add failing integration tests (resolve + precedence + boundary through `parseFile`)**

Append to `src/lib/__tests__/parsers-mpcode.test.ts`:

```ts
function mapFile(campaign: string): File {
  // MAP layout: header row keyed by name (normaliseKeys keys by header text).
  // 'confirmed-openers' triggers MAP detection. Date 07/15/2026 has a part >12
  // so month/day order resolves unambiguously (mdy), no ambiguity pause.
  const csv = [
    'Campaign Name,Date,Domains,Messages Sent,Confirmed Openers,Clickers,Hard Bounces,Soft Bounces,Unsubscribed',
    `${campaign},07/15/2026,gmail.com,100,40,10,2,3,1`,
  ].join('\n')
  return new File([csv], 'map.csv', { type: 'text/csv' })
}

describe('parseFile — MAP MP-code resolution', () => {
  it('resolves the sending domain from an MP-code when no subdomain is present', async () => {
    const r = await parseFile(mapFile('BLA-RB-WO-NZ-ACT-D1-MP-86-07-15-2026'), 'Map', [], undefined, { 'MP-86': 'brand86.com' })
    expect(r.format).toBe('map')
    const day = r.byDate['Jul 15']
    expect(day.domains['brand86.com']?.sent).toBe(100)
    expect(day.domains['unknown']).toBeUndefined()
  })

  it('lets a registered subdomain win over a present MP-code (subdomain authoritative)', async () => {
    const r = await parseFile(
      mapFile('brand16.com-ACT-D1-MP-86-07-15-2026'), 'Map',
      ['brand16.com'], undefined, { 'MP-86': 'brand86.com' },
    )
    const day = r.byDate['Jul 15']
    expect(day.domains['brand16.com']?.sent).toBe(100)
    expect(day.domains['brand86.com']).toBeUndefined()
  })

  it('does not resolve MP-86 from a campaign containing MP-861', async () => {
    const r = await parseFile(mapFile('BLA-MP-861-07-15-2026'), 'Map', [], undefined, { 'MP-86': 'brand86.com' })
    const day = r.byDate['Jul 15']
    expect(day.domains['brand86.com']).toBeUndefined()
  })
})
```

- [ ] **Step 7: Run the full test file to verify all pass**

Run: `npx vitest run src/lib/__tests__/parsers-mpcode.test.ts`
Expected: PASS (all cases).

- [ ] **Step 8: Verify existing parser tests still pass (no regressions)**

Run: `npx vitest run src/lib/__tests__`
Expected: PASS — existing Mailmodo/generic/MAP-date/kenscio suites unaffected (no `mpCodeMap` passed → behavior unchanged).

- [ ] **Step 9: Commit**

```bash
git add src/lib/parsers.ts src/lib/__tests__/parsers-mpcode.test.ts
git commit -m "feat(parsers): resolve MAP MP-## code to sending domain (subdomain authoritative)"
```

---

### Task 2: `mpCode` on the type, DB column, IP Matrix UI + persistence

Adds the field to the model, the manual DB column, the IP Matrix edit modal + CSV import, and the two Supabase `select` sites so `mp_code` round-trips.

**Files:**
- Modify: `src/lib/types.ts` (`IpmRecord`)
- Modify: `src/components/views/IPMatrixView.tsx` (modal input, `saveModal`, CSV `handleFile`, reload-after-delete select)
- Modify: `src/app/page.tsx` (mount load select + map)
- DB: `ip_matrix.mp_code` column (manual SQL, below)

**Interfaces:**
- Consumes: `IpmRecord` (extended), Supabase `ip_matrix` table with new `mp_code text` column.
- Produces: `IpmRecord.mpCode?: string` populated from the UI / CSV / DB and available in `ipmData` for Task 3.

- [ ] **Step 1: Run the DB migration (manual)**

In the Supabase SQL editor, run:

```sql
alter table ip_matrix add column mp_code text;
```

Expected: column added; existing rows have `mp_code = null`. This is a prerequisite for the `select`/`insert` changes below to round-trip.

- [ ] **Step 2: Add `mpCode` to `IpmRecord`**

In `src/lib/types.ts`, change:

```ts
export interface IpmRecord {
  id?: string
  upload_id?: string
  esp: string
  ip: string
  domain: string
  registrations?: number
  ftds?: number
}
```

to:

```ts
export interface IpmRecord {
  id?: string
  upload_id?: string
  esp: string
  ip: string
  domain: string
  mpCode?: string        // MAP campaign code, e.g. "MP-86" — resolves campaign → sending domain
  registrations?: number
  ftds?: number
}
```

- [ ] **Step 3: Add the "MP Code" input to the edit modal**

In `src/components/views/IPMatrixView.tsx`, immediately after the "From Domain" `<div>` block (the one whose input binds `modal.rec.domain`, ending `</div>` around line 759), insert:

```tsx
              <div>
                <label className={`block text-[11px] font-mono tracking-widest uppercase mb-1.5 ${muted}`}>MP Code <span className={`normal-case ${muted}`}>(optional, MAP)</span></label>
                <input
                  value={modal.rec.mpCode ?? ''}
                  onChange={e => setModal(m => ({ ...m, rec: { ...m.rec, mpCode: e.target.value } }))}
                  placeholder="e.g. MP-86"
                  className={inputCls}
                />
              </div>
```

- [ ] **Step 4: Persist `mpCode` in `saveModal`**

In `saveModal`, change the `saved` object:

```ts
    const saved: IpmRecord = {
      esp, ip, domain: modal.rec.domain.trim(),
      registrations: modal.rec.registrations,
      ftds: modal.rec.ftds,
    }
```

to:

```ts
    const saved: IpmRecord = {
      esp, ip, domain: modal.rec.domain.trim(),
      mpCode: modal.rec.mpCode?.trim() || undefined,
      registrations: modal.rec.registrations,
      ftds: modal.rec.ftds,
    }
```

Change the update call:

```ts
        await supabase.from('ip_matrix').update({ esp: saved.esp, ip: saved.ip, domain: saved.domain, registrations: saved.registrations ?? null, ftds: saved.ftds ?? null }).eq('id', existing.id)
```

to:

```ts
        await supabase.from('ip_matrix').update({ esp: saved.esp, ip: saved.ip, domain: saved.domain, mp_code: saved.mpCode ?? null, registrations: saved.registrations ?? null, ftds: saved.ftds ?? null }).eq('id', existing.id)
```

Change the insert call:

```ts
      const { data: inserted } = await supabase.from('ip_matrix').insert({ esp: saved.esp, ip: saved.ip, domain: saved.domain, registrations: saved.registrations ?? null, ftds: saved.ftds ?? null }).select('id').single()
```

to:

```ts
      const { data: inserted } = await supabase.from('ip_matrix').insert({ esp: saved.esp, ip: saved.ip, domain: saved.domain, mp_code: saved.mpCode ?? null, registrations: saved.registrations ?? null, ftds: saved.ftds ?? null }).select('id').single()
```

(`addIpmRecord({ ...saved, id: inserted?.id })` already carries `mpCode` — no change there.)

- [ ] **Step 5: Detect and import an MP-code column in CSV upload (`handleFile`)**

Add a `mpcode` detector to `ci` (headers are stripped to `[a-z]` only, so "MP Code"/"MP-Code"/"mp_code" all normalize to `mpcode`):

```ts
    const ci = {
      esp:           find('esp', 'provider', 'service'),
      ip:            find('ip', 'ipaddress', 'address'),
      domain:        find('domain', 'fromdomain', 'from', 'sender'),
      mpcode:        find('mpcode', 'code'),
      registrations: find('registrations', 'registration', 'reg'),
      ftds:          find('ftds', 'ftd'),
    }
```

Extend the `newRecords` element type and the per-row `r`:

```ts
    const newRecords: { esp: string; ip: string; domain: string; mpCode?: string; registrations?: number; ftds?: number }[] = []
    rows.slice(1).forEach(cols => {
      const r = {
        esp:           ci.esp    >= 0 ? normalizeEspName(String(cols[ci.esp] ?? '')) : '',
        ip:            ci.ip     >= 0 ? String(cols[ci.ip]     ?? '').trim() : '',
        domain:        ci.domain >= 0 ? String(cols[ci.domain] ?? '').trim() : '',
        mpCode:        ci.mpcode >= 0 ? (String(cols[ci.mpcode] ?? '').trim() || undefined) : undefined,
        registrations: ci.registrations >= 0 ? parseNum(cols[ci.registrations]) : undefined,
        ftds:          ci.ftds   >= 0 ? parseNum(cols[ci.ftds]) : undefined,
      }
      if (r.esp || r.ip) newRecords.push(r)
    })
```

Map `mpCode → mp_code` when building the Supabase insert payload. Change:

```ts
      const recordsWithUpload = newRecords.map(r => ({ ...r, upload_id: uploadId }))

      const { data: inserted } = await supabase.from('ip_matrix').insert(recordsWithUpload).select('id, esp, ip, domain, upload_id, registrations, ftds')
      if (inserted) {
        inserted.forEach(row => addIpmRecord({ id: row.id, upload_id: row.upload_id, esp: row.esp, ip: row.ip, domain: row.domain, registrations: row.registrations ?? undefined, ftds: row.ftds ?? undefined }))
      } else {
```

to:

```ts
      const recordsWithUpload = newRecords.map(({ mpCode, ...r }) => ({ ...r, mp_code: mpCode ?? null, upload_id: uploadId }))

      const { data: inserted } = await supabase.from('ip_matrix').insert(recordsWithUpload).select('id, esp, ip, domain, mp_code, upload_id, registrations, ftds')
      if (inserted) {
        inserted.forEach(row => addIpmRecord({ id: row.id, upload_id: row.upload_id, esp: row.esp, ip: row.ip, domain: row.domain, mpCode: row.mp_code ?? undefined, registrations: row.registrations ?? undefined, ftds: row.ftds ?? undefined }))
      } else {
```

(The `else` fallback `newRecords.forEach(r => addIpmRecord(r))` already carries `mpCode` — no change.)

- [ ] **Step 6: Include `mp_code` in the reload-after-delete select**

In `handleDeleteUpload`, change:

```ts
      const { data: allRows } = await supabase
        .from('ip_matrix')
        .select('id, esp, ip, domain, upload_id, registrations, ftds')
        .order('created_at', { ascending: true })
      const { setIpmData } = useDashboardStore.getState()
      setIpmData(allRows?.map(r => ({ id: r.id, upload_id: r.upload_id, esp: r.esp, ip: r.ip, domain: r.domain ?? '', registrations: r.registrations ?? undefined, ftds: r.ftds ?? undefined })) ?? [])
```

to:

```ts
      const { data: allRows } = await supabase
        .from('ip_matrix')
        .select('id, esp, ip, domain, mp_code, upload_id, registrations, ftds')
        .order('created_at', { ascending: true })
      const { setIpmData } = useDashboardStore.getState()
      setIpmData(allRows?.map(r => ({ id: r.id, upload_id: r.upload_id, esp: r.esp, ip: r.ip, domain: r.domain ?? '', mpCode: r.mp_code ?? undefined, registrations: r.registrations ?? undefined, ftds: r.ftds ?? undefined })) ?? [])
```

- [ ] **Step 7: Include `mp_code` in the mount load select (`page.tsx`)**

In `src/app/page.tsx`, change:

```ts
        const { data: ipmRows } = await supabase
          .from('ip_matrix')
          .select('id, esp, ip, domain, upload_id, registrations, ftds')
          .order('created_at', { ascending: true })
        if (ipmRows?.length) {
          setIpmData(ipmRows.map(r => ({ id: r.id, upload_id: r.upload_id, esp: r.esp, ip: r.ip, domain: r.domain ?? '', registrations: r.registrations ?? undefined, ftds: r.ftds ?? undefined })))
        }
```

to:

```ts
        const { data: ipmRows } = await supabase
          .from('ip_matrix')
          .select('id, esp, ip, domain, mp_code, upload_id, registrations, ftds')
          .order('created_at', { ascending: true })
        if (ipmRows?.length) {
          setIpmData(ipmRows.map(r => ({ id: r.id, upload_id: r.upload_id, esp: r.esp, ip: r.ip, domain: r.domain ?? '', mpCode: r.mp_code ?? undefined, registrations: r.registrations ?? undefined, ftds: r.ftds ?? undefined })))
        }
```

- [ ] **Step 8: Typecheck / lint / build**

Run: `npm run lint && npm run build`
Expected: no type errors; `modal.rec.mpCode` resolves via the extended `IpmRecord`, and all `select`/`insert` payloads compile.

- [ ] **Step 9: Manual round-trip check**

Run: `npm run dev`, open IP Matrix. Add/edit a row with an MP Code (e.g. `MP-86`), reload the page, confirm the value persists and shows in the modal. (Requires Step 1's column.)

- [ ] **Step 10: Commit**

```bash
git add src/lib/types.ts src/components/views/IPMatrixView.tsx src/app/page.tsx
git commit -m "feat(ip-matrix): store and edit MP-## code per IP row"
```

---

### Task 3: Thread the MP-code map from upload into the parser

Builds `mpCodeMap` from the selected ESP's IP Matrix rows and passes it into both `parseFile` calls, closing the loop end-to-end.

**Files:**
- Modify: `src/components/views/UploadView.tsx` (build `mpCodeMap`, pass to both `parseFile` calls, add a log line)

**Interfaces:**
- Consumes: `ipmData` (with `mpCode` from Task 2), `parseFile(..., mpCodeMap)` (from Task 1).

- [ ] **Step 1: Build `mpCodeMap` next to `knownDomains`**

In `src/components/views/UploadView.tsx`, immediately after the `knownDomains` block (the `addLog("… registered domain(s) …")` line ~100), insert:

```ts
      // Build MP-## code → sending domain map for this ESP (MAP convention).
      // Only rows with BOTH a code and a domain participate; a blank domain
      // would otherwise resolve a code to "" (see matchMpCode).
      const mpCodeMap: Record<string, string> = {}
      ipmData
        .filter(r => r.esp?.toLowerCase() === esp.toLowerCase())
        .forEach(r => {
          const code = r.mpCode?.trim()
          const dom = r.domain?.trim()
          if (code && dom) mpCodeMap[code] = dom
        })
      const mpCodeCount = Object.keys(mpCodeMap).length
      if (mpCodeCount) addLog(`🔎 Using ${mpCodeCount} MP-code mapping(s) from IP Matrix for matching`)
```

- [ ] **Step 2: Pass `mpCodeMap` to both `parseFile` calls**

Change:

```ts
      const parsed = await parseFile(file, esp, knownDomains, mapOrderOverride)
```

to:

```ts
      const parsed = await parseFile(file, esp, knownDomains, mapOrderOverride, mpCodeMap)
```

And change the `dmy` retry:

```ts
        const dmy = await parseFile(file, esp, knownDomains, 'dmy')
```

to:

```ts
        const dmy = await parseFile(file, esp, knownDomains, 'dmy', mpCodeMap)
```

- [ ] **Step 3: Typecheck / build**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 4: Manual end-to-end verification**

Prereqs: an IP Matrix row for ESP "Map" with a domain and an MP Code (e.g. `MP-86` → `brand86.com`), plus the DB column from Task 2 Step 1.

Run: `npm run dev`. Upload a MAP file whose campaign names contain `MP-86`. In the upload log, confirm the "Using N MP-code mapping(s)…" line appears. Open the ESP Deliverability Matrix, expand the Map row, and confirm per-IP rows now appear (sends attributed to the mapped domain / its IP instead of collapsing to "unknown").

- [ ] **Step 5: Commit**

```bash
git add src/components/views/UploadView.tsx
git commit -m "feat(upload): pass IP Matrix MP-code map into MAP parsing"
```

---

## Self-Review

**Spec coverage:**
- Data model (`mpCode` + `mp_code` column) → Task 2 Steps 1–2. ✓
- Resolver order (subdomain → MP-code → regex → unknown) → Task 1 Step 4. ✓
- Boundary match / case-insensitive / blank-domain fallthrough → Task 1 Steps 3, 6 + tests. ✓
- `parseFile` last-param plumbing + both call sites → Task 1 Step 5. ✓
- `UploadView` builds map + logs + passes to both calls → Task 3. ✓
- IP Matrix UI (modal, save, CSV import) + round-trip selects (delete-reload, mount) → Task 2 Steps 3–7. ✓
- Tests (resolve, boundary, precedence, blank-domain, no-map-unchanged) → Task 1 Steps 1, 6, 8. ✓
- Deferred (warn-on-conflict, backfill, alt spellings) → not implemented, by design. ✓

**Placeholder scan:** none — every code step shows full code; commands have expected output.

**Type consistency:** `matchMpCode(campaignName, mpCodeMap)` and `parseFile(..., mpCodeMap)` signatures match across Tasks 1 and 3. `IpmRecord.mpCode` (camelCase in app) vs `mp_code` (snake_case in DB) is bridged explicitly at every Supabase boundary (insert/update/select map). CSV import destructures `mpCode` out and writes `mp_code`. Consistent.
