'use client'
import { useEffect, useRef } from 'react'
import { Chart } from 'chart.js/auto'
import { useDashboardStore } from '@/lib/store'
import { fmtN, getGridColor, getTextColor, CHART_TOOLTIP_OPTS } from '@/lib/utils'
import KpiCard from '@/components/ui/KpiCard'
import ChartCard, { LegendItem } from '@/components/ui/ChartCard'

export default function HomeView() {
  const { isLight, mmData, ogData, uploadHistory, setView, setActiveReviewCtx } = useDashboardStore()
  const volumeRef = useRef<HTMLCanvasElement>(null)
  const catRef = useRef<HTMLCanvasElement>(null)
  const volumeChart = useRef<Chart | null>(null)
  const catChart = useRef<Chart | null>(null)

  const mmDates = mmData.dates || []
  const ogDates = ogData.dates || []
  const mmProvs = Object.keys(mmData.providers || {})
  const ogProvs = Object.keys(ogData.providers || {})

  // Monthly volume buckets
  const monthTotals: Record<string, number> = {}
  const accumulate = (data: typeof mmData) => {
    ;(data.dates || []).forEach(d => {
      const m = d.replace(/\s+\d+$/, '')
      monthTotals[m] = (monthTotals[m] || 0) + (data.overallByDate[d]?.sent || 0)
    })
  }
  accumulate(mmData)
  accumulate(ogData)
  const months = Object.keys(monthTotals)
  const volumes = months.map(m => monthTotals[m])

  const mmSent = mmDates.reduce((s, d) => s + (mmData.overallByDate[d]?.sent || 0), 0)
  const ogSent = ogDates.reduce((s, d) => s + (ogData.overallByDate[d]?.sent || 0), 0)

  const gc = getGridColor(isLight)
  const tc = getTextColor(isLight)

  useEffect(() => {
    if (!volumeRef.current) return
    if (volumeChart.current) { volumeChart.current.destroy(); volumeChart.current = null }
    volumeChart.current = new Chart(volumeRef.current, {
      type: 'bar',
      data: {
        labels: months.length ? months : ['No data'],
        datasets: [{ label: 'Sent', data: volumes.length ? volumes : [0], backgroundColor: 'rgba(0,229,195,0.7)', borderRadius: 4 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { ...CHART_TOOLTIP_OPTS } },
        scales: {
          x: { ticks: { color: tc, font: { size: 9 } }, grid: { display: false } },
          y: { ticks: { color: tc, font: { size: 9 }, callback: (v) => {
            const n = Number(v)
            return n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(0)+'K' : String(n)
          } }, grid: { color: gc }, border: { display: false } },
        },
      },
    })
    return () => { volumeChart.current?.destroy(); volumeChart.current = null }
  }, [isLight, mmData, ogData])

  useEffect(() => {
    if (!catRef.current) return
    if (catChart.current) { catChart.current.destroy(); catChart.current = null }
    catChart.current = new Chart(catRef.current, {
      type: 'doughnut',
      data: {
        labels: ['Mailmodo', 'Ongage'],
        datasets: [{ data: [mmSent || 0, ogSent || 0], backgroundColor: ['rgba(124,92,252,0.8)', 'rgba(255,209,102,0.8)'], borderWidth: 0, hoverOffset: 6 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '65%',
        plugins: { legend: { display: false }, tooltip: { ...CHART_TOOLTIP_OPTS } },
      },
    })
    return () => { catChart.current?.destroy(); catChart.current = null }
  }, [isLight, mmSent, ogSent])

  const latest = uploadHistory[0]

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className={`text-2xl font-bold tracking-tight ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>
          Overview
        </h1>
        <p className={`text-sm mt-1 ${isLight ? 'text-gray-500' : 'text-[#a8b0be]'}`}>
          ESP performance summary across all providers
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <KpiCard
          label="Total Reports"
          value={(mmDates.length + ogDates.length) || '—'}
          delta={<span className={isLight ? 'text-gray-400' : 'text-[#a8b0be]'}>{mmDates.length} Mailmodo · {ogDates.length} Ongage</span>}
        />
        <KpiCard
          label="Providers Tracked"
          value={new Set([...mmProvs, ...ogProvs]).size || '—'}
          delta={<span className={isLight ? 'text-gray-400' : 'text-[#a8b0be]'}>{mmProvs.length} MM · {ogProvs.length} OG</span>}
          accent="#7c5cfc"
        />
        <KpiCard
          label="Latest Upload"
          value={latest ? latest.esp.toUpperCase() : '—'}
          delta={latest
            ? <span className={isLight ? 'text-gray-400' : 'text-[#a8b0be]'}>{latest.file.length > 22 ? latest.file.slice(0,22)+'…' : latest.file}</span>
            : <span className={isLight ? 'text-gray-400' : 'text-[#a8b0be]'}>No uploads yet</span>
          }
          accent="#ffd166"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="col-span-2">
          <ChartCard title="Volume by Month" subtitle="Total emails sent" height={180}>
            <canvas ref={volumeRef} />
          </ChartCard>
        </div>
        <div>
          <ChartCard
            title="Category Split"
            subtitle="Mailmodo vs Ongage"
            height={180}
            legend={
              <>
                <LegendItem color="rgba(124,92,252,0.8)" label={`Mailmodo ${fmtN(mmSent)}`} />
                <LegendItem color="rgba(255,209,102,0.8)" label={`Ongage ${fmtN(ogSent)}`} />
              </>
            }
          >
            <canvas ref={catRef} />
          </ChartCard>
        </div>
      </div>

      {/* Provider cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div
          onClick={() => { setActiveReviewCtx('mailmodo'); setView('mailmodo') }}
          className={`rounded-xl border p-4 cursor-pointer transition-all
            ${isLight ? 'bg-white border-[#7c5cfc]/20 hover:border-[#7c5cfc]/50' : 'bg-[#111418] border-[#7c5cfc]/20 hover:border-[#7c5cfc]/40'}`}
        >
          <div className="text-[10px] font-mono tracking-widest uppercase text-[#7c5cfc] mb-1">Mailmodo</div>
          <div className={`text-2xl font-bold mb-1 ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>
            {mmProvs.length || '—'}
          </div>
          <div className={`text-xs ${isLight ? 'text-gray-500' : 'text-[#a8b0be]'}`}>
            {mmDates.length} date{mmDates.length !== 1 ? 's' : ''} · Click to review →
          </div>
        </div>
        <div
          onClick={() => { setActiveReviewCtx('ongage'); setView('ongage') }}
          className={`rounded-xl border p-4 cursor-pointer transition-all
            ${isLight ? 'bg-white border-[#ffd166]/20 hover:border-[#ffd166]/50' : 'bg-[#111418] border-[#ffd166]/20 hover:border-[#ffd166]/40'}`}
        >
          <div className="text-[10px] font-mono tracking-widest uppercase text-[#ffd166] mb-1">Ongage</div>
          <div className={`text-2xl font-bold mb-1 ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>
            {ogProvs.length || '—'}
          </div>
          <div className={`text-xs ${isLight ? 'text-gray-500' : 'text-[#a8b0be]'}`}>
            {ogDates.length} date{ogDates.length !== 1 ? 's' : ''} · Click to review →
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className={`rounded-xl border p-5 ${isLight ? 'bg-white border-black/10' : 'bg-[#111418] border-white/7'}`}>
        <div className={`text-[10px] font-mono tracking-[0.12em] uppercase mb-4 ${isLight ? 'text-gray-400' : 'text-[#a8b0be]'}`}>
          Recent Activity
        </div>
        {uploadHistory.length === 0 ? (
          <div className={`text-sm ${isLight ? 'text-gray-400' : 'text-[#a8b0be]'}`}>
            No uploads yet — use Upload Report to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {uploadHistory.slice(0, 5).map((h, i) => (
              <div key={i} className={`flex items-center justify-between py-2 border-b last:border-0
                ${isLight ? 'border-black/8' : 'border-white/7'}`}>
                <div>
                  <div className={`text-sm font-semibold ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>{h.file}</div>
                  <div className={`text-[11px] font-mono mt-0.5 ${isLight ? 'text-gray-500' : 'text-[#a8b0be]'}`}>
                    {h.esp.toUpperCase()} · {h.rows.toLocaleString()} rows · {h.dates.length} dates · {h.time}
                  </div>
                </div>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border
                  ${h.newDates > 0
                    ? 'text-[#00e5c3] border-[#00e5c3]/30 bg-[#00e5c3]/10'
                    : 'text-[#a8b0be] border-white/13 bg-white/5'
                  }`}>
                  {h.newDates > 0 ? `+${h.newDates} new` : 'updated'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
