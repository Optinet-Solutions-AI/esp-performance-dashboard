# UX Improvement Suggestions

**Date:** 2026-04-01  
**Scope:** User experience, accessibility, responsiveness, and interaction patterns

---

## High Impact

### 1. Add toast notifications for all async operations
**Current:** All operations (upload, save, delete, add record) complete silently. Users have no visual feedback.  
**Suggested:** Add a lightweight toast system showing success/error for:
- File upload success/failure
- IP Matrix add/edit/delete
- Data Management CSV import
- Supabase save failures (currently logged to console only)

**Options:** `react-hot-toast` (~3KB), `sonner` (~5KB), or a custom 50-line component.

### 2. Add error boundaries around each view
**Current:** If any view component throws (bad data shape, Chart.js error), the entire app white-screens.  
**Suggested:** Wrap each view in `page.tsx` with a React Error Boundary that shows a "Something went wrong" fallback with a retry button, while keeping the sidebar and other views functional.

### 3. Confirm destructive actions consistently
**Current state:**
- IP Matrix delete: uses `confirm()` (browser native) — adequate but basic
- Upload delete: uses `confirm()` — good
- Reset All Data: uses a custom modal — good
- Data Management import: **overwrites all data with no confirmation**

**Suggested:** The DataMgmtView CSV import (`src/components/views/DataMgmtView.tsx:41-53`) should show a confirmation before replacing all existing data, or show a preview of what will be imported.

---

## Medium Impact

### 4. IP Matrix — add pagination or virtual scrolling
**File:** `src/components/views/IPMatrixView.tsx:392-435`  
The "All Records" table renders every row at once. With 500+ records this causes:
- Slow initial render
- Janky scrolling
- High memory usage

**Suggested:** Add simple page-based pagination (25-50 rows per page) with page controls. DataMgmtView already caps at 200 rows (`DataMgmtView.tsx:307`) — apply similar approach.

### 5. Loading states for data-dependent views
**Current:** Views show "No data yet" instantly even while Supabase is loading on mount.  
**Suggested:** Pass `dbLoaded` from `page.tsx` to views, or add skeleton placeholders that show while data is loading.

### 6. Mobile responsiveness gaps
**Current issues found:**
- IP Matrix search/filter grid uses `grid-cols-[1fr_1fr_1fr_auto]` — doesn't stack on mobile (`IPMatrixView.tsx:317,341`)
- IP Matrix modal is fixed width `w-96` — overflows on small screens (`IPMatrixView.tsx:441`)
- Performance KPI cards use `grid-cols-4` without responsive breakpoints (`PerformanceView.tsx:132`)
- DataMgmtView charts use `grid-cols-2` without responsive fallback (`DataMgmtView.tsx:232`)

**Suggested:** Add `sm:` and `md:` breakpoints to these grids.

### 7. Keyboard accessibility
**Current:** Most interactive elements use `<button>` (good), but:
- The ESP Summary expand rows use `<tr onClick>` without keyboard handler (`IPMatrixView.tsx:244-246`)
- Modals don't trap focus or close on Escape consistently
- The sidebar nav items are proper buttons (good)

**Suggested:** Add `onKeyDown` handlers for Escape on modals, add `tabIndex` and `role` to clickable table rows.

---

## Low Impact (Polish)

### 8. Empty state illustrations
**Current:** Empty states show emoji + text ("No data yet"). This is functional but generic.  
**Suggested:** Consider simple SVG illustrations or more descriptive empty states that guide users to the Upload page.

### 9. Breadcrumbs or view context
**Current:** The mobile top bar shows the view label. Desktop has no header showing which view is active (the sidebar highlights it, but on wide screens the sidebar may be scrolled).  
**Suggested:** A subtle breadcrumb or sticky header on desktop showing the current view name.

### 10. Search debouncing in IP Matrix
**Current:** Search filters in `IPMatrixView` trigger on every keystroke (`onChange` → immediate filter).  
**Suggested:** For large datasets, add a 200ms debounce to prevent lag during rapid typing.

### 11. IP Matrix CSV import feedback
**Current:** CSV import silently adds records with no count shown.  
**Suggested:** After import, show a toast: "Imported 47 records from file.csv"

### 12. Consistent date display format
**Current:** Dates are shown as "Mar 10" (short label) everywhere. Upload history shows ISO with `toLocaleString()`.  
**Suggested:** Pick one format and use it consistently, or show relative time ("2 hours ago") in recent activity.

### 13. DataMgmtView table column headers are dynamic
**File:** `src/components/views/DataMgmtView.tsx:298`  
Column headers are derived from the first row's keys (`Object.keys(dmData[0])`). If CSV column names change between imports, the table adapts — but this could be confusing. Consider showing a fixed set of expected columns or a "columns" badge.

---

## Accessibility Audit

| Issue | Severity | Location |
|-------|----------|----------|
| No `aria-label` on icon-only buttons | Medium | IPMatrixView edit/delete buttons |
| Color contrast: muted text on dark bg | Low | `#5a6478` on `#0a0c10` = 4.1:1 (passes AA for large text only) |
| Charts have no alt text | Medium | All chart views — screen readers get nothing |
| Sidebar nav has no `aria-current` | Low | Sidebar.tsx |
| Tables missing `scope` attributes on `<th>` | Low | All table views |
