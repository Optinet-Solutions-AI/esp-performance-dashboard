# Kenscio ESP Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Kenscio as a fully integrated ESP — upload parsing, IP matrix support, sidebar nav, and a dedicated Kenscio Review view cloned from OngageView.

**Architecture:** Eight targeted file edits plus one new view file. The parser gets a new `isKenscio` branch before the generic fallback; the view is a string-swapped clone of OngageView with Kenscio-specific rate overrides applied post-parse.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Chart.js 4, Zustand 5, Supabase

---

## File Map

| Action | File | Change |
|---|---|---|
| Modify | `src/lib/parsers.ts` | Detection flag, branch, rate fix, format enum, ESP_CONFIGS entry |
| Modify | `src/lib/data.ts` | Add Kenscio to `ESP_COLORS` |
| Modify | `src/components/views/UploadView.tsx` | Add `'Kenscio'` to `ESP_LIST` |
| Modify | `src/components/views/IPMatrixView.tsx` | Add Kenscio to `ESP_PALETTE` |
| Modify | `src/lib/types.ts` | Add `'kenscio'` to `ViewName` |
| Modify | `src/components/layout/Sidebar.tsx` | Add Kenscio nav entry to providers list |
| Modify | `src/app/page.tsx` | Import + VIEW_LABELS + route case |
| Create | `src/components/views/KenscioView.tsx` | OngageView clone with Kenscio strings + brand color |

---

## Task 1: Parser — Kenscio branch in `parsers.ts`

**Files:**
- Modify: `src/lib/parsers.ts`

### CSV column mapping (Kenscio)
```
Campaign Name → campaign-name  (normalized key)
Domain Name   → domain-name
Email-Sent    → email-sent     (recipient — used for provider domain)
Timestamp     → timestamp      (format: dd-mm-yyyy HH:MM)
Delivered     → delivered      (non-empty = 1)
Open          → open           (non-empty = 1)
Click         → click          (non-empty = 1)
Bounce        → bounce         (non-empty = 1 total bounce)
```

- [ ] **Step 1: Add `isKenscio` detection flag**

In `src/lib/parsers.ts`, find the block (around line 316–320) that reads:
```typescript
  const isMailmodo = 'campaign-name' in first || 'opens-html' in first
  const isOngage = espName === 'Ongage'
  const isNetcore = espName === 'Netcore'
  const isMMS = espName === 'MMS' || espName === 'Hotsol' || espName === '171 MailsApp'
  const isMoosend = espName === 'Moosend' || ('sent-on' in first && 'unsubscribes' in first && 'domain' in first)
```

Add one line immediately after `isMoosend`:
```typescript
  const isKenscio = espName === 'Kenscio'
```

- [ ] **Step 2: Add `'kenscio'` to the `ParseResult.format` union**

Find (around line 29):
```typescript
  format: 'mailmodo' | 'generic' | 'netcore' | 'mms' | 'moosend'
```
Replace with:
```typescript
  format: 'mailmodo' | 'generic' | 'netcore' | 'mms' | 'moosend' | 'kenscio'
```

- [ ] **Step 3: Add `kenscio` to `ESP_CONFIGS`**

Find (around line 176–181):
```typescript
  moosend: {
    stripPrefixes: [],
  },
  // Example for future ESPs:
```
Add after the `moosend` entry:
```typescript
  kenscio: {
    stripPrefixes: [],
  },
```

- [ ] **Step 4: Insert the Kenscio parsing branch**

Find the Moosend block's closing `return` and `}` (around line 576–577):
```typescript
      pd.sent += metrics.sent; pd.delivered += metrics.delivered; pd.opened += metrics.opened
      pd.clicked += metrics.clicked; pd.bounced += metrics.bounced; pd.unsubscribed += metrics.unsubscribed
      return
    }

    // ── Per-email formats (Mailmodo / generic) ──────────────────────
```

Insert the Kenscio branch between the closing `}` of Moosend and the `// ── Per-email formats` comment:
```typescript
    // ── Kenscio per-recipient format ─────────────────────────────────
    // One row per sent email. Headers (normalized):
    //   campaign-name → campaign identifier
    //   domain-name   → sending (from) domain
    //   email-sent    → recipient email
    //   timestamp     → "dd-mm-yyyy HH:MM" date
    //   delivered     → non-empty = 1 delivered
    //   open          → non-empty = 1 opened
    //   click         → non-empty = 1 clicked
    //   bounce        → non-empty = 1 bounced (hard/soft deferred)
    if (isKenscio) {
      const rawDate = row['timestamp'] || ''
      const parsed = parseDate(rawDate, false) // dd-mm-yyyy, day-first
      if (!parsed) { skipped++; skippedNoDate++; return }
      const dateStr = parsed.str
      dateYears[dateStr] = parsed.year

      const email = row['email-sent'] || ''
      if (!email) { skipped++; skippedNoEmail++; return }
      const providerDomain = extractDomain(email)
      const sendingDomain = (row['domain-name'] || 'unknown').toLowerCase().trim()

      const metrics = {
        sent:         1,
        delivered:    (row['delivered'] || '').trim() !== '' ? 1 : 0,
        opened:       (row['open'] || '').trim() !== '' ? 1 : 0,
        clicked:      (row['click'] || '').trim() !== '' ? 1 : 0,
        bounced:      (row['bounce'] || '').trim() !== '' ? 1 : 0,
        hardBounced:  0,
        softBounced:  0,
        unsubscribed: 0,
        complained:   0,
      }

      if (!byDate[dateStr]) byDate[dateStr] = { rows: 0, providers: {}, domains: {}, providerDomains: {} }
      const bucket = byDate[dateStr]
      bucket.rows++

      if (!bucket.providers[providerDomain]) bucket.providers[providerDomain] = blankMetrics()
      mergeMetrics(bucket.providers[providerDomain], metrics)

      if (!bucket.domains[sendingDomain]) bucket.domains[sendingDomain] = blankMetrics()
      mergeMetrics(bucket.domains[sendingDomain], metrics)

      if (!bucket.providerDomains[providerDomain]) bucket.providerDomains[providerDomain] = {}
      if (!bucket.providerDomains[providerDomain][sendingDomain]) {
        bucket.providerDomains[providerDomain][sendingDomain] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, hardBounced: 0, softBounced: 0, unsubscribed: 0 }
      }
      const pd = bucket.providerDomains[providerDomain][sendingDomain]
      pd.sent += metrics.sent; pd.delivered += metrics.delivered; pd.opened += metrics.opened
      pd.clicked += metrics.clicked; pd.bounced += metrics.bounced
      pd.hardBounced = (pd.hardBounced || 0) + metrics.hardBounced
      pd.softBounced = (pd.softBounced || 0) + metrics.softBounced
      pd.unsubscribed += metrics.unsubscribed
      return
    }
```

- [ ] **Step 5: Add Kenscio rate fix-up after the Moosend rate block**

Find (around line 700–710):
```typescript
  // Moosend: openRate = open/delivered, clickRate = click/delivered, unsubRate = unsub/delivered
  if (isMoosend) {
    Object.values(byDate).forEach(d => {
      const fixRates = (m: DateMetrics) => {
        m.openRate  = m.delivered > 0 ? (m.opened  / m.delivered) * 100 : 0
        m.clickRate = m.delivered > 0 ? (m.clicked / m.delivered) * 100 : 0
        m.unsubRate = m.delivered > 0 ? ((m.unsubscribed || 0) / m.delivered) * 100 : 0
      }
      Object.values(d.providers).forEach(fixRates)
      Object.values(d.domains).forEach(fixRates)
    })
  }

  const format = isMoosend ? 'moosend' : isMMS ? 'mms' : isNetcore ? 'netcore' : isMailmodo ? 'mailmodo' : 'generic'
```

Replace with:
```typescript
  // Moosend: openRate = open/delivered, clickRate = click/delivered, unsubRate = unsub/delivered
  if (isMoosend) {
    Object.values(byDate).forEach(d => {
      const fixRates = (m: DateMetrics) => {
        m.openRate  = m.delivered > 0 ? (m.opened  / m.delivered) * 100 : 0
        m.clickRate = m.delivered > 0 ? (m.clicked / m.delivered) * 100 : 0
        m.unsubRate = m.delivered > 0 ? ((m.unsubscribed || 0) / m.delivered) * 100 : 0
      }
      Object.values(d.providers).forEach(fixRates)
      Object.values(d.domains).forEach(fixRates)
    })
  }

  // Kenscio: openRate = open/delivered (default OK), clickRate = click/delivered
  if (isKenscio) {
    Object.values(byDate).forEach(d => {
      const fixRates = (m: DateMetrics) => {
        m.clickRate = m.delivered > 0 ? (m.clicked / m.delivered) * 100 : 0
      }
      Object.values(d.providers).forEach(fixRates)
      Object.values(d.domains).forEach(fixRates)
    })
  }

  const format = isKenscio ? 'kenscio' : isMoosend ? 'moosend' : isMMS ? 'mms' : isNetcore ? 'netcore' : isMailmodo ? 'mailmodo' : 'generic'
```

- [ ] **Step 6: Run the dev server and confirm no TypeScript errors**

```bash
cd "c:/Users/Leo/OneDrive/Desktop/AI Automation/Projects/ESP-Performance-Dashboard"
npm run build 2>&1 | head -40
```
Expected: no errors referencing `parsers.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/parsers.ts
git commit -m "feat(parser): add Kenscio CSV format — timestamp date, email-sent recipient, domain-name sending domain"
```

---

## Task 2: Register Kenscio color + add to upload list

**Files:**
- Modify: `src/lib/data.ts`
- Modify: `src/components/views/UploadView.tsx`

- [ ] **Step 1: Add Kenscio to `ESP_COLORS` in `data.ts`**

Find:
```typescript
export const ESP_COLORS: Record<string, string> = {
  Mailmodo: '#7c5cfc',
  Ongage: '#c67cff',
  Netcore: '#f97316',
  Hotsol: '#00e5c3',
  MMS: '#ffd166',
  '171 MailsApp': '#ff6b9d',
  Moosend: '#ff6b35',
  Omnisend: '#ff4757',
  Klaviyo: '#60d4f0',
  Brevo: '#c5f27a',
}
```
Replace with:
```typescript
export const ESP_COLORS: Record<string, string> = {
  Mailmodo: '#7c5cfc',
  Ongage: '#c67cff',
  Netcore: '#f97316',
  Hotsol: '#00e5c3',
  MMS: '#ffd166',
  '171 MailsApp': '#ff6b9d',
  Moosend: '#ff6b35',
  Omnisend: '#ff4757',
  Klaviyo: '#60d4f0',
  Brevo: '#c5f27a',
  Kenscio: '#e63946',
}
```

- [ ] **Step 2: Add `'Kenscio'` to `ESP_LIST` in `UploadView.tsx`**

Find:
```typescript
const ESP_LIST = ['Mailmodo', 'Ongage', 'Netcore', 'Hotsol', 'MMS', '171 MailsApp', 'Moosend', 'Omnisend', 'Klaviyo', 'Brevo']
```
Replace with:
```typescript
const ESP_LIST = ['Mailmodo', 'Ongage', 'Netcore', 'Hotsol', 'MMS', '171 MailsApp', 'Moosend', 'Omnisend', 'Klaviyo', 'Brevo', 'Kenscio']
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/data.ts src/components/views/UploadView.tsx
git commit -m "feat: register Kenscio color and add to upload ESP list"
```

---

## Task 3: IP Matrix — add Kenscio palette entry

**Files:**
- Modify: `src/components/views/IPMatrixView.tsx`

- [ ] **Step 1: Add Kenscio to `ESP_PALETTE`**

Find:
```typescript
const ESP_PALETTE: Record<string, { bg: string; text: string }> = {
  Mailmodo: { bg: '#7c3aed', text: '#fff' },
  Ongage:   { bg: '#059669', text: '#fff' },
  Netcore:  { bg: '#ea6f0c', text: '#fff' },
  Hotsol:   { bg: '#0891b2', text: '#fff' },
  MMS:      { bg: '#dc2626', text: '#fff' },
  Moosend:  { bg: '#db2777', text: '#fff' },
  Omnisend: { bg: '#d97706', text: '#fff' },
  Klaviyo:  { bg: '#0369a1', text: '#fff' },
  Brevo:    { bg: '#065f46', text: '#fff' },
}
```
Replace with:
```typescript
const ESP_PALETTE: Record<string, { bg: string; text: string }> = {
  Mailmodo: { bg: '#7c3aed', text: '#fff' },
  Ongage:   { bg: '#059669', text: '#fff' },
  Netcore:  { bg: '#ea6f0c', text: '#fff' },
  Hotsol:   { bg: '#0891b2', text: '#fff' },
  MMS:      { bg: '#dc2626', text: '#fff' },
  Moosend:  { bg: '#db2777', text: '#fff' },
  Omnisend: { bg: '#d97706', text: '#fff' },
  Klaviyo:  { bg: '#0369a1', text: '#fff' },
  Brevo:    { bg: '#065f46', text: '#fff' },
  Kenscio:  { bg: '#e63946', text: '#fff' },
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/views/IPMatrixView.tsx
git commit -m "feat(ip-matrix): add Kenscio palette entry"
```

---

## Task 4: Types + Sidebar — ViewName and nav entry

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add `'kenscio'` to `ViewName` in `types.ts`**

Find:
```typescript
export type ViewName =
  | 'home'
  | 'dashboard'
  | 'performance'
  | 'daily'
  | 'mailmodo'
  | 'ongage'
  | 'netcore'
  | 'mms'
  | 'hotsol'
  | '171mailsapp'
  | 'upload'
  | 'matrix'
  | 'datamgmt'
  | 'ipmatrix'
  | 'logs'
  | 'analytics'
  | 'moosend'
```
Replace with:
```typescript
export type ViewName =
  | 'home'
  | 'dashboard'
  | 'performance'
  | 'daily'
  | 'mailmodo'
  | 'ongage'
  | 'netcore'
  | 'mms'
  | 'hotsol'
  | '171mailsapp'
  | 'upload'
  | 'matrix'
  | 'datamgmt'
  | 'ipmatrix'
  | 'logs'
  | 'analytics'
  | 'moosend'
  | 'kenscio'
```

- [ ] **Step 2: Add Kenscio to the providers list in `Sidebar.tsx`**

Find the providers list array (inside the `{providersOpen && (` block):
```typescript
                  { id: 'moosend' as ViewName, label: 'Moosend Review', color: '#ff6b35' },
                ].map(item => {
```
Replace with:
```typescript
                  { id: 'moosend' as ViewName, label: 'Moosend Review', color: '#ff6b35' },
                  { id: 'kenscio' as ViewName, label: 'Kenscio Review', color: '#e63946' },
                ].map(item => {
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts src/components/layout/Sidebar.tsx
git commit -m "feat: add kenscio ViewName and sidebar nav entry"
```

---

## Task 5: Page routing — import, label, route case

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add the import**

Find (near top of `page.tsx`):
```typescript
import AnalyticsView from '@/components/views/AnalyticsView'
```
Add immediately after:
```typescript
import KenscioView from '@/components/views/KenscioView'
```

- [ ] **Step 2: Add the VIEW_LABELS entry**

Find:
```typescript
  analytics: 'Analytics', moosend: 'Moosend Review',
```
Replace with:
```typescript
  analytics: 'Analytics', moosend: 'Moosend Review', kenscio: 'Kenscio Review',
```

- [ ] **Step 3: Add the route case**

In `page.tsx`, find the view routing switch. Search for the pattern `case 'moosend'` or where views are rendered. The pattern looks like a series of ternaries or a switch. Find:
```typescript
activeView === 'moosend' ? <OngageView />
```
or wherever `moosend` renders its component — add a parallel entry for `kenscio`:

Search for the rendering block. It will follow the pattern of other ESP views. Add:
```typescript
activeView === 'kenscio' ? <KenscioView /> :
```
immediately before the final fallback (`null` or `<HomeView />`).

> Note: read `page.tsx` lines 200–300 to locate the exact render block before editing.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(routing): add Kenscio view route and label"
```

---

## Task 6: Create `KenscioView.tsx`

**Files:**
- Create: `src/components/views/KenscioView.tsx`

- [ ] **Step 1: Copy OngageView as the starting point**

```bash
cp "src/components/views/OngageView.tsx" "src/components/views/KenscioView.tsx"
```

- [ ] **Step 2: Replace the function name and all `'Ongage'` string references**

In `KenscioView.tsx`, make these exact replacements:

| Old | New |
|---|---|
| `export default function OngageView()` | `export default function KenscioView()` |
| `allEsps.filter(e => e === 'Ongage')` | `allEsps.filter(e => e === 'Kenscio')` |
| `'Ongage Review'` | `'Kenscio Review'` |
| `'No Ongage data yet'` | `'No Kenscio data yet'` |
| `'Upload an Ongage file via Upload Report to see data here.'` | `'Upload a Kenscio file via Upload Report to see data here.'` |

All comment-only references to "Ongage" (lines with `// Ongage`) can be updated to "Kenscio" for clarity but are not functionally required.

- [ ] **Step 3: Update the brand accent color**

In `KenscioView.tsx`, the OngageView uses `'#7c5cfc'` as the delivered/primary chart color in `VOL_COLORS` and `RATE_COLORS`. Find:

```typescript
const VOL_COLORS  = { sent: '#6b7280', delivered: '#7c5cfc', opened: '#00e5c3', clicked: '#ffd166' }
const RATE_COLORS = { successRate: '#7c5cfc', openRate: '#00e5c3', clickRate: '#ffd166', bounceRate: '#ff4757' }
```

Replace with:
```typescript
const VOL_COLORS  = { sent: '#6b7280', delivered: '#e63946', opened: '#00e5c3', clicked: '#ffd166' }
const RATE_COLORS = { successRate: '#e63946', openRate: '#00e5c3', clickRate: '#ffd166', bounceRate: '#ff4757' }
```

- [ ] **Step 4: Update KPI formula labels and colors**

The `KPI_DEFS` in OngageView already uses Kenscio-compatible formulas (Open÷Delivered, Click÷Delivered, Bounce÷Sent). Only change the brand color reference where `'#7c5cfc'` appears inside `KPI_DEFS` or `GRID_KPIS`:

Find in `GRID_KPIS`:
```typescript
  { key: 'deliveryRate' as keyof DateMetrics, label: 'Success%', color: '#b39dff', lightColor: '#7c5cfc', ...
```
Replace `lightColor: '#7c5cfc'` with `lightColor: '#e63946'`:
```typescript
  { key: 'deliveryRate' as keyof DateMetrics, label: 'Success%', color: '#b39dff', lightColor: '#e63946', ...
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -50
```
Expected: no errors. If `page.tsx` cannot find `KenscioView`, confirm the import path is correct (`@/components/views/KenscioView`).

- [ ] **Step 6: Commit**

```bash
git add src/components/views/KenscioView.tsx
git commit -m "feat(view): add KenscioView — OngageView clone with Kenscio brand color and strings"
```

---

## Task 7: End-to-end verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```
Open `http://localhost:3000`.

- [ ] **Step 2: Verify Kenscio appears in the Upload dropdown**

Go to **Upload Report** → open the ESP dropdown → confirm `Kenscio` is in the list.

- [ ] **Step 3: Upload the sample CSV**

Select ESP = `Kenscio`, upload `csv/Kenscio - 01042026-09042026.csv`. Confirm:
- Parse log shows rows processed, no "no-date" or "no-email" skip warnings
- Dates parsed correctly (e.g. `Apr 01`, `Apr 02`, etc.)

- [ ] **Step 4: Verify Kenscio Review view**

Click **Kenscio Review** in the sidebar. Confirm:
- KPI cards show non-zero Sent, Delivered, Opens, Clicks, Bounces
- Open Rate = Opens ÷ Delivered × 100 (verify manually: pick one date, cross-check with raw CSV count)
- Click Rate = Clicks ÷ Delivered × 100
- Charts render without console errors

- [ ] **Step 5: Verify IP Matrix**

Go to **IPs Matrix** → add a test record with ESP = `Kenscio`. Confirm the Kenscio badge shows in red (`#e63946`).

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: Kenscio ESP integration complete — parser, upload, IP matrix, sidebar, view"
```
