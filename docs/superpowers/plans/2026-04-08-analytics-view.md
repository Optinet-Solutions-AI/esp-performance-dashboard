# Analytics View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone Analytics view with ISP / Domain / IP tabs, date range filtering, sortable/filterable tables with sparklines and KPI summary rows.

**Architecture:** A single `AnalyticsView.tsx` reads from the existing Zustand store (`espData`, `ipmData`) — no new parsing or Supabase changes needed. Each tab converts existing `ProviderData` records into a flat `AnalyticsRow[]` array, then sorts/filters them in local state. Sparklines are inline SVGs.

**Tech Stack:** React 19, TypeScript, Tailwind CSS (minimal — mostly inline styles matching codebase pattern), Zustand store, existing `aggDates` / `getEspStatus` utils.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/types.ts` | Add `'analytics'` to `ViewName` union |
| Modify | `src/components/layout/Sidebar.tsx` | Add Analytics nav item under Tools |
| Modify | `src/app/page.tsx` | Add label, import, and view case |
| Create | `src/components/views/AnalyticsView.tsx` | Full Analytics view |

---

## Task 1: Add `'analytics'` to ViewName

**Files:**
- Modify: `src/lib/types.ts:112-126`

- [ ] **Step 1: Edit ViewName union**

Open `src/lib/types.ts`. Change:

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
  | 'upload'
  | 'matrix'
  | 'datamgmt'
  | 'ipmatrix'
  | 'logs'
```

To:

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
  | 'upload'
  | 'matrix'
  | 'datamgmt'
  | 'ipmatrix'
  | 'logs'
  | 'analytics'
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd esp-dashboard && npx tsc --noEmit`
Expected: No errors (or same errors as before — don't introduce new ones).

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add analytics to ViewName type"
```

---

## Task 2: Add Analytics nav item to Sidebar

**Files:**
- Modify: `src/components/layout/Sidebar.tsx:173-178`

- [ ] **Step 1: Add icon definition**

In `Sidebar.tsx`, after the existing icon definitions (around line 85), add the analytics icon:

```typescript
const iconAnalytics = <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ width: 18, height: 18 }}><rect x="1.5" y="9.5" width="3" height="7" rx="1" /><rect x="7" y="5.5" width="3" height="11" rx="1" /><rect x="12.5" y="2" width="3" height="14.5" rx="1" /></svg>
```

- [ ] **Step 2: Add NavItem under Tools section**

In `Sidebar.tsx`, find the Tools section (around line 173–178):

```typescript
<SectionLabel text="Tools" />
<NavItem id="upload" label="Upload Report" icon={iconUp} />
<NavItem id="matrix" label="ESP Deliverability" icon={iconGrid} />
<NavItem id="datamgmt" label="Data Management" icon={iconDb} />
<NavItem id="ipmatrix" label="IPs Matrix" icon={iconIP} />
<NavItem id="logs" label="Logs" icon={iconChart} />
```

Change to:

```typescript
<SectionLabel text="Tools" />
<NavItem id="analytics" label="Analytics" icon={iconAnalytics} />
<NavItem id="upload" label="Upload Report" icon={iconUp} />
<NavItem id="matrix" label="ESP Deliverability" icon={iconGrid} />
<NavItem id="datamgmt" label="Data Management" icon={iconDb} />
<NavItem id="ipmatrix" label="IPs Matrix" icon={iconIP} />
<NavItem id="logs" label="Logs" icon={iconChart} />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: add Analytics nav item to sidebar"
```

---

## Task 3: Wire Analytics view in page.tsx

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add VIEW_LABELS entry**

In `page.tsx`, find the `VIEW_LABELS` object (line 21) and add:

```typescript
const VIEW_LABELS: Record<string, string> = {
  home: 'Overview', dashboard: 'Dashboard', mailmodo: 'Mailmodo Review',
  ongage: 'Ongage Review', netcore: 'Netcore Review', mms: 'MMS Review', upload: 'Upload Report',
  matrix: 'ESP Deliverability Matrix', datamgmt: 'Data Management',
  ipmatrix: 'IPs Matrix', performance: 'Performance',
  logs: 'Activity Logs', daily: 'Daily Report',
  analytics: 'Analytics',
}
```

- [ ] **Step 2: Add import**

After the existing view imports (around line 19), add:

```typescript
import AnalyticsView from '@/components/views/AnalyticsView'
```

- [ ] **Step 3: Add view case**

In the `<main>` section (around line 204), after `{activeView === 'logs' && <LogsView />}`, add:

```typescript
{activeView === 'analytics' && <AnalyticsView />}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: wire AnalyticsView into page router"
```

---

## Task 4: Create AnalyticsView.tsx

**Files:**
- Create: `src/components/views/AnalyticsView.tsx`

This task creates the complete view. Build it in sub-steps.

### Step 4a — Scaffold with ESP selector and date range

- [ ] **Step 1: Create the file with skeleton**

Create `src/components/views/AnalyticsView.tsx`:

```typescript
'use client'
import { useState, useMemo } from 'react'
import { useDashboardStore } from '@/lib/store'
import { aggDates, fmtN, fmtP, getEspStatus } from '@/lib/utils'
import CalendarPicker from '@/components/ui/CalendarPicker'
import type { ProviderData } from '@/lib/types'

// ── Types ────────────────────────────────────────────────────────
type AnalyticsTab = 'isp' | 'domain' | 'ip'
type SortCol = 'entity' | 'sent' | 'delivered' | 'deliveryRate' | 'opened' | 'openRate'
  | 'clicked' | 'clickRate' | 'bounced' | 'bounceRate' | 'unsub' | 'complaintRate'
type TopN = 10 | 25 | 50 | 'all'

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

// ── Sparkline ────────────────────────────────────────────────────
function Sparkline({ data, isLight }: { data: number[]; isLight: boolean }) {
  if (data.length < 2) return <span style={{ color: isLight ? '#9ca3af' : '#4a5568', fontSize: 11 }}>—</span>

  const W = 64, H = 24
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - ((v - min) / range) * (H - 4) - 2
    return `${x},${y}`
  }).join(' ')

  const last = data[data.length - 1]
  const color = last >= 95 ? '#00e5c3' : last >= 70 ? '#ffd166' : '#ff4757'

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ── Row builder ──────────────────────────────────────────────────
function buildRows(
  source: Record<string, ProviderData>,
  selectedDates: string[],
): AnalyticsRow[] {
  return Object.entries(source).flatMap(([entity, provData]) => {
    const agg = aggDates(provData.byDate, selectedDates)
    if (!agg) return []
    const trendData = selectedDates
      .map(d => {
        const m = provData.byDate[d]
        return m?.deliveryRate ?? null
      })
      .filter((v): v is number => v !== null)

    return [{
      entity,
      sent: agg.sent,
      delivered: agg.delivered,
      deliveryRate: agg.deliveryRate,
      opened: agg.opened,
      openRate: agg.openRate,
      clicked: agg.clicked,
      clickRate: agg.clickRate,
      bounced: agg.bounced,
      bounceRate: agg.bounceRate,
      unsub: agg.unsubscribed ?? 0,
      complaintRate: agg.complaintRate ?? 0,
      trendData,
    }]
  })
}

// ── KPI summary row ──────────────────────────────────────────────
function KpiSummary({ rows, isLight }: { rows: AnalyticsRow[]; isLight: boolean }) {
  const totalSent = rows.reduce((s, r) => s + r.sent, 0)
  const totalDel  = rows.reduce((s, r) => s + r.delivered, 0)
  const totalOpen = rows.reduce((s, r) => s + r.opened, 0)
  const totalClk  = rows.reduce((s, r) => s + r.clicked, 0)
  const totalBnc  = rows.reduce((s, r) => s + r.bounced, 0)

  const deliveryRate   = totalSent > 0 ? (totalDel / totalSent) * 100 : 0
  const openRate       = totalDel  > 0 ? (totalOpen / totalDel) * 100 : 0
  const clickRate      = totalOpen > 0 ? (totalClk / totalOpen) * 100 : 0
  const bounceRate     = totalSent > 0 ? (totalBnc / totalSent) * 100 : 0

  const cardBg     = isLight ? '#ffffff' : '#151a22'
  const cardBorder = isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)'
  const labelColor = isLight ? '#6b7280' : '#6b7280'
  const valColor   = isLight ? '#111827' : '#f0f2f5'

  const kpis = [
    { label: 'Sent',           value: fmtN(totalSent),        color: '#a8b0be' },
    { label: 'Delivery Rate',  value: fmtP(deliveryRate),     color: '#7c5cfc' },
    { label: 'Open Rate',      value: fmtP(openRate),         color: '#00e5c3' },
    { label: 'Click Rate',     value: fmtP(clickRate),        color: '#ffd166' },
    { label: 'Bounce Rate',    value: fmtP(bounceRate),       color: bounceRate > 10 ? '#ff4757' : bounceRate > 2 ? '#ffd166' : '#00e5c3' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
      {kpis.map(k => (
        <div key={k.label} style={{
          background: cardBg, border: `1px solid ${cardBorder}`,
          borderRadius: 12, padding: '14px 16px',
        }}>
          <div style={{ fontSize: 9, fontFamily: 'Space Mono, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: labelColor, marginBottom: 6 }}>
            {k.label}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: k.color, letterSpacing: '-0.02em' }}>
            {k.value}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main view ────────────────────────────────────────────────────
export default function AnalyticsView() {
  const { espData, ipmData, isLight } = useDashboardStore()

  const espNames = Object.keys(espData)
  const [selectedEsp, setSelectedEsp] = useState<string>(espNames[0] ?? '')
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('isp')
  const [sortCol, setSortCol]     = useState<SortCol>('sent')
  const [sortDir, setSortDir]     = useState<1 | -1>(-1)
  const [searchQ, setSearchQ]     = useState('')
  const [topN, setTopN]           = useState<TopN>(25)

  const mmData = espData[selectedEsp]
  const allDates   = mmData?.dates ?? []
  const datesFull  = mmData?.datesFull ?? []

  // Date range state — ISO strings
  const firstIso = datesFull[0]?.iso ?? ''
  const lastIso  = datesFull[datesFull.length - 1]?.iso ?? ''
  const [fromIso, setFromIso] = useState<string>(firstIso)
  const [toIso,   setToIso]   = useState<string>(lastIso)

  // When ESP changes, reset date range to full range
  function handleEspChange(name: string) {
    setSelectedEsp(name)
    const df = espData[name]?.datesFull ?? []
    setFromIso(df[0]?.iso ?? '')
    setToIso(df[df.length - 1]?.iso ?? '')
    setSortCol('sent')
    setSortDir(-1)
    setSearchQ('')
  }

  // Derive selected dates from ISO range
  const selectedDates = useMemo(() => {
    if (!fromIso || !toIso) return allDates
    const lo = fromIso < toIso ? fromIso : toIso
    const hi = fromIso < toIso ? toIso   : fromIso
    return allDates.filter(label => {
      const df = datesFull.find(d => d.label === label)
      if (!df?.iso) return true
      return df.iso >= lo && df.iso <= hi
    })
  }, [allDates, datesFull, fromIso, toIso])

  // Build raw rows for active tab
  const rawRows = useMemo((): AnalyticsRow[] => {
    if (!mmData) return []
    if (activeTab === 'isp')    return buildRows(mmData.providers, selectedDates)
    if (activeTab === 'domain') return buildRows(mmData.domains,   selectedDates)
    // IP tab: join ipmData with domain metrics
    const espIps = ipmData.filter(r => r.esp === selectedEsp)
    return espIps.flatMap(rec => {
      const domainData = mmData.domains[rec.domain]
      if (!domainData) {
        return [{
          entity: rec.ip,
          sent: 0, delivered: 0, deliveryRate: 0, opened: 0, openRate: 0,
          clicked: 0, clickRate: 0, bounced: 0, bounceRate: 0,
          unsub: 0, complaintRate: 0, trendData: [],
        }]
      }
      const agg = aggDates(domainData.byDate, selectedDates)
      if (!agg) return [{
        entity: rec.ip,
        sent: 0, delivered: 0, deliveryRate: 0, opened: 0, openRate: 0,
        clicked: 0, clickRate: 0, bounced: 0, bounceRate: 0,
        unsub: 0, complaintRate: 0, trendData: [],
      }]
      const trendData = selectedDates
        .map(d => domainData.byDate[d]?.deliveryRate ?? null)
        .filter((v): v is number => v !== null)
      return [{
        entity: rec.ip,
        sent: agg.sent, delivered: agg.delivered, deliveryRate: agg.deliveryRate,
        opened: agg.opened, openRate: agg.openRate,
        clicked: agg.clicked, clickRate: agg.clickRate,
        bounced: agg.bounced, bounceRate: agg.bounceRate,
        unsub: agg.unsubscribed ?? 0, complaintRate: agg.complaintRate ?? 0,
        trendData,
      }]
    })
  }, [mmData, activeTab, selectedDates, ipmData, selectedEsp])

  // Sort
  const sorted = useMemo(() => {
    return [...rawRows].sort((a, b) => {
      const av = a[sortCol]
      const bv = b[sortCol]
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * sortDir
      return ((av as number) - (bv as number)) * sortDir
    })
  }, [rawRows, sortCol, sortDir])

  // Filter by search
  const searched = useMemo(() => {
    if (!searchQ.trim()) return sorted
    const q = searchQ.toLowerCase()
    return sorted.filter(r => r.entity.toLowerCase().includes(q))
  }, [sorted, searchQ])

  // Apply Top N
  const displayed = useMemo(() => {
    if (topN === 'all') return searched
    return searched.slice(0, topN)
  }, [searched, topN])

  // Sort handler
  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 1 ? -1 : 1)
    else { setSortCol(col); setSortDir(-1) }
  }

  // ── Colors ──
  const bg         = isLight ? '#f0f2f6' : '#0a0c10'
  const cardBg     = isLight ? '#ffffff' : '#151a22'
  const cardBorder = isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)'
  const textColor  = isLight ? '#374151' : '#c8cdd6'
  const mutedColor = isLight ? '#9ca3af' : '#6b7280'
  const headerBg   = isLight ? '#f9fafb' : '#0e1116'
  const rowHover   = isLight ? '#f9fafb' : '#181c22'
  const borderColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)'
  const activeAccent = isLight ? '#0d9488' : '#00e5c3'
  const inputBg    = isLight ? '#ffffff' : '#1a1f28'
  const inputBorder = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)'

  const TABS: { id: AnalyticsTab; label: string }[] = [
    { id: 'isp',    label: 'ISP' },
    { id: 'domain', label: 'Domain' },
    { id: 'ip',     label: 'IP' },
  ]

  const TOP_N_OPTIONS: { value: TopN; label: string }[] = [
    { value: 10, label: 'Top 10' },
    { value: 25, label: 'Top 25' },
    { value: 50, label: 'Top 50' },
    { value: 'all', label: 'All' },
  ]

  type ColDef = { key: SortCol; label: string; align?: 'right' }
  const COLS: ColDef[] = [
    { key: 'entity',       label: activeTab === 'isp' ? 'ISP' : activeTab === 'domain' ? 'Domain' : 'IP' },
    { key: 'sent',         label: 'Sent',       align: 'right' },
    { key: 'delivered',    label: 'Delivered',  align: 'right' },
    { key: 'deliveryRate', label: 'Del. Rate',  align: 'right' },
    { key: 'opened',       label: 'Opened',     align: 'right' },
    { key: 'openRate',     label: 'Open Rate',  align: 'right' },
    { key: 'clicked',      label: 'Clicked',    align: 'right' },
    { key: 'clickRate',    label: 'Click Rate', align: 'right' },
    { key: 'bounced',      label: 'Bounced',    align: 'right' },
    { key: 'bounceRate',   label: 'Bounce %',   align: 'right' },
    { key: 'unsub',        label: 'Unsub',      align: 'right' },
    { key: 'complaintRate',label: 'Complaint%', align: 'right' },
  ]

  function bounceCellStyle(rate: number) {
    const status = getEspStatus(rate, 100)
    if (status === 'critical') return { color: '#ff4757', background: 'rgba(255,71,87,0.08)' }
    if (status === 'warn')     return { color: isLight ? '#b45309' : '#ffd166', background: 'rgba(255,209,102,0.08)' }
    return { color: isLight ? '#0d9488' : '#00e5c3', background: 'rgba(0,229,195,0.08)' }
  }

  function cellVal(row: AnalyticsRow, key: SortCol): React.ReactNode {
    const v = row[key]
    if (key === 'entity') return <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11 }}>{row.entity}</span>
    if (key === 'deliveryRate' || key === 'openRate' || key === 'clickRate' || key === 'complaintRate') {
      if (row.sent === 0) return <span style={{ color: mutedColor }}>—</span>
      return fmtP(v as number)
    }
    if (key === 'bounceRate') {
      if (row.sent === 0) return <span style={{ color: mutedColor }}>—</span>
      const s = bounceCellStyle(v as number)
      return (
        <span style={{ ...s, padding: '2px 6px', borderRadius: 6, fontSize: 11, fontFamily: 'Space Mono, monospace', fontWeight: 600 }}>
          {fmtP(v as number)}
        </span>
      )
    }
    if (row.sent === 0) return <span style={{ color: mutedColor }}>—</span>
    return fmtN(v as number)
  }

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sortCol !== col) return <span style={{ opacity: 0.25, marginLeft: 4, fontSize: 9 }}>↕</span>
    return <span style={{ marginLeft: 4, fontSize: 9, color: activeAccent }}>{sortDir === -1 ? '↓' : '↑'}</span>
  }

  if (espNames.length === 0) {
    return (
      <div style={{ padding: 40, color: mutedColor, fontFamily: 'Space Mono, monospace', fontSize: 13 }}>
        No ESP data loaded. Upload a report first.
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 28px', background: bg, minHeight: '100vh' }}>

      {/* ── Header controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {/* ESP selector */}
        <select
          value={selectedEsp}
          onChange={e => handleEspChange(e.target.value)}
          style={{
            background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: 10,
            color: textColor, fontSize: 13, fontWeight: 600, padding: '8px 12px',
            cursor: 'pointer', outline: 'none',
          }}
        >
          {espNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        {/* Date range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarPicker
            value={fromIso}
            onChange={setFromIso}
            isLight={isLight}
            rangeStart={fromIso}
            rangeEnd={toIso}
          />
          <span style={{ color: mutedColor, fontSize: 12 }}>→</span>
          <CalendarPicker
            value={toIso}
            onChange={setToIso}
            isLight={isLight}
            rangeStart={fromIso}
            rangeEnd={toIso}
            align="right"
          />
        </div>

        <span style={{ fontSize: 11, color: mutedColor, fontFamily: 'Space Mono, monospace' }}>
          {selectedDates.length} day{selectedDates.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSortCol('sent'); setSortDir(-1); setSearchQ('') }}
              style={{
                padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: active ? 600 : 400,
                background: active ? (isLight ? '#0d9488' : '#00e5c3') : cardBg,
                color: active ? (isLight ? '#ffffff' : '#0a0c10') : textColor,
                border: `1px solid ${active ? 'transparent' : cardBorder}`,
                transition: 'all 0.12s',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── KPI row ── */}
      <KpiSummary rows={displayed} isLight={isLight} />

      {/* ── Filter bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <input
          type="text"
          placeholder={`Search ${activeTab === 'isp' ? 'ISP' : activeTab === 'domain' ? 'domain' : 'IP'}…`}
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          style={{
            background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: 8,
            color: textColor, fontSize: 12, padding: '7px 12px', outline: 'none',
            fontFamily: 'Space Mono, monospace', width: 220,
          }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {TOP_N_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTopN(opt.value)}
              style={{
                padding: '6px 12px', borderRadius: 8, border: `1px solid ${topN === opt.value ? activeAccent : inputBorder}`,
                background: topN === opt.value ? (isLight ? 'rgba(13,148,128,0.1)' : 'rgba(0,229,195,0.08)') : 'transparent',
                color: topN === opt.value ? activeAccent : mutedColor,
                fontSize: 11, fontFamily: 'Space Mono, monospace', cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: mutedColor, fontFamily: 'Space Mono, monospace', marginLeft: 'auto' }}>
          {displayed.length} / {rawRows.length} rows
        </span>
      </div>

      {/* ── Table ── */}
      <div style={{
        background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14,
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: headerBg }}>
                {COLS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    style={{
                      padding: '10px 14px', textAlign: col.align ?? 'left',
                      fontSize: 10, fontFamily: 'Space Mono, monospace', letterSpacing: '0.1em',
                      textTransform: 'uppercase', color: sortCol === col.key ? activeAccent : mutedColor,
                      cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
                      borderBottom: `1px solid ${borderColor}`,
                    }}
                  >
                    {col.label}<SortIcon col={col.key} />
                  </th>
                ))}
                <th style={{
                  padding: '10px 14px', textAlign: 'center',
                  fontSize: 10, fontFamily: 'Space Mono, monospace', letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: mutedColor, whiteSpace: 'nowrap',
                  borderBottom: `1px solid ${borderColor}`,
                }}>
                  Trend
                </th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan={COLS.length + 1} style={{ padding: '40px 14px', textAlign: 'center', color: mutedColor, fontFamily: 'Space Mono, monospace', fontSize: 12 }}>
                    No data for selected range
                  </td>
                </tr>
              ) : displayed.map((row, i) => (
                <tr
                  key={row.entity + i}
                  style={{
                    borderBottom: `1px solid ${borderColor}`,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = rowHover }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                >
                  {COLS.map(col => (
                    <td
                      key={col.key}
                      style={{
                        padding: '10px 14px',
                        textAlign: col.align ?? 'left',
                        color: textColor,
                        whiteSpace: 'nowrap',
                        fontFamily: col.key !== 'entity' ? 'Space Mono, monospace' : undefined,
                        fontSize: col.key !== 'entity' ? 11 : 12,
                      }}
                    >
                      {cellVal(row, col.key)}
                    </td>
                  ))}
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <Sparkline data={row.trendData} isLight={isLight} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd esp-dashboard && npx tsc --noEmit`
Expected: Exit 0 with no new errors.

- [ ] **Step 3: Start dev server and manually verify**

Run: `cd esp-dashboard && npm run dev`

Open http://localhost:3000 and:
1. Click "Analytics" in the sidebar — view renders without crash
2. Select an ESP from the dropdown — tables populate
3. Switch between ISP / Domain / IP tabs — each tab loads data
4. Sort by Bounce % column — rows reorder
5. Type in the search box — rows filter
6. Click Top 10 / 25 / 50 / All — row count changes
7. Change date range with calendar pickers — data updates
8. KPI row reflects the displayed rows (not all rows)
9. Toggle dark/light mode — colors update correctly

- [ ] **Step 4: Commit**

```bash
git add src/components/views/AnalyticsView.tsx
git commit -m "feat: add AnalyticsView with ISP/Domain/IP tabs, sorting, filtering, sparklines"
```

---

## Self-Review Checklist

- [x] `'analytics'` added to ViewName — Task 1
- [x] Sidebar nav entry — Task 2
- [x] `VIEW_LABELS` + import + case in page.tsx — Task 3
- [x] ESP selector — Task 4a
- [x] Date range filter (CalendarPicker × 2) — Task 4a
- [x] Three tabs (ISP / Domain / IP) — Task 4a
- [x] KPI summary row (Sent, Del Rate, Open Rate, Click Rate, Bounce Rate) — KpiSummary component
- [x] KPIs reflect displayed rows — KpiSummary receives `displayed` not `rawRows`
- [x] Text search filter — Task 4a
- [x] Top N filter (10 / 25 / 50 / All) — Task 4a
- [x] All 12 metric columns — COLS array
- [x] Sortable by any column — handleSort
- [x] Bounce rate color-coded (healthy/warn/critical) — bounceCellStyle
- [x] Trend sparkline — Sparkline SVG component
- [x] IP tab uses ipmData joined with domain metrics — buildRows for IP case
- [x] IP rows with no data show `—` — zero-sent guard in cellVal
- [x] Empty state message — "No data for selected range"
- [x] No ESP data loaded state — "No ESP data loaded. Upload a report first."
- [x] Light/dark mode — all colors conditioned on `isLight`
