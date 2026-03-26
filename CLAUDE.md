# CLAUDE Context — ESP Performance Dashboard

## Project Overview
A modular web-based dashboard for monitoring Email Service Provider (ESP) performance metrics. Features real-time performance tracking, data uploads, deliverability matrices, and comprehensive data management capabilities with dark/light theme support.

## Project Structure
```
/
├── index.html                 # Main HTML (1,162 lines, all views and layouts)
├── css/
│   └── styles.css            # Design tokens, responsive layouts, themes (657 lines)
├── js/
│   ├── init.js               # Boot sequence (16 lines)
│   ├── data.js               # Global state, esps[], daily7[], formatters (42 lines)
│   ├── utils.js              # showView(), renderSidebar() (22 lines)
│   ├── dashboard.js          # Filters, KPI calc, chart/table rendering (158 lines)
│   ├── views.js              # Modal dialogs, detail/perf/daily views (205 lines)
│   ├── mailmodo.js           # Mailmodo data, provider/domain breakdowns (412 lines)
│   ├── mmcharts.js           # KPI charts by date/provider (153 lines)
│   ├── matrix.js             # Deliverability Matrix view (124 lines)
│   ├── datamgmt.js           # Data Management dashboard, roster filters (157 lines)
│   ├── upload.js             # XLSX parsing, data merge, upload history (236 lines)
│   ├── ipmatrix.js           # IPs Matrix view (TBD)
│   ├── supabase.js           # Supabase client, sbLoad(), sbSave() (102 lines)
│   ├── persistence.js        # localStorage persistence (91 lines)
│   ├── datepicker.js         # Calendar picker widget (80 lines)
│   ├── theme.js              # Dark/light mode toggle (44 lines)
│   ├── mobile.js             # Mobile nav, menu overlay, Escape listener (21 lines)
│   └── export.js             # CSV/dashboard export (91 lines)
├── REFACTORING_SUMMARY.md    # Modular refactoring documentation
├── EXTRACTION_COMPLETE.md    # Extraction milestone record
└── CLAUDE.md                 # This file
```

## Tech Stack
**Frontend:** HTML · Vanilla JavaScript · CSS
**Charting:** Chart.js 4.4.1
**Data Format:** XLSX (SheetJS)
**Backend/Database:** Supabase (PostgreSQL)
**Fonts:** Space Mono, DM Sans (Google Fonts)
**Responsive Breakpoints:** 1024px, 768px, 480px

## Design System

### Color Tokens
| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `#6366F1` | Indigo — main brand, KPI highlights |
| `--primary-dark` | `#4F46E5` | Hover state, active nav |
| `--success` | `#10B981` | Green — positive metrics (deliver rate) |
| `--warning` | `#F59E0B` | Amber — caution, bounce rates |
| `--danger` | `#EF4444` | Red — critical metrics (spam, errors) |
| `--muted` | `#9CA3AF` | Gray — secondary text, disabled |
| `--border` | `#E5E7EB` | Light gray — borders, dividers |
| `--bg-light` | `#F9FAFB` | Off-white — card backgrounds |
| `--bg-dark` | `#1F2937` | Dark mode background |
| `--text-dark` | `#111827` | Light mode text |
| `--text-light` | `#F3F4F6` | Dark mode text |

### Typography
- **Font Family:** DM Sans (main), Space Mono (monospace data)
- **Heading Weights:** 600–700
- **Body Weight:** 400–500
- **Data Tables:** Space Mono, 12px–14px

### Component Classes
- `.card` — White/dark background with subtle shadow
- `.kpi-box` — KPI metric display (value + label + trend)
- `.table` — Sortable data table with striped rows
- `.modal` — Overlay dialog with backdrop and close button
- `.chart-container` — Canvas wrapper with responsive sizing
- `.sidebar` — Fixed left nav (250px desktop, slide-in mobile)
- `.mobile-sidebar` — Hidden on desktop, full-height on mobile

## Feature Breakdown

### 1. Mailmodo Review (Default View)
**File:** `js/mailmodo.js`, `js/mmcharts.js`, `js/views.js`

- Real-time email campaign metrics from Mailmodo integration
- KPI Cards: Send Volume, Delivery Rate, Bounce Rate, Spam Rate
- By-Date Performance Charts: trends over selected date range
- By-Provider Grid: breakdown by ESP name
- By-Domain Grid: breakdown by sending domain
- Sortable columns, click-through to detail modal

**Global State:** `mmData` object in `data.js`

### 2. Upload Report
**File:** `js/upload.js`, `js/datamgmt.js`

- XLSX file parser (Mailmodo or generic ESP formats)
- Data merge with existing dashboard state
- Upload history tracking with timestamps
- Field mapping for custom ESP formats
- Local + Supabase sync

### 3. ESP Deliverability Matrix
**File:** `js/matrix.js`

- Provider × Domain matrix showing delivery metrics
- Color-coded cells: green (>95%), yellow (80–95%), red (<80%)
- Sortable rows/columns
- Click rows to isolate ESP performance

### 4. Data Management
**File:** `js/datamgmt.js`

- Roster filtering (search by provider/domain)
- Aggregate stats: total sends, avg delivery, bounce count
- Trend chart (7-day rolling avg)
- Sync status badge
- Clear/reset data option (confirms before action)

### 5. IPs Matrix
**File:** `js/ipmatrix.js` (placeholder)

- Sending IP reputation tracking
- Warmup/burndown visualization
- ISP engagement scores (Gmail, Outlook, Yahoo, etc.)
- IP assignment recommendations

## Data Flow

### Global State (`data.js`)
```javascript
esps = [
  {
    id, name, provider, color, daily: [{date, sends, delivers, bounces, ...}],
    domains: [{name, sends, delivers, ...}],
    ips: [{ip, reputation, sendCount, ...}]
  }
]
daily7 = [{date, sends, delivers, bounces, ...}]  // 7-day rollup
```

### Persistence
1. **Browser (localStorage):** Quick access, format `esp-dashboard-state`
2. **Supabase:** Long-term storage, synced via `sbLoad()`, `sbSave()`
3. **Export:** Single-file HTML snapshot with inlined assets

### Load Order (Dependency Chain)
1. `data.js` — Global state
2. `utils.js` — Depends on data.js
3. `dashboard.js` — Chart/table renderers
4. `views.js` — Modals and view handlers
5. `mailmodo.js` — Mailmodo data object
6. `mmcharts.js` → `matrix.js` → `datamgmt.js` — Feature modules
7. `upload.js` → `supabase.js` — Data ingestion & sync
8. `datepicker.js` → `persistence.js` → `theme.js` → `mobile.js` — UI utilities
9. `export.js` → `init.js` — Boot sequence

**Must load in order—no ES modules (global scope only).**

## Development Guidelines

### Adding a New View
1. Create feature module in `js/myfeature.js`
2. Export a `myFeatureRender()` function that updates `#myview` container
3. Add nav button in HTML with `onclick="showView('myfeature')"`
4. Add to `showView()` switch in `utils.js`
5. Include script tag in `index.html` before `init.js`

### Modifying Data Structure
- Edit `mmData` shape in `data.js` and update upload.js parser
- Update chart/table rendering in relevant feature module
- Test with sample XLSX file (upload.js)

### Styling New Components
- Add to `styles.css` using existing design tokens (CSS custom properties)
- Mobile-first: styles apply to all widths, then override at `@media (min-width: ...)`
- Test light/dark theme toggle (theme.js sets `.light-mode` on body)

### Security Notes
- **XLSX Parsing:** SheetJS library handles; sanitize user-provided column names
- **Supabase Keys:** Stored as constants in `js/supabase.js`; consider env var in production
- **localStorage:** No sensitive data; user session is read-only
- **Chart Injection:** All data from internal state; no direct user HTML input

### Performance Considerations
- Chart.js instances stored in `window.chartInstances` object (reuse, don't recreate)
- Table pagination: currently renders all rows; add virtual scroll if >1,000 rows
- Date range filter: pre-compute aggregates in `data.js`, not on each filter change
- Export: batched file reads in `export.js` to avoid blocking UI

## Responsive Design
- **Desktop (≥1024px):** Sidebar fixed, main area full-width, charts side-by-side
- **Tablet (768px–1023px):** Sidebar narrows to icons, charts stack
- **Mobile (<768px):** Sidebar hidden (toggle via hamburger), charts single-column, modals full-screen

Mobile menu handled by `mobile.js`: slide-in drawer from right, overlay backdrop, body scroll-lock.

## Known Issues & Backlog

### High Priority
- [ ] IPs Matrix view needs implementation (`js/ipmatrix.js` placeholder)
- [ ] Export function (exportUpdatedDashboard) needs inline-asset bundling
- [ ] Supabase sync error handling (currently silent on network failure)

### Medium Priority
- [ ] Large dataset pagination (>1,000 rows table render is slow)
- [ ] Date range sync across all views (currently view-specific)
- [ ] Chart.js memory leaks on rapid view switches (destroy instances)
- [ ] XLSX column mapping UI (currently hardcoded parsers)

### Low Priority
- [ ] Add favicon
- [ ] Accessibility: ARIA labels on nav buttons, chart alt text
- [ ] Error toast notifications (currently console.log only)
- [ ] Keyboard navigation in modals (Tab, Enter, Escape)

## Git Conventions
- Commit messages: `[Feature|Fix|Refactor] Short description`
- Branch naming: `feature/your-feature` or `fix/bug-description`
- PR format: Link to Linear/Jira, list features/fixes, testing steps

## Testing Checklist (Before Deploy)
- [ ] All views load without JS errors (check Console)
- [ ] Theme toggle switches all colors (light ↔ dark)
- [ ] Mobile menu opens/closes, overlay blocks clicks
- [ ] Date picker opens and selection updates view
- [ ] XLSX upload parses without errors
- [ ] Supabase sync (check network tab, sbSyncBadge updates)
- [ ] Export generates file with correct data
- [ ] Responsive on 1920px, 1024px, 768px, 480px widths

---

## Recent Work
- **March 2026:** Modular refactoring complete — 1 monolithic HTML → 16 JS modules + CSS
- **March 2026:** Mobile responsiveness added (hamburger menu, tablet layout)
- **March 2026:** Dark/light theme implementation with localStorage persistence
- **Date TBD:** IPs Matrix feature started (placeholder, not yet functional)

## Team Contacts
- **Dashboard Owner:** [Name/Team]
- **Data Sync:** [Supabase Admin]
- **Design System:** [Design Lead]
