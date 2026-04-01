'use client'
import { useState, useEffect } from 'react'
import { useDashboardStore } from '@/lib/store'
import { fmtN, fmtP, aggDates, fmtDateLabel } from '@/lib/utils'
import { ESP_COLORS } from '@/lib/data'
import CalendarPicker from '@/components/ui/CalendarPicker'
import type { MmData, DateMetrics, IpmRecord } from '@/lib/types'

const EMPTY_DATA: MmData = { dates: [], datesFull: [], providers: {}, domains: {}, overallByDate: {}, providerDomains: {} }

interface Agg { sent: number; delivered: number; opened: number; clicked: number; bounced: number; hardBounced: number; softBounced: number; unsubscribed: number; complained: number }

function emptyAgg(): Agg { return { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, hardBounced: 0, softBounced: 0, unsubscribed: 0, complained: 0 } }

function addAgg(t: Agg, a: Agg) {
  t.sent += a.sent; t.delivered += a.delivered; t.opened += a.opened
  t.clicked += a.clicked; t.bounced += a.bounced; t.hardBounced += a.hardBounced; t.softBounced += a.softBounced
  t.unsubscribed += a.unsubscribed; t.complained += a.complained
}

function mxAgg(byDate: Record<string, DateMetrics>, dates: string[]): Agg {
  const z = emptyAgg()
  dates.forEach(d => {
    const r = byDate[d]; if (!r) return
    z.sent += r.sent || 0; z.delivered += r.delivered || 0; z.opened += r.opened || 0
    z.clicked += r.clicked || 0; z.bounced += r.bounced || 0
    z.hardBounced += r.hardBounced || 0; z.softBounced += r.softBounced || 0
    z.unsubscribed += (r.unsubscribed || 0); z.complained += (r.complained || 0)
  })
  return z
}

function rates(a: Agg) {
  return {
    sr: a.sent > 0 ? a.delivered / a.sent * 100 : 0,
    or: a.delivered > 0 ? a.opened / a.delivered * 100 : 0,
    ctr: a.opened > 0 ? a.clicked / a.opened * 100 : 0,
    br: a.sent > 0 ? a.bounced / a.sent * 100 : 0,
  }
}

function rateCls(v: number, goodHigh: boolean, warn: number, bad: number) {
  if (!v || isNaN(v)) return ''
  return goodHigh
    ? (v >= bad ? 'mx-good' : v >= warn ? 'mx-warn' : 'mx-bad')
    : (v <= warn ? 'mx-good' : v <= bad ? 'mx-warn' : 'mx-bad')
}

function fmtMx(n: number) { return n > 0 ? n.toLocaleString() : '' }

export default function MatrixView() {
  const store = useDashboardStore()
  const { isLight, ipmData } = store
  const espList = Object.keys(store.espData)

  const [selectedEsp, setSelectedEsp] = useState<string>('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!selectedEsp || !store.espData[selectedEsp]) setSelectedEsp(espList[0] || '')
  }, [espList.length]) // eslint-disable-line

  const effectiveEsp = selectedEsp || espList[0] || ''
  const data = store.espData[effectiveEsp] ?? EMPTY_DATA
  const fromIdx = store.espRanges[effectiveEsp]?.fromIdx ?? 0
  const toIdx = store.espRanges[effectiveEsp]?.toIdx ?? Math.max(0, data.dates.length - 1)
  const setRange = (from: number, to: number) => store.setEspRange(effectiveEsp, from, to)

  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => {
    if (data.datesFull.length) {
      setFromDate(data.datesFull[fromIdx]?.iso || '')
      setToDate(data.datesFull[Math.min(toIdx, data.datesFull.length - 1)]?.iso || '')
    }
  }, [selectedEsp, data.datesFull.length]) // eslint-disable-line

  function findFrom(iso: string) { const i = data.datesFull.findIndex(d => d.iso >= iso); return i === -1 ? 0 : i }
  function findTo(iso: string) { let r = data.datesFull.length - 1; for (let i = r; i >= 0; i--) { if (data.datesFull[i].iso <= iso) { r = i; break } } return r }
  function handleFrom(iso: string) { setFromDate(iso); if (iso) setRange(findFrom(iso), toIdx) }
  function handleTo(iso: string) { setToDate(iso); if (iso) setRange(fromIdx, findTo(iso)) }
  function handleAll() {
    setRange(0, data.dates.length - 1)
    setFromDate(data.datesFull[0]?.iso || '')
    setToDate(data.datesFull[data.datesFull.length - 1]?.iso || '')
  }

  const activeDates = data.dates.slice(fromIdx, toIdx + 1)

  function toggle(key: string) { setExpanded(p => ({ ...p, [key]: !p[key] })) }

  // Build IP → fromDomain map from ipmData for each ESP
  function getIpMap(espName: string): Record<string, string[]> {
    const map: Record<string, string[]> = {}
    ipmData.filter(r => r.esp?.toLowerCase() === espName.toLowerCase()).forEach(r => {
      if (!r.ip) return
      if (!map[r.ip]) map[r.ip] = []
      const norm = r.domain ? r.domain.toLowerCase().trim() : ''
      if (norm && !map[r.ip].includes(norm)) map[r.ip].push(norm)
    })
    return map
  }

  const txt = isLight ? '#111827' : '#f0f2f5'
  const muted = isLight ? '#374151' : '#c8cdd6'
  const bdr = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'
  const headerBg = isLight ? '#f1f3f7' : '#181c22'
  const surfaceBg = isLight ? '#ffffff' : '#111418'

  const thCls = `px-3 py-2.5 text-[9px] font-mono tracking-widest uppercase text-right border-b`
  const tdCls = `px-3 py-2.5 text-right text-[11px] font-mono border-b`

  function rateColor(cls: string) {
    if (cls === 'mx-good') return isLight ? '#047857' : '#00e5c3'
    if (cls === 'mx-warn') return isLight ? '#92400e' : '#ffd166'
    if (cls === 'mx-bad') return isLight ? '#991b1b' : '#ff4757'
    return txt
  }

  function DataRow({ agg, isTotal, isFdTotal, bg }: { agg: Agg; isTotal?: boolean; isFdTotal?: boolean; bg?: string }) {
    const R = rates(agg)
    const fw = isTotal || isFdTotal ? 'font-bold' : ''
    const style: React.CSSProperties = { borderBottom: `1px solid ${bdr}` }
    if (bg) style.background = bg
    if (isTotal) { style.background = isLight ? '#e8eaef' : '#1a1e26'; style.borderTop = `2px solid ${isLight ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.1)'}` }
    if (isFdTotal) { style.background = isLight ? '#e0e3ea' : 'rgba(255,255,255,.04)'; style.borderTop = `1px solid ${bdr}` }

    const orTip = agg.delivered > 0 ? `Opens ÷ Delivered × 100\n${fmtMx(agg.opened)} ÷ ${fmtMx(agg.delivered)} × 100 = ${R.or.toFixed(2)}%` : ''
    const ctrTip = agg.opened > 0 ? `Clicks ÷ Opens × 100\n${fmtMx(agg.clicked)} ÷ ${fmtMx(agg.opened)} × 100 = ${R.ctr.toFixed(2)}%` : ''

    return (
      <>
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: txt }}>{fmtMx(agg.sent)}</td>
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: rateColor(rateCls(R.sr, true, 80, 95)) }} title={agg.sent > 0 ? `Delivered ÷ Sent × 100\n${fmtMx(agg.delivered)} ÷ ${fmtMx(agg.sent)} × 100 = ${R.sr.toFixed(2)}%` : ''}>{fmtMx(agg.delivered)}</td>
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: rateColor(rateCls(R.br, false, 5, 10)) }}>{fmtMx(agg.bounced)}</td>
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: txt }}>{fmtMx(agg.softBounced)}</td>
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: rateColor(rateCls(R.br, false, 5, 10)) }}>{fmtMx(agg.hardBounced)}</td>
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: rateColor(rateCls(R.or, true, 30, 60)) }}>{fmtMx(agg.opened)}</td>
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: rateColor(rateCls(R.or, true, 30, 60)), cursor: orTip ? 'help' : undefined }} title={orTip}>{R.or > 0 ? R.or.toFixed(1) + '%' : ''}</td>
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: rateColor(rateCls(R.ctr, true, 20, 50)) }}>{fmtMx(agg.clicked)}</td>
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: rateColor(rateCls(R.ctr, true, 20, 50)), cursor: ctrTip ? 'help' : undefined }} title={ctrTip}>{R.ctr > 0 ? R.ctr.toFixed(1) + '%' : ''}</td>
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: (agg.complained || 0) > 0 ? (isLight ? '#991b1b' : '#ff4757') : txt }}>{fmtMx(agg.complained || 0)}</td>
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: txt }}>{fmtMx(agg.unsubscribed || 0)}</td>
      </>
    )
  }

  function ToggleBtn({ expanded: ex, label, count }: { expanded: boolean; label: React.ReactNode; count?: string }) {
    return (
      <div className="flex items-center">
        <span className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded border text-[12px] font-bold mr-2 flex-shrink-0 ${isLight ? 'border-black/20 text-gray-500' : 'border-white/25 text-[#d4dae6]'}`}>
          {ex ? '−' : '+'}
        </span>
        <span className="font-semibold">{label}</span>
        {count && <span className="text-[9px] font-mono ml-1.5" style={{ color: muted }}>{count}</span>}
      </div>
    )
  }

  // Build all rows
  function buildRows() {
    const rows: React.ReactNode[] = []

    espList.forEach(espName => {
      const espData = store.espData[espName]
      if (!espData || !espData.dates.length) return
      const espColor = ESP_COLORS[espName] || '#7c5cfc'
      const ipMap = getIpMap(espName)
      const allFromDomains = Object.keys(espData.domains || {}).filter(d => d !== 'unknown' && d !== '')

      // Use this ESP's own dates for aggregation (filtered by the global date range if applicable)
      const espActiveDates = activeDates.length > 0 ? activeDates.filter(d => espData.dates.includes(d)) : espData.dates

      // Map from-domains to IPs (normalized lowercase keys)
      const domainToIp: Record<string, string> = {}
      Object.entries(ipMap).forEach(([ip, fds]) => { fds.forEach(fd => { domainToIp[fd.toLowerCase().trim()] = ip }) })

      // Group from-domains by IP
      const ipGroups: Record<string, string[]> = {}
      allFromDomains.forEach(fd => {
        const ip = domainToIp[fd.toLowerCase().trim()] || 'IP NOT FOUND'
        if (!ipGroups[ip]) ipGroups[ip] = []
        ipGroups[ip].push(fd)
      })
      // Add IPs from registry that have no matching from-domains
      Object.keys(ipMap).forEach(ip => { if (!ipGroups[ip]) ipGroups[ip] = [] })

      const sortedIps = Object.keys(ipGroups).sort((a, b) => {
        if (a === 'IP NOT FOUND') return 1
        if (b === 'IP NOT FOUND') return -1
        return a.localeCompare(b, undefined, { numeric: true })
      })

      // ESP total
      const espTot = emptyAgg()
      Object.values(espData.providers || {}).forEach(p => { const a = mxAgg(p.byDate, espActiveDates); addAgg(espTot, a) })

      if (espTot.sent === 0) return

      const espKey = `esp||${espName}`
      const espEx = !!expanded[espKey]

      // ESP header row
      rows.push(
        <tr key={espKey} className="cursor-pointer" style={{ borderBottom: `1px solid ${bdr}` }} onClick={() => toggle(espKey)}>
          <td className={`${tdCls} text-left`} style={{ borderBottom: `1px solid ${bdr}`, color: txt }}>
            <ToggleBtn expanded={espEx} label={<span style={{ color: espColor, fontWeight: 700 }}>{espName}</span>} />
          </td>
          <td className={tdCls} style={{ borderBottom: `1px solid ${bdr}` }}></td>
          <DataRow agg={espTot} />
        </tr>
      )

      if (!espEx) {
        rows.push(
          <tr key={espKey + '-total'}>
            <td className={`${tdCls} text-left font-bold`} style={{ background: isLight ? '#e8eaef' : '#1a1e26', borderTop: `2px solid ${isLight ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.1)'}`, borderBottom: `1px solid ${bdr}`, color: espColor }}>
              {espName} — Total
            </td>
            <td className={tdCls} style={{ background: isLight ? '#e8eaef' : '#1a1e26', borderTop: `2px solid ${isLight ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.1)'}`, borderBottom: `1px solid ${bdr}` }}></td>
            <DataRow agg={espTot} isTotal />
          </tr>
        )
        return
      }

      // Level 2: IPs
      sortedIps.forEach(ip => {
        const fromDomains = ipGroups[ip] || []
        const isNotFound = ip === 'IP NOT FOUND'

        const ipTot = emptyAgg()
        fromDomains.forEach(fd => {
          const d = espData.domains[fd]
          if (d) { const a = mxAgg(d.byDate, espActiveDates); addAgg(ipTot, a) }
        })
        if (ipTot.sent === 0) return

        const ipKey = `ip||${espName}||${ip}`
        const ipEx = !!expanded[ipKey]
        const activeFds = fromDomains.filter(fd => {
          const d = espData.domains[fd]; if (!d) return false
          const a = mxAgg(d.byDate, espActiveDates); return a.sent > 0
        })

        const ipBg = isLight ? 'rgba(0,0,0,.015)' : 'rgba(255,255,255,.015)'
        const ipColor = isLight ? '#0369a1' : '#7dd3fc'

        rows.push(
          <tr key={ipKey} className="cursor-pointer" onClick={() => toggle(ipKey)}>
            <td className={`${tdCls} text-left`} style={{ borderBottom: `1px solid ${bdr}`, background: ipBg, color: txt }}></td>
            <td className={`${tdCls} text-left`} style={{ borderBottom: `1px solid ${bdr}`, background: ipBg, color: txt, paddingLeft: 20 }}>
              <ToggleBtn
                expanded={ipEx}
                label={isNotFound
                  ? <span style={{ color: isLight ? '#b45309' : '#f59e0b', fontFamily: 'var(--font-mono)', fontSize: 11 }}>&#9888; IP NOT FOUND</span>
                  : <span style={{ color: ipColor, fontFamily: 'var(--font-mono)', fontSize: 11 }}>{ip}</span>
                }
                count={`${activeFds.length} from-domains`}
              />
            </td>
            <DataRow agg={ipTot} bg={ipBg} />
          </tr>
        )

        if (!ipEx) return

        // Level 3: From Domains
        fromDomains.forEach(fd => {
          const fdData = espData.domains[fd]
          const fdAgg = fdData ? mxAgg(fdData.byDate, espActiveDates) : emptyAgg()
          if (fdAgg.sent === 0) return

          const fdKey = `fd||${espName}||${ip}||${fd}`
          const fdEx = !!expanded[fdKey]

          const fdProviders = Object.entries(espData.providerDomains || {})
            .filter(([, domMap]) => domMap[fd] && domMap[fd].sent > 0)
            .map(([prov, domMap]) => ({ name: prov, agg: domMap[fd] as unknown as Agg }))
            .sort((a, b) => b.agg.sent - a.agg.sent)

          const fdBg = isLight ? 'rgba(0,0,0,.025)' : 'rgba(255,255,255,.025)'

          rows.push(
            <tr key={fdKey} className="cursor-pointer" onClick={() => toggle(fdKey)}>
              <td className={`${tdCls} text-left`} style={{ borderBottom: `1px solid ${bdr}`, background: fdBg }}></td>
              <td className={`${tdCls} text-left`} style={{ borderBottom: `1px solid ${bdr}`, background: fdBg, paddingLeft: 40, color: muted, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                <ToggleBtn expanded={fdEx} label={<span style={{ color: muted, fontFamily: 'var(--font-mono)', fontSize: 10 }}>{fd}</span>} count={fdProviders.length > 0 ? `${fdProviders.length} providers` : ''} />
              </td>
              <DataRow agg={fdAgg} bg={fdBg} />
            </tr>
          )

          if (!fdEx) return

          // Level 4: Email Providers
          fdProviders.forEach(({ name: provName, agg: provAgg }) => {
            const provBg = isLight ? 'rgba(0,0,0,.035)' : 'rgba(255,255,255,.035)'
            rows.push(
              <tr key={`prov||${espName}||${ip}||${fd}||${provName}`}>
                <td className={tdCls} style={{ borderBottom: `1px solid ${bdr}`, background: provBg }}></td>
                <td className={`${tdCls} text-left`} style={{ borderBottom: `1px solid ${bdr}`, background: provBg, paddingLeft: 60, fontFamily: 'var(--font-mono)', fontSize: 10, color: muted }}>
                  <span style={{ width: 3, height: 3, borderRadius: '50%', background: muted, display: 'inline-block', marginRight: 7, verticalAlign: 'middle' }} />
                  {provName}
                </td>
                <DataRow agg={provAgg} bg={provBg} />
              </tr>
            )
          })

          // From-domain total
          if (fdProviders.length > 0) {
            rows.push(
              <tr key={fdKey + '-total'}>
                <td className={tdCls} style={{ borderBottom: `1px solid ${bdr}`, background: isLight ? '#dde1e8' : 'rgba(255,255,255,.04)', borderTop: `1px solid ${bdr}` }}></td>
                <td className={`${tdCls} text-left font-semibold`} style={{ borderBottom: `1px solid ${bdr}`, background: isLight ? '#dde1e8' : 'rgba(255,255,255,.04)', paddingLeft: 40, fontFamily: 'var(--font-mono)', fontSize: 10, color: muted, borderTop: `1px solid ${bdr}` }}>
                  {fd} — total
                </td>
                <DataRow agg={fdAgg} isFdTotal />
              </tr>
            )
          }
        })

        // IP total
        const ipTotalBg = isLight ? 'rgba(3,105,161,.07)' : 'rgba(125,211,252,.07)'
        rows.push(
          <tr key={ipKey + '-total'}>
            <td className={tdCls} style={{ borderBottom: `1px solid ${bdr}`, background: ipTotalBg, borderTop: `1px solid ${bdr}` }}></td>
            <td className={`${tdCls} text-left font-semibold`} style={{ borderBottom: `1px solid ${bdr}`, background: ipTotalBg, paddingLeft: 20, fontFamily: 'var(--font-mono)', fontSize: 10, color: ipColor, borderTop: `1px solid ${bdr}` }}>
              {isNotFound ? '\u26A0 IP NOT FOUND' : ip} — total
            </td>
            <DataRow agg={ipTot} bg={ipTotalBg} />
          </tr>
        )
      })

      // ESP grand total
      rows.push(
        <tr key={espKey + '-grand-total'}>
          <td className={`${tdCls} text-left font-bold`} style={{ background: isLight ? '#e8eaef' : '#1a1e26', borderTop: `2px solid ${isLight ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.1)'}`, borderBottom: `1px solid ${bdr}`, color: espColor }}>
            {espName} — Total
          </td>
          <td className={tdCls} style={{ background: isLight ? '#e8eaef' : '#1a1e26', borderTop: `2px solid ${isLight ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.1)'}`, borderBottom: `1px solid ${bdr}` }}></td>
          <DataRow agg={espTot} isTotal />
        </tr>
      )
    })

    return rows
  }

  // Build breadcrumb of expanded rows for the floating collapse bar
  const expandedBreadcrumbs: { key: string; label: string; color: string }[] = []
  Object.keys(expanded).forEach(key => {
    if (!expanded[key]) return
    const parts = key.split('||')
    if (parts[0] === 'esp') {
      expandedBreadcrumbs.push({ key, label: parts[1], color: ESP_COLORS[parts[1]] || '#7c5cfc' })
    } else if (parts[0] === 'ip') {
      expandedBreadcrumbs.push({ key, label: parts[2], color: isLight ? '#0369a1' : '#7dd3fc' })
    } else if (parts[0] === 'fd') {
      expandedBreadcrumbs.push({ key, label: parts[3], color: muted })
    }
  })

  const hasData = espList.some(e => {
    const d = store.espData[e]
    return d && d.dates.length > 0 && (Object.keys(d.providers).length > 0 || Object.keys(d.domains).length > 0)
  })

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: txt }}>
            ESP Deliverability Matrix
          </h1>
          <p className="text-sm mt-1" style={{ color: muted }}>
            ESP → IP → From Domain → Email Provider
            {activeDates.length > 0 && ` · ${fmtDateLabel(activeDates[0], data.datesFull)} – ${fmtDateLabel(activeDates[activeDates.length - 1], data.datesFull)}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: muted }}>From</span>
          <CalendarPicker value={fromDate} onChange={handleFrom} isLight={isLight} rangeStart={fromDate} rangeEnd={toDate} />
          <span className="text-xs" style={{ color: muted }}>→</span>
          <CalendarPicker value={toDate} onChange={handleTo} isLight={isLight} rangeStart={fromDate} rangeEnd={toDate} align="right" />
          <button onClick={handleAll} className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-mono uppercase transition-all ${isLight ? 'border-black/20 text-gray-500 hover:border-[#009e88]' : 'border-white/13 text-[#a8b0be] hover:border-[#00e5c3]'}`}>
            All
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="rounded-xl border p-12 text-center" style={{ background: surfaceBg, borderColor: bdr }}>
          <div className="text-4xl mb-4">🔢</div>
          <div className="text-lg font-medium" style={{ color: txt }}>No matrix data</div>
          <div className="text-sm mt-2" style={{ color: muted }}>Upload data first.</div>
        </div>
      ) : (
        <>
        {expandedBreadcrumbs.length > 0 && (
          <div className="fixed left-0 lg:left-[240px] right-0 top-0 lg:top-0 z-30 flex items-center gap-2 px-5 py-2.5 border-b"
            style={{
              background: isLight ? '#f8f9fb' : '#141820',
              borderColor: bdr,
              boxShadow: `0 2px 8px ${isLight ? 'rgba(0,0,0,.1)' : 'rgba(0,0,0,.5)'}`,
            }}>
            <span className={`text-[9px] font-mono uppercase tracking-wider flex-shrink-0 ${isLight ? 'text-gray-400' : 'text-[#6b7280]'}`}>Expanded:</span>
            <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
              {expandedBreadcrumbs.map(b => (
                <button key={b.key} onClick={() => toggle(b.key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-mono transition-all ${isLight ? 'border-black/15 hover:bg-black/5' : 'border-white/15 hover:bg-white/5'}`}>
                  <span style={{ color: b.color, fontWeight: 600 }}>{b.label}</span>
                  <span className={`text-[9px] ${isLight ? 'text-gray-400' : 'text-[#6b7280]'}`}>x</span>
                </button>
              ))}
            </div>
            <button onClick={() => setExpanded({})}
              className={`flex-shrink-0 px-2.5 py-1 rounded-lg border text-[9px] font-mono uppercase tracking-wider transition-all ${isLight ? 'border-black/15 text-gray-500 hover:border-red-300 hover:text-red-500' : 'border-white/15 text-[#6b7280] hover:border-[#ff4757] hover:text-[#ff4757]'}`}>
              Collapse All
            </button>
          </div>
        )}
        <div className={`rounded-xl border overflow-auto ${expandedBreadcrumbs.length > 0 ? 'mt-2' : ''}`} style={{ background: surfaceBg, borderColor: bdr }}>
          <table className="w-full border-collapse" style={{ minWidth: 1100 }}>
            <thead>
              <tr style={{ background: headerBg }}>
                <th className={`${thCls} text-left`} style={{ borderColor: bdr, color: txt, minWidth: 180 }}>ESP / IP / From Domain</th>
                <th className={`${thCls} text-left`} style={{ borderColor: bdr, color: txt, minWidth: 160 }}>Email Provider</th>
                <th className={thCls} style={{ borderColor: bdr, color: txt }}>Sent</th>
                <th className={thCls} style={{ borderColor: bdr, color: txt }}>Delivered</th>
                <th className={thCls} style={{ borderColor: bdr, color: txt }}>Total Bounces</th>
                <th className={thCls} style={{ borderColor: bdr, color: txt }}>Soft Bounce</th>
                <th className={thCls} style={{ borderColor: bdr, color: txt }}>Hard Bounce</th>
                <th className={thCls} style={{ borderColor: bdr, color: txt }}>Opens</th>
                <th className={thCls} style={{ borderColor: bdr, color: txt }}>Open Rate %</th>
                <th className={thCls} style={{ borderColor: bdr, color: txt }}>Clicks</th>
                <th className={thCls} style={{ borderColor: bdr, color: txt }}>Click Rate %</th>
                <th className={thCls} style={{ borderColor: bdr, color: txt }}>Complaints</th>
                <th className={thCls} style={{ borderColor: bdr, color: txt }}>Unsubscribed</th>
              </tr>
            </thead>
            <tbody>{buildRows()}</tbody>
          </table>
        </div>
        </>
      )}
    </div>
  )
}
