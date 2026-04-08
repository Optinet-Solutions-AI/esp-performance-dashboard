# Matrix View — Throttle Rate Columns Design Spec
**Date:** 2026-04-08  
**Status:** Approved

---

## Overview

Add two derived columns — **Throttled** (raw count) and **Throttle %** (rate) — to the ESP Deliverability Matrix (`MatrixView.tsx`). Both values are calculated from existing parsed data; no new types, parsers, or Supabase changes are required.

---

## Formula

```
throttled    = sent − delivered − bounced
throttleRate = sent > 0 ? (throttled / sent) × 100 : 0
```

Emails that left the ESP but were neither confirmed delivered nor bounced are a proxy for ISP-level rate limiting / deferral queues. The formula is intentionally simple and derived entirely from the existing `Agg` struct fields.

---

## Changes — `MatrixView.tsx` only

### 1. `rates()` function
Add two new entries to the returned object:

```typescript
thr: a.sent > 0 ? a.sent - a.delivered - a.bounced : 0,          // raw throttled count
trr: a.sent > 0 ? (a.sent - a.delivered - a.bounced) / a.sent * 100 : 0,  // throttle rate %
```

### 2. Table header row
Insert two `<th>` cells after the Hard Bounce header, before Opens:

| Header label | Alignment |
|---|---|
| `THROTTLED` | right |
| `THROTTLE %` | right |

### 3. `DataRow` component
Insert two `<td>` cells after Hard Bounce, before Opens:

- **Throttled count** — plain text, same styling as Soft/Hard Bounce count cells (`fmtMx(R.thr)`)
- **Throttle %** — color-coded using `rateCls`, with hover tooltip

**Color thresholds** (bad-high scale):

| State | Condition |
|---|---|
| `mx-good` (green) | < 5% |
| `mx-warn` (yellow) | 5–15% |
| `mx-bad` (red) | > 15% |

**Tooltip** (matches existing Success Rate / Open Rate pattern):
- Title: `THROTTLE RATE`
- Formula: `(Sent − Delivered − Bounced) ÷ Sent × 100`
- Calc: e.g. `(1000 − 920 − 30) ÷ 1000 × 100 = 5.00%`
- Shown only when `R.trr > 0`

### 4. `downloadCsv()` function
- Add `'Throttled'` and `'Throttle %'` to the headers array after `'Hard Bounce'`
- Add corresponding values to `aggToRow()` output

---

## Column Order (after change)

Sent → Delivered → Total Bounces → Soft Bounce → Hard Bounce → **Throttled → Throttle %** → Opens → Open Rate % → Clicks → Click Rate % → Complaints → Unsubscribed

---

## What's Not in Scope

- No changes to `types.ts`, `parsers.ts`, `utils.ts`, `store.ts`, or Supabase schema
- No throttle columns in AnalyticsView
- No throttle KPI cards on Home or Dashboard views
- No trend/delta indicator comparing throttle rate across date ranges
