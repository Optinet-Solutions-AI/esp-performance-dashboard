# Matrix Throttle Rate Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Throttled` (raw count) and `Throttle %` (color-coded rate) columns to the ESP Deliverability Matrix, derived from existing parsed data with no schema or parser changes.

**Architecture:** All changes are confined to `MatrixView.tsx`. The `rates()` helper is extended with two new fields (`thr`, `trr`). `DataRow` gets two new `<td>` cells. The table header gets two new `<th>` cells. The CSV export is updated to match.

**Tech Stack:** React 19, TypeScript 5, Tailwind CSS 4, Next.js App Router

---

## Files

- Modify: `src/components/views/MatrixView.tsx`

---

### Task 1: Extend `rates()` with throttle fields

The `rates()` function (around line 33) currently returns `{ sr, or, ctr, br }`. Add `thr` (raw throttled count) and `trr` (throttle rate %).

**Files:**
- Modify: `src/components/views/MatrixView.tsx:33-40`

- [ ] **Step 1: Update `rates()` to return throttle values**

Replace the existing `rates()` function body:

```typescript
function rates(a: Agg) {
  const thr = Math.max(0, a.sent - a.delivered - a.bounced)
  return {
    sr:  a.sent > 0 ? a.delivered / a.sent * 100 : 0,
    or:  a.delivered > 0 ? a.opened / a.delivered * 100 : 0,
    ctr: a.opened > 0 ? a.clicked / a.opened * 100 : 0,
    br:  a.sent > 0 ? a.bounced / a.sent * 100 : 0,
    thr,
    trr: a.sent > 0 ? thr / a.sent * 100 : 0,
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "c:/Users/Leo/OneDrive/Desktop/AI Automation/Projects/ESP-Performance-Dashboard"
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing unrelated errors).

- [ ] **Step 3: Commit**

```bash
git add src/components/views/MatrixView.tsx
git commit -m "feat: add throttle fields to rates() in MatrixView"
```

---

### Task 2: Add table header columns

Two new `<th>` cells inserted after the existing `Hard Bounce` header (line ~554), before `Opens`.

**Files:**
- Modify: `src/components/views/MatrixView.tsx:554-555`

- [ ] **Step 1: Insert the two header cells**

Find this block in the `<thead>`:

```tsx
                <th className={thCls} style={{ borderColor: bdr, color: txt, position: 'sticky', top: 0, zIndex: 5, background: headerBg }}>Hard Bounce</th>
                <th className={thCls} style={{ borderColor: bdr, color: txt, position: 'sticky', top: 0, zIndex: 5, background: headerBg }}>Opens</th>
```

Replace with:

```tsx
                <th className={thCls} style={{ borderColor: bdr, color: txt, position: 'sticky', top: 0, zIndex: 5, background: headerBg }}>Hard Bounce</th>
                <th className={thCls} style={{ borderColor: bdr, color: txt, position: 'sticky', top: 0, zIndex: 5, background: headerBg }}>Throttled</th>
                <th className={thCls} style={{ borderColor: bdr, color: isLight ? '#b45309' : '#ffd166', position: 'sticky', top: 0, zIndex: 5, background: headerBg }}>Throttle %</th>
                <th className={thCls} style={{ borderColor: bdr, color: txt, position: 'sticky', top: 0, zIndex: 5, background: headerBg }}>Opens</th>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/views/MatrixView.tsx
git commit -m "feat: add Throttled / Throttle % header columns to MatrixView"
```

---

### Task 3: Add data cells in `DataRow`

Two new `<td>` cells inserted in `DataRow` after Hard Bounce (line ~220), before Opens.

Color thresholds for Throttle % (bad-high scale):
- `mx-good` (green): `trr < 5`
- `mx-warn` (yellow): `5 ≤ trr < 15`
- `mx-bad` (red): `trr ≥ 15`

The `Throttle %` cell gets a hover tooltip matching the existing pattern used for Success Rate / Open Rate / Click Rate.

**Files:**
- Modify: `src/components/views/MatrixView.tsx` — `DataRow` component

- [ ] **Step 1: Insert the two `<td>` cells in `DataRow`**

Find this block inside the `DataRow` component return fragment (the Hard Bounce `<td>` followed by the Opens `<td>`):

```tsx
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: rateColor(rateCls(R.br, false, 5, 10)) }}>{fmtMx(agg.hardBounced)}</td>
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: rateColor(rateCls(R.or, true, 30, 60)) }}>{fmtMx(agg.opened)}</td>
```

Replace with:

```tsx
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: rateColor(rateCls(R.br, false, 5, 10)) }}>{fmtMx(agg.hardBounced)}</td>
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: txt }}>{fmtMx(R.thr)}</td>
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: rateColor(rateCls(R.trr, false, 5, 15)), cursor: R.trr > 0 ? 'help' : undefined }}
          onMouseEnter={e => { if (R.trr > 0) showTip(e, 'THROTTLE RATE', R.trr.toFixed(2) + '%', '(Sent − Delivered − Bounced) ÷ Sent × 100', `(${fmtMx(agg.sent)} − ${fmtMx(agg.delivered)} − ${fmtMx(agg.bounced)}) ÷ ${fmtMx(agg.sent)} × 100 = ${R.trr.toFixed(2)}%`) }}
          onMouseLeave={() => setTip(null)}>{R.trr > 0 ? R.trr.toFixed(1) + '%' : ''}</td>
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: rateColor(rateCls(R.or, true, 30, 60)) }}>{fmtMx(agg.opened)}</td>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Smoke-test in browser**

```bash
npm run dev
```

Open http://localhost:3000, navigate to Matrix view. Verify:
- Two new columns appear between Hard Bounce and Opens at every level (ESP, IP, From Domain, Email Provider)
- `Throttle %` cell is color-coded (green/yellow/red)
- Hovering a non-zero `Throttle %` cell shows the tooltip with formula and calculation
- Zero throttle rows show empty string (not `0.0%`)

- [ ] **Step 4: Commit**

```bash
git add src/components/views/MatrixView.tsx
git commit -m "feat: add Throttled count and Throttle % cells to MatrixView DataRow"
```

---

### Task 4: Update CSV export

Add `Throttled` and `Throttle %` columns to `downloadCsv()` — both the headers array and the `aggToRow()` helper.

**Files:**
- Modify: `src/components/views/MatrixView.tsx` — `downloadCsv()` function (lines ~66-80)

- [ ] **Step 1: Update headers array in `downloadCsv()`**

Find this line inside `downloadCsv()`:

```typescript
    const headers = ['Level', 'ESP', 'IP', 'From Domain', 'Email Provider', 'Sent', 'Delivered', 'Total Bounces', 'Soft Bounce', 'Hard Bounce', 'Opens', 'Open Rate %', 'Clicks', 'Click Rate %', 'Complaints', 'Unsubscribed']
```

Replace with:

```typescript
    const headers = ['Level', 'ESP', 'IP', 'From Domain', 'Email Provider', 'Sent', 'Delivered', 'Total Bounces', 'Soft Bounce', 'Hard Bounce', 'Throttled', 'Throttle %', 'Opens', 'Open Rate %', 'Clicks', 'Click Rate %', 'Complaints', 'Unsubscribed']
```

- [ ] **Step 2: Update `aggToRow()` inside `downloadCsv()`**

Find the `aggToRow` function inside `downloadCsv()`:

```typescript
      return [
        level, esp, ip, fd, prov,
        String(agg.sent), String(agg.delivered), String(agg.bounced), String(agg.softBounced), String(agg.hardBounced),
        String(agg.opened),
        agg.delivered > 0 ? R.or.toFixed(2) + '%' : '',
        String(agg.clicked),
        agg.opened > 0 ? R.ctr.toFixed(2) + '%' : '',
        String(agg.complained || 0), String(agg.unsubscribed || 0)
      ]
```

Replace with:

```typescript
      return [
        level, esp, ip, fd, prov,
        String(agg.sent), String(agg.delivered), String(agg.bounced), String(agg.softBounced), String(agg.hardBounced),
        String(R.thr),
        R.trr > 0 ? R.trr.toFixed(2) + '%' : '',
        String(agg.opened),
        agg.delivered > 0 ? R.or.toFixed(2) + '%' : '',
        String(agg.clicked),
        agg.opened > 0 ? R.ctr.toFixed(2) + '%' : '',
        String(agg.complained || 0), String(agg.unsubscribed || 0)
      ]
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Smoke-test CSV export**

In the running dev server, click the CSV button in Matrix view. Open the downloaded file and verify:
- Column headers include `Throttled` and `Throttle %` between `Hard Bounce` and `Opens`
- Values are correct (Throttled = Sent − Delivered − Bounced; Throttle % = that ÷ Sent × 100)

- [ ] **Step 5: Final commit**

```bash
git add src/components/views/MatrixView.tsx
git commit -m "feat: add Throttled and Throttle % to MatrixView CSV export"
```
