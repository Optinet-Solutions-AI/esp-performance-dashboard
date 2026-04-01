# Version History

---

## v0.4.0 — Critical Bug Fixes & Supabase Sync (2026-04-01)

### Bug Fixes
- **IP Matrix now persists to Supabase** — all CRUD operations (add, edit, delete, CSV import) sync to `ip_matrix` table; data loads from Supabase on mount instead of localStorage
- **Data Management now persists to Supabase** — partner roster CSV imports sync to `data_management` table; loads from Supabase on mount
- **Fixed double-counting on page load** — changed `mergeMmData` to `overwriteMmData` in `page.tsx` mount rebuild, preventing inflated metrics when same dates appear across multiple uploads
- **Upload delete no longer reloads page** — replaced `window.location.reload()` with in-place data rebuild from remaining uploads, preserving UI state
- **Reset All Data now clears Supabase** — the reset button in Data Management now deletes from `uploads`, `ip_matrix`, and `data_management` tables, not just local state

### Schema Changes
- Added `id` field to `IpmRecord` type for safe CRUD operations
- Removed `ipmData` and `dmData` from localStorage persist (Supabase is source of truth)
- **New Supabase tables required:**
  - `ip_matrix` (id, esp, ip, domain, created_at)
  - `data_management` (id, raw_data, created_at)

### Documentation
- Added `docs/suggestions/` folder with full project audit:
  - `improvements.md` — master list of 28 issues, prioritized
  - `ip-matrix-bug.md` — root cause analysis and fix plan
  - `tech-stack.md` — full tech stack, database schema, data flow
  - `security-concerns.md` — 8 security issues with recommendations
  - `ux-improvements.md` — 13 UX improvements and accessibility audit
  - `data-architecture.md` — data flow analysis and scalability roadmap

---

## v0.3.0 — UI Polish & Light Mode (2026-03)

### Features
- Light/dark mode color scheme updates
- Filter dropdowns across views
- Mailmodo KPI section with table and charts
- Day/week/month granularity dropdown for trend charts
- Hover calculation tooltips on charts
- IP Matrix view with upload format support, search, filter, and sort

### Improvements
- Calendar date picker wired across dashboards
- Volume and trend chart updates
- Upload history display and management

---

## v0.2.0 — Upload System & Data Pipeline (2026-02 to 2026-03)

### Features
- Upload history with delete functionality
- Solo data storage per upload with re-merge on delete
- Supabase integration for upload persistence
- Ongage ESP support with `action_timestamp_rounded` date column
- Generic ESP parser with `mailing_name` as from-domain
- Email provider dashboards switched to IP-based statistics
- Deliverability Matrix view
- Performance and Daily Report views
- Data Management view with partner roster CSV import/export

### Bug Fixes
- Fixed CSV date parsing (dd/mm/yyyy for Mailmodo)
- Fixed upload overwriting and duplicate handling
- Fixed null calendar picker issues
- Removed legacy vanilla JS files, consolidated to Next.js

---

## v0.1.0 — Initial Release (2026-01 to 2026-02)

### Features
- Next.js 16 App Router with React 19
- Sidebar navigation with ESP list and status pills
- Mailmodo and Ongage review views with charts
- KPI cards for delivery rate, open rate, click rate, bounce rate
- File upload wizard for CSV/XLSX parsing
- Zustand state management with localStorage persistence
- Dark mode default with theme toggle
- Mobile-responsive sidebar drawer
- Supabase PostgreSQL backend for upload data
- Chart.js visualizations (bar, line, doughnut)
