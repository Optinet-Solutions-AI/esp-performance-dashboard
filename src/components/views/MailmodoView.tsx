'use client'
import { useEffect, useRef, useState } from 'react'
import { Chart } from 'chart.js/auto'
import { useDashboardStore } from '@/lib/store'
import { aggDates, fmtN, fmtP, getGridColor, getTextColor, CHART_TOOLTIP_OPTS } from '@/lib/utils'
import { PROVIDER_COLORS, DOMAIN_COLORS, IP_COLOR_PALETTE, ESP_COLORS } from '@/lib/data'
import type { MmData, MmTabType, DateMetrics } from '@/lib/types'
import CalendarPicker from '@/components/ui/CalendarPicker'

/* ─────────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────────── */
const EMPTY: MmData = {
  dates: [], datesFull: [], providers: {}, domains: {}, overallByDate: {}, providerDomains: {},
}
const VOL_COLORS  = { sent: '#6b7280', delivered: '#7c5cfc', opened: '#00e5c3', clicked: '#ffd166' }
const RATE_COLORS = { successRate: '#7c5cfc', openRate: '#00e5c3', clickRate: '#ffd166', bounceRate: '#ff4757' }
const KPI_DEFS = [
  { key: 'openRate'   as keyof DateMetrics, label: 'Open Rate %',   color: '#00e5c3' },
  { key: 'clickRate'  as keyof DateMetrics, label: 'CTR %',         color: '#ffd166' },
  { key: 'bounceRate' as keyof DateMetrics, label: 'Bounce Rate %', color: '#ff4757' },
  { key: 'unsubRate'  as keyof DateMetrics, label: 'Unsub Rate %',  color: '#ff9a5c' },
]
const GRID_KPIS = [
  { key: 'deliveryRate' as keyof DateMetrics, label: 'Sr%',  color: '#b39dff' },
  { key: 'openRate'     as keyof DateMetrics, label: 'Or%',  color: '#00ffd5' },
  { key: 'clickRate'    as keyof DateMetrics, label: 'Ctr%', color: '#ffe066' },
  { key: 'bounceRate'   as keyof DateMetrics, label: 'Br%',  color: '#ff6b77' },
  { key: 'unsubRate'    as keyof DateMetrics, label: 'Ubr%', color: '#ff9a5c' },
]
const BAD_METRICS = new Set(['bounceRate', 'unsubRate'])

/* ─────────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────────── */
type Granularity = 'daily' | 'weekly' | 'monthly'
type EmbedView   = 'date' | 'provider'
interface DateGroup { label: string; dates: string[] }

/* ─────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────── */
function lds(label: string, data: (number | null)[], color: string, dash?: number[]) {
  return {
    label, data,
    borderColor: color,
    backgroundColor: color + '18',
    borderWidth: 1.5,
    tension: 0.35,
    pointRadius: 2,
    pointHoverRadius: 5,
    fill: false,
    borderDash: dash ?? [],
  }
}

function rateDs(label: string, data: (number | null)[], color: string, dash?: number[]) {
  return {
    label, data,
    borderColor: color,
    backgroundColor: color + '28',
    borderWidth: 2,
    tension: 0.4,
    pointRadius: 4,
    pointHoverRadius: 7,
    pointBackgroundColor: color,
    pointBorderColor: color,
    fill: 'origin' as const,
    borderDash: dash ?? [],
  }
}

function groupDates(
  dates: string[],
  gran: Granularity,
  datesFull: { label: string; year: number; iso: string }[],
): DateGroup[] {
  if (gran === 'daily') return dates.map(d => ({ label: d, dates: [d] }))

  const isoMap: Record<string, string> = {}
  datesFull.forEach(df => { if (df.iso) isoMap[df.label] = df.iso })

  if (gran === 'weekly') {
    const groups: DateGroup[] = []
    for (const d of dates) {
      const iso = isoMap[d]
      if (!iso) { groups.push({ label: d, dates: [d] }); continue }
      const dt        = new Date(iso + 'T00:00:00')
      const wStart    = new Date(dt)
      wStart.setDate(dt.getDate() - dt.getDay())
      const wKey      = wStart.toISOString().slice(0, 10)
      const last      = groups[groups.length - 1]
      // Store wKey as a temp identifier on first date, then compare
      if (last && (last as DateGroup & { _wKey?: string })._wKey === wKey) {
        last.dates.push(d)
      } else {
        const g: DateGroup & { _wKey?: string } = { label: d, dates: [d], _wKey: wKey }
        groups.push(g)
      }
    }
    // Clean up temp key
    groups.forEach(g => { delete (g as DateGroup & { _wKey?: string })._wKey })
    return groups
  }

  if (gran === 'monthly') {
    const map = new Map<string, DateGroup>()
    for (const d of dates) {
      const df = datesFull.find(x => x.label === d)
      if (!df) continue
      const [mon]  = d.split(' ')
      const key    = `${mon} ${df.year}`
      if (!map.has(key)) map.set(key, { label: key, dates: [] })
      map.get(key)!.dates.push(d)
    }
    return Array.from(map.values())
  }

  return dates.map(d => ({ label: d, dates: [d] }))
}

function minMaxHeat(kpiKey: string, val: number, minV: number, maxV: number): string {
  if (maxV === minV) return 'transparent'
  let score = (val - minV) / (maxV - minV)
  if (BAD_METRICS.has(kpiKey)) score = 1 - score
  if (score >= 0.75) return 'rgba(0,229,195,0.14)'
  if (score >= 0.5)  return 'rgba(0,229,195,0.07)'
  if (score <= 0.25) return 'rgba(255,71,87,0.16)'
  if (score <= 0.5)  return 'rgba(255,160,60,0.10)'
  return 'transparent'
}

function trendArrow(cur: number | null, prev: number | null, kpiKey: string) {
  if (cur == null || prev == null) return null
  const diff = cur - prev
  if (Math.abs(diff) < 0.01) return null
  const good = BAD_METRICS.has(kpiKey) ? diff < 0 : diff > 0
  return { arrow: good ? '▲' : '▼', color: good ? '#00e5c3' : '#ff4757' }
}

function destroyAll(ref: React.MutableRefObject<(Chart | null)[]>) {
  ref.current.forEach(c => c?.destroy())
  ref.current = ref.current.map(() => null)
}

/* ─────────────────────────────────────────────────────────────────
   MAIN VIEW
───────────────────────────────────────────────────────────────── */
export default function MailmodoView({ filter }: { filter?: 'ongage' | 'mailmodo' }) {
  const store     = useDashboardStore()
  const isLight   = store.isLight
  const allEsps   = Object.keys(store.espData)
  const espList   = filter === 'ongage'
    ? allEsps.filter(e => e === 'Ongage')
    : filter === 'mailmodo'
      ? allEsps.filter(e => e !== 'Ongage')
      : allEsps

  const [selectedEsp, setSelectedEsp] = useState('')
  const [granularity, setGranularity] = useState<Granularity>('daily')
  const [embedView,   setEmbedView]   = useState<EmbedView>('date')

  // ── Pick initial ESP ────────────────────────────────────────────
  useEffect(() => {
    if (!selectedEsp || !espList.includes(selectedEsp)) {
      const def = store.reviewEsp && espList.includes(store.reviewEsp)
        ? store.reviewEsp : espList[0] || ''
      if (def) setSelectedEsp(def)
    }
  }, [espList.join(','), store.reviewEsp]) // eslint-disable-line

  useEffect(() => { store.setMmSelectedRow(null) }, [selectedEsp]) // eslint-disable-line

  // ── Data & range ────────────────────────────────────────────────
  const data: MmData = store.espData[selectedEsp] ?? EMPTY
  const fromIdx = store.espRanges[selectedEsp]?.fromIdx ?? 0
  const toIdx   = store.espRanges[selectedEsp]?.toIdx   ?? Math.max(0, data.dates.length - 1)
  const setRange = (f: number, t: number) => store.setEspRange(selectedEsp, f, t)

  const [fromDate, setFromDate] = useState('')
  const [toDate,   setToDate]   = useState('')

  useEffect(() => {
    if (data.datesFull.length) {
      setFromDate(data.datesFull[fromIdx]?.iso || '')
      setToDate(data.datesFull[Math.min(toIdx, data.datesFull.length - 1)]?.iso || '')
    }
  }, [selectedEsp, data.datesFull.length]) // eslint-disable-line

  function findFrom(iso: string) {
    const i = data.datesFull.findIndex(d => d.iso >= iso)
    return i === -1 ? 0 : i
  }
  function findTo(iso: string) {
    let r = data.datesFull.length - 1
    for (let i = r; i >= 0; i--) { if (data.datesFull[i].iso <= iso) { r = i; break } }
    return r
  }
  function handleFrom(iso: string) {
    setFromDate(iso)
    if (iso) setRange(findFrom(iso), toIdx)
  }
  function handleTo(iso: string) {
    setToDate(iso)
    if (iso) setRange(fromIdx, findTo(iso))
  }
  function handleAll() {
    setRange(0, data.dates.length - 1)
    setFromDate(data.datesFull[0]?.iso || '')
    setToDate(data.datesFull[data.datesFull.length - 1]?.iso || '')
  }

  // ── Tab / row ────────────────────────────────────────────────────
  const mmTab        = (store.mmTab === 'ip' ? 'provider' : store.mmTab) as 'provider' | 'domain'
  const setMmTab     = (t: 'provider' | 'domain') => store.setMmTab(t as MmTabType)
  const selectedRow  = store.mmSelectedRow
  const setSelected  = store.setMmSelectedRow

  // ── Computed: dates, groups, entities ───────────────────────────
  const safeTo      = Math.min(toIdx, data.dates.length - 1)
  const activeDates = data.dates.slice(fromIdx, safeTo + 1)
  const dateGroups  = groupDates(activeDates, granularity, data.datesFull)
  const groupsKey   = dateGroups.map(g => g.label).join(',')
  const datesKey    = activeDates.join(',')

  const gc = getGridColor(isLight)
  const tc = getTextColor(isLight)

  function entityColor(name: string, idx: number) {
    if (mmTab === 'provider') return PROVIDER_COLORS[name] || IP_COLOR_PALETTE[idx % IP_COLOR_PALETTE.length]
    return DOMAIN_COLORS[name] || IP_COLOR_PALETTE[idx % IP_COLOR_PALETTE.length]
  }

  const rawNames   = mmTab === 'provider' ? Object.keys(data.providers || {}) : Object.keys(data.domains || {})
  const entityData = rawNames
    .map((name, idx) => {
      const bd = mmTab === 'provider' ? data.providers[name]?.byDate : data.domains[name]?.byDate
      return { name, color: entityColor(name, idx), byDate: bd || {}, data: aggDates(bd || {}, activeDates) }
    })
    .filter(e => e.data && e.data.sent > 0)
    .sort((a, b) => (b.data?.sent ?? 0) - (a.data?.sent ?? 0))

  const entityNamesKey = entityData.map(e => e.name).join(',')
  const aggOverall     = aggDates(data.overallByDate, activeDates)

  // ── Grid col-stats (min/max per entity×kpi across date groups) ──
  const colStats: Record<string, Record<string, { min: number; max: number }>> = {}
  const gridTop5 = entityData.slice(0, 5)
  gridTop5.forEach(e => {
    colStats[e.name] = {}
    GRID_KPIS.forEach(kpi => {
      const vals = dateGroups
        .map(g => { const r = aggDates(e.byDate, g.dates); return r ? (r[kpi.key] as number) : null })
        .filter((v): v is number => v != null)
      colStats[e.name][kpi.key as string] = {
        min: vals.length ? Math.min(...vals) : 0,
        max: vals.length ? Math.max(...vals) : 0,
      }
    })
  })

  // ── Chart refs ───────────────────────────────────────────────────
  const volRef   = useRef<HTMLCanvasElement>(null)
  const volInst  = useRef<Chart | null>(null)
  const rateRef  = useRef<HTMLCanvasElement>(null)
  const rateInst = useRef<Chart | null>(null)
  const kpiRefs  = useRef<(HTMLCanvasElement | null)[]>([null, null, null, null])
  const kpiInsts = useRef<(Chart | null)[]>([null, null, null, null])
  const pieRefs  = useRef<(HTMLCanvasElement | null)[]>([null, null, null])
  const pieInsts = useRef<(Chart | null)[]>([null, null, null])

  // ── Volume chart ─────────────────────────────────────────────────
  useEffect(() => {
    if (volInst.current) { volInst.current.destroy(); volInst.current = null }
    if (!volRef.current || !dateGroups.length) return
    const od = data.overallByDate
    volInst.current = new Chart(volRef.current, {
      type: 'line',
      data: {
        labels: dateGroups.map(g => g.label),
        datasets: [
          lds('Sent',      dateGroups.map(g => aggDates(od, g.dates)?.sent      ?? null), VOL_COLORS.sent),
          lds('Delivered', dateGroups.map(g => aggDates(od, g.dates)?.delivered ?? null), VOL_COLORS.delivered),
          lds('Opens',     dateGroups.map(g => aggDates(od, g.dates)?.opened    ?? null), VOL_COLORS.opened),
          lds('Clicks',    dateGroups.map(g => aggDates(od, g.dates)?.clicked   ?? null), VOL_COLORS.clicked),
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...CHART_TOOLTIP_OPTS,
            mode: 'index',
            intersect: false,
            callbacks: {
              title: (items: any[]) => items[0]?.label ?? '',
              label: (ctx: any) => `${ctx.dataset.label}: ${fmtN(ctx.parsed.y ?? 0)}`,
            },
          },
        },
        scales: {
          x: { ticks: { color: tc, font: { size: 9 }, maxRotation: 30 }, grid: { display: false } },
          y: { ticks: { color: tc, font: { size: 9 }, callback: (v: any) => fmtN(+v) }, grid: { color: gc }, border: { display: false } },
        },
      },
    })
    return () => { volInst.current?.destroy(); volInst.current = null }
  }, [groupsKey, selectedEsp, isLight]) // eslint-disable-line

  // ── Rate trend chart ─────────────────────────────────────────────
  useEffect(() => {
    if (rateInst.current) { rateInst.current.destroy(); rateInst.current = null }
    if (!rateRef.current || !dateGroups.length) return

    const src = selectedRow
      ? (mmTab === 'provider' ? data.providers[selectedRow]?.byDate : data.domains[selectedRow]?.byDate) ?? {}
      : data.overallByDate

    rateInst.current = new Chart(rateRef.current, {
      type: 'line',
      data: {
        labels: dateGroups.map(g => g.label),
        datasets: [
          rateDs('Success Rate', dateGroups.map(g => aggDates(src, g.dates)?.deliveryRate ?? null), RATE_COLORS.successRate),
          rateDs('Open Rate',    dateGroups.map(g => aggDates(src, g.dates)?.openRate     ?? null), RATE_COLORS.openRate),
          rateDs('CTR',          dateGroups.map(g => aggDates(src, g.dates)?.clickRate    ?? null), RATE_COLORS.clickRate,  [4, 4]),
          rateDs('Bounce Rate',  dateGroups.map(g => aggDates(src, g.dates)?.bounceRate   ?? null), RATE_COLORS.bounceRate, [2, 2]),
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...CHART_TOOLTIP_OPTS,
            mode: 'index',
            intersect: false,
            callbacks: {
              title: (items: any[]) => items[0]?.label ?? '',
              label: (ctx: any) => `${ctx.dataset.label}: ${(ctx.parsed.y ?? 0).toFixed(1)}%`,
            },
          },
        },
        scales: {
          x: { ticks: { color: tc, font: { size: 9 }, maxRotation: 30 }, grid: { display: false } },
          y: { min: 0, ticks: { color: tc, font: { size: 9 }, callback: (v: any) => v + '%' }, grid: { color: gc }, border: { display: false } },
        },
      },
    })
    return () => { rateInst.current?.destroy(); rateInst.current = null }
  }, [groupsKey, selectedEsp, selectedRow, mmTab, isLight]) // eslint-disable-line

  // ── KPI charts ───────────────────────────────────────────────────
  useEffect(() => {
    destroyAll(kpiInsts)
    if (!activeDates.length || !entityData.length) return

    KPI_DEFS.forEach((kpi, i) => {
      const canvas = kpiRefs.current[i]
      if (!canvas) return
      if (embedView === 'date') {
        kpiInsts.current[i] = new Chart(canvas, {
          type: 'line',
          data: {
            labels: dateGroups.map(g => g.label),
            datasets: entityData.map(e =>
              lds(e.name, dateGroups.map(g => {
                const r = aggDates(e.byDate, g.dates)
                return r ? ((r[kpi.key] as number) ?? null) : null
              }), e.color)
            ),
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { ...CHART_TOOLTIP_OPTS, callbacks: { label: ctx => `${ctx.dataset.label}: ${(ctx.parsed.y ?? 0).toFixed(1)}%` } },
            },
            scales: {
              x: { ticks: { color: tc, font: { size: 9 }, maxRotation: 30 }, grid: { display: false } },
              y: { min: 0, ticks: { color: tc, font: { size: 9 }, callback: v => v + '%' }, grid: { color: gc }, border: { display: false } },
            },
          },
        })
      } else {
        kpiInsts.current[i] = new Chart(canvas, {
          type: 'bar',
          data: {
            labels: entityData.map(e => e.name.length > 16 ? e.name.slice(0, 14) + '…' : e.name),
            datasets: [{
              label: kpi.label,
              data: entityData.map(e => (e.data?.[kpi.key] as number) ?? 0),
              backgroundColor: entityData.map(e => e.color + 'aa'),
              borderColor: entityData.map(e => e.color),
              borderWidth: 1, borderRadius: 4,
            }],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { ...CHART_TOOLTIP_OPTS, callbacks: { label: ctx => `${(ctx.parsed.y ?? 0).toFixed(2)}%` } },
            },
            scales: {
              x: { ticks: { color: tc, font: { size: 9 }, maxRotation: 30 }, grid: { display: false } },
              y: { min: 0, ticks: { color: tc, font: { size: 9 }, callback: v => v + '%' }, grid: { color: gc }, border: { display: false } },
            },
          },
        })
      }
    })
    return () => { destroyAll(kpiInsts) }
  }, [groupsKey, selectedEsp, mmTab, isLight, embedView, entityNamesKey]) // eslint-disable-line

  // ── Pie charts ───────────────────────────────────────────────────
  useEffect(() => {
    destroyAll(pieInsts)
    if (mmTab !== 'provider' || !entityData.length || !activeDates.length) return

    const PIE_KEYS: (keyof DateMetrics)[] = ['sent', 'opened', 'clicked']
    PIE_KEYS.forEach((mk, i) => {
      const canvas = pieRefs.current[i]
      if (!canvas) return
      const vals  = entityData.map(e => (e.data?.[mk] as number) ?? 0)
      const total = vals.reduce((a, b) => a + b, 0)

      const centerPlugin = {
        id: `pie_center_${i}`,
        beforeDraw(chart: Chart) {
          const { ctx, chartArea } = chart
          if (!chartArea) return
          const cx = (chartArea.left + chartArea.right) / 2
          const cy = (chartArea.top  + chartArea.bottom) / 2
          ctx.save()
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillStyle = isLight ? '#111827' : '#f0f2f5'
          ctx.font = 'bold 14px "Space Mono", monospace'
          ctx.fillText(fmtN(total), cx, cy - 7)
          ctx.font = '8px "Space Mono", monospace'
          ctx.fillStyle = isLight ? '#6b7280' : '#a8b0be'
          ctx.fillText('TOTAL', cx, cy + 8)
          ctx.restore()
        },
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cfg: any = {
        type: 'doughnut',
        data: {
          labels: entityData.map(e => e.name),
          datasets: [{ data: vals, backgroundColor: entityData.map(e => e.color + 'cc'), borderColor: 'transparent', hoverOffset: 8 }],
        },
        options: {
          cutout: '66%', responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              ...CHART_TOOLTIP_OPTS,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              callbacks: { label: (ctx: any) => `${ctx.label}: ${fmtN(ctx.parsed)} (${total > 0 ? (ctx.parsed / total * 100).toFixed(1) : '0.0'}%)` },
            },
          },
        },
        plugins: [centerPlugin],
      }
      pieInsts.current[i] = new Chart(canvas, cfg)
    })
    return () => { destroyAll(pieInsts) }
  }, [datesKey, selectedEsp, mmTab, isLight, entityNamesKey]) // eslint-disable-line

  // ── Style shorthands ─────────────────────────────────────────────
  const card    = `rounded-xl border ${isLight ? 'bg-white border-black/10' : 'bg-[#111418] border-white/7'}`
  const selCls  = `px-3 py-1.5 rounded-lg border text-xs font-mono outline-none appearance-none ${isLight ? 'bg-white border-black/20 text-gray-800' : 'bg-[#1e232b] border-white/18 text-white'}`
  const muted   = isLight ? 'text-gray-500' : 'text-[#a8b0be]'
  const txt     = isLight ? 'text-gray-900' : 'text-[#f0f2f5]'
  const divBdr  = { borderColor: isLight ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.07)' }
  const tabBdr  = isLight ? 'border-black/15' : 'border-white/13'

  const tabLabel    = mmTab === 'provider' ? 'Provider' : 'Domain'
  const selectedBD  = selectedRow
    ? (mmTab === 'provider' ? data.providers[selectedRow] : data.domains[selectedRow])?.byDate ?? {}
    : {}

  // ── Range label ──────────────────────────────────────────────────
  const rangeLabel = activeDates.length > 0
    ? `${activeDates[0]} – ${activeDates[activeDates.length - 1]} · ${fmtN(aggOverall?.sent ?? 0)} sent`
    : 'No date range selected'

  /* ──────────────────────────────────────────────────────────────
     RENDER
  ─────────────────────────────────────────────────────────────── */
  return (
    <div className="p-6 space-y-5">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className={`text-xl font-bold tracking-tight ${txt}`}>Mailmodo Review</h1>
          <p className={`text-[11px] mt-1 font-mono ${muted}`}>{rangeLabel}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* ESP selector */}
          {espList.length > 1 && (
            <select value={selectedEsp} onChange={e => setSelectedEsp(e.target.value)} className={selCls}>
              {espList.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          )}

          {/* Calendar pickers */}
          <CalendarPicker value={fromDate} onChange={iso => handleFrom(iso)} isLight={isLight} rangeStart={fromDate} rangeEnd={toDate} />
          <span className={`text-xs ${muted}`}>→</span>
          <CalendarPicker value={toDate}   onChange={iso => handleTo(iso)}   isLight={isLight} rangeStart={fromDate} rangeEnd={toDate} align="right" />
          <button
            onClick={handleAll}
            className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-mono uppercase transition-all
              ${isLight ? 'border-black/20 text-gray-500 hover:border-[#009e88]' : 'border-white/13 text-[#a8b0be] hover:border-[#00e5c3]'}`}
          >All</button>

          {/* Granularity toggle */}
          <div className={`flex rounded-lg border overflow-hidden ${tabBdr}`}>
            {(['daily', 'weekly', 'monthly'] as Granularity[]).map(g => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-all
                  ${granularity === g
                    ? 'bg-[#4a2fa0] text-white'
                    : isLight ? 'bg-white text-gray-400 hover:bg-gray-50' : 'bg-[#1e232b] text-[#6b7280] hover:bg-[#252b35]'
                  }`}
              >
                {g.slice(0, 1).toUpperCase() + g.slice(1, 3)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Empty state ───────────────────────────────────────────── */}
      {espList.length === 0 || data.dates.length === 0 ? (
        <div className={`${card} p-12 text-center`}>
          <div className="text-4xl mb-4">📬</div>
          <div className={`text-lg font-medium mb-2 ${txt}`}>No data yet</div>
          <div className={`text-sm ${muted}`}>Upload a file via Upload Report to see data here.</div>
        </div>
      ) : (
        <>

          {/* ── KPI Cards ─────────────────────────────────────────── */}
          {aggOverall && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: 'Total Sent',   val: fmtN(aggOverall.sent),         sub: `${fmtN(aggOverall.delivered)} delivered`, accent: ESP_COLORS[selectedEsp] || '#7c5cfc' },
                { label: 'Success Rate', val: fmtP(aggOverall.deliveryRate),  sub: 'delivery rate',                          accent: '#7c5cfc' },
                { label: 'Open Rate',    val: fmtP(aggOverall.openRate),      sub: `${fmtN(aggOverall.opened)} opens`,        accent: '#00e5c3' },
                { label: 'CTR',          val: fmtP(aggOverall.clickRate),     sub: `${fmtN(aggOverall.clicked)} clicks`,      accent: '#ffd166' },
                { label: 'Bounce Rate',  val: fmtP(aggOverall.bounceRate),    sub: `${fmtN(aggOverall.bounced)} bounced`,
                  accent: aggOverall.bounceRate > 10 ? '#ff4757' : aggOverall.bounceRate > 2 ? '#ffd166' : '#00e5c3' },
              ].map(k => (
                <div key={k.label}
                  className={`rounded-xl border px-4 py-3 ${isLight ? 'bg-white border-black/10' : 'bg-[#111418] border-white/7'}`}
                  style={{ borderBottom: `2px solid ${k.accent}` }}
                >
                  <div className={`text-[9px] font-mono tracking-wider uppercase mb-2 ${muted}`}>{k.label}</div>
                  <div className={`text-2xl font-bold font-mono ${txt}`}>{k.val}</div>
                  <div className={`text-[10px] mt-1 ${muted}`}>{k.sub}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Tab Switcher ──────────────────────────────────────── */}
          <div className="flex items-center gap-1">
            {(['provider', 'domain'] as const).map(tab => (
              <button key={tab} onClick={() => setMmTab(tab)}
                className={`px-3 py-1.5 rounded-lg border text-[10px] font-mono uppercase tracking-wider transition-all
                  ${mmTab === tab
                    ? 'bg-[#4a2fa0] border-[#4a2fa0] text-white'
                    : isLight ? 'border-black/15 text-gray-500 hover:border-black/30' : 'border-white/13 text-[#a8b0be] hover:border-white/25'
                  }`}
              >
                {tab === 'provider' ? 'Email Provider' : 'Sending Domain'}
              </button>
            ))}
          </div>

          {/* ── Volume + Rate Charts ──────────────────────────────── */}
          <div className="flex flex-col gap-4">

            <div className={`${card} p-4`}>
              <div className="mb-3">
                <div className={`text-xs font-medium ${txt}`}>Volume Trend</div>
                <div className={`text-[10px] font-mono mt-0.5 ${muted}`}>
                  Sent · Delivered · Opens · Clicks — all {tabLabel}s · {granularity}
                </div>
              </div>
              <div style={{ height: 200 }}><canvas ref={volRef} /></div>
              <div className="flex gap-4 mt-3 flex-wrap">
                {(Object.entries(VOL_COLORS) as [string, string][]).map(([k, c]) => (
                  <div key={k} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm" style={{ background: c }} />
                    <span className={`text-[10px] font-mono capitalize ${muted}`}>{k}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${card} p-4`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className={`text-xs font-medium ${txt}`}>Rate Trends{selectedRow ? ` — ${selectedRow}` : ''}</div>
                  <div className={`text-[10px] font-mono mt-0.5 ${muted}`}>
                    {selectedRow ? 'Click row again to reset' : `Click table row to isolate · ${granularity}`}
                  </div>
                </div>
                {selectedRow && (
                  <button onClick={() => setSelected(null)}
                    className={`text-[10px] font-mono px-2 py-1 rounded border transition-all
                      ${isLight ? 'border-black/20 text-gray-500 hover:border-black/40' : 'border-white/13 text-[#a8b0be] hover:border-white/30'}`}>
                    Reset
                  </button>
                )}
              </div>
              <div style={{ height: 200 }}><canvas ref={rateRef} /></div>
              <div className="flex gap-3 mt-3 flex-wrap">
                {[['Success Rate', RATE_COLORS.successRate],['Open Rate', RATE_COLORS.openRate],['CTR', RATE_COLORS.clickRate],['Bounce Rate', RATE_COLORS.bounceRate]].map(([l, c]) => (
                  <div key={l} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm" style={{ background: c }} />
                    <span className={`text-[10px] font-mono ${muted}`}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── KPI Charts ────────────────────────────────────────── */}
          <div className={`${card} p-4`}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <div className={`text-xs font-medium ${txt}`}>KPI Charts</div>
                <div className={`text-[10px] font-mono mt-0.5 ${muted}`}>
                  {embedView === 'date'
                    ? `X-axis: ${granularity} groups — one line per ${tabLabel.toLowerCase()}`
                    : `X-axis: ${tabLabel}s — aggregate for selected period`}
                </div>
              </div>
              <div className={`flex rounded-lg border overflow-hidden ${tabBdr}`}>
                {(['date', 'provider'] as EmbedView[]).map(v => (
                  <button key={v} onClick={() => setEmbedView(v)}
                    className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-all
                      ${embedView === v
                        ? 'bg-[#4a2fa0] text-white'
                        : isLight ? 'bg-white text-gray-500 hover:bg-gray-50' : 'bg-[#1e232b] text-[#a8b0be] hover:bg-[#252b35]'
                      }`}>
                    By {v === 'date' ? 'Date' : tabLabel}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {KPI_DEFS.map((kpi, i) => (
                <div key={kpi.key as string}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: kpi.color }} />
                    <span className={`text-[11px] font-medium ${txt}`}>{kpi.label}</span>
                  </div>
                  <div style={{ height: 180 }}>
                    <canvas ref={el => { kpiRefs.current[i] = el }} />
                  </div>
                  {embedView === 'date' && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                      {entityData.map(e => (
                        <div key={e.name} className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: e.color }} />
                          <span className={`text-[9px] font-mono ${muted}`}>
                            {e.name.length > 20 ? e.name.slice(0, 18) + '…' : e.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Distribution Pies (provider tab only) ─────────────── */}
          {mmTab === 'provider' && entityData.length > 0 && (
            <div className={`${card} p-4`}>
              <div className={`text-xs font-medium mb-4 ${txt}`}>Distribution by Provider</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {(['Sent', 'Opens', 'Clicks'] as const).map((title, idx) => {
                  const mk = (['sent', 'opened', 'clicked'] as const)[idx]
                  const total = entityData.reduce((s, e) => s + ((e.data?.[mk] as number) ?? 0), 0)
                  return (
                    <div key={title} className="flex flex-col items-center">
                      <div className={`text-xs font-medium mb-0.5 ${txt}`}>{title}</div>
                      <div className={`text-[10px] font-mono mb-3 ${muted}`}>share of total {title.toLowerCase()}</div>
                      <div style={{ height: 160, width: '100%', maxWidth: 160 }}>
                        <canvas ref={el => { pieRefs.current[idx] = el }} />
                      </div>
                      <div className="mt-3 w-full space-y-1.5">
                        {entityData.map(e => {
                          const val = (e.data?.[mk] as number) ?? 0
                          const pct = total > 0 ? (val / total * 100).toFixed(1) : '0.0'
                          return (
                            <div key={e.name} className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.color }} />
                              <span className={`text-[10px] font-mono flex-1 truncate ${muted}`}>{e.name}</span>
                              <span className={`text-[10px] font-mono font-bold ${txt}`}>{pct}%</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Summary Table ─────────────────────────────────────── */}
          <div className={`${card} overflow-hidden`}>
            <div className="px-4 py-3 border-b flex items-center justify-between" style={divBdr}>
              <span className={`text-[10px] font-mono uppercase tracking-wider ${muted}`}>
                {mmTab === 'provider' ? 'Email Provider Summary' : 'Sending Domain Summary'}
              </span>
              <span className={`text-[10px] font-mono ${muted}`}>Click row → isolate rate trend & daily breakdown</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: 940 }}>
                <thead className={isLight ? 'bg-gray-50' : 'bg-[#181c22]'}>
                  <tr>
                    {['Provider / Domain','Sent','Delivered','Opens','Clicks','Bounced','Unsubs','Success%','Open%','CTR%','Bounce%','Unsub%'].map((h, i) => (
                      <th key={h}
                        className={`px-3 py-2.5 text-[9px] font-mono tracking-wider uppercase border-b
                          ${i === 0 ? 'text-left' : 'text-right'}
                          ${isLight ? 'border-black/8 text-gray-700' : 'border-white/7 text-[#d4dae6]'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entityData.map(({ name, data: d, color }) => (
                    <tr key={name}
                      onClick={() => setSelected(selectedRow === name ? null : name)}
                      className={`cursor-pointer border-b last:border-0 transition-colors
                        ${isLight ? 'border-black/8 hover:bg-black/3' : 'border-white/7 hover:bg-white/3'}
                        ${selectedRow === name ? (isLight ? 'bg-[#009e88]/7' : 'bg-[#00e5c3]/4') : ''}`}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-5 rounded-sm flex-shrink-0" style={{ background: color }} />
                          <span className={`text-[11px] font-mono ${txt}`}>{name}</span>
                        </div>
                      </td>
                      <td className={`px-3 py-2.5 text-right text-[11px] font-mono ${muted}`}>{fmtN(d?.sent ?? 0)}</td>
                      <td className={`px-3 py-2.5 text-right text-[11px] font-mono ${txt}`}>{fmtN(d?.delivered ?? 0)}</td>
                      <td className="px-3 py-2.5 text-right text-[11px] font-mono text-[#00e5c3]">{fmtN(d?.opened ?? 0)}</td>
                      <td className="px-3 py-2.5 text-right text-[11px] font-mono text-[#ffd166]">{fmtN(d?.clicked ?? 0)}</td>
                      <td className={`px-3 py-2.5 text-right text-[11px] font-mono ${(d?.bounced ?? 0) > 0 ? 'text-[#ff4757]' : muted}`}>{fmtN(d?.bounced ?? 0)}</td>
                      <td className={`px-3 py-2.5 text-right text-[11px] font-mono ${(d?.unsubscribed ?? 0) > 0 ? 'text-[#ff9a5c]' : muted}`}>{fmtN(d?.unsubscribed ?? 0)}</td>
                      <td className={`px-3 py-2.5 text-right text-[11px] font-mono ${(d?.deliveryRate ?? 0) < 80 ? 'text-[#ffd166]' : txt}`}>{fmtP(d?.deliveryRate ?? 0)}</td>
                      <td className="px-3 py-2.5 text-right text-[11px] font-mono text-[#00e5c3]">{fmtP(d?.openRate ?? 0)}</td>
                      <td className="px-3 py-2.5 text-right text-[11px] font-mono text-[#ffd166]">{fmtP(d?.clickRate ?? 0)}</td>
                      <td className={`px-3 py-2.5 text-right text-[11px] font-mono
                        ${(d?.bounceRate ?? 0) > 10 ? 'text-[#ff4757]' : (d?.bounceRate ?? 0) > 2 ? 'text-[#ffd166]' : muted}`}>
                        {fmtP(d?.bounceRate ?? 0)}
                      </td>
                      <td className={`px-3 py-2.5 text-right text-[11px] font-mono ${(d?.unsubRate ?? 0) > 0 ? 'text-[#ff9a5c]' : muted}`}>
                        {fmtP(d?.unsubRate ?? 0, 3)}
                      </td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  {aggOverall && (
                    <tr className={`border-t font-bold ${isLight ? 'border-black/15 bg-gray-50' : 'border-white/12 bg-[#181c22]'}`}>
                      <td className={`px-3 py-2.5 text-[11px] font-mono ${txt}`}>TOTAL</td>
                      <td className={`px-3 py-2.5 text-right text-[11px] font-mono ${txt}`}>{fmtN(aggOverall.sent)}</td>
                      <td className={`px-3 py-2.5 text-right text-[11px] font-mono ${txt}`}>{fmtN(aggOverall.delivered)}</td>
                      <td className="px-3 py-2.5 text-right text-[11px] font-mono text-[#00e5c3]">{fmtN(aggOverall.opened)}</td>
                      <td className="px-3 py-2.5 text-right text-[11px] font-mono text-[#ffd166]">{fmtN(aggOverall.clicked)}</td>
                      <td className={`px-3 py-2.5 text-right text-[11px] font-mono ${aggOverall.bounced > 0 ? 'text-[#ff4757]' : txt}`}>{fmtN(aggOverall.bounced)}</td>
                      <td className={`px-3 py-2.5 text-right text-[11px] font-mono ${(aggOverall.unsubscribed ?? 0) > 0 ? 'text-[#ff9a5c]' : txt}`}>{fmtN(aggOverall.unsubscribed ?? 0)}</td>
                      <td className={`px-3 py-2.5 text-right text-[11px] font-mono ${txt}`}>{fmtP(aggOverall.deliveryRate)}</td>
                      <td className="px-3 py-2.5 text-right text-[11px] font-mono text-[#00e5c3]">{fmtP(aggOverall.openRate)}</td>
                      <td className="px-3 py-2.5 text-right text-[11px] font-mono text-[#ffd166]">{fmtP(aggOverall.clickRate)}</td>
                      <td className={`px-3 py-2.5 text-right text-[11px] font-mono ${aggOverall.bounceRate > 10 ? 'text-[#ff4757]' : aggOverall.bounceRate > 2 ? 'text-[#ffd166]' : txt}`}>
                        {fmtP(aggOverall.bounceRate)}
                      </td>
                      <td className={`px-3 py-2.5 text-right text-[11px] font-mono ${(aggOverall.unsubRate ?? 0) > 0 ? 'text-[#ff9a5c]' : txt}`}>
                        {fmtP(aggOverall.unsubRate ?? 0, 3)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Day Breakdown ─────────────────────────────────────── */}
          {selectedRow && activeDates.some(d => selectedBD[d]) && (
            <div className={`${card} overflow-hidden`}>
              <div className="px-4 py-3 border-b flex items-center justify-between" style={divBdr}>
                <span className={`text-[10px] font-mono uppercase tracking-wider ${muted}`}>
                  Daily Breakdown — {selectedRow}
                </span>
                <button onClick={() => setSelected(null)}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-all
                    ${isLight ? 'border-black/20 text-gray-500 hover:text-gray-800' : 'border-white/13 text-[#a8b0be] hover:text-[#f0f2f5]'}`}>
                  Close ✕
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: 780 }}>
                  <thead className={isLight ? 'bg-gray-50' : 'bg-[#181c22]'}>
                    <tr>
                      {['Date','Sent','Delivered','Opens','Clicks','Bounced','Success%','Open%','CTR%','Bounce%'].map((h, i) => (
                        <th key={h}
                          className={`px-3 py-2.5 text-[9px] font-mono tracking-wider uppercase border-b
                            ${i === 0 ? 'text-left' : 'text-right'}
                            ${isLight ? 'border-black/8 text-gray-700' : 'border-white/7 text-[#d4dae6]'}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeDates.filter(d => selectedBD[d]).map(d => {
                      const r = selectedBD[d]
                      return (
                        <tr key={d} className={`border-b last:border-0 ${isLight ? 'border-black/8' : 'border-white/7'}`}>
                          <td className={`px-3 py-2 text-[11px] font-mono ${txt}`}>{d}</td>
                          <td className={`px-3 py-2 text-right text-[11px] font-mono ${muted}`}>{fmtN(r.sent)}</td>
                          <td className={`px-3 py-2 text-right text-[11px] font-mono ${txt}`}>{fmtN(r.delivered)}</td>
                          <td className="px-3 py-2 text-right text-[11px] font-mono text-[#00e5c3]">{fmtN(r.opened)}</td>
                          <td className="px-3 py-2 text-right text-[11px] font-mono text-[#ffd166]">{fmtN(r.clicked)}</td>
                          <td className={`px-3 py-2 text-right text-[11px] font-mono ${r.bounced > 0 ? 'text-[#ff4757]' : muted}`}>{fmtN(r.bounced)}</td>
                          <td className={`px-3 py-2 text-right text-[11px] font-mono ${r.deliveryRate < 85 ? 'text-[#ffd166]' : txt}`}>{fmtP(r.deliveryRate)}</td>
                          <td className="px-3 py-2 text-right text-[11px] font-mono text-[#00e5c3]">{fmtP(r.openRate)}</td>
                          <td className="px-3 py-2 text-right text-[11px] font-mono text-[#ffd166]">{fmtP(r.clickRate)}</td>
                          <td className={`px-3 py-2 text-right text-[11px] font-mono ${r.bounceRate > 10 ? 'text-[#ff4757]' : r.bounceRate > 2 ? 'text-[#ffd166]' : muted}`}>
                            {fmtP(r.bounceRate)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Daily KPIs Grid ───────────────────────────────────── */}
          {gridTop5.length > 0 && dateGroups.length > 0 && (
            <div className={`${card} overflow-hidden`}>
              <div className="px-4 py-3 border-b" style={divBdr}>
                <span className={`text-[10px] font-mono uppercase tracking-wider ${muted}`}>
                  {granularity.charAt(0).toUpperCase() + granularity.slice(1)} KPIs Grid
                  {' '}— by {tabLabel} · top {gridTop5.length} by volume · heatmap per column
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="border-collapse text-[10px] font-mono"
                  style={{ minWidth: gridTop5.length * 5 * 56 + 80 }}>
                  <thead>
                    {/* Entity names */}
                    <tr className={isLight ? 'bg-gray-50' : 'bg-[#181c22]'}>
                      <th className={`px-3 py-2 text-left border-b border-r ${isLight ? 'border-black/8' : 'border-white/7'}`} />
                      {gridTop5.map(e => (
                        <th key={e.name} colSpan={5}
                          className={`px-2 py-2 border-b border-r text-center ${isLight ? 'border-black/8 text-gray-700' : 'border-white/7 text-[#d4dae6]'}`}>
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: e.color }} />
                            <span className="truncate" style={{ maxWidth: 100 }}>{e.name}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                    {/* KPI sub-labels */}
                    <tr className={isLight ? 'bg-gray-50' : 'bg-[#181c22]'}>
                      <th className={`px-3 py-1.5 border-b border-r ${isLight ? 'border-black/8' : 'border-white/7'}`} />
                      {gridTop5.flatMap(e =>
                        GRID_KPIS.map((kpi, ki) => (
                          <th key={e.name + kpi.key}
                            className={`px-1.5 py-1.5 border-b text-center ${ki === 4 ? 'border-r' : ''} ${isLight ? 'border-black/8' : 'border-white/7'}`}
                            style={{ color: kpi.color }}>
                            {kpi.label}
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {dateGroups.map((group, gi) => (
                      <tr key={group.label} className={`border-b last:border-0 ${isLight ? 'border-black/8' : 'border-white/7'}`}>
                        <td className={`px-3 py-1.5 whitespace-nowrap border-r ${isLight ? 'border-black/8 text-gray-700' : 'border-white/7 text-[#c8cdd6]'}`}>
                          {group.label}
                        </td>
                        {gridTop5.flatMap(e =>
                          GRID_KPIS.map((kpi, ki) => {
                            const r    = aggDates(e.byDate, group.dates)
                            const val  = r ? (r[kpi.key] as number | undefined) ?? null : null
                            const prev = gi > 0 ? aggDates(e.byDate, dateGroups[gi - 1].dates) : null
                            const pVal = prev ? (prev[kpi.key] as number | undefined) ?? null : null
                            const stats = colStats[e.name]?.[kpi.key as string]
                            const bg   = val != null && stats
                              ? minMaxHeat(kpi.key as string, val, stats.min, stats.max)
                              : 'transparent'
                            const trend = trendArrow(val, pVal, kpi.key as string)
                            return (
                              <td key={e.name + kpi.key + group.label}
                                className={`px-1.5 py-1.5 text-center ${ki === 4 ? 'border-r' : ''} ${isLight ? 'border-black/5' : 'border-white/5'}`}
                                style={{ background: bg }}>
                                {val != null ? (
                                  <div className="flex items-center justify-center gap-0.5">
                                    <span className={txt}>
                                      {kpi.key === 'unsubRate' ? val.toFixed(2) : val.toFixed(1)}%
                                    </span>
                                    {trend && (
                                      <span style={{ color: trend.color, fontSize: 7, lineHeight: 1 }}>{trend.arrow}</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className={isLight ? 'text-gray-300' : 'text-white/20'}>—</span>
                                )}
                              </td>
                            )
                          })
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </>
      )}
    </div>
  )
}
