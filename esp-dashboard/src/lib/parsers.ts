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
      sent: number; delivered: number; opened: number; clicked: number; bounced: number; unsubscribed: number
    }>>
  }>
  dates: string[]
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

function parseDate(raw: string | number): string | null {
  if (!raw) return null
  // Excel serial number
  if (typeof raw === 'number') {
    const d = new Date(Date.UTC(1899, 11, 30) + raw * 86400000)
    const m = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
    const day = String(d.getUTCDate()).padStart(2, '0')
    return `${m} ${day}`
  }
  const s = String(raw).trim()
  if (!s) return null
  // dd/mm/yyyy or dd-mm-yyyy (with optional time)
  const ddmm = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (ddmm) {
    const d = new Date(parseInt(ddmm[3]), parseInt(ddmm[2]) - 1, parseInt(ddmm[1]))
    if (!isNaN(d.getTime()))
      return d.toLocaleString('en-US', { month: 'short' }) + ' ' + String(d.getDate()).padStart(2, '0')
  }
  // ISO yyyy-mm-dd
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    const d = new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]))
    if (!isNaN(d.getTime()))
      return d.toLocaleString('en-US', { month: 'short' }) + ' ' + String(d.getDate()).padStart(2, '0')
  }
  // Fallback: native Date parse
  const fallback = new Date(s)
  if (!isNaN(fallback.getTime()))
    return fallback.toLocaleString('en-US', { month: 'short' }) + ' ' + String(fallback.getDate()).padStart(2, '0')
  return null
}

function extractDomain(email: string): string {
  const at = email.indexOf('@')
  return at >= 0 ? email.slice(at + 1).toLowerCase().trim() : 'unknown'
}

function extractSendingDomain(campaignName: string): string {
  const m = campaignName.match(/([a-z0-9-]+\.[a-z]{2,})$/i)
  return m ? m[1].toLowerCase() : 'unknown'
}

function mergeMetrics(
  target: DateMetrics,
  src: { sent?: number; delivered?: number; opened?: number; clicked?: number; bounced?: number; unsubscribed?: number }
) {
  target.sent += src.sent || 0
  target.delivered += src.delivered || 0
  target.opened += src.opened || 0
  target.clicked += src.clicked || 0
  target.bounced += src.bounced || 0
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
  return { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0, complained: 0, deliveryRate: 0, openRate: 0, clickRate: 0, bounceRate: 0 }
}

export async function parseFile(file: File): Promise<ParseResult> {
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

  const byDate: ParseResult['byDate'] = {}
  let skipped = 0, totalRows = 0
  let skippedNoDate = 0, skippedNoEmail = 0

  rows.forEach(row => {
    totalRows++
    const rawDate = row['sent-time'] || row['date'] || row['action_timestamp_rounded'] || row['timestamp'] || ''
    const dateStr = parseDate(rawDate !== '' && !isNaN(Number(rawDate)) ? Number(rawDate) : rawDate)
    if (!dateStr) { skipped++; skippedNoDate++; return }

    const email = row['email'] || row['email-address'] || row['email_address'] || row['recipient'] || row['to'] || ''
    if (!email) { skipped++; skippedNoEmail++; return }

    const providerDomain = extractDomain(email)
    const sendingDomain = isMailmodo
      ? extractSendingDomain(row['campaign-name'] || '')
      : (row['from_domain'] || row['from-domain'] || row['sending_domain'] || 'unknown')

    if (!byDate[dateStr]) {
      byDate[dateStr] = { rows: 0, providers: {}, domains: {}, providerDomains: {} }
    }
    const bucket = byDate[dateStr]
    bucket.rows++

    const metrics = isMailmodo ? {
      sent: 1,
      delivered: (row['delivery'] === 'TRUE' || row['delivery'] === 'true' || row['delivery'] === '1' || Number(row['delivery'] || 0) > 0) ? 1 : 0,
      opened: (Number(row['opens-html'] || 0) + Number(row['opens-amp'] || 0)) > 0 ? 1 : 0,
      clicked: (Number(row['clicks-html'] || 0) + Number(row['clicks-amp'] || 0)) > 0 ? 1 : 0,
      bounced: (row['bounced'] === '1' || row['bounced'] === 'true' || row['bounced'] === 'TRUE') ? 1 : 0,
      unsubscribed: (row['unsubscribed'] === '1' || row['unsubscribed'] === 'true' || row['unsubscribed'] === 'TRUE') ? 1 : 0,
    } : {
      sent: Number(row['sent'] || 1),
      delivered: Number(row['delivered'] || 0),
      opened: Number(row['opens'] || row['opened'] || 0),
      clicked: Number(row['clicks'] || row['clicked'] || 0),
      bounced: Number(row['bounced'] || row['bounce'] || 0),
      unsubscribed: Number(row['unsubscribed'] || row['unsub'] || 0),
    }

    if (!bucket.providers[providerDomain]) bucket.providers[providerDomain] = blankMetrics()
    mergeMetrics(bucket.providers[providerDomain], metrics)

    if (!bucket.domains[sendingDomain]) bucket.domains[sendingDomain] = blankMetrics()
    mergeMetrics(bucket.domains[sendingDomain], metrics)

    if (!bucket.providerDomains[providerDomain]) bucket.providerDomains[providerDomain] = {}
    if (!bucket.providerDomains[providerDomain][sendingDomain]) {
      bucket.providerDomains[providerDomain][sendingDomain] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 }
    }
    const pd = bucket.providerDomains[providerDomain][sendingDomain]
    pd.sent += metrics.sent
    pd.delivered += metrics.delivered
    pd.opened += metrics.opened
    pd.clicked += metrics.clicked
    pd.bounced += metrics.bounced
    pd.unsubscribed += metrics.unsubscribed || 0
  })

  // Recalculate rates
  Object.values(byDate).forEach(d => {
    Object.values(d.providers).forEach(recalcRates)
    Object.values(d.domains).forEach(recalcRates)
  })

  const dates = Object.keys(byDate).sort((a, b) => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const [am, ad] = a.split(' ')
    const [bm, bd] = b.split(' ')
    const ai = months.indexOf(am) * 31 + parseInt(ad)
    const bi = months.indexOf(bm) * 31 + parseInt(bd)
    return ai - bi
  })

  return { byDate, dates, totalRows, skipped, skippedNoDate, skippedNoEmail, newDates: 0, format: isMailmodo ? 'mailmodo' : 'generic' }
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

  // Sort dates
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  data.dates.sort((a, b) => {
    const [am, ad] = a.split(' ')
    const [bm, bd] = b.split(' ')
    return (months.indexOf(am) * 31 + parseInt(ad)) - (months.indexOf(bm) * 31 + parseInt(bd))
  })
  data.datesFull = data.dates.map(d => {
    const [m, day] = d.split(' ')
    const year = new Date().getFullYear()
    return { label: d, year }
  })

  return { data, newDates }
}
