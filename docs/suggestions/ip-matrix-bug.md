# IP Matrix — Data Not Persisting Across Browsers/Machines

## Status
**Bug — confirmed.** Data is stored in `localStorage` only; there is no Supabase backing store for IP Matrix records.

---

## Root Cause

### 1. Zustand persist is `localStorage`-only for `ipmData`
In `src/lib/store.ts` lines 148–155:

```ts
{
  name: 'esp-dashboard-storage',
  partialize: (s) => ({
    isLight: s.isLight,
    ipmData: s.ipmData,   // <-- written to localStorage only
    dmData: s.dmData,      // <-- same problem
  }),
}
```

`localStorage` is tied to the specific browser + origin. A different machine, browser, or incognito session starts with an empty store.

### 2. On-mount Supabase load does not read IP Matrix
In `src/app/page.tsx` lines 32–78, the `loadFromDB()` function queries only the `uploads` table:

```ts
const { data: rows, error } = await supabase
  .from('uploads')
  .select('esp, solo_data')
```

There is no query for IP Matrix data. Even if a Supabase table existed, nothing populates the store from it.

### 3. No Supabase table exists
There is no `ip_matrix` table in the schema. All CRUD operations in `IPMatrixView.tsx` — `addIpmRecord`, `updateIpmRecord`, `deleteIpmRecord` — mutate Zustand state only (`src/lib/store.ts:130-135`).

### 4. All 3 write operations are local-only
- **Add** (`store.ts:131`): `set(s => ({ ipmData: [...s.ipmData, rec] }))`
- **Delete** (`store.ts:132`): `set(s => ({ ipmData: s.ipmData.filter((_, i) => i !== idx) }))`
- **Update** (`store.ts:133-134`): `set(s => ({ ipmData: s.ipmData.map((r, i) => i === idx ? rec : r) }))`
- **CSV import** (`IPMatrixView.tsx:152-159`): calls `addIpmRecord()` per row — same local-only path

---

## Same Problem: `dmData` (Data Management)
The `DataMgmtView` partner roster has the identical issue — it is also persisted only to `localStorage` via the same `partialize` block. `DataMgmtView.tsx:52` calls `setDmData(rows)` which only updates Zustand.

---

## Fix Plan

### Step 1 — Create Supabase tables
```sql
-- IP Matrix
create table ip_matrix (
  id          uuid primary key default gen_random_uuid(),
  esp         text not null,
  ip          text not null,
  domain      text default '',
  created_at  timestamptz default now()
);

-- Data Management (partner roster)
create table data_management (
  id          uuid primary key default gen_random_uuid(),
  country     text,
  domain      text,
  partner     text,
  raw_data    jsonb,           -- full DmRecord for dynamic columns
  created_at  timestamptz default now()
);
```

### Step 2 — Update `IpmRecord` type
In `src/lib/types.ts`:

```ts
export interface IpmRecord {
  id?: string    // Supabase uuid, optional for new records pre-insert
  esp: string
  ip: string
  domain: string
}
```

### Step 3 — Load on mount (`page.tsx`)
Add to `loadFromDB()` after the existing uploads query:

```ts
// Load IP Matrix
const { data: ipmRows } = await supabase
  .from('ip_matrix')
  .select('id, esp, ip, domain')
  .order('created_at', { ascending: true })

if (ipmRows?.length) {
  setIpmData(ipmRows.map(r => ({ id: r.id, esp: r.esp, ip: r.ip, domain: r.domain ?? '' })))
}

// Load Data Management
const { data: dmRows } = await supabase
  .from('data_management')
  .select('raw_data')
  .order('created_at', { ascending: true })

if (dmRows?.length) {
  setDmData(dmRows.map(r => r.raw_data))
}
```

### Step 4 — Sync writes in `IPMatrixView.tsx`
- **Add record**: after `addIpmRecord(saved)`, also `await supabase.from('ip_matrix').insert(saved)`
- **Delete record**: delete by `id` (not index) — `await supabase.from('ip_matrix').delete().eq('id', record.id)`
- **Update record**: `await supabase.from('ip_matrix').update(saved).eq('id', record.id)`
- **CSV import**: batch insert all parsed rows in one call

### Step 5 — Sync writes in `DataMgmtView.tsx`
- **Import CSV**: `await supabase.from('data_management').delete()` then batch insert new rows
- **Reset**: also delete from Supabase table

### Step 6 — Remove from localStorage persist
Once Supabase is the source of truth, remove `ipmData` and `dmData` from the `partialize` block to avoid stale cache conflicts:

```ts
partialize: (s) => ({
  isLight: s.isLight,
  // ipmData removed — loaded from Supabase
  // dmData removed — loaded from Supabase
})
```

---

## Additional bug found: `mergeMmData` vs `overwriteMmData` on mount

**File:** `src/app/page.tsx:5,53`

The CLAUDE.md explicitly states:
> **Critical:** Use `overwriteMmData` (not `mergeMmData`) when rebuilding from multiple uploads.

But `page.tsx` line 5 imports `mergeMmData` and line 53 uses it:

```ts
// Line 5:
import { buildProviderDomains, syncEspFromData, mergeMmData } from '@/lib/utils'

// Line 53:
merged = mergeMmData(merged, data)  // <-- should be overwriteMmData
```

Note: `UploadView.tsx` (line 105) correctly uses `overwriteMmData` for the same rebuild logic. Only `page.tsx` has the bug.

This will **double-count metrics** when the same date range appears in multiple uploads for the same ESP. This should be changed to `overwriteMmData`.
