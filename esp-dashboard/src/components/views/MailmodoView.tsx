'use client'
import { useEffect, useRef } from 'react'
import { Chart } from 'chart.js/auto'
import { useDashboardStore } from '@/lib/store'
import { aggDates, fmtN, fmtP, getGridColor, getTextColor, CHART_TOOLTIP_OPTS, buildProviderDomains } from '@/lib/utils'
import { PROVIDER_COLORS, DOMAIN_COLORS, IP_COLOR_PALETTE } from '@/lib/data'
import type { MmData, MmTabType } from '@/lib/types'
import { supabase } from '@/lib/supabase'

interface ProviderRowProps {
  name: string
  data: ReturnType<typeof aggDates>
  color: string
  isLight: boolean
  isSelected: boolean
  onSelect: () => void
  maxSent: number
}

function ProviderRow({ name, data, color, isLight, isSelected, onSelect, maxSent }: ProviderRowProps) {
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

interface Props {
  ctx: 'mailmodo' | 'ongage'
}

export default function MailmodoView({ ctx }: Props) {
  const store = useDashboardStore()
  const isLight = store.isLight
  const data: MmData = ctx === 'mailmodo' ? store.mmData : store.ogData
  const fromIdx = ctx === 'mailmodo' ? store.mmFromIdx : store.ogFromIdx
  const toIdx = ctx === 'mailmodo' ? store.mmToIdx : store.ogToIdx
  const setRange = ctx === 'mailmodo' ? store.setMmRange : store.setOgRange
  const mmTab = store.mmTab
  const setMmTab = store.setMmTab
  const mmSelectedRow = store.mmSelectedRow
  const setMmSelectedRow = store.setMmSelectedRow

  const gc = getGridColor(isLight)
  const tc = getTextColor(isLight)

  // Fetch all records for this category from Supabase and merge into store
  useEffect(() => {
    const setData = ctx === 'mailmodo' ? store.setMmData : store.setOgData
    supabase
      .from('reports')
      .select('data')
      .eq('category', ctx)
      .then(({ data: rows }) => {
        if (!rows || rows.length === 0) return
        // Merge all provider rows into one MmData
        let merged: MmData = { dates: [], datesFull: [], providers: {}, domains: {}, overallByDate: {}, providerDomains: {} }
        for (const row of rows) {
          const src = row.data as MmData
          if (!src?.dates?.length) continue
          // Merge dates
          src.dates.forEach(d => { if (!merged.dates.includes(d)) merged.dates.push(d) })
          // Merge providers
          Object.entries(src.providers || {}).forEach(([name, pd]) => {
            if (!merged.providers[name]) merged.providers[name] = { overall: pd.overall, byDate: { ...pd.byDate } }
            else Object.assign(merged.providers[name].byDate, pd.byDate)
          })
          // Merge domains
          Object.entries(src.domains || {}).forEach(([name, pd]) => {
            if (!merged.domains[name]) merged.domains[name] = { overall: pd.overall, byDate: { ...pd.byDate } }
            else Object.assign(merged.domains[name].byDate, pd.byDate)
          })
          // Merge overallByDate
          Object.entries(src.overallByDate || {}).forEach(([d, m]) => {
            merged.overallByDate[d] = m
          })
        }
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
        merged.dates.sort((a, b) => {
          const [am, ad] = a.split(' '), [bm, bd] = b.split(' ')
          return (months.indexOf(am) * 31 + parseInt(ad)) - (months.indexOf(bm) * 31 + parseInt(bd))
        })
        merged.datesFull = merged.dates.map(d => ({ label: d, year: new Date().getFullYear() }))
        merged.providerDomains = buildProviderDomains(merged)
        setData(merged)
      })
  }, [ctx])

  const activeDates = data.dates.slice(fromIdx, toIdx + 1)

  const trendRef = useRef<HTMLCanvasElement>(null)
  const trendChart = useRef<Chart | null>(null)

  // KPI aggregation
  const aggOverall = aggDates(data.overallByDate, activeDates)

  // Get entity list by tab
  function getEntities() {
    if (mmTab === 'provider') return Object.keys(data.providers || {})
    if (mmTab === 'domain') return Object.keys(data.domains || {})
    // ip: use domains as proxy for IP rows
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

  // Trend chart for selected row
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

  const brandColor = ctx === 'mailmodo' ? '#7c5cfc' : '#ffd166'
  const title = ctx === 'mailmodo' ? 'Mailmodo Review' : 'Ongage Review'

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className={`text-2xl font-bold tracking-tight ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>
            {title}
          </h1>
          <p className={`text-sm mt-1 ${isLight ? 'text-gray-500' : 'text-[#a8b0be]'}`}>
            Provider and domain deliverability breakdown
          </p>
        </div>
        {/* Date range */}
        <div className="flex items-center gap-2">
          <select
            value={fromIdx}
            onChange={e => setRange(Number(e.target.value), toIdx)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono outline-none
              ${isLight ? 'bg-white border-black/20 text-gray-800' : 'bg-[#1e232b] border-white/18 text-white'}`}
          >
            {data.dates.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
          <span className={`text-xs ${isLight ? 'text-gray-400' : 'text-[#a8b0be]'}`}>→</span>
          <select
            value={toIdx}
            onChange={e => setRange(fromIdx, Number(e.target.value))}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono outline-none
              ${isLight ? 'bg-white border-black/20 text-gray-800' : 'bg-[#1e232b] border-white/18 text-white'}`}
          >
            {data.dates.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
          <button
            onClick={() => setRange(0, data.dates.length - 1)}
            className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-mono uppercase transition-all
              ${isLight ? 'border-black/20 text-gray-500 hover:border-[#009e88]' : 'border-white/13 text-[#a8b0be] hover:border-[#00e5c3]'}`}
          >
            All
          </button>
        </div>
      </div>

      {data.dates.length === 0 ? (
        <div className={`rounded-xl border p-12 text-center ${isLight ? 'bg-white border-black/10' : 'bg-[#111418] border-white/7'}`}>
          <div className="text-4xl mb-4">📬</div>
          <div className={`text-lg font-medium mb-2 ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>No data yet</div>
          <div className={`text-sm ${isLight ? 'text-gray-500' : 'text-[#a8b0be]'}`}>
            Upload a {ctx === 'mailmodo' ? 'Mailmodo' : 'Ongage'} file via Upload Report to see data here.
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

          {/* Trend chart (when row selected) */}
          {mmSelectedRow && (
            <div className={`rounded-xl border p-4 mb-4 ${isLight ? 'bg-white border-black/10' : 'bg-[#111418] border-white/7'}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className={`text-xs font-mono ${isLight ? 'text-gray-800' : 'text-[#f0f2f5]'}`}>{mmSelectedRow}</div>
                  <div className={`text-[10px] ${isLight ? 'text-gray-400' : 'text-[#a8b0be]'}`}>Trend — Delivery & Open rate</div>
                </div>
                <button
                  onClick={() => setMmSelectedRow(null)}
                  className={`text-xs font-mono px-2 py-1 rounded border transition-all
                    ${isLight ? 'border-black/15 text-gray-400 hover:border-black/30' : 'border-white/13 text-[#a8b0be] hover:border-white/30'}`}
                >
                  ✕ Close
                </button>
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
        </>
      )}
    </div>
  )
}
