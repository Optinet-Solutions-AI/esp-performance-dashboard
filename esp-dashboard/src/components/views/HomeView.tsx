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
  const totalSent = mmSent + ogSent

  const gc = getGridColor(isLight)
  const tc = getTextColor(isLight)

  useEffect(() => {
    if (!volumeRef.current) return
    volumeChart.current?.destroy()
    volumeChart.current = new Chart(volumeRef.current, {
      type: 'bar',
      data: {
        labels: months.length ? months : ['No data'],
        datasets: [{
          label: 'Sent',
          data: volumes.length ? volumes : [0],
          backgroundColor: isLight ? 'rgba(0,160,140,0.55)' : 'rgba(0,229,195,0.65)',
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { ...CHART_TOOLTIP_OPTS } },
        scales: {
          x: { ticks: { color: tc, font: { size: 10 } }, grid: { display: false }, border: { display: false } },
          y: {
            ticks: {
              color: tc, font: { size: 10 },
              callback: v => { const n = Number(v); return n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(0)+'K' : String(n) },
            },
            grid: { color: gc }, border: { display: false },
          },
        },
      },
    })
    return () => { volumeChart.current?.destroy(); volumeChart.current = null }
  }, [isLight, mmData, ogData])

  useEffect(() => {
    if (!catRef.current) return
    catChart.current?.destroy()
    catChart.current = new Chart(catRef.current, {
      type: 'doughnut',
      data: {
        labels: ['Mailmodo', 'Ongage'],
        datasets: [{
          data: [mmSent || 0.001, ogSent || 0.001],
          backgroundColor: ['rgba(124,92,252,0.75)', 'rgba(255,209,102,0.75)'],
          borderWidth: 0,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '68%',
        plugins: { legend: { display: false }, tooltip: { ...CHART_TOOLTIP_OPTS } },
      },
    })
    return () => { catChart.current?.destroy(); catChart.current = null }
  }, [isLight, mmSent, ogSent])

  const latest = uploadHistory[0]
  const muted = isLight ? '#9ca3af' : '#5a6478'
  const textMain = isLight ? '#111827' : '#f0f2f5'
  const cardBg = isLight ? '#ffffff' : '#111418'
  const cardBorder = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'
  const hoverBg = isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)'

  return (
    <div className="view-page fade-up">
      {/* Page header */}
      <div className="section-title" style={{ marginBottom: 4 }}>
        <div className="section-title-bar" style={{ background: '#00e5c3' }} />
        <h1>Overview</h1>
      </div>
      <p className="section-title-sub">ESP performance summary across all providers</p>

      {/* KPI row */}
      <div className="grid-kpi">
        <KpiCard
          label="Total Emails Sent"
          value={totalSent > 0 ? fmtN(totalSent) : '—'}
          accent="#00e5c3"
          delta={<span style={{ color: muted, fontSize: 11 }}>{fmtN(mmSent)} MM · {fmtN(ogSent)} OG</span>}
          icon={
            <svg style={{ width: 18, height: 18 }} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
              <rect x="2" y="4" width="16" height="12" rx="2" />
              <path d="M2 8l8 5 8-5" />
            </svg>
          }
        />
        <KpiCard
          label="Providers Tracked"
          value={new Set([...mmProvs, ...ogProvs]).size || '—'}
          accent="#7c5cfc"
          delta={<span style={{ color: muted, fontSize: 11 }}>{mmProvs.length} MM · {ogProvs.length} OG</span>}
          icon={
            <svg style={{ width: 18, height: 18 }} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
              <circle cx="10" cy="7" r="3" />
              <path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6" />
            </svg>
          }
        />
        <KpiCard
          label="Latest Upload"
          value={latest ? latest.esp.toUpperCase() : '—'}
          accent="#ffd166"
          delta={latest
            ? <span style={{ color: muted, fontSize: 11 }}>{latest.file.length > 24 ? latest.file.slice(0,24)+'…' : latest.file}</span>
            : <span style={{ color: muted, fontSize: 11 }}>No uploads yet</span>
          }
          icon={
            <svg style={{ width: 18, height: 18 }} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M10 13V5M7 8l3-3 3 3" strokeLinecap="round" />
              <rect x="3" y="14" width="14" height="3" rx="1.5" />
            </svg>
          }
        />
      </div>

      {/* Charts row */}
      <div className="grid-charts">
        <ChartCard title="Volume by Month" subtitle="Total emails sent across all ESPs" height={200}>
          <canvas ref={volumeRef} />
        </ChartCard>
        <ChartCard
          title="ESP Split"
          subtitle="Mailmodo vs Ongage"
          height={200}
          legend={
            <>
              <LegendItem color="rgba(124,92,252,0.75)" label={`Mailmodo — ${fmtN(mmSent)}`} />
              <LegendItem color="rgba(255,209,102,0.75)" label={`Ongage — ${fmtN(ogSent)}`} />
            </>
          }
        >
          <canvas ref={catRef} />
        </ChartCard>
      </div>

      {/* Provider quick-access */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <button
          onClick={() => { setActiveReviewCtx('mailmodo'); setView('mailmodo') }}
          style={{
            background: cardBg, border: `1px solid ${cardBorder}`,
            borderRadius: 16, padding: '20px 20px', textAlign: 'left', cursor: 'pointer',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(124,92,252,0.35)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = cardBorder)}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontFamily: 'Space Mono,monospace', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#7c5cfc' }}>Mailmodo</span>
            <span style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(124,92,252,0.1)', color: '#7c5cfc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>→</span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: textMain, marginBottom: 4, lineHeight: 1 }}>{mmProvs.length || '—'}</div>
          <div style={{ fontSize: 12, color: muted }}>{mmDates.length} date{mmDates.length !== 1 ? 's' : ''} loaded · Click to review</div>
        </button>

        <button
          onClick={() => { setActiveReviewCtx('ongage'); setView('ongage') }}
          style={{
            background: cardBg, border: `1px solid ${cardBorder}`,
            borderRadius: 16, padding: '20px 20px', textAlign: 'left', cursor: 'pointer',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,209,102,0.35)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = cardBorder)}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontFamily: 'Space Mono,monospace', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#ffd166' }}>Ongage</span>
            <span style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,209,102,0.1)', color: '#ffd166', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>→</span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: textMain, marginBottom: 4, lineHeight: 1 }}>{ogProvs.length || '—'}</div>
          <div style={{ fontSize: 12, color: muted }}>{ogDates.length} date{ogDates.length !== 1 ? 's' : ''} loaded · Click to review</div>
        </button>
      </div>

      {/* Recent activity */}
      <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: '20px 20px' }}>
        <div style={{ fontSize: 10, fontFamily: 'Space Mono,monospace', letterSpacing: '0.15em', textTransform: 'uppercase', color: muted, marginBottom: 16 }}>
          Recent Activity
        </div>
        {uploadHistory.length === 0 ? (
          <div style={{ fontSize: 13, color: muted, padding: '16px 0', textAlign: 'center' }}>
            No uploads yet — use Upload Report to get started.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {uploadHistory.slice(0, 6).map((h, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                borderRadius: 12, transition: 'background 0.12s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                }}>📂</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: textMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.file}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: 'Space Mono,monospace', color: muted, marginTop: 2 }}>
                    {h.esp.toUpperCase()} · {h.rows.toLocaleString()} rows · {h.dates.length} dates · {h.time}
                  </div>
                </div>
                <span style={{
                  fontSize: 9, fontFamily: 'Space Mono,monospace', fontWeight: 700,
                  padding: '4px 8px', borderRadius: 8, flexShrink: 0,
                  color: h.newDates > 0 ? '#00e5c3' : muted,
                  background: h.newDates > 0 ? 'rgba(0,229,195,0.08)' : isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${h.newDates > 0 ? 'rgba(0,229,195,0.25)' : 'rgba(255,255,255,0.06)'}`,
                }}>
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
