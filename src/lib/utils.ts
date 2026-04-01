import type { MmData, DateMetrics, ProviderData, EspRecord, EspStatus } from './types'

export const fmtN = (n: number): string => {
  return Math.round(n).toLocaleString()
}

export const fmtP = (n: number, d = 1): string => n.toFixed(d) + '%'

export function getEspStatus(bounceRate: number, deliveryRate: number): EspStatus {
  if (bounceRate > 10 || deliveryRate < 70) return 'critical'
  if (bounceRate > 2 || deliveryRate < 95) return 'warn'
  return 'healthy'
}

export function aggDates(
  byDate: Record<string, DateMetrics>,
  dates: string[]
): DateMetrics | null {
  let sent = 0, delivered = 0, opened = 0, clicked = 0,
    bounced = 0, unsubscribed = 0, complained = 0

  dates.forEach(d => {
    const r = byDate[d]
    if (!r) return
    sent += r.sent || 0
    delivered += r.delivered || 0
    opened += r.opened || 0
    clicked += r.clicked || 0
    bounced += r.bounced || 0
    unsubscribed += r.unsubscribed || 0
    complained += r.complained || 0
  })

  if (sent === 0) return null

  return {
    sent, delivered, opened, clicked, bounced, unsubscribed, complained,
    deliveryRate: (delivered / sent) * 100,
    successRate: (delivered / sent) * 100,
    openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
    clickRate: opened > 0 ? (clicked / opened) * 100 : 0,
    bounceRate: (bounced / sent) * 100,
    unsubRate: opened > 0 ? (unsubscribed / opened) * 100 : 0,
    complaintRate: delivered > 0 ? (complained / delivered) * 100 : 0,
  }
}

export function buildProviderDomains(data: MmData): MmData['providerDomains'] {
  const pd: MmData['providerDomains'] = {}

  data.dates.forEach(date => {
    const provTotal = Object.values(data.providers).reduce((s, p) => {
      const r = p.byDate[date]
      return r ? s + r.sent : s
    }, 0)
    if (!provTotal) return

    Object.entries(data.providers).forEach(([prov, pData]) => {
      const pr = pData.byDate[date]
      if (!pr || !pr.sent) return
      const pFrac = pr.sent / provTotal

      Object.entries(data.domains).forEach(([dom, dData]) => {
        const dr = dData.byDate[date]
        if (!dr || !dr.sent) return
        const domSent = Math.round(dr.sent * pFrac)
        if (!domSent) return

        if (!pd[prov]) pd[prov] = {}
        if (!pd[prov][dom]) pd[prov][dom] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 }
        const x = pd[prov][dom]
        x.sent += Math.round(dr.sent * pFrac)
        x.delivered += Math.round(dr.delivered * pFrac)
        x.opened += Math.round(dr.opened * pFrac)
        x.clicked += Math.round(dr.clicked * pFrac)
        x.bounced += Math.round(dr.bounced * pFrac)
        x.unsubscribed += Math.round((dr.unsubscribed || 0) * pFrac)
      })
    })
  })

  return pd
}

export function syncEspFromData(
  esp: EspRecord,
  data: MmData
): EspRecord {
  const dates = data.dates
  let sent = 0, delivered = 0, opened = 0, clicked = 0, bounced = 0, unsub = 0
  dates.forEach(d => {
    const r = data.overallByDate[d]
    if (r) {
      sent += r.sent || 0
      delivered += r.delivered || 0
      opened += r.opened || 0
      clicked += r.clicked || 0
      bounced += r.bounced || 0
      unsub += r.unsubscribed || 0
    }
  })
  if (sent === 0) return esp

  const deliveryRate = (delivered / sent) * 100
  const openRate = delivered > 0 ? (opened / delivered) * 100 : 0
  const clickRate = opened > 0 ? (clicked / opened) * 100 : 0
  const bounceRate = (bounced / sent) * 100
  const unsubRate = opened > 0 ? (unsub / opened) * 100 : 0

  return {
    ...esp,
    sent, delivered, opens: opened, clicks: clicked, bounced, unsub,
    deliveryRate, openRate, clickRate, bounceRate, unsubRate,
    status: getEspStatus(bounceRate, deliveryRate),
  }
}

function mergeMetrics(a: DateMetrics, b: DateMetrics): DateMetrics {
  const sent = (a.sent || 0) + (b.sent || 0)
  const delivered = (a.delivered || 0) + (b.delivered || 0)
  const opened = (a.opened || 0) + (b.opened || 0)
  const clicked = (a.clicked || 0) + (b.clicked || 0)
  const bounced = (a.bounced || 0) + (b.bounced || 0)
  const unsubscribed = (a.unsubscribed || 0) + (b.unsubscribed || 0)
  const complained = (a.complained || 0) + (b.complained || 0)
  return {
    sent, delivered, opened, clicked, bounced, unsubscribed, complained,
    deliveryRate: sent > 0 ? (delivered / sent) * 100 : 0,
    successRate: sent > 0 ? (delivered / sent) * 100 : 0,
    openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
    clickRate: opened > 0 ? (clicked / opened) * 100 : 0,
    bounceRate: sent > 0 ? (bounced / sent) * 100 : 0,
    unsubRate: opened > 0 ? (unsubscribed / opened) * 100 : 0,
    complaintRate: delivered > 0 ? (complained / delivered) * 100 : 0,
  }
}

function mergeProviderData(a: ProviderData, b: ProviderData): ProviderData {
  const allDates = new Set([...Object.keys(a.byDate), ...Object.keys(b.byDate)])
  const byDate: Record<string, DateMetrics> = {}
  allDates.forEach(d => {
    const am = a.byDate[d], bm = b.byDate[d]
    byDate[d] = am && bm ? mergeMetrics(am, bm) : (am || bm)
  })
  const vals = Object.values(byDate)
  const overall = vals.length
    ? vals.reduce((acc, m) => mergeMetrics(acc, m))
    : a.overall
  return { overall, byDate }
}

const MONTHS_UTIL = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function makeDatesFull(label: string, year: number): { label: string; year: number; iso: string } {
  const [mon, day] = label.split(' ')
  const m = MONTHS_UTIL.indexOf(mon) + 1
  const iso = `${year}-${String(m).padStart(2, '0')}-${day.padStart(2, '0')}`
  return { label, year, iso }
}

function inferYearsFromSequence(labels: string[]): Record<string, number> {
  // Start from 2025, increment year when month wraps backward
  const result: Record<string, number> = {}
  let year = 2025
  let prevMonthIdx = -1
  for (const label of labels) {
    const [mon] = label.split(' ')
    const mIdx = MONTHS_UTIL.indexOf(mon)
    if (mIdx < prevMonthIdx) year++
    result[label] = year
    prevMonthIdx = mIdx
  }
  return result
}

export function mergeMmData(a: MmData, b: MmData): MmData {
  const dateSet = new Set([...a.dates, ...b.dates])

  // Build label -> datesFull map from both sources
  const dfMap: Record<string, { label: string; year: number; iso: string }> = {}
  ;[...a.datesFull, ...b.datesFull].forEach(df => {
    if (!dfMap[df.label]) dfMap[df.label] = { label: df.label, year: df.year, iso: df.iso || '' }
  })

  // For any label missing iso or year, infer
  const allLabels = Array.from(dateSet)
  const missingYears = allLabels.filter(l => !dfMap[l] || !dfMap[l].iso)
  if (missingYears.length) {
    // Sort labels first to infer year sequence correctly
    const sorted = allLabels.slice().sort((x, y) => {
      const xi = MONTHS_UTIL.indexOf(x.split(' ')[0]) * 31 + parseInt(x.split(' ')[1])
      const yi = MONTHS_UTIL.indexOf(y.split(' ')[0]) * 31 + parseInt(y.split(' ')[1])
      return xi - yi
    })
    const inferred = inferYearsFromSequence(sorted)
    missingYears.forEach(l => { dfMap[l] = makeDatesFull(l, inferred[l] || 2025) })
  }

  const dates = Array.from(dateSet).sort((x, y) => {
    const xy = dfMap[x]?.year || 2025, yy = dfMap[y]?.year || 2025
    if (xy !== yy) return xy - yy
    const [xm, xd] = x.split(' '), [ym, yd] = y.split(' ')
    return (MONTHS_UTIL.indexOf(xm) * 31 + parseInt(xd)) - (MONTHS_UTIL.indexOf(ym) * 31 + parseInt(yd))
  })
  const datesFull = dates.map(d => dfMap[d])

  const allProviders = new Set([...Object.keys(a.providers), ...Object.keys(b.providers)])
  const providers: MmData['providers'] = {}
  allProviders.forEach(p => {
    providers[p] = a.providers[p] && b.providers[p]
      ? mergeProviderData(a.providers[p], b.providers[p])
      : (a.providers[p] || b.providers[p])
  })

  const allDomains = new Set([...Object.keys(a.domains), ...Object.keys(b.domains)])
  const domains: MmData['domains'] = {}
  allDomains.forEach(d => {
    domains[d] = a.domains[d] && b.domains[d]
      ? mergeProviderData(a.domains[d], b.domains[d])
      : (a.domains[d] || b.domains[d])
  })

  const allDates = new Set([...Object.keys(a.overallByDate), ...Object.keys(b.overallByDate)])
  const overallByDate: MmData['overallByDate'] = {}
  allDates.forEach(d => {
    const am = a.overallByDate[d], bm = b.overallByDate[d]
    overallByDate[d] = am && bm ? mergeMetrics(am, bm) : (am || bm)
  })

  const merged: MmData = { dates, datesFull, providers, domains, overallByDate, providerDomains: {} }
  merged.providerDomains = buildProviderDomains(merged)
  return merged
}

/**
 * Apply `override` on top of `base` using last-write-wins per date.
 * For every date in override: wipe that date from base, then write the new data.
 * Dates not covered by override are left untouched in base.
 * This prevents double-counting when re-uploading the same date range.
 */
export function overwriteMmData(base: MmData, override: MmData): MmData {
  const result: MmData = {
    dates: [...base.dates],
    datesFull: [...base.datesFull],
    providers: JSON.parse(JSON.stringify(base.providers)),
    domains:   JSON.parse(JSON.stringify(base.domains)),
    overallByDate: { ...base.overallByDate },
    providerDomains: {},
  }

  override.dates.forEach(date => {
    // Add date to result if genuinely new
    if (!result.dates.includes(date)) {
      result.dates.push(date)
      const df = override.datesFull.find(d => d.label === date)
      if (df) result.datesFull.push(df)
    }

    // Wipe this date's slice from all existing providers/domains/overall
    Object.values(result.providers).forEach(p => { delete p.byDate[date] })
    Object.values(result.domains).forEach(d  => { delete d.byDate[date] })
    delete result.overallByDate[date]

    // Write fresh data for this date from override
    Object.entries(override.providers).forEach(([name, data]) => {
      if (!data.byDate[date]) return
      if (!result.providers[name]) result.providers[name] = { overall: {} as DateMetrics, byDate: {} }
      result.providers[name].byDate[date] = data.byDate[date]
    })
    Object.entries(override.domains).forEach(([name, data]) => {
      if (!data.byDate[date]) return
      if (!result.domains[name]) result.domains[name] = { overall: {} as DateMetrics, byDate: {} }
      result.domains[name].byDate[date] = data.byDate[date]
    })
    if (override.overallByDate[date]) result.overallByDate[date] = override.overallByDate[date]
  })

  // Sort dates chronologically
  const dfMap: Record<string, { label: string; year: number; iso: string }> = {}
  result.datesFull.forEach(df => { dfMap[df.label] = df })
  result.dates.sort((x, y) => {
    const xy = dfMap[x]?.year || 2025, yy = dfMap[y]?.year || 2025
    if (xy !== yy) return xy - yy
    const [xm, xd] = x.split(' '), [ym, yd] = y.split(' ')
    return (MONTHS_UTIL.indexOf(xm) * 31 + parseInt(xd)) - (MONTHS_UTIL.indexOf(ym) * 31 + parseInt(yd))
  })
  result.datesFull = result.dates.map(d => dfMap[d]).filter(Boolean)

  // Recalculate overall for every provider/domain
  Object.values(result.providers).forEach(p => {
    const vals = Object.values(p.byDate)
    p.overall = vals.length ? vals.reduce((acc, m) => mergeMetrics(acc, m)) : p.overall
  })
  Object.values(result.domains).forEach(d => {
    const vals = Object.values(d.byDate)
    d.overall = vals.length ? vals.reduce((acc, m) => mergeMetrics(acc, m)) : d.overall
  })

  result.providerDomains = buildProviderDomains(result)
  return result
}

export function exportCSV(rows: EspRecord[]): void {
  const headers = ['ESP', 'Sent', 'Delivered', 'Delivery%', 'Opens', 'Open%', 'Clicks', 'Click%', 'Bounced', 'Bounce%', 'Unsub']
  const data = rows.map(d => [
    d.name, d.sent, d.delivered, d.deliveryRate.toFixed(2),
    d.opens, d.openRate.toFixed(2), d.clicks, d.clickRate.toFixed(2),
    d.bounced, d.bounceRate.toFixed(2), d.unsub,
  ])
  const csv = [headers, ...data].map(r => r.join(',')).join('\n')
  const a = document.createElement('a')
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
  a.download = 'esp_performance.csv'
  a.click()
}

export const CHART_TOOLTIP_OPTS = {
  backgroundColor: '#1a1e26',
  titleColor: '#f0f2f5',
  bodyColor: '#e8ecf2',
  borderColor: 'rgba(255,255,255,0.1)',
  borderWidth: 1,
}

export function chartTooltip(isLight: boolean) {
  return isLight
    ? { backgroundColor: '#ffffff', titleColor: '#111827', bodyColor: '#374151', borderColor: 'rgba(0,0,0,0.12)', borderWidth: 1 }
    : CHART_TOOLTIP_OPTS
}

export const getGridColor = (isLight: boolean) =>
  isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.05)'

export const getTextColor = (isLight: boolean) =>
  isLight ? '#111827' : '#c8cdd6'
