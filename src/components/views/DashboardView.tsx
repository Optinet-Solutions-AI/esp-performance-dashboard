'use client'
import { useEffect, useRef, useState } from 'react'
import { Chart } from 'chart.js/auto'
import { useDashboardStore } from '@/lib/store'
import { fmtN, fmtP, exportCSV, getGridColor, getTextColor, chartTooltip } from '@/lib/utils'
import KpiCard from '@/components/ui/KpiCard'
import ChartCard, { LegendItem } from '@/components/ui/ChartCard'
import StatusPill from '@/components/ui/StatusPill'
import type { EspRecord } from '@/lib/types'

const ESP_COLORS = ['#00e5c3','#7c5cfc','#ffd166','#ff6b35','#ff4757','#60d4f0','#c5f27a','#b39dff']

export default function DashboardView() {
  const {
    isLight, esps, daily7, activeFilter, activeEsp, sortKey, sortDir, searchQ,
    setFilter, setActiveEsp, setSort, setSearch,
  } = useDashboardStore()

  const gc = getGridColor(isLight)
  const tc = getTextColor(isLight)

  const sentRef = useRef<HTMLCanvasElement>(null)
  const rateRef = useRef<HTMLCanvasElement>(null)
  const bounceRef = useRef<HTMLCanvasElement>(null)
  const clickRef = useRef<HTMLCanvasElement>(null)
  const dailyRef = useRef<HTMLCanvasElement>(null)
  const charts = useRef<Record<string, Chart>>({})

  function getFiltered(): EspRecord[] {
    let data = [...esps]
    if (activeEsp) data = data.filter(e => e.name === activeEsp)
    else if (activeFilter !== 'all') data = data.filter(e => e.status === activeFilter)
    if (searchQ) data = data.filter(e => e.name.toLowerCase().includes(searchQ.toLowerCase()))
    if (sortKey) {
      data.sort((a, b) => {
        const av = a[sortKey as keyof EspRecord] as number | string
        const bv = b[sortKey as keyof EspRecord] as number | string
        if (typeof av === 'string') return String(av).localeCompare(String(bv)) * sortDir
        return ((av as number) - (bv as number)) * sortDir
      })
    }
    return data
  }

  const filtered = getFiltered()

  // KPI totals
  const totals = filtered.reduce((acc, e) => {
    acc.sent += e.sent; acc.delivered += e.delivered; acc.opens += e.opens
    acc.clicks += e.clicks; acc.bounced += e.bounced
    return acc
  }, { sent: 0, delivered: 0, opens: 0, clicks: 0, bounced: 0 })

  const criticals = filtered.filter(e => e.status === 'critical')

  useEffect(() => {
    const destroyAll = () => Object.values(charts.current).forEach(c => c.destroy())
    destroyAll()
    charts.current = {}

    const baseOpts = {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { ...chartTooltip(isLight) } },
    }

    if (sentRef.current) {
      charts.current['sent'] = new Chart(sentRef.current, {
        type: 'bar',
        data: { labels: filtered.map(e => e.name), datasets: [{ data: filtered.map(e => e.sent), backgroundColor: filtered.map((_, i) => ESP_COLORS[i % ESP_COLORS.length] + 'bb'), borderRadius: 4 }] },
        options: { ...baseOpts, scales: { x: { ticks: { color: tc, font: { size: 9 } }, grid: { display: false } }, y: { ticks: { color: tc, font: { size: 9 }, callback: v => fmtN(Number(v)) }, grid: { color: gc }, border: { display: false } } } },
      })
    }
    if (rateRef.current) {
      charts.current['rate'] = new Chart(rateRef.current, {
        type: 'bar',
        data: { labels: filtered.map(e => e.name), datasets: [{ data: filtered.map(e => e.deliveryRate), backgroundColor: filtered.map((_, i) => ESP_COLORS[i % ESP_COLORS.length] + 'bb'), borderRadius: 4 }] },
        options: { ...baseOpts, scales: { x: { ticks: { color: tc, font: { size: 9 } }, grid: { display: false } }, y: { min: 0, max: 100, ticks: { color: tc, font: { size: 9 }, callback: v => v + '%' }, grid: { color: gc }, border: { display: false } } } },
      })
    }
    if (bounceRef.current) {
      charts.current['bounce'] = new Chart(bounceRef.current, {
        type: 'bar',
        data: { labels: filtered.map(e => e.name), datasets: [{ data: filtered.map(e => e.bounceRate), backgroundColor: filtered.map(e => e.status === 'critical' ? '#ff4757bb' : e.status === 'warn' ? '#ffd166bb' : '#00e5c3bb'), borderRadius: 4 }] },
        options: { ...baseOpts, scales: { x: { ticks: { color: tc, font: { size: 9 } }, grid: { display: false } }, y: { ticks: { color: tc, font: { size: 9 }, callback: v => v + '%' }, grid: { color: gc }, border: { display: false } } } },
      })
    }
    if (clickRef.current) {
      charts.current['click'] = new Chart(clickRef.current, {
        type: 'bar',
        data: { labels: filtered.map(e => e.name), datasets: [{ data: filtered.map(e => e.clickRate), backgroundColor: '#7c5cfcbb', borderRadius: 4 }] },
        options: { ...baseOpts, scales: { x: { ticks: { color: tc, font: { size: 9 } }, grid: { display: false } }, y: { ticks: { color: tc, font: { size: 9 }, callback: v => v + '%' }, grid: { color: gc }, border: { display: false } } } },
      })
    }
    if (dailyRef.current) {
      charts.current['daily'] = new Chart(dailyRef.current, {
        type: 'line',
        data: {
          labels: daily7.map(d => d.date),
          datasets: [
            { label: 'Sent', data: daily7.map(d => d.sent), borderColor: '#00e5c3', backgroundColor: 'transparent', tension: 0.3, borderWidth: 2 },
            { label: 'Opens', data: daily7.map(d => d.opens), borderColor: '#7c5cfc', backgroundColor: 'transparent', tension: 0.3, borderWidth: 2 },
          ],
        },
        options: { ...baseOpts, plugins: { legend: { display: false }, tooltip: { ...chartTooltip(isLight) } }, scales: { x: { ticks: { color: tc, font: { size: 9 } }, grid: { display: false } }, y: { ticks: { color: tc, font: { size: 9 }, callback: v => fmtN(Number(v)) }, grid: { color: gc }, border: { display: false } } } },
      })
    }

    return destroyAll
  }, [isLight, filtered.length, activeFilter, activeEsp, sortKey, sortDir, searchQ])

  const thText = isLight ? 'text-gray-900' : 'text-[#d4dae6]'
  const tdText = isLight ? 'text-gray-800' : 'text-[#f0f2f5]'

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className={`text-2xl font-bold tracking-tight ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>
            Dashboard
          </h1>
          <p className={`text-sm mt-1 ${isLight ? 'text-gray-500' : 'text-[#a8b0be]'}`}>ESP performance overview</p>
        </div>
        <button
          onClick={() => exportCSV(filtered)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono transition-all
            ${isLight ? 'bg-white border-black/20 text-gray-600 hover:border-[#009e88] hover:text-[#009e88]' : 'bg-transparent border-white/13 text-[#a8b0be] hover:border-[#00e5c3] hover:text-[#00e5c3]'}`}
        >
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 2v8M5 7l3 3 3-3" /><rect x="2" y="11" width="12" height="3" rx="1" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Alert strip */}
      {criticals.length > 0 && (
        <div
          onClick={() => setFilter('critical')}
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-[#ff4757]/20 bg-[#ff4757]/8 mb-5 cursor-pointer hover:bg-[#ff4757]/12 transition-colors"
        >
          <span className="w-4 h-4 flex-shrink-0 text-[#ff4757]">⚠</span>
          <span className="text-sm text-[#ff4757]">
            <strong>{criticals.length} ESP{criticals.length > 1 ? 's' : ''}</strong> need attention — {criticals.map(e => e.name).join(', ')}
          </span>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        <KpiCard label="Emails Sent" value={fmtN(totals.sent)} accent="#00e5c3" />
        <KpiCard label="Delivered" value={fmtN(totals.delivered)} accent="#7c5cfc" />
        <KpiCard label="Opens" value={fmtN(totals.opens)} accent="#ffd166" />
        <KpiCard label="Clicks" value={fmtN(totals.clicks)} accent="#ff6b35" />
        <KpiCard label="Bounced" value={fmtN(totals.bounced)} accent="#ff4757" onClick={() => setFilter('critical')} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="col-span-2">
          <ChartCard title="Volume by ESP" subtitle="Emails sent" height={140}>
            <canvas ref={sentRef} />
          </ChartCard>
        </div>
        <ChartCard title="Delivery Rate" subtitle="% delivered" height={140}>
          <canvas ref={rateRef} />
        </ChartCard>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        <ChartCard title="Bounce Rate" subtitle="% bounced" height={120}>
          <canvas ref={bounceRef} />
        </ChartCard>
        <ChartCard title="Click Rate" subtitle="% CTR" height={120}>
          <canvas ref={clickRef} />
        </ChartCard>
        <ChartCard title="7-Day Trend" subtitle="Sent & Opens"
          height={120}
          legend={<><LegendItem color="#00e5c3" label="Sent" /><LegendItem color="#7c5cfc" label="Opens" /></>}
        >
          <canvas ref={dailyRef} />
        </ChartCard>
      </div>

      {/* Table */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className={`text-[10px] font-mono tracking-[0.12em] uppercase ${isLight ? 'text-gray-400' : 'text-[#a8b0be]'}`}>
            ESP Table
          </span>
          <div className="flex items-center gap-2">
            <input
              value={searchQ}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono outline-none transition-all w-36
                ${isLight ? 'bg-gray-50 border-black/15 text-gray-900 placeholder-gray-400 focus:border-[#009e88]' : 'bg-[#181c22] border-white/13 text-[#f0f2f5] placeholder-[#a8b0be] focus:border-[#00e5c3]'}`}
            />
            {(['all', 'healthy', 'warn', 'critical'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono uppercase tracking-wider transition-all
                  ${activeFilter === f
                    ? f === 'all' ? 'border-[#00e5c3]/40 text-[#00e5c3] bg-[#00e5c3]/10'
                      : f === 'healthy' ? 'border-[#00e5c3]/40 text-[#00e5c3] bg-[#00e5c3]/10'
                      : f === 'warn' ? 'border-[#ffd166]/40 text-[#ffd166] bg-[#ffd166]/10'
                      : 'border-[#ff4757]/40 text-[#ff4757] bg-[#ff4757]/10'
                    : isLight ? 'border-black/15 text-gray-500 hover:border-black/30' : 'border-white/13 text-[#a8b0be] hover:border-white/25'
                  }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className={`rounded-xl border overflow-hidden ${isLight ? 'bg-white border-black/10' : 'bg-[#111418] border-white/7'}`}>
          <table className="w-full border-collapse">
            <thead className={isLight ? 'bg-gray-50' : 'bg-[#181c22]'}>
              <tr>
                {['name','sent','deliveryRate','openRate','clickRate','bounceRate'].map(k => (
                  <th
                    key={k}
                    onClick={() => setSort(k)}
                    className={`px-4 py-3 text-left text-[9px] font-mono tracking-wider uppercase border-b select-none cursor-pointer transition-colors
                      ${isLight ? 'border-black/8 text-gray-700 hover:text-gray-900' : 'border-white/7 text-[#d4dae6] hover:text-[#f0f2f5]'}
                      ${k !== 'name' ? 'text-right' : ''}`}
                  >
                    {k === 'name' ? 'ESP' : k === 'sent' ? 'Sent' : k === 'deliveryRate' ? 'Delivery %' : k === 'openRate' ? 'Open %' : k === 'clickRate' ? 'CTR' : 'Bounce %'}
                    <i className="ml-1 opacity-40 not-italic">
                      {sortKey === k ? (sortDir === 1 ? '↑' : '↓') : '⇅'}
                    </i>
                  </th>
                ))}
                <th className={`px-4 py-3 text-left text-[9px] font-mono tracking-wider uppercase border-b ${isLight ? 'border-black/8 text-gray-700' : 'border-white/7 text-[#d4dae6]'}`}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const maxSent = Math.max(...filtered.map(x => x.sent), 1)
                return (
                  <tr
                    key={e.name}
                    onClick={() => setActiveEsp(e.name)}
                    className={`cursor-pointer transition-colors border-b last:border-0
                      ${isLight ? 'border-black/8 hover:bg-black/3' : 'border-white/7 hover:bg-white/3'}
                      ${activeEsp === e.name ? (isLight ? 'bg-[#009e88]/7' : 'bg-[#00e5c3]/4') : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-6 rounded-sm flex-shrink-0" style={{ background: e.color }} />
                        <span className={`text-sm font-medium ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>{e.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <div className={`flex-1 h-1 rounded-full min-w-[40px] ${isLight ? 'bg-black/8' : 'bg-white/6'}`}>
                          <div className="h-1 rounded-full" style={{ width: `${(e.sent / maxSent) * 100}%`, background: e.color }} />
                        </div>
                        <span className="text-[11px] font-mono text-[#a8b0be] min-w-[36px] text-right">{fmtN(e.sent)}</span>
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-right text-[11px] font-mono ${isLight ? 'text-gray-800' : 'text-[#f0f2f5]'}`}>
                      {fmtP(e.deliveryRate)}
                    </td>
                    <td className={`px-4 py-3 text-right text-[11px] font-mono ${isLight ? 'text-gray-800' : 'text-[#f0f2f5]'}`}>
                      {fmtP(e.openRate)}
                    </td>
                    <td className={`px-4 py-3 text-right text-[11px] font-mono ${isLight ? 'text-gray-800' : 'text-[#f0f2f5]'}`}>
                      {fmtP(e.clickRate)}
                    </td>
                    <td className={`px-4 py-3 text-right text-[11px] font-mono
                      ${e.status === 'critical' ? 'text-[#ff4757]' : e.status === 'warn' ? 'text-[#ffd166]' : 'text-[#00e5c3]'}`}>
                      {fmtP(e.bounceRate)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={e.status} />
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className={`px-4 py-8 text-center text-sm ${isLight ? 'text-gray-400' : 'text-[#a8b0be]'}`}>No ESPs match current filter</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
