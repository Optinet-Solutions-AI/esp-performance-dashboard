# CLAUDE Context — ESP Performance Dashboard

## Project Structure
```
/
├── index.html          # Monolithic SPA — all HTML, CSS, JS, and data
├── supabase.js         # Optional Supabase persistence layer
├── SUPABASE_SETUP.md   # Supabase config docs
└── VERIFICATION_CHECKLIST.md
```

## Tech Stack
Vanilla JS (ES6+) · HTML5 · CSS3 · Chart.js 4.4.1 · SheetJS 0.18.5 · Supabase JS 2.x

No build tools, no bundler, no package manager. Single distributable HTML file.

## Design System
| Token | Value |
|-------|-------|
| Dark bg | `#0f1117` / `#1a1d27` |
| Accent green | `#009e88` |
| Accent amber | `#f59e0b` |
| Text primary | `#d4dae6` |
| Fonts | `Space Mono` (mono), `DM Sans` (sans) |

- **Dark mode** is default (no body class)
- **Light mode** adds `body.light` — overrides via CSS cascade
- Theme preference persisted in `localStorage('espDashTheme')`

## Architecture

### Views (tabs)
Controlled by `showView(name)`. Each view hides all `.view` elements then shows the target:
| View name | Content |
|-----------|---------|
| `dashboard` | ESP overview — KPIs, charts, sortable table |
| `mailmodo` | Deep-dive provider/domain metrics with trend charts |
| `upload` | Step-by-step XLSX/CSV ingestion workflow |
| `matrix` | ESP × Domain deliverability cross-tab |
| `datamanagement` | Partner roster analytics |
| `ipm` | IP registry by ESP and sending domain |

### Global State
```js
mmData = {
  dates[],           // "Feb 17", "Feb 20", … (key strings)
  datesFull[],       // {label, year} for display
  providers{},       // email providers → { overall{}, byDate{} }
  domains{},         // sending domains  → { overall{}, byDate{} }
  overallByDate{},   // global daily aggregates
  providerDomains{}  // cross-ref for matrix view
}
```

Misc UI state: `activeFilter`, `activeEsp`, `sortKey`, `sortDir`, `searchQ`, `mmTab`, `mmFromIdx`, `mmToIdx`

### Charts
- Stored in `C{}` (dashboard) and `mmCharts{}` (Mailmodo) for reuse
- **Must be destroyed before recreation** on theme toggle (Chart.js limitation)
- `refreshChartThemeVars()` + `rebuildAllCharts()` called by `toggleTheme()`

### Persistence
1. **In-memory** — `mmData` JS object (primary)
2. **localStorage** — theme + Supabase toggle state
3. **Supabase** — optional cloud sync, auto-save every 5 min via `setInterval`
4. **Export** — `exportUpdatedDashboard()` serializes `mmData` into HTML blob download

## Key Functions

| Function | Purpose |
|----------|---------|
| `showView(name)` | Switch active tab |
| `getFiltered()` | Apply filter/search, trigger KPI + chart + table update |
| `updateKpis()` | Recalculate dashboard KPI cards |
| `renderCharts()` | Rebuild all dashboard Chart.js instances |
| `renderTable()` | Render sortable ESP table |
| `mmGetData(name)` | Aggregate provider/domain data for selected date range |
| `rates(r)` | Compute SR, OR, CTR, BR, Unsub from raw counts |
| `mxRender()` | Build deliverability matrix |
| `dmRender()` | Render data management view |
| `uploadProcess()` | Parse XLSX, merge rows into `mmData` |
| `exportUpdatedDashboard()` | Serialize state → downloadable HTML |
| `toggleTheme()` | Flip dark/light, update label, rebuild charts |
| `dpInit(ns)` | Init calendar picker text for a view namespace (mm/mmc/mx) |
| `dpOpen(ns,which,event)` | Open calendar popup for from/to picker |
| `dpApplyToView(ns)` | Apply selected calendar dates → update view indices + re-render |
| `dpReset(ns)` | Reset calendar to full data range + re-render |
| `sbInit() / sbSave() / sbLoad()` | Supabase CRUD |

## Status Logic
| Condition | Status |
|-----------|--------|
| Bounce > 10% | Critical (red) |
| Bounce > 2% OR Delivery < 95% | Warning (amber) |
| Otherwise | Healthy (green) |

## Theme Toggle
```js
let isLight = false;  // false = dark (default)

function toggleTheme() {
  isLight = !isLight;
  document.body.classList.toggle('light', isLight);
  document.getElementById('themeLabel').textContent = isLight ? '☀ Light mode' : '🌙 Dark mode';
  localStorage.setItem('espDashTheme', isLight ? 'light' : 'dark');
  refreshChartThemeVars();
  rebuildAllCharts();
}
```
Label always reflects **current** active mode.

## File Upload Flow
1. Select ESP → `uploadEspChanged()`
2. Select XLSX/CSV → `uploadFileSelected()` (SheetJS parses)
3. Process → `uploadProcess()` aggregates by date, merges into `mmData`
4. Dashboard auto-rerenders
5. Download updated HTML → `exportUpdatedDashboard()`

## Development Notes
- Test locally: `python -m http.server 8000` → `http://localhost:8000`
- No transpilation — edit `index.html` directly
- All CSS in `<style>` blocks within `index.html`; light-mode overrides use `body.light` prefix
- Supabase anon key in `supabase.js` is intentionally public (row-level security handles access)
- PIN protection on Data Management CSV download is simple 4-digit check (client-side only)

## Dynamic State

### Current Tasks
- [x] Dark/light theme toggle with localStorage persistence
- [x] Supabase optional cloud sync
- [x] XLSX upload → data merge → HTML export flow
- [x] Deliverability matrix with date-range picker
- [x] IP registry view

### Recent Changes
- *March 2026:* Replaced date filter `<select>` dropdowns with calendar picker buttons across mm/mmc/mx views — uses existing `dpState`/`dpOpen`/`dpRenderPopup` engine; IDs follow `${ns}DpFrom/ToBtn/Popup/Txt` pattern.
- *March 2026:* Fixed theme toggle label mismatch — label now shows current active mode.
- *March 2026:* Fixed `mm-select` text color for light mode visibility.
- *March 2026:* Created `CLAUDE.md`.

### Known Issues / Backlog
- Large file uploads (>100K rows) may lag (single-threaded JS)
- Supabase has no authentication — public read/write (RLS should be configured)
- Chart.js requires full destroy/recreate on theme change (no live color update)
- `providerDomains` cross-ref is heuristically estimated, not exact
