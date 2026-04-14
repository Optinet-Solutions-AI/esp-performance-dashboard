# ESP Performance Dashboard — Codebase Manifesto

**Ethos: Data integrity over features. Accuracy over velocity.**

This manifesto governs how we build and maintain the ESP Performance Dashboard — a multi-ESP email analytics platform where email operations teams make deliverability decisions based on what this dashboard shows them. Wrong data = wrong decisions = IP reputation damage. The rules here exist to prevent that.

---

## 1. The Ethos

### 📊 Accuracy Is the Product
This dashboard is not the thing that sends email. It is the thing that tells people how their email is performing. If the numbers are wrong, the product is broken — regardless of how the UI looks.

- A miscalculated bounce rate could cause a team to ignore a real deliverability problem.
- A double-counted metric from a bad merge could make a bad ESP look healthy.
- A missing date in the graph could cause a campaign decision to be made on incomplete data.

Every data operation must be correct. Test with real CSV files from each ESP, not synthetic data.

### 🥱 Beautifully Boring
We build on battle-tested primitives.
- *Yes:* Next.js App Router, TypeScript, Tailwind, Zustand, Supabase, Chart.js, xlsx.
- *No:* New state management libraries, custom parsers when xlsx handles it, clever abstractions that save 10 lines but require a PhD to debug.
- *Goal:* Any developer opening this codebase should understand what a view does in under 2 minutes.

### 🔄 Append-Only Uploads, Last-Write-Wins Dates
Upload history is a ledger — you add entries, never delete them. When rebuilding the merged dataset, the latest upload for a given date wins. This is the single most important architectural rule in this codebase. Violate it and metrics double-count.

### 🧠 Zustand Is the Only Truth
One store. One source. Views read from it. Supabase feeds it on mount. Nothing writes to Supabase except the upload flow. Nothing renders metrics except what came through the store. Direct Supabase reads in render paths are a bug.

---

## 2. Core Principles

### 🔐 Data Integrity First
- **`overwriteMmData` is the rebuild function.** When stacking multiple uploads together (on mount, after an upload, after a date filter change), always use `overwriteMmData(base, override)`. It replaces a date's data with the latest upload's version — last-write-wins.
- **`mergeMmData` is for genuinely separate date ranges only.** It accumulates metrics. If the same date appears in two uploads and you use `mergeMmData`, sent counts double. This is a silent bug — the chart renders fine, the numbers are just wrong. *Never use `mergeMmData` when rebuilding from upload history.*
- **`overall` must stay in sync.** After any modification to `byDate` on a `ProviderData`, recalculate `overall` by aggregating all `byDate` values. A stale `overall` will produce wrong KPI cards while charts are correct — confusing, hard to trace.

### 📅 Date Keys Are Short Labels, Always
Date map keys are `"Mar 10"`, `"Apr 3"` — not `"2026-03-10"`, not ISO, not Unix timestamps. Year lives in `datesFull[].year` and `datesFull[].iso`. This convention must be consistent across parsing, storage, rendering, and filtering. One ISO key in a `byDate` map breaks every lookup for that date.

### 📤 Upload Flow Is Append-Only
When a user uploads a new file:
1. Parse → `solo_data` (MmData for this file only — never the merged view)
2. `INSERT` to `uploads` table — never UPDATE, never DELETE a previous row
3. Re-query all uploads for the ESP ordered `uploaded_at ASC`
4. Rebuild merged MmData using `overwriteMmData()` walking oldest → newest
5. `syncEspFromData()` to recompute KPIs
6. Update Zustand store

Steps 3–5 must run every time a new upload is added. Never skip the rebuild and just tack the new data onto the existing store value — that accumulates instead of rebuilds.

### 🧱 Views Are Self-Contained
- Views read from store via `useDashboardStore()` — no props drilling data down the tree.
- Views do not call Supabase directly. Supabase reads happen in `page.tsx` on mount only.
- Chart.js instances must be destroyed on re-render — use `key` prop or `useEffect` cleanup. A Chart.js instance that isn't destroyed on remount will throw canvas-in-use errors.

### 🩺 Status Thresholds Are Fixed
`getEspStatus(bounceRate, deliveryRate)` in `src/lib/utils.ts` is the canonical status function. Every status pill, every health indicator, every "critical" badge uses this. Do not inline threshold logic in components — one place, one truth.

| Status | Condition |
|--------|-----------|
| `healthy` | delivery > 95% AND bounce < 2% |
| `warn` | delivery 70–95% OR bounce 2–10% |
| `critical` | delivery < 70% OR bounce > 10% |

---

## 3. Architecture Layers

```
src/
├── app/
│   ├── page.tsx        ← App shell: sidebar, view routing, Supabase load-on-mount
│   ├── layout.tsx      ← Root HTML + metadata
│   └── globals.css     ← Global styles
├── components/
│   ├── layout/         ← Sidebar (nav, ESP list, theme toggle, status pills)
│   ├── ui/             ← KpiCard, ChartCard, CalendarPicker, StatusPill
│   └── views/          ← One file per screen. Self-contained. Reads from store.
└── lib/
    ├── types.ts        ← All TypeScript interfaces. Single source of type truth.
    ├── store.ts        ← Zustand store. 15+ slices. Single source of UI+data truth.
    ├── supabase.ts     ← Supabase client init only. No query logic here.
    ├── parsers.ts      ← CSV/XLSX parsing + metric aggregation per ESP format
    ├── data.ts         ← Seed data, ESP/provider color maps
    └── utils.ts        ← Formatting, aggregation, data merging, CSV export
```

### Layer rules
- **`types.ts`** — Interfaces only. No logic. If a type is used in more than one file, it lives here.
- **`store.ts`** — State + setters. No async logic. No Supabase calls. Thin.
- **`parsers.ts`** — All file parsing. New ESP format = new detection block here. No parsing logic in views.
- **`utils.ts`** — All data math. `mergeMmData`, `overwriteMmData`, `aggDates`, `syncEspFromData`, `getEspStatus`. No rendering logic here.
- **Views** — Display only. Call store. Call utils for formatting. Never call parsers or run merge logic directly.

### Path alias
`@/*` maps to `./src/*`. Always use `@/lib/...`, `@/components/...`. Relative imports (`../../lib/utils`) are a lint error waiting to happen.

---

## 4. Decision Philosophy

When making a technical decision, ask in order:

1. **Does it preserve data accuracy?** If the change touches parsing, merging, or aggregation, test it with a real upload file from each affected ESP before shipping.
2. **Is it boring?** If you're reaching for a new library, ask whether `utils.ts` + a small helper function solves the same problem.
3. **What breaks if Supabase is slow?** The dashboard must still render from Zustand state if the Supabase query takes 10 seconds. Loading skeletons, not blank screens.
4. **Will it double-count?** Any data operation that touches multiple uploads must use `overwriteMmData`, not `mergeMmData`. When in doubt, re-read both functions' docstrings before touching the merge path.
5. **Can someone read this view in 2 minutes?** Views should be scannable. If a view file exceeds ~400 lines, it's doing too much — split by tab or section into sub-components.
6. **Does a new ESP need a custom parser?** Check `parsers.ts` first. If the generic parser handles its columns, a new parser block isn't needed — just add it to `ESP_LIST` and `ESP_COLORS`.

---

## 5. Mandatory Analysis Steps

Before modifying any data path (parser, merge function, Supabase query, store slice):

1. **Trace the data flow.** Where does this data enter (upload/parse)? Where is it stored (Supabase `solo_data`, Zustand `espData`)? Where is it rendered (which view, which chart)?
2. **Identify the merge path.** Does the change affect how multiple uploads are combined? If yes — `overwriteMmData` or `mergeMmData`? Re-read both. Write a comment explaining the choice.
3. **Check `overall` sync.** If you touch any `byDate` record, where is `overall` recalculated? Is it explicit in this code path, or does it depend on a rebuild that might not run?
4. **Verify date key format.** Any new date-keyed map must use short label format (`"Mar 10"`). Trace where the date string comes from and confirm the format before shipping.
5. **Test with a real file.** Upload an actual CSV from the affected ESP after the change. Verify the KPI cards match what you calculate by hand from the raw file for a single date.

---

## 6. Hard Rules

Non-negotiable. These exist because they were learned the hard way.

### Data merging
- **`overwriteMmData` when rebuilding from upload history.** Without exception. This includes: on app mount, after a new upload, after clearing and re-adding an ESP's data.
- **`mergeMmData` only for disjoint date ranges.** If you cannot guarantee the two datasets have zero date overlap, do not use `mergeMmData`.
- **Never mutate store data in place.** Always create a new `MmData` object. Zustand's shallow comparison won't detect in-place mutations.

### Upload flow
- **`uploads` table is append-only.** Never DELETE a row from `uploads`. The full history is the source of truth for rebuilding. Delete it and the rebuild is corrupted.
- **`solo_data` stores only the parsed data for that single file** — not the merged cumulative view. When an upload is re-processed, it is re-parsed in isolation, then merged with others in order.
- **INSERT before parsing side effects.** The row must be in Supabase before you update Zustand. If the client crashes after insert but before store update, the next mount will re-rebuild correctly. If you update Zustand first and the insert fails, state is wrong until page reload.

### Charts
- **Destroy Chart.js instances on re-render.** Pass a `key` prop that changes when data changes, or use `useEffect` cleanup to call `chart.destroy()`. Not doing this causes "Canvas is already in use" runtime errors that are silent in prod.
- **Use `aggDates(byDate, dates[])` for all date-range aggregations.** Do not re-implement the aggregation logic inline in a chart component.

### Theming
- **Read `isLight` from store, not from DOM.** `document.body.classList.contains('light')` is not reliable in SSR or fast renders. The store value is always correct.
- **`isLight` is persisted to localStorage** via Zustand's `persist` middleware. It survives page reloads. Do not set a default theme in CSS that fights the persisted value.

### Adding a new ESP
1. Add name to `ESP_LIST` in `UploadView.tsx`
2. Add color to `ESP_COLORS` in `src/lib/data.ts`
3. If it needs a custom parser, add format detection + field mapping in `parsers.ts`
4. Add to sidebar nav in `Sidebar.tsx` if it needs its own review view
5. Add to the `ViewName` union type in `types.ts`
6. Add `case 'newview': return <NewView />` in `page.tsx`

### Adding a new view
1. Create `src/components/views/NewView.tsx`
2. Add the view name to `ViewName` union in `src/lib/types.ts`
3. Add nav entry in `Sidebar.tsx`
4. Add `case 'newview': return <NewView />` in `page.tsx`
5. Read from store only — no Supabase calls, no parsers called directly

### DataMgmt PIN
The partner roster export/reset is PIN-gated: `1234`. This is documented here so it isn't "discovered" as a bug and removed.

---

## 7. The "Read → Trace → Change" Discipline

Before modifying any file that touches data:

1. **READ** — Open the file. Read the function you're changing. Read its callers (`grep` for the function name — who calls this?). Read what it returns and how callers use the return value.
2. **TRACE** — Follow the data. If you change how a date is parsed in `parsers.ts`, trace what happens to that date key in `store.ts`, in `utils.ts`, in the view rendering it. If the key format changes anywhere in the chain, every lookup breaks.
3. **CHANGE** — Make the minimal change. Add a comment if the logic is non-obvious (especially for the `overwriteMmData` vs `mergeMmData` distinction). Verify with a real upload.

### Why this matters
- The hardest bugs in this codebase are silent wrong-number bugs, not crashes. A crash is obvious. A KPI card showing 94.2% delivery instead of 94.8% because of an off-by-one in the date range is invisible until someone double-checks against the ESP's own dashboard.
- Parsers handle real-world CSV files with edge cases: multiline quoted fields, Excel date serials, mixed date formats, blank rows. Do not simplify a parser without testing every known edge case.

---

## 8. Output Priority

When choices conflict, resolve in this order — top wins:

1. **Data accuracy** (correct numbers, correct merges, correct date keys)
2. **Data integrity** (append-only uploads, no double-counting, overall in sync)
3. **Reliability** (Zustand always readable, Supabase rebuild always possible from history)
4. **Observability** (`uploaded_at`, ESP name, filename, row count stored per upload — always traceable)
5. **Maintainability** (boring tech, self-contained views, utils functions over inline logic)
6. **Performance** (Chart.js cleanup, memoize expensive aggregations if measurably slow)
7. **Visual polish** (animations, micro-interactions, color refinements)
8. **New features** (only after all of the above are already satisfied for existing features)

If you are adding a feature that requires touching the merge path, the parser, or the upload flow — slow down. Those are the three highest-risk areas in this codebase. New views and new UI components are low risk. New data paths are high risk.
