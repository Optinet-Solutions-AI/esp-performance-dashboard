'use client'
import { useEffect, useRef, useState } from 'react'
import { Chart } from 'chart.js/auto'
import { useDashboardStore } from '@/lib/store'
import { aggDates, fmtN, fmtP, getGridColor, getTextColor, CHART_TOOLTIP_OPTS } from '@/lib/utils'
import { PROVIDER_COLORS, DOMAIN_COLORS, IP_COLOR_PALETTE, ESP_COLORS } from '@/lib/data'
import type { MmData, MmTabType, DateMetrics } from '@/lib/types'

const EMPTY: MmData = {
  dates: [], datesFull: [], providers: {}, domains: {}, overallByDate: {}, providerDomains: {},
}

const VOL_COLORS = {
  sent: '#6b7280', delivered: '#7c5cfc', opened: '#00e5c3', clicked: '#ffd166',
}
const RATE_COLORS = {
  successRate: '#7c5cfc', openRate: '#00e5c3', clickRate: '#ffd166', bounceRate: '#ff4757',
}
const KPI_DEFS = [
  { key: 'openRate'  as keyof DateMetrics, label: 'Open Rate %',   color: '#00e5c3' },
  { key: 'clickRate' as keyof DateMetrics, label: 'CTR %',         color: '#ffd166' },
  { key: 'bounceRate'as keyof DateMetrics, label: 'Bounce Rate %', color: '#ff4757' },
  { key: 'unsubRate' as keyof DateMetrics, label: 'Unsub Rate %',  color: '#ff9a5c' },
]
const GRID_KPIS = [
  { key: 'deliveryRate' as keyof DateMetrics, label: 'Sr%',  color: '#b39dff' },
  { key: 'openRate'     as keyof DateMetrics, label: 'Or%',  color: '#00ffd5' },
  { key: 'clickRate'    as keyof DateMetrics, label: 'Ctr%', color: '#ffe066' },
  { key: 'bounceRate'   as keyof DateMetrics, label: 'Br%',  color: '#ff6b77' },
  { key: 'unsubRate'    as keyof DateMetrics, label: 'Ubr%', color: '#ff9a5c' },
]

type EmbedView = 'date' | 'provider'

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

function heatBg(key: keyof DateMetrics, val: number | null | undefined): string {
  if (val == null) return 'transparent'
  if (key === 'deliveryRate' || key === 'successRate') {
    return val >= 97 ? 'rgba(0,229,195,.13)' : val >= 85 ? 'rgba(255,209,102,.13)' : 'rgba(255,71,87,.13)'
  }
  if (key === 'openRate') {
    return val >= 60 ? 'rgba(0,229,195,.13)' : val >= 30 ? 'rgba(255,209,102,.13)' : 'rgba(255,71,87,.13)'
  }
  if (key === 'clickRate') {
    return val >= 85 ? 'rgba(0,229,195,.13)' : val >= 60 ? 'rgba(255,209,102,.13)' : 'rgba(255,71,87,.13)'
  }
  if (key === 'bounceRate') {
    return val <= 1 ? 'rgba(0,229,195,.13)' : val <= 5 ? 'rgba(255,209,102,.13)' : 'rgba(255,71,87,.13)'
  }
  if (key === 'unsubRate') {
    return val <= 0.1 ? 'rgba(0,229,195,.13)' : val <= 0.5 ? 'rgba(255,209,102,.13)' : 'rgba(255,71,87,.13)'
  }
  return 'transparent'
}

function destroyAll(insts: React.MutableRefObject<(Chart | null)[]>) {
  insts.current.forEach(c => { if (c) c.destroy() })
  insts.current = insts.current.map(() => null)
}

export default function MailmodoView({ filter }: { filter?: 'ongage' | 'mailmodo' }) {
  const store = useDashboardStore()
  const isLight = store.isLight
  const allEspList = Object.keys(store.espData)
  const espList = filter === 'ongage'
    ? allEspList.filter(e => e === 'Ongage')
    : filter === 'mailmodo'
      ? allEspList.filter(e => e !== 'Ongage')
      : allEspList

  const [selectedEsp, setSelectedEsp] = useState<string>('')
  const [embedView, setEmbedView] = useState<EmbedView>('date')

  useEffect(() => {
    if (!selectedEsp || !espList.includes(selectedEsp)) {
      const def = store.reviewEsp && espList.includes(store.reviewEsp)
        ? store.reviewEsp : espList[0] || ''
      if (def) setSelectedEsp(def)
    }
  }, [espList.join(','), store.reviewEsp]) // eslint-disable-line

  useEffect(() => { store.setMmSelectedRow(null) }, [selectedEsp]) // eslint-disable-line

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

  const mmTab          = (store.mmTab === 'ip' ? 'provider' : store.mmTab) as 'provider' | 'domain'
  const setMmTab       = (t: 'provider' | 'domain') => store.setMmTab(t as MmTabType)
  const mmSelectedRow  = store.mmSelectedRow
  const setSelected    = store.setMmSelectedRow

  const gc = getGridColor(isLight)
  const tc = getTextColor(isLight)

  const safeTo     = Math.min(toIdx, data.dates.length - 1)
  const activeDates = data.dates.slice(fromIdx, safeTo + 1)
  const datesKey   = activeDates.join(',')

  function entityColor(name: string, idx: number) {
    if (mmTab === 'provider') return PROVIDER_COLORS[name] || IP_COLOR_PALETTE[idx % IP_COLOR_PALETTE.length]
    return DOMAIN_COLORS[name] || IP_COLOR_PALETTE[idx % IP_COLOR_PALETTE.length]
  }

  const rawNames = mmTab === 'provider'
    ? Object.keys(data.providers || {})
    : Object.keys(data.domains  || {})

  const entityData = rawNames
    .map((name, idx) => {
      const bd = mmTab === 'provider' ? data.providers[name]?.byDate : data.domains[name]?.byDate
      return { name, color: entityColor(name, idx), byDate: bd || {}, data: aggDates(bd || {}, activeDates) }
    })
    .filter(e => e.data && e.data.sent > 0)
    .sort((a, b) => (b.data?.sent ?? 0) - (a.data?.sent ?? 0))

  const entityNamesKey = entityData.map(e => e.name).join(',')
  const aggOverall     = aggDates(data.overallByDate, activeDates)

  /* ── Chart refs ─────────────────────────────────── */
  const volRef  = useRef<HTMLCanvasElement>(null)
  const volInst = useRef<Chart | null>(null)
  const rateRef  = useRef<HTMLCanvasElement>(null)
  const rateInst = useRef<Chart | null>(null)
  const kpiRefs  = useRef<(HTMLCanvasElement | null)[]>([null, null, null, null])
  const kpiInsts = useRef<(Chart | null)[]>([null, null, null, null])
  const pieRefs  = useRef<(HTMLCanvasElement | null)[]>([null, null, null])
  const pieInsts = useRef<(Chart | null)[]>([null, null, null])

  /* ── Volume chart ────────────────────────────────── */
  useEffect(() => {
    if (!volRef.current || !activeDates.length) {
      if (volInst.current) { volInst.current.destroy(); volInst.current = null }
      return
    }
    if (volInst.current) { volInst.current.destroy(); volInst.current = null }
    const od = data.overallByDate
    volInst.current = new Chart(volRef.current, {
      type: 'line',
      data: {
        labels: activeDates,
        datasets: [
          lds('Sent',      activeDates.map(d => od[d]?.sent      ?? null), VOL_COLORS.sent),
          lds('Delivered', activeDates.map(d => od[d]?.delivered ?? null), VOL_COLORS.delivered),
          lds('Opens',     activeDates.map(d => od[d]?.opened    ?? null), VOL_COLORS.opened),
          lds('Clicks',    activeDates.map(d => od[d]?.clicked   ?? null), VOL_COLORS.clicked),
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { ...CHART_TOOLTIP_OPTS, callbacks: { label: ctx => `${ctx.dataset.label}: ${fmtN(ctx.parsed.y ?? 0)}` } },
        },
        scales: {
          x: { ticks: { color: tc, font: { size: 9 } }, grid: { display: false } },
          y: { ticks: { color: tc, font: { size: 9 }, callback: v => fmtN(+v) }, grid: { color: gc }, border: { display: false } },
        },
      },
    })
    return () => { volInst.current?.destroy(); volInst.current = null }
  }, [datesKey, selectedEsp, isLight]) // eslint-disable-line

  /* ── Rate trend chart ────────────────────────────── */
  useEffect(() => {
    if (!rateRef.current || !activeDates.length) {
      if (rateInst.current) { rateInst.current.destroy(); rateInst.current = null }
      return
    }
    if (rateInst.current) { rateInst.current.destroy(); rateInst.current = null }

    const src = mmSelectedRow
      ? (mmTab === 'provider' ? data.providers[mmSelectedRow]?.byDate : data.domains[mmSelectedRow]?.byDate) ?? {}
      : data.overallByDate

    rateInst.current = new Chart(rateRef.current, {
      type: 'line',
      data: {
        labels: activeDates,
        datasets: [
          lds('Success %', activeDates.map(d => src[d]?.deliveryRate ?? null), RATE_COLORS.successRate),
          lds('Open %',    activeDates.map(d => src[d]?.openRate     ?? null), RATE_COLORS.openRate),
          lds('CTR %',     activeDates.map(d => src[d]?.clickRate    ?? null), RATE_COLORS.clickRate,  [4, 4]),
          lds('Bounce %',  activeDates.map(d => src[d]?.bounceRate   ?? null), RATE_COLORS.bounceRate, [2, 2]),
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { ...CHART_TOOLTIP_OPTS, callbacks: { label: ctx => `${ctx.dataset.label}: ${(ctx.parsed.y ?? 0).toFixed(1)}%` } },
        },
        scales: {
          x: { ticks: { color: tc, font: { size: 9 } }, grid: { display: false } },
          y: { min: 0, ticks: { color: tc, font: { size: 9 }, callback: v => v + '%' }, grid: { color: gc }, border: { display: false } },
        },
      },
    })
    return () => { rateInst.current?.destroy(); rateInst.current = null }
  }, [datesKey, selectedEsp, mmSelectedRow, mmTab, isLight]) // eslint-disable-line

  /* ── KPI charts ──────────────────────────────────── */
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
            labels: activeDates,
            datasets: entityData.map(e =>
              lds(e.name, activeDates.map(d => {
                const r = e.byDate[d]
                return r ? (r[kpi.key] as number ?? null) : null
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
              x: { ticks: { color: tc, font: { size: 9 } }, grid: { display: false } },
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
  }, [datesKey, selectedEsp, mmTab, isLight, embedView, entityNamesKey]) // eslint-disable-line

  /* ── Pie charts ──────────────────────────────────── */
  useEffect(() => {
    destroyAll(pieInsts)
    if (mmTab !== 'provider' || !entityData.length || !activeDates.length) return

    const PIE_METRICS: (keyof DateMetrics)[] = ['sent', 'opened', 'clicked']

    PIE_METRICS.forEach((metricKey, i) => {
      const canvas = pieRefs.current[i]
      if (!canvas) return

      const vals  = entityData.map(e => (e.data?.[metricKey] as number) ?? 0)
      const total = vals.reduce((a, b) => a + b, 0)

      const centerPlugin = {
        id: `center_${i}`,
        beforeDraw(chart: Chart) {
          const { ctx, chartArea } = chart
          if (!chartArea) return
          const cx = (chartArea.left + chartArea.right) / 2
          const cy = (chartArea.top + chartArea.bottom) / 2
          ctx.save()
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = isLight ? '#111827' : '#f0f2f5'
          ctx.font = 'bold 14px "Space Mono", monospace'
          ctx.fillText(fmtN(total), cx, cy - 6)
          ctx.font = '8px "Space Mono", monospace'
          ctx.fillStyle = isLight ? '#6b7280' : '#a8b0be'
          ctx.fillText('TOTAL', cx, cy + 8)
          ctx.restore()
        },
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pieConfig: any = {
        type: 'doughnut',
        data: {
          labels: entityData.map(e => e.name),
          datasets: [{
            data: vals,
            backgroundColor: entityData.map(e => e.color + 'cc'),
            borderColor: 'transparent',
            hoverOffset: 8,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '66%',
          plugins: {
            legend: { display: false },
            tooltip: {
              ...CHART_TOOLTIP_OPTS,
              callbacks: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                label: (ctx: any) => {
                  const v = ctx.parsed
                  const pct = total > 0 ? ((v / total) * 100).toFixed(1) : '0.0'
                  return `${ctx.label}: ${fmtN(v)} (${pct}%)`
                },
              },
            },
          },
        },
        plugins: [centerPlugin],
      }
      pieInsts.current[i] = new Chart(canvas, pieConfig)
    })
    return () => { destroyAll(pieInsts) }
  }, [datesKey, selectedEsp, mmTab, isLight, entityNamesKey]) // eslint-disable-line

  /* ── Styles ──────────────────────────────────────── */
  const card   = `rounded-xl border ${isLight ? 'bg-white border-black/10' : 'bg-[#111418] border-white/7'}`
  const sel    = `px-3 py-1.5 rounded-lg border text-xs font-mono outline-none appearance-none ${isLight ? 'bg-white border-black/20 text-gray-800' : 'bg-[#1e232b] border-white/18 text-white'}`
  const muted  = isLight ? 'text-gray-500' : 'text-[#a8b0be]'
  const txt    = isLight ? 'text-gray-900' : 'text-[#f0f2f5]'
  const divBdr = { borderColor: isLight ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.07)' }

  const tabLabel   = mmTab === 'provider' ? 'Provider' : 'Domain'
  const gridTop5   = entityData.slice(0, 5)

  const selectedByDate = mmSelectedRow
    ? (mmTab === 'provider' ? data.providers[mmSelectedRow] : data.domains[mmSelectedRow])?.byDate ?? {}
    : {}

  return (
    <div className="p-6 space-y-5">

      {/* ── Header ──────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className={`text-xl font-bold tracking-tight ${txt}`}>Mailmodo Review</h1>
          <p className={`text-xs mt-1 font-mono ${muted}`}>
            {aggOverall
              ? `${activeDates[0]} – ${activeDates[activeDates.length - 1]} · ${fmtN(aggOverall.sent)} records`
              : 'Provider & domain deliverability'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {espList.length > 1 && (
            <select value={selectedEsp} onChange={e => setSelectedEsp(e.target.value)} className={sel}>
              {espList.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          )}
          <input type="date" value={fromDate} min="2025-01-01"
            onChange={e => { setFromDate(e.target.value); if (e.target.value) setRange(findFrom(e.target.value), toIdx) }}
            className={sel} />
          <span className={`text-xs ${muted}`}>→</span>
          <input type="date" value={toDate} min="2025-01-01"
            onChange={e => { setToDate(e.target.value); if (e.target.value) setRange(fromIdx, findTo(e.target.value)) }}
            className={sel} />
          <button
            onClick={() => {
              setRange(0, data.dates.length - 1)
              setFromDate(data.datesFull[0]?.iso || '')
              setToDate(data.datesFull[data.datesFull.length - 1]?.iso || '')
            }}
            className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-mono uppercase transition-all
              ${isLight ? 'border-black/20 text-gray-500 hover:border-[#009e88]' : 'border-white/13 text-[#a8b0be] hover:border-[#00e5c3]'}`}>
            All
          </button>
        </div>
      </div>

      {espList.length === 0 || data.dates.length === 0 ? (
        <div className={`${card} p-12 text-center`}>
          <div className="text-4xl mb-4">📬</div>
          <div className={`text-lg font-medium mb-2 ${txt}`}>No data yet</div>
          <div className={`text-sm ${muted}`}>Upload a file via Upload Report to see data here.</div>
        </div>
      ) : (
        <>
          {/* ── KPI Cards ───────────────────────────── */}
          {aggOverall && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: 'Total Sent',   val: fmtN(aggOverall.sent),          sub: `${fmtN(aggOverall.delivered)} delivered`, accent: ESP_COLORS[selectedEsp] || '#7c5cfc' },
                { label: 'Success Rate', val: fmtP(aggOverall.deliveryRate),  sub: `delivery rate`,                            accent: '#7c5cfc' },
                { label: 'Open Rate',    val: fmtP(aggOverall.openRate),      sub: `${fmtN(aggOverall.opened)} opens`,          accent: '#00e5c3' },
                { label: 'CTR',          val: fmtP(aggOverall.clickRate),     sub: `${fmtN(aggOverall.clicked)} clicks`,        accent: '#ffd166' },
                {
                  label: 'Bounce Rate',  val: fmtP(aggOverall.bounceRate),   sub: `${fmtN(aggOverall.bounced)} bounced`,
                  accent: aggOverall.bounceRate > 10 ? '#ff4757' : aggOverall.bounceRate > 2 ? '#ffd166' : '#00e5c3',
                },
              ].map(k => (
                <div key={k.label}
                  className={`rounded-xl border px-4 py-3 ${isLight ? 'bg-white border-black/10' : 'bg-[#111418] border-white/7'}`}
                  style={{ borderBottom: `2px solid ${k.accent}` }}>
                  <div className={`text-[9px] font-mono tracking-wider uppercase mb-2 ${muted}`}>{k.label}</div>
                  <div className={`text-2xl font-bold font-mono ${txt}`}>{k.val}</div>
                  <div className={`text-[10px] mt-1 ${muted}`}>{k.sub}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Tab Switcher ────────────────────────── */}
          <div className="flex items-center gap-1">
            {(['provider', 'domain'] as const).map(tab => (
              <button key={tab} onClick={() => setMmTab(tab)}
                className={`px-3 py-1.5 rounded-lg border text-[10px] font-mono uppercase tracking-wider transition-all
                  ${mmTab === tab
                    ? 'bg-[#4a2fa0] border-[#4a2fa0] text-white'
                    : isLight ? 'border-black/15 text-gray-500 hover:border-black/30' : 'border-white/13 text-[#a8b0be] hover:border-white/25'
                  }`}>
                {tab === 'provider' ? 'Email Provider' : 'Sending Domain'}
              </button>
            ))}
          </div>

          {/* ── Volume + Rate Charts ─────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

            {/* Volume */}
            <div className={`lg:col-span-3 ${card} p-4`}>
              <div className="mb-3">
                <div className={`text-xs font-medium ${txt}`}>Volume Trend</div>
                <div className={`text-[10px] font-mono mt-0.5 ${muted}`}>Sent · Delivered · Opens · Clicks — all {tabLabel}s combined</div>
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

            {/* Rate Trend */}
            <div className={`lg:col-span-2 ${card} p-4`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className={`text-xs font-medium ${txt}`}>
                    Rate Trends — {mmSelectedRow ?? 'Overall'}
                  </div>
                  <div className={`text-[10px] font-mono mt-0.5 ${muted}`}>
                    {mmSelectedRow ? 'Click row again to reset' : 'Click a table row to isolate'}
                  </div>
                </div>
                {mmSelectedRow && (
                  <button onClick={() => setSelected(null)}
                    className={`text-[10px] font-mono px-2 py-1 rounded border transition-all
                      ${isLight ? 'border-black/20 text-gray-500 hover:border-black/40' : 'border-white/13 text-[#a8b0be] hover:border-white/30'}`}>
                    Reset
                  </button>
                )}
              </div>
              <div style={{ height: 200 }}><canvas ref={rateRef} /></div>
              <div className="flex gap-3 mt-3 flex-wrap">
                {[['Success %', RATE_COLORS.successRate], ['Open %', RATE_COLORS.openRate], ['CTR %', RATE_COLORS.clickRate], ['Bounce %', RATE_COLORS.bounceRate]].map(([l, c]) => (
                  <div key={l} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm" style={{ background: c }} />
                    <span className={`text-[10px] font-mono ${muted}`}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── KPI Charts ──────────────────────────── */}
          <div className={`${card} p-4`}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <div className={`text-xs font-medium ${txt}`}>KPI Charts</div>
                <div className={`text-[10px] font-mono mt-0.5 ${muted}`}>
                  {embedView === 'date'
                    ? `X-axis: Dates — each line = one ${tabLabel.toLowerCase()}`
                    : `X-axis: ${tabLabel}s — aggregate for selected period`}
                </div>
              </div>
              <div className={`flex rounded-lg border overflow-hidden ${isLight ? 'border-black/15' : 'border-white/13'}`}>
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

          {/* ── Distribution Pies (provider tab only) ── */}
          {mmTab === 'provider' && entityData.length > 0 && (
            <div className={`${card} p-4`}>
              <div className={`text-xs font-medium mb-4 ${txt}`}>Distribution by Provider</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {(['Sent', 'Opens', 'Clicks'] as const).map((title, idx) => {
                  const metricKeys = ['sent', 'opened', 'clicked'] as const
                  const mk = metricKeys[idx]
                  const total = entityData.reduce((s, e) => s + ((e.data?.[mk] as number) ?? 0), 0)
                  return (
                    <div key={title} className="flex flex-col items-center">
                      <div className={`text-xs font-medium mb-0.5 ${txt}`}>{title}</div>
                      <div className={`text-[10px] font-mono mb-3 ${muted}`}>share of total {title.toLowerCase()}</div>
                      <div style={{ height: 170, width: '100%', maxWidth: 170 }}>
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

          {/* ── Summary Table ────────────────────────── */}
          <div className={`${card} overflow-hidden`}>
            <div className="px-4 py-3 border-b flex items-center justify-between" style={divBdr}>
              <span className={`text-[10px] font-mono uppercase tracking-wider ${muted}`}>
                {mmTab === 'provider' ? 'Email Provider Summary' : 'Sending Domain Summary'}
              </span>
              <span className={`text-[10px] font-mono ${muted}`}>Click row to isolate trends · click again to reset</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: 920 }}>
                <thead className={isLight ? 'bg-gray-50' : 'bg-[#181c22]'}>
                  <tr>
                    {['Provider / Domain','Sent','Delivered','Opens','Clicks','Bounced','Unsubs','Success%','Open%','CTR%','Bounce%','Unsub%'].map((h, i) => (
                      <th key={h} className={`px-3 py-2.5 text-[9px] font-mono tracking-wider uppercase border-b
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
                      onClick={() => setSelected(mmSelectedRow === name ? null : name)}
                      className={`cursor-pointer border-b last:border-0 transition-colors
                        ${isLight ? 'border-black/8 hover:bg-black/3' : 'border-white/7 hover:bg-white/3'}
                        ${mmSelectedRow === name ? (isLight ? 'bg-[#009e88]/7' : 'bg-[#00e5c3]/4') : ''}`}>
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
                    <tr className={`border-t ${isLight ? 'border-black/15 bg-gray-50' : 'border-white/12 bg-[#181c22]'}`}>
                      <td className={`px-3 py-2.5 text-[11px] font-mono font-bold ${txt}`}>TOTAL</td>
                      <td className={`px-3 py-2.5 text-right text-[11px] font-mono font-bold ${txt}`}>{fmtN(aggOverall.sent)}</td>
                      <td className={`px-3 py-2.5 text-right text-[11px] font-mono font-bold ${txt}`}>{fmtN(aggOverall.delivered)}</td>
                      <td className="px-3 py-2.5 text-right text-[11px] font-mono font-bold text-[#00e5c3]">{fmtN(aggOverall.opened)}</td>
                      <td className="px-3 py-2.5 text-right text-[11px] font-mono font-bold text-[#ffd166]">{fmtN(aggOverall.clicked)}</td>
                      <td className={`px-3 py-2.5 text-right text-[11px] font-mono font-bold ${aggOverall.bounced > 0 ? 'text-[#ff4757]' : txt}`}>{fmtN(aggOverall.bounced)}</td>
                      <td className={`px-3 py-2.5 text-right text-[11px] font-mono font-bold ${(aggOverall.unsubscribed ?? 0) > 0 ? 'text-[#ff9a5c]' : txt}`}>{fmtN(aggOverall.unsubscribed ?? 0)}</td>
                      <td className={`px-3 py-2.5 text-right text-[11px] font-mono font-bold ${txt}`}>{fmtP(aggOverall.deliveryRate)}</td>
                      <td className="px-3 py-2.5 text-right text-[11px] font-mono font-bold text-[#00e5c3]">{fmtP(aggOverall.openRate)}</td>
                      <td className="px-3 py-2.5 text-right text-[11px] font-mono font-bold text-[#ffd166]">{fmtP(aggOverall.clickRate)}</td>
                      <td className={`px-3 py-2.5 text-right text-[11px] font-mono font-bold
                        ${aggOverall.bounceRate > 10 ? 'text-[#ff4757]' : aggOverall.bounceRate > 2 ? 'text-[#ffd166]' : txt}`}>
                        {fmtP(aggOverall.bounceRate)}
                      </td>
                      <td className={`px-3 py-2.5 text-right text-[11px] font-mono font-bold ${(aggOverall.unsubRate ?? 0) > 0 ? 'text-[#ff9a5c]' : txt}`}>
                        {fmtP(aggOverall.unsubRate ?? 0, 3)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Day Breakdown ────────────────────────── */}
          {mmSelectedRow && activeDates.some(d => selectedByDate[d]) && (
            <div className={`${card} overflow-hidden`}>
              <div className="px-4 py-3 border-b flex items-center justify-between" style={divBdr}>
                <span className={`text-[10px] font-mono uppercase tracking-wider ${muted}`}>
                  Daily Breakdown — {mmSelectedRow}
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
                        <th key={h} className={`px-3 py-2.5 text-[9px] font-mono tracking-wider uppercase border-b
                          ${i === 0 ? 'text-left' : 'text-right'}
                          ${isLight ? 'border-black/8 text-gray-700' : 'border-white/7 text-[#d4dae6]'}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeDates.filter(d => selectedByDate[d]).map(d => {
                      const r = selectedByDate[d]
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
                          <td className={`px-3 py-2 text-right text-[11px] font-mono
                            ${r.bounceRate > 10 ? 'text-[#ff4757]' : r.bounceRate > 2 ? 'text-[#ffd166]' : muted}`}>
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

          {/* ── Daily KPIs Grid ──────────────────────── */}
          {gridTop5.length > 0 && activeDates.length > 0 && (
            <div className={`${card} overflow-hidden`}>
              <div className="px-4 py-3 border-b" style={divBdr}>
                <span className={`text-[10px] font-mono uppercase tracking-wider ${muted}`}>
                  Daily KPIs Grid — by {tabLabel} · top {gridTop5.length} by volume
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="border-collapse text-[10px] font-mono"
                  style={{ minWidth: gridTop5.length * 5 * 52 + 72 }}>
                  <thead>
                    {/* Entity name row */}
                    <tr className={isLight ? 'bg-gray-50' : 'bg-[#181c22]'}>
                      <th className={`px-3 py-2 text-left border-b ${isLight ? 'border-black/8' : 'border-white/7'}`} />
                      {gridTop5.map(e => (
                        <th key={e.name} colSpan={5}
                          className={`px-2 py-2 border-b border-r text-center ${isLight ? 'border-black/8 text-gray-700' : 'border-white/7 text-[#d4dae6]'}`}>
                          <div className="flex items-center justify-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: e.color }} />
                            <span className="truncate" style={{ maxWidth: 90 }}>{e.name}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                    {/* KPI sub-header row */}
                    <tr className={isLight ? 'bg-gray-50' : 'bg-[#181c22]'}>
                      <th className={`px-3 py-1 border-b ${isLight ? 'border-black/8' : 'border-white/7'}`} />
                      {gridTop5.flatMap(e =>
                        GRID_KPIS.map((kpi, ki) => (
                          <th key={e.name + kpi.key}
                            className={`px-1.5 py-1 border-b text-center ${ki === 4 ? 'border-r' : ''} ${isLight ? 'border-black/8' : 'border-white/7'}`}
                            style={{ color: kpi.color }}>
                            {kpi.label}
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {activeDates.map(d => (
                      <tr key={d} className={`border-b last:border-0 ${isLight ? 'border-black/8' : 'border-white/7'}`}>
                        <td className={`px-3 py-1.5 whitespace-nowrap ${txt}`}>{d}</td>
                        {gridTop5.flatMap(e =>
                          GRID_KPIS.map((kpi, ki) => {
                            const r   = e.byDate[d]
                            const val = r ? (r[kpi.key] as number | undefined) ?? null : null
                            return (
                              <td key={e.name + kpi.key + d}
                                className={`px-1.5 py-1.5 text-center ${ki === 4 ? 'border-r' : ''} ${isLight ? 'border-black/5' : 'border-white/5'}`}
                                style={{ background: heatBg(kpi.key, val) }}>
                                <span className={val == null ? (isLight ? 'text-gray-300' : 'text-white/20') : txt}>
                                  {val != null
                                    ? (kpi.key === 'unsubRate' ? val.toFixed(2) : val.toFixed(1)) + '%'
                                    : '—'}
                                </span>
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
