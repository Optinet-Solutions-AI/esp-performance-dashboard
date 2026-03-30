'use client'
import { useEffect, useRef, useState } from 'react'
import { Chart } from 'chart.js/auto'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Filler, Title, Tooltip, Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { useDashboardStore } from '@/lib/store'
import { aggDates, fmtN, fmtP, getGridColor, getTextColor, CHART_TOOLTIP_OPTS } from '@/lib/utils'
import { PROVIDER_COLORS, DOMAIN_COLORS, IP_COLOR_PALETTE, ESP_COLORS } from '@/lib/data'
import type { MmData, MmTabType } from '@/lib/types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Title, Tooltip, Legend)

const EMPTY_DATA: MmData = { dates: [], datesFull: [], providers: {}, domains: {}, overallByDate: {}, providerDomains: {} }

function TrendCharts({ activeDates, overallByDate, brandColor, isLight, gc, tc }: {
  activeDates: string[]
  overallByDate: MmData['overallByDate']
  brandColor: string
  isLight: boolean
  gc: string
  tc: string
}) {
  const cardClass = `rounded-xl border ${isLight ? 'bg-white border-black/10' : 'bg-[#111418] border-white/7'}`

  const perDateMetrics = activeDates.map(d => {
    const r = overallByDate[d]
    if (!r) return null
    return {
      date: d,
      sent: r.sent || 0,
      delivered: r.delivered || 0,
      deliveryRate: r.deliveryRate || 0,
      openRate: r.openRate || 0,
      bounceRate: r.bounceRate || 0,
    }
  }).filter(Boolean) as { date: string; sent: number; delivered: number; deliveryRate: number; openRate: number; bounceRate: number }[]

  const labels = perDateMetrics.map(r => r.date)

  const volumeOptions = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: { legend: { display: false }, tooltip: { ...CHART_TOOLTIP_OPTS } },
    scales: {
      x: { ticks: { color: tc, font: { size: 9 }, maxRotation: 30, autoSkip: true }, grid: { display: false }, border: { display: false } },
      y: { ticks: { color: tc, font: { size: 9 }, callback: (v: number | string) => fmtN(Number(v)) }, grid: { color: gc }, border: { display: false } },
    },
  }

  const rateOptions = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: { legend: { display: false }, tooltip: { ...CHART_TOOLTIP_OPTS } },
    scales: {
      x: { ticks: { color: tc, font: { size: 9 }, maxRotation: 30, autoSkip: true }, grid: { display: false }, border: { display: false } },
      y: { ticks: { color: tc, font: { size: 9 }, callback: (v: number | string) => v + '%' }, grid: { color: gc }, border: { display: false } },
    },
  }

  const charts = [
    {
      label: 'Volume Over Time', sublabel: 'Sent + Delivered', accent: '#6b7280',
      data: {
        labels,
        datasets: [
          { label: 'Sent', data: perDateMetrics.map(r => r.sent), borderColor: '#6b7280', backgroundColor: 'rgba(107,114,128,0.06)', fill: true, tension: 0.35, pointRadius: 4, pointHoverRadius: 7, borderWidth: 2 },
          { label: 'Delivered', data: perDateMetrics.map(r => r.delivered), borderColor: brandColor, backgroundColor: brandColor + '12', fill: true, tension: 0.35, pointRadius: 4, pointHoverRadius: 7, borderWidth: 2 },
        ],
      },
      opts: volumeOptions,
    },
    {
      label: 'Delivery Rate Trend', sublabel: 'Delivered ÷ Sent × 100', accent: '#00e5c3',
      data: { labels, datasets: [{ label: 'Delivery Rate', data: perDateMetrics.map(r => +r.deliveryRate.toFixed(2)), borderColor: '#00e5c3', backgroundColor: 'rgba(0,229,195,0.08)', fill: true, tension: 0.35, pointRadius: 4, pointHoverRadius: 7, borderWidth: 2 }] },
      opts: rateOptions,
    },
    {
      label: 'Open Rate Trend', sublabel: 'Opens ÷ Delivered × 100', accent: brandColor,
      data: { labels, datasets: [{ label: 'Open Rate', data: perDateMetrics.map(r => +r.openRate.toFixed(2)), borderColor: brandColor, backgroundColor: brandColor + '12', fill: true, tension: 0.35, pointRadius: 4, pointHoverRadius: 7, borderWidth: 2 }] },
      opts: rateOptions,
    },
    {
      label: 'Bounce Rate Trend', sublabel: 'Bounced ÷ Sent × 100', accent: '#ff4757',
      data: { labels, datasets: [{ label: 'Bounce Rate', data: perDateMetrics.map(r => +r.bounceRate.toFixed(2)), borderColor: '#ff4757', backgroundColor: 'rgba(255,71,87,0.06)', fill: true, tension: 0.35, pointRadius: 4, pointHoverRadius: 7, borderWidth: 2 }] },
      opts: rateOptions,
    },
  ]

  if (perDateMetrics.length === 0) return null

  return (
    <div className="mt-5">
      <div className={`text-xs font-mono tracking-wider uppercase mb-3 ${isLight ? 'text-gray-400' : 'text-[#a8b0be]'}`}>KPI Trends</div>
      <div className="grid grid-cols-2 gap-4">
        {charts.map(chart => (
          <div key={chart.label} className={`${cardClass} p-4`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-sm font-semibold" style={{ color: chart.accent }}>{chart.label}</div>
                <div className={`text-[10px] font-mono mt-0.5 ${isLight ? 'text-gray-400' : 'text-[#a8b0be]'}`}>{chart.sublabel}</div>
              </div>
              <div className={`text-[9px] font-mono px-2 py-0.5 rounded border ${isLight ? 'border-black/15 text-gray-500' : 'border-white/13 text-[#a8b0be]'}`}>
                {activeDates.length}d
              </div>
            </div>
            <div style={{ height: 200 }}>
              <Line data={chart.data} options={chart.opts} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface ProviderRowProps {
  name: string
  data: ReturnType<typeof aggDates>
  color: string
  isLight: boolean
  isSelected: boolean
  onSelect: () => void
  maxSent: number
}

function ProviderRow({ name, data, color, isLight, isSelected, onSelect }: ProviderRowProps) {
  if (!data) return null
  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer border-b last:border-0 transition-colors
        ${isLight ? 'border-black/8 hover:bg-black/3' : 'border-white/7 hover:bg-white/3'}
        ${isSelected ? (isLight ? 'bg-[#009e88]/7' : 'bg-[#00e5c3]/4') : ''}`}
    >
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: color }} />
          <span className={`text-xs font-mono ${isLight ? 'text-gray-800' : 'text-[#f0f2f5]'}`}>{name}</span>
        </div>
      </td>
      <td className={`px-4 py-2.5 text-right text-[11px] font-mono ${isLight ? 'text-gray-600' : 'text-[#a8b0be]'}`}>{fmtN(data.sent)}</td>
      <td className={`px-4 py-2.5 text-right text-[11px] font-mono ${isLight ? 'text-gray-800' : 'text-[#f0f2f5]'}`}>{fmtP(data.deliveryRate)}</td>
      <td className={`px-4 py-2.5 text-right text-[11px] font-mono ${isLight ? 'text-gray-800' : 'text-[#f0f2f5]'}`}>{fmtP(data.openRate)}</td>
      <td className={`px-4 py-2.5 text-right text-[11px] font-mono ${isLight ? 'text-gray-800' : 'text-[#f0f2f5]'}`}>{fmtP(data.clickRate)}</td>
      <td className={`px-4 py-2.5 text-right text-[11px] font-mono
        ${data.bounceRate > 10 ? 'text-[#ff4757]' : data.bounceRate > 2 ? 'text-[#ffd166]' : (isLight ? 'text-gray-800' : 'text-[#f0f2f5]')}`}>
        {fmtP(data.bounceRate)}
      </td>
    </tr>
  )
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

  // Pick initial ESP: use reviewEsp if available, else first ESP in filtered list
  useEffect(() => {
    if (!selectedEsp || !espList.includes(selectedEsp)) {
      const def = store.reviewEsp && espList.includes(store.reviewEsp)
        ? store.reviewEsp
        : espList[0] || ''
      if (def) setSelectedEsp(def)
    }
  }, [espList.join(','), store.reviewEsp])

  // Reset selected row when ESP changes
  useEffect(() => {
    store.setMmSelectedRow(null)
  }, [selectedEsp])

  const data: MmData = store.espData[selectedEsp] ?? EMPTY_DATA
  const fromIdx = store.espRanges[selectedEsp]?.fromIdx ?? 0
  const toIdx = store.espRanges[selectedEsp]?.toIdx ?? 0
  const setRange = (from: number, to: number) => store.setEspRange(selectedEsp, from, to)

  // Calendar date state (ISO strings)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // Sync calendar inputs when ESP or data changes
  useEffect(() => {
    if (data.datesFull.length) {
      setFromDate(data.datesFull[fromIdx]?.iso || '')
      setToDate(data.datesFull[toIdx]?.iso || '')
    }
  }, [selectedEsp, data.datesFull.length])

  function findFromIdx(iso: string): number {
    const idx = data.datesFull.findIndex(df => df.iso >= iso)
    return idx === -1 ? 0 : idx
  }
  function findToIdx(iso: string): number {
    let found = data.datesFull.length - 1
    for (let i = data.datesFull.length - 1; i >= 0; i--) {
      if (data.datesFull[i].iso <= iso) { found = i; break }
    }
    return found
  }
  function handleFromDate(iso: string) {
    setFromDate(iso)
    if (iso) setRange(findFromIdx(iso), toIdx)
  }
  function handleToDate(iso: string) {
    setToDate(iso)
    if (iso) setRange(fromIdx, findToIdx(iso))
  }
  function handleAllDates() {
    setRange(0, data.dates.length - 1)
    setFromDate(data.datesFull[0]?.iso || '')
    setToDate(data.datesFull[data.datesFull.length - 1]?.iso || '')
  }
  const mmTab = store.mmTab
  const setMmTab = store.setMmTab
  const mmSelectedRow = store.mmSelectedRow
  const setMmSelectedRow = store.setMmSelectedRow

  const gc = getGridColor(isLight)
  const tc = getTextColor(isLight)

  const activeDates = data.dates.slice(fromIdx, toIdx + 1)

  const trendRef = useRef<HTMLCanvasElement>(null)
  const trendChart = useRef<Chart | null>(null)

  const aggOverall = aggDates(data.overallByDate, activeDates)

  function getEntities() {
    if (mmTab === 'provider') return Object.keys(data.providers || {})
    return Object.keys(data.domains || {})
  }

  function getEntityData(name: string) {
    if (mmTab === 'provider') return aggDates(data.providers[name]?.byDate || {}, activeDates)
    return aggDates(data.domains[name]?.byDate || {}, activeDates)
  }

  function getEntityColor(name: string, idx: number): string {
    if (mmTab === 'provider') return PROVIDER_COLORS[name] || IP_COLOR_PALETTE[idx % IP_COLOR_PALETTE.length]
    return DOMAIN_COLORS[name] || IP_COLOR_PALETTE[idx % IP_COLOR_PALETTE.length]
  }

  const entities = getEntities()
  const entityData = entities.map(e => ({ name: e, data: getEntityData(e) })).filter(e => e.data && e.data.sent > 0)
  const maxSent = Math.max(...entityData.map(e => e.data?.sent || 0), 1)

  useEffect(() => {
    if (!trendRef.current || !mmSelectedRow) {
      if (trendChart.current) { trendChart.current.destroy(); trendChart.current = null }
      return
    }
    if (trendChart.current) { trendChart.current.destroy(); trendChart.current = null }

    const byDate = mmTab === 'provider'
      ? data.providers[mmSelectedRow]?.byDate
      : data.domains[mmSelectedRow]?.byDate

    if (!byDate) return
    const color = getEntityColor(mmSelectedRow, entities.indexOf(mmSelectedRow))

    trendChart.current = new Chart(trendRef.current, {
      type: 'line',
      data: {
        labels: activeDates,
        datasets: [
          { label: 'Delivery %', data: activeDates.map(d => byDate[d]?.deliveryRate ?? null), borderColor: color, backgroundColor: 'transparent', tension: 0.3, borderWidth: 2 },
          { label: 'Open %', data: activeDates.map(d => byDate[d]?.openRate ?? null), borderColor: '#7c5cfc', backgroundColor: 'transparent', tension: 0.3, borderWidth: 2, borderDash: [4, 4] },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { ...CHART_TOOLTIP_OPTS } },
        scales: {
          x: { ticks: { color: tc, font: { size: 9 } }, grid: { display: false } },
          y: { min: 0, max: 100, ticks: { color: tc, font: { size: 9 }, callback: v => v + '%' }, grid: { color: gc }, border: { display: false } },
        },
      },
    })

    return () => { trendChart.current?.destroy(); trendChart.current = null }
  }, [mmSelectedRow, mmTab, isLight, fromIdx, toIdx])

  const brandColor = ESP_COLORS[selectedEsp] || '#00e5c3'
  const selectCls = `px-3 py-1.5 rounded-lg border text-xs font-mono outline-none appearance-none
    ${isLight ? 'bg-white border-black/20 text-gray-800' : 'bg-[#1e232b] border-white/18 text-white'}`

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className={`text-2xl font-bold tracking-tight ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>
            ESP Review
          </h1>
          <p className={`text-sm mt-1 ${isLight ? 'text-gray-500' : 'text-[#a8b0be]'}`}>
            Provider and domain deliverability breakdown
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* ESP selector */}
          {espList.length > 0 && (
            <select
              value={selectedEsp}
              onChange={e => setSelectedEsp(e.target.value)}
              className={selectCls}
            >
              {espList.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          )}
          {/* Date range — calendar */}
          <input
            type="date"
            value={fromDate}
            min="2025-01-01"
            onChange={e => handleFromDate(e.target.value)}
            className={selectCls}
          />
          <span className={`text-xs ${isLight ? 'text-gray-400' : 'text-[#a8b0be]'}`}>→</span>
          <input
            type="date"
            value={toDate}
            min="2025-01-01"
            onChange={e => handleToDate(e.target.value)}
            className={selectCls}
          />
          <button
            onClick={handleAllDates}
            className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-mono uppercase transition-all
              ${isLight ? 'border-black/20 text-gray-500 hover:border-[#009e88]' : 'border-white/13 text-[#a8b0be] hover:border-[#00e5c3]'}`}
          >
            All
          </button>
        </div>
      </div>

      {espList.length === 0 || data.dates.length === 0 ? (
        <div className={`rounded-xl border p-12 text-center ${isLight ? 'bg-white border-black/10' : 'bg-[#111418] border-white/7'}`}>
          <div className="text-4xl mb-4">📬</div>
          <div className={`text-lg font-medium mb-2 ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>No data yet</div>
          <div className={`text-sm ${isLight ? 'text-gray-500' : 'text-[#a8b0be]'}`}>
            Upload a file via Upload Report to see data here.
          </div>
        </div>
      ) : (
        <>
          {/* KPI row */}
          {aggOverall && (
            <div className="grid grid-cols-5 gap-3 mb-5">
              {[
                { label: 'Sent', val: fmtN(aggOverall.sent), accent: brandColor },
                { label: 'Delivery Rate', val: fmtP(aggOverall.deliveryRate), accent: '#00e5c3' },
                { label: 'Open Rate', val: fmtP(aggOverall.openRate), accent: '#7c5cfc' },
                { label: 'CTR', val: fmtP(aggOverall.clickRate), accent: '#ffd166' },
                { label: 'Bounce Rate', val: fmtP(aggOverall.bounceRate),
                  accent: aggOverall.bounceRate > 10 ? '#ff4757' : aggOverall.bounceRate > 2 ? '#ffd166' : '#00e5c3' },
              ].map(k => (
                <div key={k.label} className={`rounded-xl border px-4 py-3 ${isLight ? 'bg-white border-black/10' : 'bg-[#111418] border-white/7'}`}
                  style={{ borderLeft: `3px solid ${k.accent}` }}>
                  <div className={`text-[10px] font-mono tracking-wider uppercase mb-1 ${isLight ? 'text-gray-400' : 'text-[#a8b0be]'}`}>{k.label}</div>
                  <div className={`text-xl font-bold ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>{k.val}</div>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-4">
            {(['ip', 'provider', 'domain'] as MmTabType[]).map(tab => (
              <button
                key={tab}
                onClick={() => setMmTab(tab)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-mono uppercase tracking-wider transition-all
                  ${mmTab === tab
                    ? 'bg-[#4a2fa0] border-[#4a2fa0] text-white'
                    : isLight ? 'border-black/15 text-gray-500 hover:border-black/30' : 'border-white/13 text-[#a8b0be] hover:border-white/25'
                  }`}
              >
                {tab === 'ip' ? 'IP' : tab === 'provider' ? 'Provider' : 'Domain'}
              </button>
            ))}
          </div>

          {/* Trend chart */}
          {mmSelectedRow && (
            <div className={`rounded-xl border p-4 mb-4 ${isLight ? 'bg-white border-black/10' : 'bg-[#111418] border-white/7'}`}>
              <div className="mb-3">
                <div className={`text-xs font-mono ${isLight ? 'text-gray-800' : 'text-[#f0f2f5]'}`}>{mmSelectedRow}</div>
                <div className={`text-[10px] ${isLight ? 'text-gray-400' : 'text-[#a8b0be]'}`}>Trend — Delivery & Open rate · Click row again to close</div>
              </div>
              <div style={{ height: 140 }}>
                <canvas ref={trendRef} />
              </div>
            </div>
          )}

          {/* Table */}
          <div className={`rounded-xl border overflow-hidden ${isLight ? 'bg-white border-black/10' : 'bg-[#111418] border-white/7'}`}>
            <table className="w-full border-collapse">
              <thead className={isLight ? 'bg-gray-50' : 'bg-[#181c22]'}>
                <tr>
                  {['Name', 'Sent', 'Delivery %', 'Open %', 'CTR', 'Bounce %'].map((h, i) => (
                    <th key={h} className={`px-4 py-3 text-[9px] font-mono tracking-wider uppercase border-b
                      ${i > 0 ? 'text-right' : 'text-left'}
                      ${isLight ? 'border-black/8 text-gray-700' : 'border-white/7 text-[#d4dae6]'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entityData.length === 0 ? (
                  <tr><td colSpan={6} className={`px-4 py-8 text-center text-sm ${isLight ? 'text-gray-400' : 'text-[#a8b0be]'}`}>No data for selected range</td></tr>
                ) : (
                  entityData.map(({ name, data: d }, idx) => (
                    <ProviderRow
                      key={name}
                      name={name}
                      data={d}
                      color={getEntityColor(name, idx)}
                      isLight={isLight}
                      isSelected={mmSelectedRow === name}
                      onSelect={() => setMmSelectedRow(mmSelectedRow === name ? null : name)}
                      maxSent={maxSent}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* KPI Trend Charts */}
          <TrendCharts
            activeDates={activeDates}
            overallByDate={data.overallByDate}
            brandColor={brandColor}
            isLight={isLight}
            gc={gc}
            tc={tc}
          />
        </>
      )}
    </div>
  )
}
