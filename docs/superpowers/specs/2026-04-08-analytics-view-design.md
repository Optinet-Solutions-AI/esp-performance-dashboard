# Analytics View — Design Spec
**Date:** 2026-04-08  
**Status:** Approved

---

## Overview

A new standalone view that lets users analyze email delivery statistics at three dimensions — ISP, Domain, and IP — for a selected ESP, with date range filtering and a sortable/filterable table.

---

## Navigation

- New view type `'analytics'` added to the `View` union in `src/lib/types.ts`
- New component `src/components/views/AnalyticsView.tsx`
- New sidebar entry **"Analytics"** under the Tools section in `Sidebar.tsx`
- New `case 'analytics': return <AnalyticsView />` in `app/page.tsx`

---

## Layout

### Controls (top bar)
1. **ESP selector** — dropdown populated from `Object.keys(espData)`. Defaults to first available ESP.
2. **Date range filter** — reuses `CalendarPicker`, scoped to dates available for the selected ESP (`espData[selectedEsp].dates`).

### Tabs
Three tabs: **ISP** · **Domain** · **IP**

Each tab shares the same layout:
1. KPI summary row
2. Filter bar
3. Sortable table with sparklines

---

## KPI Summary Row

Five cards displayed above the table, aggregating all currently visible rows (after date filter, before table text/top-N filter):

| Card | Value |
|------|-------|
| Sent | Total volume (sum) |
| Delivery Rate | Weighted average |
| Open Rate | Weighted average |
| Bounce Rate | Weighted average |
| Click Rate | Weighted average |

KPIs update live when the user applies table filters.

---

## Table

### Columns (same across all tabs)

| Column | Notes |
|--------|-------|
| Entity | Header label: "ISP" / "Domain" / "IP" per tab |
| Sent | Raw count |
| Delivered | Raw count |
| Del. Rate | Percentage |
| Opened | Raw count |
| Open Rate | Percentage |
| Clicked | Raw count |
| Click Rate | Percentage |
| Bounced | Raw count |
| Bounce Rate | Color-coded cell |
| Unsub | Raw count |
| Complaint Rate | Percentage |
| Trend | 7-point delivery rate sparkline |

### Color coding — Bounce Rate cell
- Green (`healthy`): < 2%
- Yellow (`warn`): 2–10%
- Red (`critical`): > 10%

Uses existing `getEspStatus` thresholds from `src/lib/utils.ts`.

### Sorting
Click any column header to sort ascending/descending. Default sort: Sent descending.

### Filter bar (above table)
- **Text search** — filters entity name (ISP/domain/IP string match)
- **Top N quick filter** — buttons: 10 / 25 / 50 / All. Applies after sorting, before display.

---

## Data Sources

### ISP tab
- Source: `espData[selectedEsp].providers`
- Keys are recipient email domains (e.g. `gmail.com`, `outlook.com`, `yahoo.com`)
- Metric aggregation: `aggDates(provider.byDate, selectedDates)` for the chosen date range
- Sparkline: delivery rate per date across selected range

### Domain tab
- Source: `espData[selectedEsp].domains`
- Keys are sending from-domains
- Same aggregation logic as ISP tab

### IP tab
- Source: `ipmData` filtered to `ipmRecord.esp === selectedEsp`
- Each IP row joined with metrics from `espData` if available
- If an IP exists in `ipmData` but has no metric data, it still appears with `—` for all metric columns
- Sparkline omitted (shown as `—`) when no date-level data exists for an IP

---

## Component Boundaries

- `AnalyticsView.tsx` — top-level view; owns ESP selector, date range, tab state
- Internal `AnalyticsTable` component — renders KPI row + filter bar + table; receives `rows: AnalyticsRow[]`, `dates: string[]`, `isLight: boolean` as props
- `AnalyticsRow` type (local to view or added to `types.ts`):
  ```typescript
  interface AnalyticsRow {
    entity: string
    sent: number
    delivered: number
    deliveryRate: number
    opened: number
    openRate: number
    clicked: number
    clickRate: number
    bounced: number
    bounceRate: number
    unsub: number
    complaintRate: number
    trendData: number[]  // delivery rate per date in selected range
  }
  ```

---

## What's Not in Scope

- Cross-ESP comparison within this view
- Heatmap visualization
- CSV export from this view
- IP warmup tracking / cohort analysis
