# CLAUDE Context — ESP Performance Dashboard

## ⚠ Next.js Version Note
> This project uses **Next.js 16** which has breaking changes from older versions.
> APIs, conventions, and file structure may differ from training data.
> **Always read `esp-dashboard/node_modules/next/dist/docs/` before writing any code in `esp-dashboard/`.**
> Heed deprecation notices.

---

## Repository Layout
```
/
├── index.html                  # Original monolithic SPA (vanilla JS)
├── supabase.js                 # Optional Supabase persistence layer
├── SUPABASE_SETUP.md
├── VERIFICATION_CHECKLIST.md
└── esp-dashboard/              # Next.js + Tailwind rewrite
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx        # SPA shell — renders active view
    │   │   └── globals.css     # Tailwind 4 + design tokens
    │   ├── lib/
    │   │   ├── types.ts        # All TypeScript interfaces
    │   │   ├── data.ts         # Seed data (esps, mmData, ogData)
    │   │   ├── utils.ts        # fmtN, fmtP, aggDates, buildProviderDomains
    │   │   ├── store.ts        # Zustand global store (persisted to localStorage)
    │   │   └── parsers.ts      # XLSX/CSV file parsing (lazy-loads xlsx)
    │   └── components/
    │       ├── layout/Sidebar.tsx
    │       ├── ui/             # KpiCard, ChartCard, StatusPill
    │       └── views/          # HomeView, DashboardView, MailmodoView,
    │                           # UploadView, MatrixView, DataMgmtView, IPMatrixView
    ├── next.config.ts
    └── package.json
```

---

## Tech Stack

| Layer | Original (`index.html`) | Next.js (`esp-dashboard/`) |
|-------|------------------------|---------------------------|
| Framework | None (vanilla JS) | Next.js 16 + App Router |
| Styling | Custom CSS variables | Tailwind CSS 4 |
| State | Global `let` vars | Zustand (persisted) |
| Charts | Chart.js 4 (CDN) | react-chartjs-2 + chart.js |
| File parsing | XLSX (CDN) | xlsx (lazy-loaded, client-side) |
| Database | Supabase JS 2 (CDN) | @supabase/supabase-js |
| Language | JavaScript | TypeScript |

---

## Design System (shared between both versions)

| Token | Dark value | Light value |
|-------|-----------|-------------|
| Background | `#0a0c10` | `#f0f2f6` |
| Surface | `#111418` | `#ffffff` |
| Surface2 | `#181c22` | `#f4f5f8` |
| Accent (teal) | `#00e5c3` | `#009e88` |
| Accent2 (purple) | `#7c5cfc` | `#5b3fd4` |
| Accent3 (orange) | `#ff6b35` | `#d4520a` |
| Accent4 (amber) | `#ffd166` | `#b08600` |
| Danger | `#ff4757` | `#d93025` |
| Text | `#f0f2f5` | `#111827` |
| Muted | `#a8b0be` | `#a8b0be` |
| Font mono | `Space Mono` | |
| Font sans | `DM Sans` | |

- Dark mode is default; light mode adds `body.light`
- Theme persisted in `localStorage` / Zustand store

---

## Views / Navigation

| View | Route key | Content |
|------|-----------|---------|
| Home | `home` | Overview KPIs, volume chart, category split, recent activity |
| Dashboard | `dashboard` | ESP table + 5 charts + filters/search |
| Mailmodo Review | `mailmodo` | Provider/domain metrics with trend charts |
| Ongage Review | `ongage` | Same component as Mailmodo, different data context |
| Upload Report | `upload` | XLSX/CSV drag-drop ingestion → merges into store |
| Deliverability Matrix | `matrix` | Provider × Domain cross-tab (delivery rate heatmap) |
| Data Management | `datamgmt` | Partner roster CSV import/export (PIN-protected download) |
| IPs Matrix | `ipmatrix` | IP registry CRUD by ESP and sending domain |

---

## Data Model

```ts
MmData = {
  dates: string[]                          // "Feb 17", "Feb 20", …
  datesFull: { label: string; year: number }[]
  providers: Record<string, ProviderData>  // email providers
  domains: Record<string, ProviderData>    // sending domains
  overallByDate: Record<string, DateMetrics>
  providerDomains: Record<string, Record<string, ProviderDomainCell>>
}
```

- `mmData` = Mailmodo data, `ogData` = Ongage data (same structure)
- Both live in Zustand store, persisted to localStorage

---

## Status Logic

| Condition | Status |
|-----------|--------|
| Bounce > 10% OR Delivery < 70% | Critical (red) |
| Bounce > 2% OR Delivery < 95% | Warning (amber) |
| Otherwise | Healthy (green) |

---

## File Upload Flow (Next.js)

1. Select ESP + category (Mailmodo / Ongage)
2. Drop or browse XLSX / CSV file
3. `parsers.ts` auto-detects format (Mailmodo vs generic by column names)
4. Merges parsed data into `mmData` or `ogData` in Zustand store
5. `buildProviderDomains()` rebuilds the matrix cross-reference
6. Upload entry added to `uploadHistory`

---

## Development

```bash
# Original (no build needed)
python -m http.server 8000   # → http://localhost:8000

# Next.js rewrite
cd esp-dashboard
npm run dev                  # → http://localhost:3000
npm run build                # production build
```

---

## Dynamic State

### Current Tasks
- [x] Scaffold full Next.js + Tailwind rewrite of `index.html`
- [x] Zustand store with localStorage persistence
- [x] All 8 main views ported as React components
- [x] XLSX/CSV upload with drag-drop and live log
- [x] Deliverability matrix with date-range picker
- [x] IP registry CRUD with add/edit/delete modal
- [x] Data management with PIN-protected CSV export
- [x] Dark/light theme toggle

### Known Issues / Backlog
- `performance`, `daily`, `mmcharts`, `ogcharts` views are stubs ("coming soon")
- Large file uploads (>100K rows) may lag (single-threaded JS parser)
- Supabase integration not yet wired into the Next.js version
- `providerDomains` cross-ref is heuristically estimated, not exact
- PIN protection on Data Management export is client-side only (4-digit: `1234`)
