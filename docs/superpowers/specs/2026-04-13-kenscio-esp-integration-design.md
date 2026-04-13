# Kenscio ESP Integration — Design Spec
**Date:** 2026-04-13

## Overview
Add Kenscio as a fully integrated ESP provider: upload support, IP matrix color/domain matching, sidebar navigation, and a dedicated Kenscio Review view (modeled on OngageView).

Kenscio-specific metric formulas will be refined in a future update; standard placeholders are used for now.

---

## CSV Format

**Sample headers:**
```
Campaign Name, Domain Name, Email-Sent, Timestamp, Delivered, Open, Click, Bounce
```

Each row represents one email sent.

| CSV Column | Field | Notes |
|---|---|---|
| `Timestamp` | Date | Format: `dd-mm-yyyy HH:MM` — parse day-first |
| `Domain Name` | Sending domain | Used directly as the from-domain |
| `Email-Sent` | Recipient email | Split on `@` to extract provider domain |
| `Delivered` | delivered = 1 | Non-empty = delivered |
| `Open` | opened = 1 | Non-empty = opened |
| `Click` | clicked = 1 | Non-empty = clicked |
| `Bounce` | bounced = 1 | Non-empty = total bounce |
| Hard Bounce | hardBounced = 0 | Leave for now |
| Soft Bounce | softBounced = 0 | Leave for now |
| Unsubscribed | unsubscribed = 0 | Leave for now |
| Complaints | complained = 0 | Leave for now |
| Throttling | — | Column noted, no action yet |

`sent = 1` per row always.

---

## KPI Formulas

| Metric | Formula |
|---|---|
| Delivery Rate | Delivered ÷ Sent × 100 |
| Open Rate | Opens ÷ Delivered × 100 |
| Click Rate | Clicks ÷ Delivered × 100 |
| Bounce Rate | Bounced ÷ Sent × 100 |
| Unsub Rate | 0 (placeholder) |
| Complaint Rate | 0 (placeholder) |

---

## Architecture

### Approach
Clone OngageView as KenscioView. Swap ESP name, color, and KPI formula definitions. Remove Ongage-specific aggregated-format handling. Formulas can be updated in one place when Kenscio-specific ones are provided.

### Color
`#e63946` (red) — distinct from all existing ESP colors in `ESP_COLORS`.

---

## Files Changed

### 1. `src/lib/parsers.ts`
- Add `isKenscio = espName === 'Kenscio'` detection flag
- Add `kenscio: { stripPrefixes: [] }` to `ESP_CONFIGS`
- Add parsing branch before the generic fallback:
  - Date from `timestamp` column, parsed day-first (`dd-mm-yyyy HH:MM`, strip time)
  - Recipient from `email-sent` column
  - Sending domain from `domain-name` column
  - Metrics: `sent=1`, delivered/opened/clicked/bounced from non-empty column check, rest = 0

### 2. `src/lib/data.ts`
- Add `Kenscio: '#e63946'` to `ESP_COLORS`

### 3. `src/components/views/UploadView.tsx`
- Add `'Kenscio'` to `ESP_LIST` array

### 4. `src/components/views/IPMatrixView.tsx`
- Add `Kenscio: { bg: '#e63946', text: '#fff' }` to `ESP_PALETTE`

### 5. `src/lib/types.ts`
- Add `'kenscio'` to `ViewName` union type

### 6. `src/components/layout/Sidebar.tsx`
- Add `{ id: 'kenscio', label: 'Kenscio Review', color: '#e63946' }` to the providers list array

### 7. `src/app/page.tsx`
- Import `KenscioView`
- Add `kenscio: 'Kenscio Review'` to `VIEW_LABELS`
- Add `case 'kenscio': return <KenscioView />` to view routing

### 8. `src/components/views/KenscioView.tsx` *(new file)*
- Clone of `OngageView.tsx`
- Swap: ESP name → `'Kenscio'`, color accent → `#e63946`
- KPI_DEFS updated to use Kenscio formulas (Open÷Delivered, Click÷Delivered, Bounce÷Sent)
- Remove Ongage-specific aggregated-format references if any leak into the view layer

---

## Out of Scope
- Hard/Soft bounce breakdown (deferred until Kenscio provides field)
- Unsubscribe and complaint tracking (deferred)
- Throttling column (column added in parser, value empty, no UI action)
- Custom Kenscio formula refinements (to be updated in a follow-up once provided)
