# Data Architecture Analysis & Suggestions

**Date:** 2026-04-01  
**Scope:** Data flow, storage patterns, state management, and scalability

---

## Current Architecture

### Data Storage Split
The app uses a **hybrid storage model** that creates consistency issues:

| Data | Storage | Persisted? | Cross-device? |
|------|---------|-----------|---------------|
| ESP upload data (MmData) | Supabase `uploads` table (JSONB) | Yes | Yes |
| IP Matrix records | Zustand → localStorage | Yes (local only) | **No** |
| Partner roster (dmData) | Zustand → localStorage | Yes (local only) | **No** |
| Theme preference | Zustand → localStorage | Yes (local only) | No (acceptable) |
| Upload history | Zustand (volatile) | No | No |
| Navigation / UI state | Zustand (volatile) | No | No (acceptable) |

### Zustand Store Structure (`src/lib/store.ts`)
The store has **15+ slices** in a single flat store. Current `partialize` config persists only 3 fields to localStorage:
```ts
partialize: (s) => ({
  isLight: s.isLight,    // theme — OK to be local
  ipmData: s.ipmData,    // IP Matrix — should be in Supabase
  dmData: s.dmData,      // Partner roster — should be in Supabase
})
```

---

## Data Flow Issues

### 1. Inconsistent merge strategy between mount and upload

| Context | Function Used | Correct? |
|---------|--------------|----------|
| On mount (`page.tsx:53`) | `mergeMmData()` | **No** — double-counts |
| On upload (`UploadView.tsx:105`) | `overwriteMmData()` | Yes |

This means: uploading data produces correct metrics, but refreshing the page can inflate numbers by double-counting overlapping date ranges.

### 2. Upload delete doesn't rebuild data

**File:** `src/components/views/UploadView.tsx:141-149`

When deleting an upload:
```ts
await supabase.from('uploads').delete().eq('id', record.id)
window.location.reload()  // <-- full reload, relies on loadFromDB() which has the mergeMmData bug
```

Problems:
1. Uses `window.location.reload()` instead of rebuilding in-place
2. The reload triggers `loadFromDB()` which uses the buggy `mergeMmData()`
3. Volatile state (upload history, active view, filters) is lost

### 3. IP Matrix delete by array index is fragile

**File:** `src/lib/store.ts:132`

```ts
deleteIpmRecord: (idx) => set(s => ({ ipmData: s.ipmData.filter((_, i) => i !== idx) }))
```

In `IPMatrixView.tsx:399`, the original index is found via:
```ts
const origIdx = ipmData.indexOf(row)
```

If two records are identical objects (same esp, ip, domain), `indexOf` returns the first match, potentially deleting the wrong record. Adding unique IDs fixes this.

---

## MmData Structure Analysis

The core `MmData` type is used everywhere:

```
MmData
├── dates: string[]                          // ["Mar 10", "Mar 11", ...]
├── datesFull: { label, year, iso }[]        // Full date info
├── providers: Record<string, ProviderData>  // gmail.com, yahoo.com, etc.
│   └── ProviderData
│       ├── overall: DateMetrics             // Aggregate
│       └── byDate: Record<string, DateMetrics>  // Per-date
├── domains: Record<string, ProviderData>    // Sending from-domains
├── overallByDate: Record<string, DateMetrics>   // Daily aggregate
└── providerDomains: Record<string, Record<string, ProviderDomainCell>>  // Cross-tab
```

**Size concern:** A single upload with 30 dates, 50 providers, and 10 domains produces a `solo_data` JSONB blob of ~200-500KB. With 100+ uploads, the `uploads` table could reach 50MB+ of JSONB data that must be fetched and merged on every page load.

---

## Scalability Concerns

### Near-term (current usage)
- **OK for now.** With <50 uploads and <100 dates, the JSONB approach works fine.
- Query all uploads + client-side merge takes <1 second.

### Medium-term (100+ uploads, 1000+ dates)
- `loadFromDB()` fetches ALL `solo_data` blobs on mount — no pagination, no lazy loading
- Client-side merge (`overwriteMmData` in a loop) becomes CPU-bound
- `localStorage` limit (5-10MB) could be hit by `ipmData` if thousands of IP records exist

### Long-term (production scale)
Consider:
1. **Pre-computed merged data**: Store the merged `MmData` per ESP as a materialized view or separate table, rebuilt on each upload. Mount load becomes a single read per ESP.
2. **Normalized schema**: Replace JSONB blobs with relational tables (`upload_metrics` with columns for date, provider, domain, sent, delivered, etc.). Aggregation can be done in SQL.
3. **Server-side API routes**: Move merge logic to Next.js API routes or Supabase Edge Functions to reduce client computation.

---

## Recommended Architecture Changes

### Phase 1 — Fix critical issues (immediate)
1. Create `ip_matrix` and `data_management` tables in Supabase
2. Sync IP Matrix and DataMgmt writes to Supabase
3. Load IP Matrix and DataMgmt from Supabase on mount
4. Remove `ipmData` and `dmData` from `localStorage` persist
5. Fix `mergeMmData` → `overwriteMmData` in `page.tsx`

### Phase 2 — Improve reliability (soon)
1. Replace `window.location.reload()` with in-place data rebuild after upload delete
2. Add unique IDs (`uuid`) to `IpmRecord` for safe CRUD
3. Make `resetAllData()` also clear Supabase tables
4. Derive upload history from Supabase instead of volatile Zustand

### Phase 3 — Scale (when needed)
1. Add a `merged_data` table or column to store pre-computed per-ESP MmData
2. Paginate upload history queries (don't load all at once)
3. Add database indexes on `uploads.esp` and `uploads.uploaded_at`
4. Consider moving merge computation server-side

---

## State Management Observations

The Zustand store is well-structured for the current app size. A few notes:

- **Single store is fine** — no need to split into multiple stores yet
- **Selector usage:** Components pull what they need via destructuring (e.g., `const { isLight, ipmData } = useDashboardStore()`). This is correct for Zustand.
- **No middleware besides persist**: Consider adding `devtools` middleware in development for debugging state changes
- **`espRanges` is a good pattern**: Storing per-ESP date range indices in the store allows the slider/picker state to persist while navigating between views
