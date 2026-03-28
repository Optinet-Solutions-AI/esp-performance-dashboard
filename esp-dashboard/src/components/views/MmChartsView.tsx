'use client'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { useDashboardStore } from '@/lib/store'
import { fmtN, fmtP, getGridColor, getTextColor, CHART_TOOLTIP_OPTS, aggDates } from '@/lib/utils'
import type { MmData } from '@/lib/types'

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  Filler, Title, Tooltip, Legend
)

interface ChartsViewProps {
  ctx: 'mailmodo' | 'ongage'
}

function ChartsView({ ctx }: ChartsViewProps) {
  const store = useDashboardStore()
  const isLight = store.isLight
  const data: MmData = ctx === 'mailmodo' ? store.mmData : store.ogData
  const fromIdx = ctx === 'mailmodo' ? store.mmFromIdx : store.ogFromIdx
  const toIdx = ctx === 'mailmodo' ? store.mmToIdx : store.ogToIdx
  const setRange = ctx === 'mailmodo' ? store.setMmRange : store.setOgRange

  const gc = getGridColor(isLight)
  const tc = getTextColor(isLight)
  const cardClass = `rounded-xl border ${isLight ? 'bg-white border-black/10' : 'bg-[#111418] border-white/7'}`
  const brandColor = ctx === 'mailmodo' ? '#7c5cfc' : '#ffd166'
  const title = ctx === 'mailmodo' ? 'Mailmodo Charts' : 'Ongage Charts'

  const activeDates = data.dates.slice(fromIdx, toIdx + 1)
  const hasData = data.dates.length > 0

  // Per-date metrics for chart lines (from overallByDate)
  const perDateMetrics = activeDates.map(d => {
    const r = data.overallByDate[d]
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

  // Volume chart: Sent + Delivered
  const volumeData = {
    labels,
    datasets: [
      {
        label: 'Sent',
        data: perDateMetrics.map(r => r.sent),
        borderColor: '#6b7280',
        backgroundColor: 'rgba(107,114,128,0.06)',
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointHoverRadius: 7,
        borderWidth: 2,
      },
      {
        label: 'Delivered',
        data: perDateMetrics.map(r => r.delivered),
        borderColor: brandColor,
        backgroundColor: brandColor + '12',
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointHoverRadius: 7,
        borderWidth: 2,
      },
    ],
  }

  // Delivery rate trend
  const deliveryRateData = {
    labels,
    datasets: [
      {
        label: 'Delivery Rate',
        data: perDateMetrics.map(r => +r.deliveryRate.toFixed(2)),
        borderColor: '#00e5c3',
        backgroundColor: 'rgba(0,229,195,0.08)',
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointHoverRadius: 7,
        borderWidth: 2,
      },
    ],
  }

  // Open rate trend
  const openRateData = {
    labels,
    datasets: [
      {
        label: 'Open Rate',
        data: perDateMetrics.map(r => +r.openRate.toFixed(2)),
        borderColor: brandColor,
        backgroundColor: brandColor + '12',
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointHoverRadius: 7,
        borderWidth: 2,
      },
    ],
  }

  // Bounce rate trend
  const bounceRateData = {
    labels,
    datasets: [
      {
        label: 'Bounce Rate',
        data: perDateMetrics.map(r => +r.bounceRate.toFixed(2)),
        borderColor: '#ff4757',
        backgroundColor: 'rgba(255,71,87,0.06)',
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointHoverRadius: 7,
        borderWidth: 2,
      },
    ],
  }

  const volumeOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { ...CHART_TOOLTIP_OPTS },
    },
    scales: {
      x: { ticks: { color: tc, font: { size: 9 }, maxRotation: 30, autoSkip: true }, grid: { display: false }, border: { display: false } },
      y: {
        ticks: { color: tc, font: { size: 9 }, callback: (v: number | string) => fmtN(Number(v)) },
        grid: { color: gc },
        border: { display: false },
      },
    },
  }

  const rateOptions = (color: string) => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { ...CHART_TOOLTIP_OPTS },
    },
    scales: {
      x: { ticks: { color: tc, font: { size: 9 }, maxRotation: 30, autoSkip: true }, grid: { display: false }, border: { display: false } },
      y: {
        ticks: { color: tc, font: { size: 9 }, callback: (v: number | string) => v + '%' },
        grid: { color: gc },
        border: { display: false },
      },
    },
  })

  const charts = [
    { label: 'Volume Over Time', sublabel: 'Sent + Delivered', data: volumeData, opts: volumeOptions, accent: '#6b7280' },
    { label: 'Delivery Rate Trend', sublabel: 'Delivered ÷ Sent × 100', data: deliveryRateData, opts: rateOptions('#00e5c3'), accent: '#00e5c3' },
    { label: 'Open Rate Trend', sublabel: 'Opens ÷ Delivered × 100', data: openRateData, opts: rateOptions(brandColor), accent: brandColor },
    { label: 'Bounce Rate Trend', sublabel: 'Bounced ÷ Sent × 100', data: bounceRateData, opts: rateOptions('#ff4757'), accent: '#ff4757' },
  ]

  // Aggregate totals for the selected range
  const aggOverall = aggDates(data.overallByDate, activeDates)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className={`text-2xl font-bold tracking-tight ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>
            {title}
          </h1>
          <p className={`text-sm mt-1 ${isLight ? 'text-gray-500' : 'text-[#a8b0be]'}`}>
            KPI trend charts for the selected date range
          </p>
        </div>

        {/* Date range picker */}
        {hasData && (
          <div className="flex items-center gap-2">
            <select
              value={fromIdx}
              onChange={e => setRange(Number(e.target.value), toIdx)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono outline-none
                ${isLight ? 'bg-white border-black/20 text-gray-800' : 'bg-[#1e232b] border-white/18 text-white'}`}
            >
              {data.dates.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
            <span className={`text-xs ${isLight ? 'text-gray-400' : 'text-[#a8b0be]'}`}>→</span>
            <select
              value={toIdx}
              onChange={e => setRange(fromIdx, Number(e.target.value))}
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono outline-none
                ${isLight ? 'bg-white border-black/20 text-gray-800' : 'bg-[#1e232b] border-white/18 text-white'}`}
            >
              {data.dates.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
            <button
              onClick={() => setRange(0, data.dates.length - 1)}
              className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-mono uppercase transition-all
                ${isLight ? 'border-black/20 text-gray-500 hover:border-[#009e88]' : 'border-white/13 text-[#a8b0be] hover:border-[#00e5c3]'}`}
            >
              All
            </button>
          </div>
        )}
      </div>

      {!hasData ? (
        <div className={`${cardClass} p-12 text-center`}>
          <div className="text-4xl mb-4">📈</div>
          <div className={`text-lg font-medium mb-2 ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>
            No data yet
          </div>
          <div className={`text-sm ${isLight ? 'text-gray-500' : 'text-[#a8b0be]'}`}>
            Upload a {ctx === 'mailmodo' ? 'Mailmodo' : 'Ongage'} file via Upload Report to see charts here.
          </div>
        </div>
      ) : (
        <>
          {/* KPI summary strip */}
          {aggOverall && (
            <div className="grid grid-cols-5 gap-3 mb-5">
              {[
                { label: 'Sent', val: fmtN(aggOverall.sent), accent: '#a8b0be' },
                { label: 'Delivery Rate', val: fmtP(aggOverall.deliveryRate), accent: '#00e5c3' },
                { label: 'Open Rate', val: fmtP(aggOverall.openRate), accent: brandColor },
                { label: 'CTR', val: fmtP(aggOverall.clickRate), accent: '#ffd166' },
                {
                  label: 'Bounce Rate',
                  val: fmtP(aggOverall.bounceRate),
                  accent: aggOverall.bounceRate > 10 ? '#ff4757' : aggOverall.bounceRate > 2 ? '#ffd166' : '#00e5c3',
                },
              ].map(k => (
                <div
                  key={k.label}
                  className={`${cardClass} px-4 py-3`}
                  style={{ borderLeft: `3px solid ${k.accent}` }}
                >
                  <div className={`text-[10px] font-mono tracking-wider uppercase mb-1 ${isLight ? 'text-gray-400' : 'text-[#a8b0be]'}`}>
                    {k.label}
                  </div>
                  <div className={`text-xl font-bold ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>
                    {k.val}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 2×2 Chart Grid */}
          <div className="grid grid-cols-2 gap-4">
            {charts.map(chart => (
              <div key={chart.label} className={`${cardClass} p-4`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div
                      className="text-sm font-semibold"
                      style={{ color: chart.accent }}
                    >
                      {chart.label}
                    </div>
                    <div className={`text-[10px] font-mono mt-0.5 ${isLight ? 'text-gray-400' : 'text-[#a8b0be]'}`}>
                      {chart.sublabel}
                    </div>
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
        </>
      )}
    </div>
  )
}

export default function MmChartsView() {
  return <ChartsView ctx="mailmodo" />
}
