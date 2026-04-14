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
  const thr = Math.max(0, a.sent - a.delivered - a.bounced)
  return {
    sr: a.sent > 0 ? a.delivered / a.sent * 100 : 0,
    or: a.delivered > 0 ? a.opened / a.delivered * 100 : 0,
    ctr: a.opened > 0 ? a.clicked / a.opened * 100 : 0,
    br: a.sent > 0 ? a.bounced / a.sent * 100 : 0,
    thr,
    trr: a.sent > 0 ? thr / a.sent * 100 : 0,
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

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [tip, setTip] = useState<{ title: string; exact: string; formula: string; calc: string; x: number; y: number } | null>(null)

  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  function handleFrom(iso: string) { setFromDate(iso) }
  function handleTo(iso: string) { setToDate(iso) }
  function handleAll() { setFromDate(''); setToDate('') }

  function downloadCsv() {
    const headers = ['Level', 'ESP', 'IP', 'From Domain', 'Email Provider', 'Sent', 'Delivered', 'Total Bounces', 'Soft Bounce', 'Hard Bounce', 'Opens', 'Open Rate %', 'Clicks', 'Click Rate %', 'Unsubscribed', 'Complaints', 'Throttling']
    const csvRows: string[][] = [headers]

    function aggToRow(level: string, esp: string, ip: string, fd: string, prov: string, agg: Agg): string[] {
      const R = rates(agg)
      return [
        level, esp, ip, fd, prov,
        String(agg.sent), String(agg.delivered), String(agg.bounced), String(agg.softBounced), String(agg.hardBounced),
        String(agg.opened),
        agg.delivered > 0 ? R.or.toFixed(2) + '%' : '',
        String(agg.clicked),
        agg.opened > 0 ? R.ctr.toFixed(2) + '%' : '',
        String(agg.unsubscribed || 0), String(agg.complained || 0),
        R.thr > 0 ? `${R.thr} (${R.trr.toFixed(2)}%)` : '0'
      ]
    }

    espList.forEach(espName => {
      const espData = store.espData[espName]
      if (!espData || !espData.dates.length) return
      const ipMap = getIpMap(espName)
      const allFromDomains = Object.keys(espData.domains || {}).filter(d => d !== 'unknown' && d !== '')
      const espActiveDates = (fromDate && toDate)
        ? (espData.datesFull || []).filter(df => df.iso >= fromDate && df.iso <= toDate).map(df => df.label)
        : espData.dates

      const domainToIp: Record<string, string> = {}
      Object.entries(ipMap).forEach(([ip, fds]) => { fds.forEach(fd => { domainToIp[fd.toLowerCase().trim()] = ip }) })

      const ipGroups: Record<string, string[]> = {}
      allFromDomains.forEach(fd => {
        const ip = domainToIp[fd.toLowerCase().trim()] || 'IP NOT FOUND'
        if (!ipGroups[ip]) ipGroups[ip] = []
        ipGroups[ip].push(fd)
      })
      Object.keys(ipMap).forEach(ip => { if (!ipGroups[ip]) ipGroups[ip] = [] })

      const sortedIps = Object.keys(ipGroups).sort((a, b) => {
        if (a === 'IP NOT FOUND') return 1
        if (b === 'IP NOT FOUND') return -1
        return a.localeCompare(b, undefined, { numeric: true })
      })

      const espTot = emptyAgg()
      Object.values(espData.providers || {}).forEach(p => { const a = mxAgg(p.byDate, espActiveDates); addAgg(espTot, a) })
      if (espTot.sent === 0) return

      csvRows.push(aggToRow('ESP', espName, '', '', '', espTot))

      sortedIps.forEach(ip => {
        const fromDomains = ipGroups[ip] || []
        const ipTot = emptyAgg()
        fromDomains.forEach(fd => {
          const d = espData.domains[fd]
          if (d) { const a = mxAgg(d.byDate, espActiveDates); addAgg(ipTot, a) }
        })
        if (ipTot.sent === 0) return

        csvRows.push(aggToRow('IP', espName, ip, '', '', ipTot))

        fromDomains.forEach(fd => {
          const fdData = espData.domains[fd]
          const fdAgg = fdData ? mxAgg(fdData.byDate, espActiveDates) : emptyAgg()
          if (fdAgg.sent === 0) return

          csvRows.push(aggToRow('From Domain', espName, ip, fd, '', fdAgg))

          const fdProviders = Object.entries(espData.providerDomains || {})
            .filter(([, domMap]) => domMap[fd] && domMap[fd].sent > 0)
            .map(([prov, domMap]) => {
              const c = domMap[fd]
              return { name: prov, agg: { sent: c.sent, delivered: c.delivered, opened: c.opened, clicked: c.clicked, bounced: c.bounced, hardBounced: c.hardBounced || 0, softBounced: c.softBounced || 0, unsubscribed: c.unsubscribed, complained: 0 } as Agg }
            })
            .sort((a, b) => b.agg.sent - a.agg.sent)

          const top10Providers = fdProviders.slice(0, 10)
          const otherProviders = fdProviders.slice(10)
          const othersAgg = emptyAgg()
          otherProviders.forEach(({ agg }) => addAgg(othersAgg, agg))

          top10Providers.forEach(({ name: provName, agg: provAgg }) => {
            csvRows.push(aggToRow('Email Provider', espName, ip, fd, provName, provAgg))
          })
          if (otherProviders.length > 0) {
            csvRows.push(aggToRow('Email Provider', espName, ip, fd, `Others (${otherProviders.length})`, othersAgg))
          }
        })
      })
    })

    const csv = csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const dateRange = (fromDate && toDate) ? `_${fromDate}_to_${toDate}` : ''
    a.href = url
    a.download = `esp-deliverability-matrix${dateRange}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function toggle(key: string) { setExpanded(p => ({ ...p, [key]: !p[key] })) }

  // ESP name aliases: keys are canonical ESP names (lowercase), values are additional IP Matrix names to match
  const ESP_IPM_ALIASES: Record<string, string[]> = {
    '171 mailsapp': ['171'],
    'hotsol': ['hotsol'],
  }

  // Build IP → fromDomain map from ipmData for each ESP
  function getIpMap(espName: string): Record<string, string[]> {
    const map: Record<string, string[]> = {}
    const aliases = ESP_IPM_ALIASES[espName.toLowerCase()] ?? []
    const matchNames = [espName.toLowerCase(), ...aliases.map(a => a.toLowerCase())]
    ipmData.filter(r => matchNames.includes(r.esp?.toLowerCase() ?? '')).forEach(r => {
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

  const thCls = `px-3 py-2.5 text-[11px] font-mono tracking-widest uppercase text-left border-b whitespace-nowrap overflow-hidden`
  const tdCls = `px-3 py-2.5 text-left text-[11px] font-mono border-b`

  function rateColor(cls: string) {
    if (cls === 'mx-good') return isLight ? '#047857' : '#00e5c3'
    if (cls === 'mx-warn') return isLight ? '#92400e' : '#ffd166'
    if (cls === 'mx-bad') return isLight ? '#991b1b' : '#ff4757'
    return txt
  }

  function showTip(e: React.MouseEvent, title: string, exact: string, formula: string, calc: string) {
    const tipW = 260, tipH = 130
    const x = e.clientX + 14 + tipW > window.innerWidth ? e.clientX - tipW - 8 : e.clientX + 14
    const y = e.clientY + 14 + tipH > window.innerHeight ? e.clientY - tipH - 8 : e.clientY + 14
    setTip({ title, exact, formula, calc, x, y })
  }

  function DataRow({ agg, isTotal, isFdTotal, bg }: { agg: Agg; isTotal?: boolean; isFdTotal?: boolean; bg?: string }) {
    const R = rates(agg)
    const fw = isTotal || isFdTotal ? 'font-bold' : ''
    const style: React.CSSProperties = { borderBottom: `1px solid ${bdr}` }
    if (bg) style.background = bg
    if (isTotal) { style.background = isLight ? '#e8eaef' : '#1a1e26'; style.borderTop = `2px solid ${isLight ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.1)'}` }
    if (isFdTotal) { style.background = isLight ? '#e0e3ea' : 'rgba(255,255,255,.04)'; style.borderTop = `1px solid ${bdr}` }

    return (
      <>
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: txt }}>{fmtMx(agg.sent)}</td>
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: rateColor(rateCls(R.sr, true, 80, 95)), cursor: agg.sent > 0 ? 'help' : undefined }}
          onMouseEnter={e => { if (agg.sent > 0) showTip(e, 'SUCCESS RATE', R.sr.toFixed(2) + '%', 'Delivered ÷ Sent × 100', `${fmtMx(agg.delivered)} ÷ ${fmtMx(agg.sent)} × 100 = ${R.sr.toFixed(2)}%`) }}
          onMouseLeave={() => setTip(null)}>{fmtMx(agg.delivered)}</td>
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: rateColor(rateCls(R.br, false, 5, 10)) }}>{fmtMx(agg.bounced)}</td>
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: txt }}>{fmtMx(agg.softBounced)}</td>
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: rateColor(rateCls(R.br, false, 5, 10)) }}>{fmtMx(agg.hardBounced)}</td>
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: rateColor(rateCls(R.or, true, 30, 60)) }}>{fmtMx(agg.opened)}</td>
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: rateColor(rateCls(R.or, true, 30, 60)), cursor: R.or > 0 ? 'help' : undefined }}
          onMouseEnter={e => { if (R.or > 0) showTip(e, 'OPEN RATE', R.or.toFixed(2) + '%', 'Opens ÷ Delivered × 100', `${fmtMx(agg.opened)} ÷ ${fmtMx(agg.delivered)} × 100 = ${R.or.toFixed(2)}%`) }}
          onMouseLeave={() => setTip(null)}>{R.or > 0 ? R.or.toFixed(1) + '%' : ''}</td>
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: rateColor(rateCls(R.ctr, true, 20, 50)) }}>{fmtMx(agg.clicked)}</td>
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: rateColor(rateCls(R.ctr, true, 20, 50)), cursor: R.ctr > 0 ? 'help' : undefined }}
          onMouseEnter={e => { if (R.ctr > 0) showTip(e, 'CLICK RATE', R.ctr.toFixed(2) + '%', 'Clicks ÷ Opens × 100', `${fmtMx(agg.clicked)} ÷ ${fmtMx(agg.opened)} × 100 = ${R.ctr.toFixed(2)}%`) }}
          onMouseLeave={() => setTip(null)}>{R.ctr > 0 ? R.ctr.toFixed(1) + '%' : ''}</td>
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: txt }}>{fmtMx(agg.unsubscribed || 0)}</td>
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: (agg.complained || 0) > 0 ? (isLight ? '#991b1b' : '#ff4757') : txt }}>{fmtMx(agg.complained || 0)}</td>
        <td className={`${tdCls} ${fw}`} style={{ ...style, color: rateColor(rateCls(R.trr, false, 5, 15)), cursor: R.thr > 0 ? 'help' : undefined }}
          onMouseEnter={e => { if (R.thr > 0) showTip(e, 'THROTTLING', R.trr.toFixed(2) + '%', '(Sent − Delivered − Bounced) ÷ Sent × 100', `(${fmtMx(agg.sent)} − ${fmtMx(agg.delivered)} − ${fmtMx(agg.bounced)}) ÷ ${fmtMx(agg.sent)} × 100 = ${R.trr.toFixed(2)}%`) }}
          onMouseLeave={() => setTip(null)}>{R.thr > 0 ? `${fmtMx(R.thr)} (${R.trr.toFixed(1)}%)` : ''}</td>
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
        {count && <span className="text-[11px] font-mono ml-1.5 flex-shrink-0" style={{ color: muted, whiteSpace: 'nowrap' }}>{count}</span>}
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

      // Use this ESP's own dates for aggregation, filtered by the selected ISO range
      const espActiveDates = (fromDate && toDate)
        ? (espData.datesFull || []).filter(df => df.iso >= fromDate && df.iso <= toDate).map(df => df.label)
        : espData.dates

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

      if (!espEx) return

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
            <td className={tdCls} style={{ borderBottom: `1px solid ${bdr}`, background: ipBg }}></td>
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
            .map(([prov, domMap]) => {
              const c = domMap[fd]
              return { name: prov, agg: { sent: c.sent, delivered: c.delivered, opened: c.opened, clicked: c.clicked, bounced: c.bounced, hardBounced: c.hardBounced || 0, softBounced: c.softBounced || 0, unsubscribed: c.unsubscribed, complained: 0 } as Agg }
            })
            .sort((a, b) => b.agg.sent - a.agg.sent)

          const top10FdProviders = fdProviders.slice(0, 10)
          const otherFdProviders = fdProviders.slice(10)
          const othersFdAgg = emptyAgg()
          otherFdProviders.forEach(({ agg }) => addAgg(othersFdAgg, agg))

          const fdBg = isLight ? 'rgba(0,0,0,.025)' : 'rgba(255,255,255,.025)'

          rows.push(
            <tr key={fdKey} className="cursor-pointer" onClick={() => toggle(fdKey)}>
              <td className={`${tdCls} text-left`} style={{ borderBottom: `1px solid ${bdr}`, background: fdBg, paddingLeft: 40, color: muted, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                <ToggleBtn expanded={fdEx} label={<span style={{ color: muted, fontFamily: 'var(--font-mono)', fontSize: 11 }}>{fd}</span>} count={fdProviders.length > 0 ? `${fdProviders.length} providers` : ''} />
              </td>
              <td className={tdCls} style={{ borderBottom: `1px solid ${bdr}`, background: fdBg }}></td>
              <DataRow agg={fdAgg} bg={fdBg} />
            </tr>
          )

          if (!fdEx) return

          // Level 4: Email Providers (top 10 + Others)
          top10FdProviders.forEach(({ name: provName, agg: provAgg }) => {
            const provBg = isLight ? 'rgba(0,0,0,.035)' : 'rgba(255,255,255,.035)'
            rows.push(
              <tr key={`prov||${espName}||${ip}||${fd}||${provName}`}>
                <td className={tdCls} style={{ borderBottom: `1px solid ${bdr}`, background: provBg }}></td>
                <td className={tdCls} style={{ borderBottom: `1px solid ${bdr}`, background: provBg, paddingLeft: 60, fontFamily: 'var(--font-mono)', fontSize: 11, color: muted, textAlign: 'left' }}>
                  <span style={{ width: 3, height: 3, borderRadius: '50%', background: muted, display: 'inline-block', marginRight: 7, verticalAlign: 'middle' }} />
                  {provName}
                </td>
                <DataRow agg={provAgg} bg={provBg} />
              </tr>
            )
          })
          if (otherFdProviders.length > 0) {
            const provBg = isLight ? 'rgba(0,0,0,.035)' : 'rgba(255,255,255,.035)'
            rows.push(
              <tr key={`prov||${espName}||${ip}||${fd}||__others__`}>
                <td className={tdCls} style={{ borderBottom: `1px solid ${bdr}`, background: provBg }}></td>
                <td className={tdCls} style={{ borderBottom: `1px solid ${bdr}`, background: provBg, paddingLeft: 60, fontFamily: 'var(--font-mono)', fontSize: 11, color: muted, textAlign: 'left' }}>
                  <span style={{ width: 3, height: 3, borderRadius: '50%', background: muted, display: 'inline-block', marginRight: 7, verticalAlign: 'middle' }} />
                  Others ({otherFdProviders.length})
                </td>
                <DataRow agg={othersFdAgg} bg={provBg} />
              </tr>
            )
          }

          // From-domain total
          if (fdProviders.length > 0) {
            rows.push(
              <tr key={fdKey + '-total'}>
                <td className={`${tdCls} text-left font-semibold`} style={{ borderBottom: `1px solid ${bdr}`, background: isLight ? '#dde1e8' : 'rgba(255,255,255,.04)', paddingLeft: 40, fontFamily: 'var(--font-mono)', fontSize: 11, color: muted, borderTop: `1px solid ${bdr}` }}>
                  {fd} — total
                </td>
                <td className={tdCls} style={{ borderBottom: `1px solid ${bdr}`, background: isLight ? '#dde1e8' : 'rgba(255,255,255,.04)', borderTop: `1px solid ${bdr}` }}></td>
                <DataRow agg={fdAgg} isFdTotal />
              </tr>
            )
          }
        })

        // IP total
        const ipTotalBg = isLight ? 'rgba(3,105,161,.07)' : 'rgba(125,211,252,.07)'
        rows.push(
          <tr key={ipKey + '-total'}>
            <td className={`${tdCls} text-left font-semibold`} style={{ borderBottom: `1px solid ${bdr}`, background: ipTotalBg, paddingLeft: 20, fontFamily: 'var(--font-mono)', fontSize: 11, color: ipColor, borderTop: `1px solid ${bdr}` }}>
              {isNotFound ? '\u26A0 IP NOT FOUND' : ip} — total
            </td>
            <td className={tdCls} style={{ borderBottom: `1px solid ${bdr}`, background: ipTotalBg, borderTop: `1px solid ${bdr}` }}></td>
            <DataRow agg={ipTot} bg={ipTotalBg} />
          </tr>
        )
      })

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
            {(fromDate || toDate) && ` · ${fromDate || '…'} – ${toDate || '…'}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: muted }}>From</span>
          <CalendarPicker value={fromDate} onChange={handleFrom} isLight={isLight} rangeStart={fromDate} rangeEnd={toDate} />
          <span className="text-xs" style={{ color: muted }}>→</span>
          <CalendarPicker value={toDate} onChange={handleTo} isLight={isLight} rangeStart={fromDate} rangeEnd={toDate} align="right" />
          <button onClick={handleAll} className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-mono uppercase transition-all ${isLight ? 'border-black/20 text-gray-500 hover:border-[#0d9488]' : 'border-white/13 text-[#a8b0be] hover:border-[#0d9488]'}`}>
            All
          </button>
          {hasData && (
            <button onClick={downloadCsv} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-mono uppercase tracking-wider transition-all ${isLight ? 'border-black/20 text-gray-600 hover:border-[#0d9488] hover:text-[#0d9488]' : 'border-white/13 text-[#a8b0be] hover:border-[#0d9488] hover:text-[#0d9488]'}`}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 1v7M3.5 6l2.5 2.5L8.5 6"/><path d="M1 10h10"/>
              </svg>
              CSV
            </button>
          )}
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
            <span className={`text-[11px] font-mono uppercase tracking-wider flex-shrink-0 ${isLight ? 'text-gray-400' : 'text-[#6b7280]'}`}>Expanded:</span>
            <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
              {expandedBreadcrumbs.map(b => (
                <button key={b.key} onClick={() => toggle(b.key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono transition-all ${isLight ? 'border-black/15 hover:bg-black/5' : 'border-white/15 hover:bg-white/5'}`}>
                  <span style={{ color: b.color, fontWeight: 600 }}>{b.label}</span>
                  <span className={`text-[11px] ${isLight ? 'text-gray-400' : 'text-[#6b7280]'}`}>x</span>
                </button>
              ))}
            </div>
            <button onClick={() => setExpanded({})}
              className={`flex-shrink-0 px-2.5 py-1 rounded-lg border text-[11px] font-mono uppercase tracking-wider transition-all ${isLight ? 'border-black/15 text-gray-500 hover:border-red-300 hover:text-red-500' : 'border-white/15 text-[#6b7280] hover:border-[#ff4757] hover:text-[#ff4757]'}`}>
              Collapse All
            </button>
          </div>
        )}
        <div className={`rounded-xl border overflow-auto ${expandedBreadcrumbs.length > 0 ? 'mt-2' : ''}`} style={{ background: surfaceBg, borderColor: bdr, maxHeight: 'calc(100vh - 180px)' }}>
          <table className="w-full border-collapse" style={{ minWidth: 1380, tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: headerBg }}>
                <th className={`${thCls} text-left`} style={{ borderColor: bdr, color: txt, width: 200, position: 'sticky', top: 0, zIndex: 5, background: headerBg }}>ESP / IP / From Domain</th>
                <th className={`${thCls} text-left`} style={{ borderColor: bdr, color: txt, width: 140, position: 'sticky', top: 0, zIndex: 5, background: headerBg }}>Email Provider</th>
                <th className={thCls} style={{ borderColor: bdr, color: txt, width: 70, position: 'sticky', top: 0, zIndex: 5, background: headerBg }}>Sent</th>
                <th className={thCls} style={{ borderColor: bdr, color: txt, width: 80, position: 'sticky', top: 0, zIndex: 5, background: headerBg }}>Delivered</th>
                <th className={thCls} style={{ borderColor: bdr, color: txt, width: 90, position: 'sticky', top: 0, zIndex: 5, background: headerBg }}>Total BNCS</th>
                <th className={thCls} style={{ borderColor: bdr, color: txt, width: 80, position: 'sticky', top: 0, zIndex: 5, background: headerBg }}>Soft BNC</th>
                <th className={thCls} style={{ borderColor: bdr, color: txt, width: 80, position: 'sticky', top: 0, zIndex: 5, background: headerBg }}>Hard BNC</th>
                <th className={thCls} style={{ borderColor: bdr, color: txt, width: 70, position: 'sticky', top: 0, zIndex: 5, background: headerBg }}>Opens</th>
                <th className={thCls} style={{ borderColor: bdr, color: txt, width: 80, position: 'sticky', top: 0, zIndex: 5, background: headerBg }}>Open Rate</th>
                <th className={thCls} style={{ borderColor: bdr, color: txt, width: 70, position: 'sticky', top: 0, zIndex: 5, background: headerBg }}>Clicks</th>
                <th className={thCls} style={{ borderColor: bdr, color: txt, width: 80, position: 'sticky', top: 0, zIndex: 5, background: headerBg }}>Click Rate</th>
                <th className={thCls} style={{ borderColor: bdr, color: txt, width: 95, position: 'sticky', top: 0, zIndex: 5, background: headerBg }}>Unsubscribed</th>
                <th className={thCls} style={{ borderColor: bdr, color: txt, width: 85, position: 'sticky', top: 0, zIndex: 5, background: headerBg }}>Complaints</th>
                <th className={thCls} style={{ borderColor: bdr, color: isLight ? '#b45309' : '#ffd166', width: 110, position: 'sticky', top: 0, zIndex: 5, background: headerBg }}>Throttling</th>
              </tr>
            </thead>
            <tbody>{buildRows()}</tbody>
          </table>
        </div>
        </>
      )}

      {/* Formula tooltip */}
      {tip && (
        <div className="fixed z-[9999] pointer-events-none" style={{ left: tip.x, top: tip.y, minWidth: 240 }}>
          <div className="rounded-xl shadow-2xl p-4" style={{ background: isLight ? '#ffffff' : '#1a1e26', border: `1px solid ${isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.14)'}` }}>
            <div className="text-[11px] font-mono tracking-widest uppercase mb-2" style={{ color: isLight ? '#9ca3af' : '#6b7280' }}>{tip.title}</div>
            <div className="text-2xl font-bold font-mono mb-3" style={{ color: isLight ? '#111827' : '#ffffff' }}>{tip.exact}</div>
            <div className="text-[11px] font-mono tracking-widest uppercase mb-1.5" style={{ color: isLight ? '#b45309' : '#ffd166' }}>Formula</div>
            <div className="text-[11px] font-mono mb-1" style={{ color: isLight ? '#374151' : '#c8cdd6' }}>{tip.formula}</div>
            <div className="text-[11px] font-mono" style={{ color: isLight ? '#374151' : '#c8cdd6' }}>{tip.calc}</div>
          </div>
        </div>
      )}
    </div>
  )
}
