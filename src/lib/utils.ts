import type { MmData, DateMetrics, ProviderData, EspRecord, EspStatus, ThrottleRecord, ThrottleValue } from './types'

export const fmtN = (n: number): string => {
  return Math.round(n).toLocaleString()
}

export const fmtP = (n: number, d = 1): string => n.toFixed(d) + '%'

const MONTHS_FMT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

/** Convert "Mar 11" + year → "11/03/2026" */
export function fmtDateLabel(label: string, datesFull?: { label: string; year: number; iso: string }[]): string {
  const df = datesFull?.find(d => d.label === label)
  if (df?.iso) {
    const [y, m, d] = df.iso.split('-')
    return `${d}/${m}/${y}`
  }
  // Fallback: parse "Mar 11" manually
  const parts = label.split(' ')
  if (parts.length === 2) {
    const mIdx = MONTHS_FMT.indexOf(parts[0])
    if (mIdx >= 0) return `${parts[1].padStart(2, '0')}/${String(mIdx + 1).padStart(2, '0')}/2026`
  }
  return label
}

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
    bounced = 0, hardBounced = 0, softBounced = 0, unsubscribed = 0, complained = 0

  dates.forEach(d => {
    const r = byDate[d]
    if (!r) return
    sent += r.sent || 0
    delivered += r.delivered || 0
    opened += r.opened || 0
    clicked += r.clicked || 0
    bounced += r.bounced || 0
    hardBounced += r.hardBounced || 0
    softBounced += r.softBounced || 0
    unsubscribed += r.unsubscribed || 0
    complained += r.complained || 0
  })

  if (sent === 0) return null

  return {
    sent, delivered, opened, clicked, bounced, hardBounced, softBounced, unsubscribed, complained,
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
  const hardBounced = (a.hardBounced || 0) + (b.hardBounced || 0)
  const softBounced = (a.softBounced || 0) + (b.softBounced || 0)
  const unsubscribed = (a.unsubscribed || 0) + (b.unsubscribed || 0)
  const complained = (a.complained || 0) + (b.complained || 0)
  return {
    sent, delivered, opened, clicked, bounced, hardBounced, softBounced, unsubscribed, complained,
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

  // Merge providerDomains from both sources
  const pdMerged: MmData['providerDomains'] = {}
  const addPd = (src: MmData['providerDomains']) => {
    Object.entries(src || {}).forEach(([prov, domMap]) => {
      if (!pdMerged[prov]) pdMerged[prov] = {}
      Object.entries(domMap).forEach(([dom, cell]) => {
        if (!pdMerged[prov][dom]) pdMerged[prov][dom] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, hardBounced: 0, softBounced: 0, unsubscribed: 0 }
        const t = pdMerged[prov][dom]; t.sent += cell.sent; t.delivered += cell.delivered
        t.opened += cell.opened; t.clicked += cell.clicked; t.bounced += cell.bounced
        t.hardBounced = (t.hardBounced || 0) + (cell.hardBounced || 0)
        t.softBounced = (t.softBounced || 0) + (cell.softBounced || 0)
        t.unsubscribed += cell.unsubscribed
      })
    })
  }
  addPd(a.providerDomains); addPd(b.providerDomains)
  return { dates, datesFull, providers, domains, overallByDate, providerDomains: pdMerged }
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

  // Merge providerDomains: use override's actual data, keep base for non-overridden providers
  const basePd = JSON.parse(JSON.stringify(base.providerDomains || {}))
  const overPd = override.providerDomains || {}
  // Override replaces per-provider per-domain cells entirely
  Object.entries(overPd).forEach(([prov, domMap]) => {
    if (!basePd[prov]) basePd[prov] = {}
    Object.entries(domMap as Record<string, unknown>).forEach(([dom, cell]) => {
      basePd[prov][dom] = cell
    })
  })
  result.providerDomains = basePd
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
    ? { backgroundColor: '#ffffff', titleColor: '#0f172a', bodyColor: '#475569', borderColor: 'rgba(0,0,0,0.11)', borderWidth: 1, padding: 10 }
    : CHART_TOOLTIP_OPTS
}

export const getGridColor = (isLight: boolean) =>
  isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.05)'

export const getTextColor = (isLight: boolean) =>
  isLight ? '#64748b' : '#c8cdd6'

// ─── ESP Visibility Helpers ─────────────────────────────────
// Pure filters used by every view that displays ESPs.
// "hidden" is the list of ESP names a user has hidden globally.

export function isEspHidden(name: string, hidden: string[]): boolean {
  return hidden.includes(name)
}

export function visibleEsps<T extends { name: string }>(esps: T[], hidden: string[]): T[] {
  if (hidden.length === 0) return esps
  return esps.filter(e => !hidden.includes(e.name))
}

export function visibleEspNames(espData: Record<string, unknown>, hidden: string[]): string[] {
  const names = Object.keys(espData)
  if (hidden.length === 0) return names
  return names.filter(n => !hidden.includes(n))
}

export function visibleEspData<T>(espData: Record<string, T>, hidden: string[]): Record<string, T> {
  if (hidden.length === 0) return espData
  const out: Record<string, T> = {}
  for (const [name, data] of Object.entries(espData)) {
    if (!hidden.includes(name)) out[name] = data
  }
  return out
}

// ── Throttle Matrix helpers ──────────────────────────────────────────────────

type ThrottleCategory = 'gmail' | 'hotmail' | 'outlook' | 'yahoo' | 'icloud' | 'aol' | 'live' | 'gmx' | 'web' | 'others'

/**
 * Map a recipient email domain to one of the 10 throttle provider categories.
 * Used to look up per-provider throttle limits in the Throttling Matrix.
 */
export function getThrottleCategory(emailDomain: string): ThrottleCategory {
  const d = emailDomain.toLowerCase().trim()
  if (d === 'gmail.com' || d === 'googlemail.com') return 'gmail'
  if (d === 'hotmail.com' || d.startsWith('hotmail.')) return 'hotmail'
  if (d === 'outlook.com' || d.startsWith('outlook.')) return 'outlook'
  if (d === 'yahoo.com' || d === 'ymail.com' || d.startsWith('yahoo.')) return 'yahoo'
  if (d === 'icloud.com' || d === 'me.com' || d === 'mac.com') return 'icloud'
  if (d === 'aol.com' || d.startsWith('aol.')) return 'aol'
  if (d === 'live.com' || d === 'msn.com' || d.startsWith('live.')) return 'live'
  if (d === 'gmx.com' || d === 'gmx.net' || d.startsWith('gmx.')) return 'gmx'
  if (d === 'web.de' || d === 'freenet.de' || d === 't-online.de' || d === 'mail.de') return 'web'
  return 'others'
}

/**
 * Find the throttle record for a given ESP + from-domain pair.
 * Matching is case-insensitive and trims whitespace.
 */
export function findThrottleRecord(
  throttleData: ThrottleRecord[],
  espName: string,
  fromDomain: string
): ThrottleRecord | undefined {
  const esp = espName.toLowerCase()
  const fd  = fromDomain.toLowerCase().trim()
  return throttleData.find(
    r => r.esp.toLowerCase() === esp && r.fromDomain.toLowerCase().trim() === fd
  )
}

/**
 * Sum all numeric provider limits in a ThrottleRecord.
 * TBC values are excluded from the sum.
 * Returns 'TBC' if every provider value is 'TBC' (no numeric limits found).
 */
export function throttleSumOrTbc(rec: ThrottleRecord): number | 'TBC' {
  const vals: ThrottleValue[] = [
    rec.gmail, rec.hotmail, rec.outlook, rec.yahoo, rec.icloud,
    rec.aol, rec.live, rec.gmx, rec.web, rec.others,
  ]
  const nums = vals.filter((v): v is number => typeof v === 'number')
  return nums.length === 0 ? 'TBC' : nums.reduce((a, b) => a + b, 0)
}
