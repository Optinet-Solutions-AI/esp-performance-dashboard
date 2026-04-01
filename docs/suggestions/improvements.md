# Project Improvement Suggestions

**Date:** 2026-04-01  
**Scope:** Full codebase scan — architecture, data persistence, UX, correctness, security, and code quality

---

## Tech Stack (Current)

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.1 |
| UI | React + TypeScript | 19.2.4 / TS 5 |
| Styling | Tailwind CSS | 4 |
| Charts | Chart.js + react-chartjs-2 | 4.5.1 / 5.3.1 |
| State | Zustand (persist to localStorage) | 5.0.12 |
| Database | **Supabase (PostgreSQL + JSONB)** | @supabase/supabase-js 2.100.1 |
| File parsing | xlsx (SheetJS) | 0.18.5 |
| Theming | next-themes | 0.4.6 |

**Database:** Supabase — PostgreSQL hosted by Supabase, accessed via the JS client (`@supabase/supabase-js`). One table currently in use: `uploads` (stores parsed CSV/XLSX data as JSONB blobs per upload).

> See `docs/suggestions/tech-stack.md` for full dependency analysis.

---

## Critical Bugs

### 1. IP Matrix data not synced to Supabase
**Severity: HIGH** — **File:** `src/lib/store.ts:150-153`, `src/components/views/IPMatrixView.tsx`  
`ipmData` is only persisted to `localStorage`. On a different browser or machine, the IP Matrix is always empty.  
See `docs/suggestions/ip-matrix-bug.md` for the full analysis and fix plan.

### 2. Data Management (`dmData`) not synced to Supabase
**Severity: HIGH** — **File:** `src/lib/store.ts:150-153`, `src/components/views/DataMgmtView.tsx`  
Same issue as IP Matrix. The partner roster in `DataMgmtView` is saved to `localStorage` only. It should be stored in a Supabase table (e.g. `data_management`) so it survives across devices.

### 3. `mergeMmData` used instead of `overwriteMmData` on mount
**Severity: HIGH** — **File:** `src/app/page.tsx:5,53`  
In `page.tsx` line 5, the import pulls `mergeMmData` from utils. On line 53, the on-mount rebuild loop uses `mergeMmData` when stacking uploads. CLAUDE.md explicitly says to use `overwriteMmData` for this case to prevent double-counting metrics when the same date appears in multiple uploads.

```ts
// Current (line 5):
import { buildProviderDomains, syncEspFromData, mergeMmData } from '@/lib/utils'
// Current (line 53):
merged = mergeMmData(merged, data)

// Should be:
import { buildProviderDomains, syncEspFromData, overwriteMmData } from '@/lib/utils'
merged = overwriteMmData(merged, data)
```

### 4. Upload delete uses `window.location.reload()` — wipes in-memory state
**Severity: MEDIUM** — **File:** `src/components/views/UploadView.tsx:147`  
When a user deletes an upload, the code does a full page reload instead of rebuilding the ESP data from remaining uploads. This wipes all non-persisted Zustand state. Should instead re-fetch uploads and rebuild the merged data like `loadFromDB()` does.

```ts
// Current:
await supabase.from('uploads').delete().eq('id', record.id)
window.location.reload()

// Should: re-query remaining uploads for the ESP, rebuild merged data, update store
```

### 5. `resetAllData()` only clears Zustand, not Supabase
**Severity: MEDIUM** — **File:** `src/lib/store.ts:142-146`, `src/components/views/DataMgmtView.tsx:110`  
The "Reset All Data" button in DataMgmtView calls `resetAllData()` which clears only in-memory Zustand state. The `uploads` table in Supabase still has all rows. On next page load, `loadFromDB()` will restore everything. Users think data was deleted but it wasn't.

---

## Data & Architecture

### 6. No row-level IDs on `IpmRecord`
**Severity: MEDIUM** — **File:** `src/lib/types.ts:69-73`  
`IpmRecord` has no `id` field. Deleting and updating records in `IPMatrixView` is done by array index (`deleteIpmRecord(idx)`), which is fragile — the index can shift after filtering. Adding a Supabase `uuid` as `id` would make CRUD operations safe.

### 7. DailyView date sorting ignores year
**Severity: MEDIUM** — **File:** `src/components/views/DailyView.tsx:50-54`  
The "last 7 days" logic sorts dates by month+day only (no year). If data spans a year boundary (e.g. Dec 2025 + Jan 2026), the sort order will be wrong and the "last 7" selection will be incorrect.

```ts
// Current (no year awareness):
const sortedDates = [...allDatesSet].sort((a, b) => {
  const [am, ad] = a.split(' ')
  const [bm, bd] = b.split(' ')
  return (MONTHS.indexOf(am) * 31 + parseInt(ad)) - (MONTHS.indexOf(bm) * 31 + parseInt(bd))
})
```

### 8. Upload history is in-memory only
**Severity: LOW** — **File:** `src/lib/store.ts:126`  
`uploadHistory` in Zustand is not persisted and is lost on refresh. The HomeView "Recent Activity" section will be empty after refresh (though UploadView loads its own from Supabase). Consider always deriving from Supabase.

### 9. Large JSONB blobs in `uploads.solo_data`
**Severity: LOW (future concern)**  
Each upload stores the entire parsed `MmData` object as a JSONB blob. At scale (many uploads, many dates, many providers), this will slow queries and inflate storage. A normalized schema (rows per date×provider) would be more efficient but is a larger refactor.

---

## UX / Functionality

### 10. No feedback/toast notifications
**Severity: MEDIUM**  
All operations (add record, upload file, delete, save) complete silently. There is no success confirmation, error message, or loading indicator for async Supabase operations. Users have no way to know if a save failed.  
Suggestion: Add a lightweight toast system (e.g. `react-hot-toast` or a custom component).

### 11. No IP address format validation
**Severity: LOW** — **File:** `src/components/views/IPMatrixView.tsx:118-126`  
The Add/Edit modal accepts any string as an IP address. Basic validation (IPv4 regex or CIDR notation check) would prevent bad data entry.

### 12. No bulk delete in IP Matrix
**Severity: LOW**  
Records can only be deleted one at a time. A checkbox-select + bulk delete action would be useful when managing large IP lists.

### 13. CSV import has no preview step
**Severity: LOW** — **File:** `src/components/views/IPMatrixView.tsx:129-160`  
When uploading a CSV/XLSX to IP Matrix, all rows are imported immediately with no preview, no duplicate detection, and no validation. A preview modal showing parsed rows before committing would prevent accidental bulk imports of malformed data.

### 14. No duplicate IP detection
**Severity: MEDIUM**  
Uploading the same CSV twice or adding the same IP manually creates duplicate records. There is no de-duplication check on `ip + esp` combination.

### 15. IP Matrix table has no pagination
**Severity: LOW**  
The "All Records" table renders every row at once. With hundreds of entries this will slow render. Virtual scrolling or pagination (25–50 rows per page) should be added.

### 16. No export for IP Matrix
**Severity: LOW**  
There is a CSV export for the ESP performance dashboard (`exportCSV` in `utils.ts`) but nothing for IP Matrix data. Adding an export button would let users download their IP registry.

### 17. DataMgmtView CSV parsing is naive
**Severity: LOW** — **File:** `src/components/views/DataMgmtView.tsx:41-53`  
Uses simple `line.split(',')` instead of `splitCsvRows()` from `parsers.ts`. Quoted fields with commas will break. Should reuse the robust CSV parser.

---

## Code Quality

### 18. React key warnings in IPMatrixView expanded rows
**Severity: LOW** — **File:** `src/components/views/IPMatrixView.tsx:242-299`  
The ESP Summary expanded section uses `<>` (Fragment) wrappers without keys on the outer fragment. The keys are placed on inner `<tr>` elements but React needs them on the iterable root. This causes reconciliation warnings and potential rendering bugs.

### 19. Chart.js cleanup not consistent across views
**Severity: LOW**  
`HomeView` uses manual `useRef` + `destroy()` in `useEffect` cleanup. `PerformanceView`, `DailyView`, and `DataMgmtView` use `react-chartjs-2` components (which auto-manage lifecycle). `MailmodoView` uses raw `Chart` constructors. The approach should be consistent to prevent "Canvas already in use" errors.

### 20. Chart.js registered twice differently
**Severity: LOW**  
`HomeView` and `MailmodoView` use `Chart` from `chart.js/auto` (auto-registers everything). `PerformanceView`, `DailyView`, and `DataMgmtView` manually register specific components. Mixing both approaches bloats the bundle and can cause subtle issues. Pick one.

### 21. `useEffect` dependency using `JSON.stringify`
**Severity: LOW** — **File:** `src/components/views/HomeView.tsx:77,101`  
`useEffect` dependencies use `JSON.stringify(monthTotals)` and `JSON.stringify(espSentMap)`. This creates a new string on every render and defeats React's shallow comparison. Use `useMemo` for the derived data instead.

### 22. Hardcoded year `2025` in `inferYearsFromSequence`
**Severity: LOW** — **File:** `src/lib/utils.ts:166`  
The year inference starts from hardcoded `2025`. As the app is used in 2026+, this will produce incorrect year assignments for new data. Should use `new Date().getFullYear() - 1` or derive from the data context.

---

## Missing Features (High Value)

### 23. Ongage-specific review view
**Severity: MEDIUM**  
The sidebar nav entry for "Ongage Review" renders `<MailmodoView filter="ongage" />` — it reuses the Mailmodo view. Ongage may have different data structure nuances. A dedicated `OngageView` or proper parameterization would give it proper treatment.

### 24. Date range picker not wired to all views
**Severity: MEDIUM**  
`CalendarPicker` exists as a UI component and is used in `MatrixView` and `MailmodoView`, but `PerformanceView` and `DailyView` don't use it. A global date range filter (or per-view) would give users more control.

### 25. No authentication / access control
**Severity: MEDIUM (for shared deployment)**  
The app has no login gate. Anyone with the URL can view and modify all data. For a shared deployment, Supabase RLS + Supabase Auth would be the natural solution.

### 26. No real-time sync between users
**Severity: LOW**  
If two users have the dashboard open simultaneously, changes by one are not reflected until page refresh. Supabase Realtime subscriptions could fix this.

### 27. No error boundaries
**Severity: MEDIUM**  
If any component throws (e.g. Chart.js canvas issue, bad data shape), the entire app crashes. React Error Boundaries around views would gracefully degrade individual sections.

### 28. No loading/skeleton states for views
**Severity: LOW**  
The initial DB load in `page.tsx` has a spinner, but individual views have no skeleton/loading state when data is computing or fetching.

---

## Security Concerns

See `docs/suggestions/security-concerns.md` for full analysis.

Key items:
- PIN `1234` is hardcoded in source code (DataMgmtView)
- No Supabase RLS — all data is publicly readable/writable
- No input sanitization on CSV imports
- Supabase keys in client-side env vars (acceptable for anon key but needs RLS)

---

## Summary Priority Order

| Priority | Item | File |
|----------|------|------|
| **Fix now** | #1 IP Matrix → Supabase | store.ts, IPMatrixView.tsx |
| **Fix now** | #2 dmData → Supabase | store.ts, DataMgmtView.tsx |
| **Fix now** | #3 `overwriteMmData` on mount | page.tsx:5,53 |
| **Fix now** | #4 Upload delete → rebuild not reload | UploadView.tsx:147 |
| **Fix now** | #5 resetAllData should clear Supabase too | store.ts, DataMgmtView.tsx |
| Soon | #7 DailyView year-aware sorting | DailyView.tsx:50 |
| Soon | #10 Toast notifications | — |
| Soon | #14 Duplicate IP detection | IPMatrixView.tsx |
| Soon | #6 IpmRecord IDs | types.ts |
| Soon | #27 Error boundaries | — |
| Later | #11 IP validation | IPMatrixView.tsx |
| Later | #12 Bulk delete | IPMatrixView.tsx |
| Later | #15 Pagination | IPMatrixView.tsx |
| Later | #17 DataMgmt CSV parser | DataMgmtView.tsx |
| Later | #22 Hardcoded year | utils.ts:166 |
| Later | #23 Ongage dedicated view | — |
| Later | #24 Date range picker wiring | — |
| Optional | #25 Authentication | — |
| Optional | #26 Real-time sync | — |
