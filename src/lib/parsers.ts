'use client'
import type { MmData, DateMetrics } from './types'

// Dynamically import xlsx to avoid SSR issues
type XLSXType = typeof import('xlsx')
let XLSX: XLSXType | null = null

async function getXLSX(): Promise<XLSXType> {
  if (!XLSX) XLSX = await import('xlsx')
  return XLSX
}

interface ParseResult {
  byDate: Record<string, {
    rows: number
    providers: Record<string, DateMetrics>
    domains: Record<string, DateMetrics>
    providerDomains: Record<string, Record<string, {
      sent: number; delivered: number; opened: number; clicked: number; bounced: number; hardBounced: number; softBounced: number; unsubscribed: number
    }>>
  }>
  dates: string[]
  dateYears: Record<string, number>
  totalRows: number
  skipped: number
  skippedNoDate: number
  skippedNoEmail: number
  newDates: number
  format: 'mailmodo' | 'generic'
}

function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur.trim())
  return result
}

// Splits the full CSV text into rows, correctly handling quoted fields
// that contain embedded newlines (e.g. BounceReason with \r\n in them)
function splitCsvRows(text: string): string[][] {
  const rows: string[][] = []
  const fields: string[] = []
  let cur = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (ch === '"') {
      if (inQuotes && next === '"') { cur += '"'; i++ }   // escaped quote
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      fields.push(cur.trim())
      cur = ''
    } else if ((ch === '\n' || (ch === '\r' && next === '\n')) && !inQuotes) {
      if (ch === '\r') i++                                // consume \n of \r\n
      fields.push(cur.trim())
      cur = ''
      rows.push([...fields])
      fields.length = 0
    } else if (ch === '\r' && !inQuotes) {
      // bare \r — treat as line end
      fields.push(cur.trim())
      cur = ''
      rows.push([...fields])
      fields.length = 0
    } else {
      cur += ch
    }
  }

  // Last row (no trailing newline)
  if (cur.trim() || fields.length) {
    fields.push(cur.trim())
    if (fields.some(f => f !== '')) rows.push([...fields])
  }

  return rows
}

function normaliseKeys(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  Object.entries(row).forEach(([k, v]) => {
    out[k.toLowerCase().replace(/\s+/g, '-')] = String(v ?? '')
  })
  return out
}

function parseDate(raw: string | number, monthFirst = false): { str: string; year: number } | null {
  if (!raw) return null
  // Excel serial number
  if (typeof raw === 'number') {
    const d = new Date(Date.UTC(1899, 11, 30) + raw * 86400000)
    const m = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
    const day = String(d.getUTCDate()).padStart(2, '0')
    return { str: `${m} ${day}`, year: d.getUTCFullYear() }
  }
  const s = String(raw).trim()
  if (!s) return null
  // mm/dd/yyyy (Ongage) or dd/mm/yyyy — also handles dd-mm-yyyy and optional time suffix
  const dmMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (dmMatch) {
    const n1 = parseInt(dmMatch[1])
    const n2 = parseInt(dmMatch[2])
    const year = parseInt(dmMatch[3])
    let month: number, day: number
    if (monthFirst || n2 > 12) { month = n1; day = n2 }
    else { day = n1; month = n2 }
    const d = new Date(year, month - 1, day)
    if (!isNaN(d.getTime()))
      return { str: d.toLocaleString('en-US', { month: 'short' }) + ' ' + String(d.getDate()).padStart(2, '0'), year }
  }
  // ISO yyyy-mm-dd
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    const year = parseInt(isoMatch[1])
    const d = new Date(year, parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]))
    if (!isNaN(d.getTime()))
      return { str: d.toLocaleString('en-US', { month: 'short' }) + ' ' + String(d.getDate()).padStart(2, '0'), year }
  }
  return null
}

function extractDomain(email: string): string {
  const at = email.indexOf('@')
  return at >= 0 ? email.slice(at + 1).toLowerCase().trim() : 'unknown'
}

function extractSendingDomain(campaignName: string): string {
  // Try prefix format: "domain.com - Campaign Name"
  const mPrefix = campaignName.match(/^([a-z0-9.-]+\.[a-z]{2,})\s*[-–]/i)
  if (mPrefix) return mPrefix[1].toLowerCase()
  // Try domain at end: "Campaign Name - domain.com"
  const mEnd = campaignName.match(/([a-z0-9-]+\.[a-z]{2,})$/i)
  if (mEnd) return mEnd[1].toLowerCase()
  // Try domain anywhere in the string
  const m = campaignName.match(/([a-z0-9-]+\.[a-z]{2,})/i)
  if (m) return m[1].toLowerCase()
  // Try underscore-separated format: "WP_march10_domainname" → "domainname.com"
  const parts = campaignName.split(/[_\-\s]+/)
  const last = parts[parts.length - 1]?.toLowerCase().trim()
  if (last && last.length >= 6 && /^[a-z][a-z0-9]+$/i.test(last)) {
    // If it looks like a domain name without TLD (all alphanumeric, 4+ chars), append .com
    return last + '.com'
  }
  return 'unknown'
}

function mergeMetrics(
  target: DateMetrics,
  src: { sent?: number; delivered?: number; opened?: number; clicked?: number; bounced?: number; hardBounced?: number; softBounced?: number; unsubscribed?: number }
) {
  target.sent += src.sent || 0
  target.delivered += src.delivered || 0
  target.opened += src.opened || 0
  target.clicked += src.clicked || 0
  target.bounced += src.bounced || 0
  target.hardBounced = (target.hardBounced || 0) + (src.hardBounced || 0)
  target.softBounced = (target.softBounced || 0) + (src.softBounced || 0)
  target.unsubscribed = (target.unsubscribed || 0) + (src.unsubscribed || 0)
}

function recalcRates(m: DateMetrics): void {
  m.deliveryRate = m.sent > 0 ? (m.delivered / m.sent) * 100 : 0
  m.openRate = m.delivered > 0 ? (m.opened / m.delivered) * 100 : 0
  m.clickRate = m.opened > 0 ? (m.clicked / m.opened) * 100 : 0
  m.bounceRate = m.sent > 0 ? (m.bounced / m.sent) * 100 : 0
  m.unsubRate = m.opened > 0 ? ((m.unsubscribed || 0) / m.opened) * 100 : 0
}

function blankMetrics(): DateMetrics {
  return { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, hardBounced: 0, softBounced: 0, unsubscribed: 0, complained: 0, deliveryRate: 0, openRate: 0, clickRate: 0, bounceRate: 0 }
}

export async function parseFile(file: File, espName?: string): Promise<ParseResult> {
  const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
  let rows: Record<string, string>[]

  if (isXlsx) {
    const xlsx = await getXLSX()
    const buf = await file.arrayBuffer()
    const wb = xlsx.read(buf, { type: 'array', cellDates: false })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rawRows = xlsx.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
    rows = rawRows.map(normaliseKeys)
  } else {
    // Parse CSV as plain text, respecting quoted multi-line fields
    const text = await file.text()
    const csvRows = splitCsvRows(text)
    if (csvRows.length < 2) throw new Error('No rows found in file')
    const headers = csvRows[0].map(h => h.toLowerCase().replace(/\s+/g, '-'))
    rows = csvRows.slice(1)
      .filter(r => r.some(v => v.trim() !== ''))
      .map(vals => {
        const row: Record<string, string> = {}
        headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
        return row
      })
  }

  if (rows.length === 0) throw new Error('No rows found in file')

  const first = rows[0]
  const isMailmodo = 'campaign-name' in first || 'opens-html' in first
  const isOngage = espName === 'Ongage'

  const byDate: ParseResult['byDate'] = {}
  const dateYears: Record<string, number> = {}
  let skipped = 0, totalRows = 0
  let skippedNoDate = 0, skippedNoEmail = 0

  rows.forEach(row => {
    totalRows++
    const rawDate = row['sent-time'] || row['date'] || row['action_timestamp_rounded'] || row['timestamp'] || ''
    const parsed = parseDate(rawDate !== '' && !isNaN(Number(rawDate)) ? Number(rawDate) : rawDate, isOngage)
    if (!parsed) { skipped++; skippedNoDate++; return }
    const dateStr = parsed.str
    dateYears[dateStr] = parsed.year

    const email = row['email'] || row['email-address'] || row['email_address'] || row['recipient'] || row['to'] || ''
    if (!email) { skipped++; skippedNoEmail++; return }

    const providerDomain = extractDomain(email)
    // Extract sending (from) domain — check explicit columns first, then fall back to campaign name
    const explicitFromDomain = row['from-domain'] || row['from_domain'] || row['sending_domain'] || row['sender-domain'] || ''
    const explicitFromEmail = row['from-email'] || row['from-address'] || row['from_address'] || row['sender'] || ''
    const sendingDomain = explicitFromDomain
      ? explicitFromDomain.toLowerCase().trim()
      : explicitFromEmail
        ? extractDomain(explicitFromEmail)
        : isMailmodo
          ? extractSendingDomain(row['campaign-name'] || '')
          : 'unknown'

    if (!byDate[dateStr]) {
      byDate[dateStr] = { rows: 0, providers: {}, domains: {}, providerDomains: {} }
    }
    const bucket = byDate[dateStr]
    bucket.rows++

    const isBounced = isMailmodo
      ? (row['bounced'] === '1' || row['bounced'] === 'true' || row['bounced'] === 'TRUE') ? 1 : 0
      : Number(row['bounced'] || row['bounce'] || 0)
    const hardBounceRaw = row['ishardbounce'] || row['ishardbounced'] || row['is-hard-bounced'] || row['is-hard-bounce'] || row['hardbounce'] || row['hard-bounce'] || row['hard_bounce'] || row['hard_bounced'] || ''
    const isHard = isMailmodo
      ? (hardBounceRaw === '1' || hardBounceRaw === 'true' || hardBounceRaw === 'TRUE') ? 1 : 0
      : Number(hardBounceRaw || 0)
    const hardBounced = isBounced > 0 ? Math.min(isHard, isBounced) : 0
    const softBounced = isBounced > 0 ? isBounced - hardBounced : 0

    const metrics = isMailmodo ? {
      sent: 1,
      delivered: (row['delivery'] === 'TRUE' || row['delivery'] === 'true' || row['delivery'] === '1' || Number(row['delivery'] || 0) > 0) ? 1 : 0,
      opened: (Number(row['opens-html'] || 0) + Number(row['opens-amp'] || 0)) > 0 ? 1 : 0,
      clicked: (Number(row['clicks-html'] || 0) + Number(row['clicks-amp'] || 0)) > 0 ? 1 : 0,
      bounced: isBounced,
      hardBounced,
      softBounced,
      unsubscribed: (row['unsubscribed'] === '1' || row['unsubscribed'] === 'true' || row['unsubscribed'] === 'TRUE') ? 1 : 0,
    } : {
      sent: Number(row['sent'] || 1),
      delivered: Number(row['delivered'] || 0),
      opened: Number(row['opens'] || row['opened'] || 0),
      clicked: Number(row['clicks'] || row['clicked'] || 0),
      bounced: isBounced,
      hardBounced,
      softBounced,
      unsubscribed: Number(row['unsubscribed'] || row['unsub'] || 0),
    }

    if (!bucket.providers[providerDomain]) bucket.providers[providerDomain] = blankMetrics()
    mergeMetrics(bucket.providers[providerDomain], metrics)

    if (!bucket.domains[sendingDomain]) bucket.domains[sendingDomain] = blankMetrics()
    mergeMetrics(bucket.domains[sendingDomain], metrics)

    if (!bucket.providerDomains[providerDomain]) bucket.providerDomains[providerDomain] = {}
    if (!bucket.providerDomains[providerDomain][sendingDomain]) {
      bucket.providerDomains[providerDomain][sendingDomain] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, hardBounced: 0, softBounced: 0, unsubscribed: 0 }
    }
    const pd = bucket.providerDomains[providerDomain][sendingDomain]
    pd.sent += metrics.sent
    pd.delivered += metrics.delivered
    pd.opened += metrics.opened
    pd.clicked += metrics.clicked
    pd.bounced += metrics.bounced
    pd.hardBounced = (pd.hardBounced || 0) + (metrics.hardBounced || 0)
    pd.softBounced = (pd.softBounced || 0) + (metrics.softBounced || 0)
    pd.unsubscribed += metrics.unsubscribed || 0
  })

  // Recalculate rates
  Object.values(byDate).forEach(d => {
    Object.values(d.providers).forEach(recalcRates)
    Object.values(d.domains).forEach(recalcRates)
  })

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const dates = Object.keys(byDate).sort((a, b) => {
    const ay = dateYears[a] || 0, by_ = dateYears[b] || 0
    if (ay !== by_) return ay - by_
    const [am, ad] = a.split(' '), [bm, bd] = b.split(' ')
    return (MONTHS.indexOf(am) * 31 + parseInt(ad)) - (MONTHS.indexOf(bm) * 31 + parseInt(bd))
  })

  return { byDate, dates, dateYears, totalRows, skipped, skippedNoDate, skippedNoEmail, newDates: 0, format: isMailmodo ? 'mailmodo' : 'generic' }
}

export function mergeIntoMmData(current: MmData, result: ReturnType<typeof parseFile> extends Promise<infer T> ? T : never, espName: string): { data: MmData; newDates: number } {
  const data = { ...current }
  let newDates = 0

  result.dates.forEach(date => {
    const bucket = result.byDate[date]
    const isNew = !data.dates.includes(date)
    if (isNew) { data.dates.push(date); newDates++ }

    // Merge providers
    Object.entries(bucket.providers).forEach(([prov, metrics]) => {
      if (!data.providers[prov]) data.providers[prov] = { overall: blankMetrics(), byDate: {} }
      if (!data.providers[prov].byDate[date]) data.providers[prov].byDate[date] = blankMetrics()
      mergeMetrics(data.providers[prov].byDate[date], metrics)
      recalcRates(data.providers[prov].byDate[date])
    })

    // Merge domains
    Object.entries(bucket.domains).forEach(([dom, metrics]) => {
      if (!data.domains[dom]) data.domains[dom] = { overall: blankMetrics(), byDate: {} }
      if (!data.domains[dom].byDate[date]) data.domains[dom].byDate[date] = blankMetrics()
      mergeMetrics(data.domains[dom].byDate[date], metrics)
      recalcRates(data.domains[dom].byDate[date])
    })

    // Merge providerDomains (actual per-provider per-domain data)
    if (bucket.providerDomains) {
      if (!data.providerDomains) data.providerDomains = {}
      Object.entries(bucket.providerDomains).forEach(([prov, domMap]) => {
        if (!data.providerDomains[prov]) data.providerDomains[prov] = {}
        Object.entries(domMap).forEach(([dom, cell]) => {
          if (!data.providerDomains[prov][dom]) {
            data.providerDomains[prov][dom] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, hardBounced: 0, softBounced: 0, unsubscribed: 0 }
          }
          const t = data.providerDomains[prov][dom]
          t.sent += cell.sent || 0; t.delivered += cell.delivered || 0
          t.opened += cell.opened || 0; t.clicked += cell.clicked || 0
          t.bounced += cell.bounced || 0; t.hardBounced = (t.hardBounced || 0) + (cell.hardBounced || 0)
          t.softBounced = (t.softBounced || 0) + (cell.softBounced || 0)
          t.unsubscribed += cell.unsubscribed || 0
        })
      })
    }

    // Overall
    if (!data.overallByDate[date]) data.overallByDate[date] = blankMetrics()
    mergeMetrics(data.overallByDate[date], bucket.providers ? Object.values(bucket.providers).reduce((acc, m) => {
      acc.sent += m.sent; acc.delivered += m.delivered; acc.opened += m.opened
      acc.clicked += m.clicked; acc.bounced += m.bounced
      return acc
    }, blankMetrics()) : blankMetrics())
    recalcRates(data.overallByDate[date])
  })

  // Recalculate overall stats for each provider and domain
  Object.values(data.providers).forEach(p => {
    const overall = blankMetrics()
    Object.values(p.byDate).forEach(d => mergeMetrics(overall, d))
    recalcRates(overall)
    p.overall = overall
  })
  Object.values(data.domains).forEach(d => {
    const overall = blankMetrics()
    Object.values(d.byDate).forEach(r => mergeMetrics(overall, r))
    recalcRates(overall)
    d.overall = overall
  })

  // Sort dates with year awareness
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  data.dates.sort((a, b) => {
    const ay = result.dateYears[a] || 0, by_ = result.dateYears[b] || 0
    if (ay !== by_) return ay - by_
    const [am, ad] = a.split(' '), [bm, bd] = b.split(' ')
    return (MONTHS.indexOf(am) * 31 + parseInt(ad)) - (MONTHS.indexOf(bm) * 31 + parseInt(bd))
  })
  data.datesFull = data.dates.map(d => {
    const year = result.dateYears[d] || new Date().getFullYear()
    const [mon, day] = d.split(' ')
    const m = MONTHS.indexOf(mon) + 1
    const iso = `${year}-${String(m).padStart(2, '0')}-${day.padStart(2, '0')}`
    return { label: d, year, iso }
  })

  return { data, newDates }
}
