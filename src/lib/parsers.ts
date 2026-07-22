'use client'
import type { MmData, DateMetrics, ThrottleRecord, ThrottleValue } from './types'

// Dynamically import xlsx to avoid SSR issues
type XLSXType = typeof import('xlsx')
let XLSX: XLSXType | null = null

async function getXLSX(): Promise<XLSXType> {
  if (!XLSX) XLSX = await import('xlsx')
  return XLSX
}

export interface ParseResult {
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
  format: 'mailmodo' | 'generic' | 'netcore' | 'mms' | 'moosend' | 'kenscio' | 'mailjet' | 'elastic' | 'inboxroad' | 'map'
  // MAP only: true when the Date column's month/day order could not be inferred
  // from the file itself and a default was assumed — the caller must confirm.
  dateAmbiguous: boolean
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
export function splitCsvRows(text: string): string[][] {
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

export function normaliseKeys(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  Object.entries(row).forEach(([k, v]) => {
    out[k.toLowerCase().replace(/\s+/g, '-')] = String(v ?? '')
  })
  return out
}

export function parseDate(raw: string | number, monthFirst = false): { str: string; year: number } | null {
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
  // mm/dd/yyyy (Mailgun) or dd/mm/yyyy — also handles dd-mm-yyyy and optional time suffix
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

// MAP exports the Date column in an inconsistent 2-part numeric format: it may be
// mm/dd/yyyy, dd/mm/yyyy, mm-dd-yyyy or dd-mm-yyyy — the separator does NOT imply
// the order. 'mdy' = month-first, 'dmy' = day-first.
export type MapDateOrder = 'mdy' | 'dmy'

const TWO_PART_DATE = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/

/**
 * Infer the month/day order for a whole MAP file from its date cells.
 * A single file is one format throughout, so any row with a component > 12
 * (which can only be the day) locks the order for every row — including the
 * rows that are individually ambiguous. Returns ambiguous=true only when the
 * data itself can't decide (every 2-part date has both parts <= 12, or the
 * evidence is contradictory), in which case the caller must ask the operator.
 */
export function resolveMapDateOrder(rawDates: (string | number)[]): { order: MapDateOrder | null; ambiguous: boolean } {
  let sawDayFirst = false     // a first component > 12 proves day-first
  let sawMonthFirst = false   // a second component > 12 proves month-first
  let hadTwoPart = false

  for (const raw of rawDates) {
    if (typeof raw === 'number') continue
    const m = String(raw ?? '').trim().match(TWO_PART_DATE)
    if (!m) continue
    hadTwoPart = true
    const a = parseInt(m[1], 10)
    const b = parseInt(m[2], 10)
    if (a > 12) sawDayFirst = true
    if (b > 12) sawMonthFirst = true
  }

  if (sawDayFirst && !sawMonthFirst) return { order: 'dmy', ambiguous: false }
  if (sawMonthFirst && !sawDayFirst) return { order: 'mdy', ambiguous: false }
  if (sawDayFirst && sawMonthFirst) return { order: null, ambiguous: true }   // contradictory
  if (hadTwoPart) return { order: null, ambiguous: true }                     // all parts <= 12
  return { order: null, ambiguous: false }                                    // nothing to resolve
}

/**
 * Parse one MAP date with an explicit month/day order. A component > 12 always
 * overrides the requested order (it can only be the day). ISO dates and Excel
 * serials are unambiguous and pass through to parseDate.
 */
export function parseMapDate(raw: string | number, order: MapDateOrder): { str: string; year: number } | null {
  if (typeof raw === 'string') {
    const m = raw.trim().match(TWO_PART_DATE)
    if (m) {
      const a = parseInt(m[1], 10)
      const b = parseInt(m[2], 10)
      const year = parseInt(m[3], 10)
      let month: number, day: number
      if (a > 12) { day = a; month = b }
      else if (b > 12) { month = a; day = b }
      else if (order === 'mdy') { month = a; day = b }
      else { day = a; month = b }
      const d = new Date(year, month - 1, day)
      if (isNaN(d.getTime())) return null
      return { str: d.toLocaleString('en-US', { month: 'short' }) + ' ' + String(d.getDate()).padStart(2, '0'), year }
    }
  }
  return parseDate(raw)
}

function extractDomain(email: string): string {
  const at = email.indexOf('@')
  return at >= 0 ? email.slice(at + 1).toLowerCase().trim() : 'unknown'
}

/**
 * Per-ESP configuration for parsing.
 * Add a new ESP here to customize:
 *   - domainColumn: which CSV column to read for the from-domain
 *   - normalizeDomain: post-process the extracted domain (e.g. strip 'og.' prefix)
 *   - stripPrefixes: shortcut list of prefixes to strip from the extracted domain
 *
 * How to add a new ESP:
 *   1. Add an entry to ESP_CONFIGS with the ESP name (case-insensitive key)
 *   2. Specify stripPrefixes if the CSV has domains like 'og.example.com' that
 *      should match 'example.com' in the IP Matrix registry
 *   3. If a new CSV layout is needed, add detection + parsing branch in parseFile
 */
export interface EspConfig {
  stripPrefixes?: string[]
}

export const ESP_CONFIGS: Record<string, EspConfig> = {
  mailmodo: {
    stripPrefixes: [],
  },
  mailgun: {
    // Mailgun CSVs have sending subdomains like "og.dailythrillbox.com" or
    // "rp.oriopress.com" but the IP Matrix registry stores the root domain
    // (e.g. "dailythrillbox.com", "oriopress.com"). Strip these prefixes so the
    // extracted from-domain matches a registered domain.
    stripPrefixes: ['og.', 'rp.'],
  },
  netcore: {
    stripPrefixes: [],
  },
  mms: {
    stripPrefixes: [],
  },
  moosend: {
    stripPrefixes: [],
  },
  kenscio: {
    stripPrefixes: [],
  },
  mailjet: {
    stripPrefixes: [],
  },
  elastic: {
    stripPrefixes: [],
  },
  inboxroad: {
    stripPrefixes: ['inboxroad - '],
  },
  map: {
    stripPrefixes: ['su.'],
  },
  // Example for future ESPs:
  // klaviyo: { stripPrefixes: ['klv.', 'mail.'] },
  // brevo:   { stripPrefixes: ['bvo.'] },
}

/** Apply ESP-specific normalization to a raw extracted domain. */
function normalizeDomainForEsp(domain: string, espName?: string): string {
  if (!domain || !espName) return domain
  const cfg = ESP_CONFIGS[espName.toLowerCase()]
  if (!cfg?.stripPrefixes?.length) return domain
  let d = domain.toLowerCase()
  for (const prefix of cfg.stripPrefixes) {
    if (d.startsWith(prefix)) {
      d = d.slice(prefix.length)
      break
    }
  }
  return d
}

/**
 * Find a registered domain inside a campaign name (substring match).
 *
 * Tries the full domain first (e.g. "alerts.dailypromosdeal.com"), then the
 * brand stem without TLD (e.g. "dailypromosdeal"). Longest known domain wins
 * to prefer specific subdomains over root domains.
 *
 * Examples (with knownDomains = ["dailydealhive.com", "alerts.dealdivaz.com"]):
 *   "RBOY-AU-Opens-P42-March26-Dealsonoffers"            -> null
 *   "MNU-CA-Opens-P3-LV-$5-March28-Dailydealhive"        -> "dailydealhive.com"
 *   "alerts.dailypromosdeal.com - Mar 05, 2026"          -> "alerts.dailypromosdeal.com" (if registered)
 */
function findKnownDomain(campaignName: string, knownDomains: string[]): string | null {
  if (!knownDomains || !knownDomains.length) return null
  const haystack = campaignName.toLowerCase()
  // Sort by length desc so "alerts.dailypromosdeal.com" beats "dailypromosdeal.com"
  const sorted = [...new Set(knownDomains.map(d => d.toLowerCase().trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
  for (const domain of sorted) {
    // Try full domain (with TLD) as substring
    if (haystack.includes(domain)) return domain
  }
  // Then try brand stems (domain without TLD) — handles campaigns with no .com suffix
  for (const domain of sorted) {
    const stem = domain.replace(/\.[a-z]{2,}(?:\.[a-z]{2,})?$/i, '')
    if (stem.length >= 5 && haystack.includes(stem)) return domain
  }
  return null
}

/**
 * Match a MAP campaign name to a registered MP-## code (MAP convention).
 *
 * Codes are matched case-insensitively and must be boundary-delimited: the code
 * is preceded by start-of-string or a non-[a-z0-9] char and followed by
 * end-of-string or a non-[a-z0-9] char, so "MP-86" matches in "...-MP-86-..."
 * but NOT inside "MP-861" or "xMP-86y". Returns the code's mapped sending
 * domain, or null when nothing matches or the matched code maps to a blank
 * domain (callers should fall through to domain/regex extraction).
 */
export function matchMpCode(campaignName: string, mpCodeMap?: Record<string, string>): string | null {
  if (!mpCodeMap || !campaignName) return null
  const haystack = campaignName.toLowerCase()
  for (const [code, domain] of Object.entries(mpCodeMap)) {
    const c = code.toLowerCase().trim()
    const d = (domain || '').toLowerCase().trim()
    if (!c || !d) continue
    const esc = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(?:^|[^a-z0-9])${esc}(?![a-z0-9])`, 'i')
    if (re.test(haystack)) return d
  }
  return null
}

function extractSendingDomain(campaignName: string, knownDomains?: string[], mpCodeMap?: Record<string, string>): string {
  // 1. Highest priority: match against domains registered in the IP Matrix.
  //    This is the most reliable approach because it relies on user-curated data,
  //    not pattern guessing. Adding a domain to IP Matrix automatically improves
  //    parsing — no code changes needed. Subdomain is authoritative: if a
  //    registered domain is present it wins even when an MP-code is also present.
  const matched = findKnownDomain(campaignName, knownDomains || [])
  if (matched) return matched

  // 2. MAP convention: resolve a registered MP-## code to its sending domain.
  //    Only reached when no registered subdomain matched above.
  const byCode = matchMpCode(campaignName, mpCodeMap)
  if (byCode) return byCode

  // 3. Fall back to regex extraction for campaigns where the domain isn't registered yet.
  //    A "domain" here = a word followed by optional .subdomain segments ending in a TLD.
  //    Use \b word boundary so hyphens/underscores in campaign names act as separators.

  // Try domain at end: match the last dot-separated domain bounded by a word boundary
  const mEnd = campaignName.match(/(?:^|[^a-z0-9.])([a-z0-9]+(?:\.[a-z0-9]+)*\.[a-z]{2,})$/i)
  if (mEnd) return mEnd[1].toLowerCase()
  // Try domain at start: "domain.com - Campaign Name"
  const mStart = campaignName.match(/^([a-z0-9]+(?:\.[a-z0-9]+)*\.[a-z]{2,})(?:$|[^a-z0-9.])/i)
  if (mStart) return mStart[1].toLowerCase()
  // Try domain anywhere (bounded by non-word-chars)
  const mAny = campaignName.match(/(?:^|[^a-z0-9.])([a-z0-9]+(?:\.[a-z0-9]+)*\.[a-z]{2,})(?:$|[^a-z0-9.])/i)
  if (mAny) return mAny[1].toLowerCase()
  // Fallback: underscore-separated "WP_march10_domainname" → "domainname.com"
  // Skip month-day-like segments (march5, p22, etc.) that aren't real domain names
  const parts = campaignName.split(/[_\-\s]+/).filter(Boolean)
  const last = parts[parts.length - 1]?.toLowerCase().trim()
  if (last && last.length >= 6 && /^[a-z][a-z0-9]*$/i.test(last) && !/^(march|april|may|june|july|august|september|october|november|december|january|february)\d*$/i.test(last) && !/^p\d+$/i.test(last)) {
    return last + '.com'
  }
  return 'unknown'
}

function mergeMetrics(
  target: DateMetrics,
  src: { sent?: number; delivered?: number; opened?: number; clicked?: number; bounced?: number; hardBounced?: number; softBounced?: number; unsubscribed?: number; complained?: number }
) {
  target.sent += src.sent || 0
  target.delivered += src.delivered || 0
  target.opened += src.opened || 0
  target.clicked += src.clicked || 0
  target.bounced += src.bounced || 0
  target.hardBounced = (target.hardBounced || 0) + (src.hardBounced || 0)
  target.softBounced = (target.softBounced || 0) + (src.softBounced || 0)
  target.unsubscribed = (target.unsubscribed || 0) + (src.unsubscribed || 0)
  target.complained = (target.complained || 0) + (src.complained || 0)
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

/**
 * Read a CSV/XLSX upload into normalized header + row objects.
 * Shared by parseFile and the upload validator so both see identical columns.
 * Does NOT throw on empty input — callers decide what an empty file means.
 */
export async function readUploadRows(
  file: File
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
  if (isXlsx) {
    const xlsx = await getXLSX()
    const buf = await file.arrayBuffer()
    const wb = xlsx.read(buf, { type: 'array', cellDates: false })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rawRows = xlsx.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
    const rows = rawRows.map(normaliseKeys)
    const headers = rows.length ? Object.keys(rows[0]) : []
    return { headers, rows }
  }
  const text = await file.text()
  const csvRows = splitCsvRows(text)
  if (csvRows.length < 2) return { headers: [], rows: [] }
  const headers = csvRows[0].map(h => h.toLowerCase().replace(/\s+/g, '-'))
  const rows = csvRows.slice(1)
    .filter(r => r.some(v => v.trim() !== ''))
    .map(vals => {
      const row: Record<string, string> = {}
      headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
      return row
    })
  return { headers, rows }
}

export async function parseFile(file: File, espName?: string, knownDomains?: string[], mapDateOrder?: MapDateOrder, mpCodeMap?: Record<string, string>): Promise<ParseResult> {
  const { rows } = await readUploadRows(file)

  if (rows.length === 0) throw new Error('No rows found in file')

  const first = rows[0]
  const isMap      = espName === 'Map' || 'confirmed-openers' in first
  const isMailmodo = !isMap && ('campaign-name' in first || 'opens-html' in first)
  const isMailgun = espName === 'Mailgun'
  const isNetcore = espName === 'Netcore'
  const isMMS = espName === 'MMS' || espName === 'Hotsol' || espName === '171 MailsApp'
  const isMoosend = espName === 'Moosend' || ('sent-on' in first && 'unsubscribes' in first && 'domain' in first)
  const isKenscio = espName === 'Kenscio'
  const isMailjet = espName === 'Mailjet'
  const isElastic = espName === 'Elastic'
  const isInboxroad = espName === 'Inboxroad'
  // Mailgun aggregated format: one row per ISP per sending domain per date (no per-email rows)
  const isMailgunAgg = isMailgun && ('domain-grouped-by-esp' in first || 'success' in first)

  const byDate: ParseResult['byDate'] = {}
  const dateYears: Record<string, number> = {}
  let skipped = 0, totalRows = 0
  let skippedNoDate = 0, skippedNoEmail = 0

  // MAP: resolve the whole file's month/day order once (see resolveMapDateOrder).
  // A caller-supplied hint (operator's pick for a genuinely ambiguous file) wins.
  let mapOrder: MapDateOrder = 'mdy'
  let mapDateAmbiguous = false
  if (isMap) {
    if (mapDateOrder) {
      mapOrder = mapDateOrder
    } else {
      const res = resolveMapDateOrder(rows.map(r => r['date'] ?? ''))
      mapOrder = res.order ?? 'mdy'
      mapDateAmbiguous = res.ambiguous
    }
  }

  rows.forEach(row => {
    totalRows++

    // ── Mailgun aggregated format ───────────────────────────────────
    if (isMailgunAgg) {
      const rawDate = row['last-stats-date'] || row['last-sent-date'] || row['date'] || ''
      const parsed = parseDate(rawDate, false)
      if (!parsed) { skipped++; skippedNoDate++; return }
      const dateStr = parsed.str
      dateYears[dateStr] = parsed.year

      const providerDomain = (row['domain-grouped-by-esp'] || 'unknown').toLowerCase().trim()
      // Mailgun ESP column format: "Mailgun SMTP - og.example.com" or "Mailgun SMTP - og.weekly-surprise.com"
      // Try IP Matrix lookup first, then fall back to splitting on " - ".
      const espValue = (row['esp'] || '').trim()
      const knownMatch = findKnownDomain(espValue, knownDomains || [])
      let rawDomain: string
      if (knownMatch) {
        rawDomain = knownMatch
      } else {
        const afterDash = espValue.split(/\s+-\s+/).pop()?.toLowerCase().trim() || ''
        rawDomain = afterDash || extractSendingDomain(espValue, knownDomains)
      }
      const sendingDomain = normalizeDomainForEsp(rawDomain, espName) || 'unknown'

      if (!byDate[dateStr]) byDate[dateStr] = { rows: 0, providers: {}, domains: {}, providerDomains: {} }
      const bucket = byDate[dateStr]
      bucket.rows++

      const sent        = Number(row['sent'] || 0)
      const delivered   = Number(row['success'] || 0)
      const bounced     = Number(row['failed'] || 0)
      const hardBounced = Number(row['hard-bounces'] || 0)
      const softBounced = Number(row['soft-bounces'] || 0)
      const opened      = Number(row['unique-opens'] || row['opens'] || 0)
      const clicked     = Number(row['unique-clickers'] || row['unique-clicks'] || row['clicks'] || 0)
      const unsubscribed = Number(row['unsubscribes'] || row['unsubscribed'] || 0)
      const complained  = Number(row['complaints'] || 0)

      const metrics = { sent, delivered, opened, clicked, bounced, hardBounced, softBounced, unsubscribed, complained }

      if (!bucket.providers[providerDomain]) bucket.providers[providerDomain] = blankMetrics()
      mergeMetrics(bucket.providers[providerDomain], metrics)

      if (!bucket.domains[sendingDomain]) bucket.domains[sendingDomain] = blankMetrics()
      mergeMetrics(bucket.domains[sendingDomain], metrics)

      if (!bucket.providerDomains[providerDomain]) bucket.providerDomains[providerDomain] = {}
      if (!bucket.providerDomains[providerDomain][sendingDomain]) {
        bucket.providerDomains[providerDomain][sendingDomain] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, hardBounced: 0, softBounced: 0, unsubscribed: 0 }
      }
      const pd = bucket.providerDomains[providerDomain][sendingDomain]
      pd.sent += sent; pd.delivered += delivered; pd.opened += opened; pd.clicked += clicked
      pd.bounced += bounced; pd.hardBounced = (pd.hardBounced || 0) + hardBounced
      pd.softBounced = (pd.softBounced || 0) + softBounced; pd.unsubscribed += unsubscribed
      return
    }

    // ── Netcore per-recipient format ─────────────────────────────────
    // One row per recipient. Headers (normalized):
    //   email-(primary-key) → recipient email
    //   domain              → sending (from) domain
    //   sent-date           → d/m/yyyy h:mm (monthFirst=false)
    //   bounce-type         → "Soft Bounce" | "Hard Bounce" | ""
    //   open-time           → non-empty if opened
    //   no.-of-clicks       → integer clicks count
    //   unsub-reason        → non-empty if unsubscribed
    //   abuse-reason        → non-empty if complained
    if (isNetcore) {
      const rawDate = row['sent-date'] || row['sending-date'] || row['date'] || ''
      const parsed = parseDate(rawDate, false) // d/m/yyyy → monthFirst=false
      if (!parsed) { skipped++; skippedNoDate++; return }
      const dateStr = parsed.str
      dateYears[dateStr] = parsed.year

      const email = row['email-(primary-key)'] || row['email'] || row['recipient'] || ''
      if (!email) { skipped++; skippedNoEmail++; return }
      const providerDomain = extractDomain(email)

      const sendingDomain = (row['domain'] || row['from-domain'] || 'unknown').toLowerCase().trim()

      const bounceType = (row['bounce-type'] || '').toLowerCase().trim()
      const isBounced  = bounceType !== '' ? 1 : 0
      const isHard     = bounceType.includes('hard') ? 1 : 0
      const isSoft     = bounceType.includes('soft') ? 1 : 0

      const statusVal = (row['status'] || '').toLowerCase().trim()
      const metrics = {
        sent:         statusVal === 'sent' ? 1 : 0,
        delivered:    statusVal === 'sent' ? 1 : 0,  // Netcore: delivered = sent rows only
        opened:       statusVal === 'opened' ? 1 : 0,
        clicked:      statusVal === 'clicked' ? 1 : 0,
        bounced:      isSoft || isHard ? 1 : 0,  // Netcore: soft + hard bounces
        hardBounced:  isHard,
        softBounced:  isSoft,
        unsubscribed: (row['unsub-reason'] || '').trim() !== '' ? 1 : 0,
        complained:   (row['abuse-reason'] || '').trim() !== '' ? 1 : 0,
      }

      if (!byDate[dateStr]) byDate[dateStr] = { rows: 0, providers: {}, domains: {}, providerDomains: {} }
      const bucket = byDate[dateStr]
      bucket.rows++

      if (!bucket.providers[providerDomain]) bucket.providers[providerDomain] = blankMetrics()
      mergeMetrics(bucket.providers[providerDomain], metrics)

      if (!bucket.domains[sendingDomain]) bucket.domains[sendingDomain] = blankMetrics()
      mergeMetrics(bucket.domains[sendingDomain], metrics)

      if (!bucket.providerDomains[providerDomain]) bucket.providerDomains[providerDomain] = {}
      if (!bucket.providerDomains[providerDomain][sendingDomain]) {
        bucket.providerDomains[providerDomain][sendingDomain] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, hardBounced: 0, softBounced: 0, unsubscribed: 0 }
      }
      const pd = bucket.providerDomains[providerDomain][sendingDomain]
      pd.sent += metrics.sent; pd.delivered += metrics.delivered; pd.opened += metrics.opened
      pd.clicked += metrics.clicked; pd.bounced += metrics.bounced
      pd.hardBounced = (pd.hardBounced || 0) + metrics.hardBounced
      pd.softBounced = (pd.softBounced || 0) + metrics.softBounced
      pd.unsubscribed += metrics.unsubscribed
      return
    }

    // ── MMS per-recipient format ─────────────────────────────────────
    // One row per sent email. Headers (normalized):
    //   domain          → sending (from) domain (Column A)
    //   sent-email      → recipient email (Column C)
    //   process-status  → "Success" = delivered (Column D)
    //   date-added      → "M/D/YY, H:MM AM/PM" (Column F)
    //   open-email      → non-empty = 1 open (Column G)
    //   clicks          → non-empty = 1 click (Column H)
    //   unsubscribe-    → non-empty = 1 unsub (Column I — trailing space in header)
    //   bounce          → non-empty = bounced (Column J)
    //   bounce-type     → "Hard Bounce"/"Internal" = hard, "Soft Bounce" = soft (Column K)
    if (isMMS) {
      const rawDate = row['date-added'] || row['date'] || ''
      // Date format: "3/24/26, 10:46 AM" — strip time, parse M/D/YY
      const datePart = rawDate.split(',')[0].trim()
      const mmsMatch = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
      let parsed: { str: string; year: number } | null = null
      if (mmsMatch) {
        const month = parseInt(mmsMatch[1])
        const day   = parseInt(mmsMatch[2])
        const year  = 2000 + parseInt(mmsMatch[3])
        const d = new Date(year, month - 1, day)
        parsed = { str: d.toLocaleString('en-US', { month: 'short' }) + ' ' + String(d.getDate()).padStart(2, '0'), year }
      } else {
        parsed = parseDate(datePart, false)  // fallback: handles DD-MM-YYYY (171 MailsApp) and M/D/YYYY
      }
      if (!parsed) { skipped++; skippedNoDate++; return }
      const dateStr = parsed.str
      dateYears[dateStr] = parsed.year

      const email = row['sent-email'] || row['email'] || ''
      if (!email) { skipped++; skippedNoEmail++; return }
      const providerDomain = extractDomain(email)
      const sendingDomain = (row['domain'] || 'unknown').toLowerCase().trim()

      const bounceRaw      = (row['bounce'] || '').trim()
      const bounceTypeRaw  = (row['bounce-type'] || '').toLowerCase().trim()
      const isBounced      = bounceRaw !== '' ? 1 : 0
      const isHard         = (bounceTypeRaw.includes('hard') || bounceTypeRaw.includes('internal')) ? isBounced : 0
      const isSoft         = bounceTypeRaw.includes('soft') ? isBounced : 0

      const metrics = {
        sent:         1,
        delivered:    (row['process-status'] || '').toLowerCase() === 'success' ? 1 : 0,
        opened:       (row['open-email'] || '').trim() !== '' ? 1 : 0,
        clicked:      (row['clicks'] || '').trim() !== '' ? 1 : 0,
        bounced:      isBounced,
        hardBounced:  isHard,
        softBounced:  isSoft,
        unsubscribed: (row['unsubscribe-'] || row['unsubscribe'] || '').trim() !== '' ? 1 : 0,
        complained:   0,
      }

      if (!byDate[dateStr]) byDate[dateStr] = { rows: 0, providers: {}, domains: {}, providerDomains: {} }
      const bucket = byDate[dateStr]
      bucket.rows++

      if (!bucket.providers[providerDomain]) bucket.providers[providerDomain] = blankMetrics()
      mergeMetrics(bucket.providers[providerDomain], metrics)

      if (!bucket.domains[sendingDomain]) bucket.domains[sendingDomain] = blankMetrics()
      mergeMetrics(bucket.domains[sendingDomain], metrics)

      if (!bucket.providerDomains[providerDomain]) bucket.providerDomains[providerDomain] = {}
      if (!bucket.providerDomains[providerDomain][sendingDomain]) {
        bucket.providerDomains[providerDomain][sendingDomain] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, hardBounced: 0, softBounced: 0, unsubscribed: 0 }
      }
      const pd = bucket.providerDomains[providerDomain][sendingDomain]
      pd.sent += metrics.sent; pd.delivered += metrics.delivered; pd.opened += metrics.opened
      pd.clicked += metrics.clicked; pd.bounced += metrics.bounced
      pd.hardBounced = (pd.hardBounced || 0) + metrics.hardBounced
      pd.softBounced = (pd.softBounced || 0) + metrics.softBounced
      pd.unsubscribed += metrics.unsubscribed
      return
    }

    // ── Moosend per-recipient format ─────────────────────────────────
    // One row per sent email. Headers (normalized):
    //   domain        → sending (from) domain (Column A)
    //   sent          → recipient email (Column C) — non-empty = 1 sent & 1 delivered
    //   opened        → opener email (Column D) — contains '@' = 1 open
    //   clicked       → clicker email (Column E) — contains '@' = 1 click
    //   unsubscribes  → unsubscriber email (Column F) — contains '@' = 1 unsub
    //   sent-on       → "D/M/YYYY" or "DD-MM-YYYY HH:MM" date (Column G)
    //   bounced       → bounced email (Column H) — contains '@' = 1 bounce (absent in older exports)
    if (isMoosend) {
      const rawDate = row['sent-on'] || ''
      const parsed = parseDate(rawDate, false)
      if (!parsed) { skipped++; skippedNoDate++; return }
      const dateStr = parsed.str
      dateYears[dateStr] = parsed.year

      const email = row['sent'] || ''
      if (!email) { skipped++; skippedNoEmail++; return }
      const providerDomain = extractDomain(email)
      const sendingDomain = (row['domain'] || 'unknown').toLowerCase().trim()

      const isBounced = (row['bounced'] || '').includes('@') ? 1 : 0

      const metrics = {
        sent:         1,
        delivered:    isBounced ? 0 : 1,
        opened:       (row['opened'] || '').includes('@') ? 1 : 0,
        clicked:      (row['clicked'] || '').includes('@') ? 1 : 0,
        bounced:      isBounced,
        hardBounced:  0,
        softBounced:  0,
        unsubscribed: (row['unsubscribes'] || '').includes('@') ? 1 : 0,
        complained:   0,
      }

      if (!byDate[dateStr]) byDate[dateStr] = { rows: 0, providers: {}, domains: {}, providerDomains: {} }
      const bucket = byDate[dateStr]
      bucket.rows++

      if (!bucket.providers[providerDomain]) bucket.providers[providerDomain] = blankMetrics()
      mergeMetrics(bucket.providers[providerDomain], metrics)

      if (!bucket.domains[sendingDomain]) bucket.domains[sendingDomain] = blankMetrics()
      mergeMetrics(bucket.domains[sendingDomain], metrics)

      if (!bucket.providerDomains[providerDomain]) bucket.providerDomains[providerDomain] = {}
      if (!bucket.providerDomains[providerDomain][sendingDomain]) {
        bucket.providerDomains[providerDomain][sendingDomain] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, hardBounced: 0, softBounced: 0, unsubscribed: 0 }
      }
      const pd = bucket.providerDomains[providerDomain][sendingDomain]
      pd.sent += metrics.sent; pd.delivered += metrics.delivered; pd.opened += metrics.opened
      pd.clicked += metrics.clicked; pd.bounced += metrics.bounced; pd.unsubscribed += metrics.unsubscribed
      return
    }

    // ── Kenscio per-recipient format ─────────────────────────────────
    // One row per sent email. Headers (normalized):
    //   campaign-name → campaign identifier
    //   domain-name   → sending (from) domain
    //   email-sent    → recipient email
    //   timestamp     → "dd-mm-yyyy HH:MM" date
    //   delivered     → non-empty = 1 delivered
    //   open          → non-empty = 1 opened
    //   click         → non-empty = 1 clicked
    //   bounce        → non-empty = 1 bounced (total)
    //   soft-bounce   → non-empty = 1 soft bounce
    //   hard-bounce   → non-empty = 1 hard bounce
    if (isKenscio) {
      const rawDate = row['timestamp'] || ''
      const parsed = parseDate(rawDate, false) // dd-mm-yyyy, day-first
      if (!parsed) { skipped++; skippedNoDate++; return }
      const dateStr = parsed.str
      dateYears[dateStr] = parsed.year

      const email = row['email-sent'] || ''
      if (!email) { skipped++; skippedNoEmail++; return }
      const providerDomain = extractDomain(email)
      const sendingDomain = (row['domain-name'] || 'unknown').toLowerCase().trim()

      const metrics = {
        sent:         1,
        delivered:    (row['delivered'] || '').trim() !== '' ? 1 : 0,
        opened:       (row['open'] || '').trim() !== '' ? 1 : 0,
        clicked:      (row['click'] || '').trim() !== '' ? 1 : 0,
        bounced:      (row['bounce'] || '').trim() !== '' ? 1 : 0,
        hardBounced:  (row['hard-bounce'] || '').trim() !== '' ? 1 : 0,
        softBounced:  (row['soft-bounce'] || '').trim() !== '' ? 1 : 0,
        unsubscribed: 0,
        complained:   0,
      }

      if (!byDate[dateStr]) byDate[dateStr] = { rows: 0, providers: {}, domains: {}, providerDomains: {} }
      const bucket = byDate[dateStr]
      bucket.rows++

      if (!bucket.providers[providerDomain]) bucket.providers[providerDomain] = blankMetrics()
      mergeMetrics(bucket.providers[providerDomain], metrics)

      if (!bucket.domains[sendingDomain]) bucket.domains[sendingDomain] = blankMetrics()
      mergeMetrics(bucket.domains[sendingDomain], metrics)

      if (!bucket.providerDomains[providerDomain]) bucket.providerDomains[providerDomain] = {}
      if (!bucket.providerDomains[providerDomain][sendingDomain]) {
        bucket.providerDomains[providerDomain][sendingDomain] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, hardBounced: 0, softBounced: 0, unsubscribed: 0 }
      }
      const pd = bucket.providerDomains[providerDomain][sendingDomain]
      pd.sent += metrics.sent; pd.delivered += metrics.delivered; pd.opened += metrics.opened
      pd.clicked += metrics.clicked; pd.bounced += metrics.bounced
      pd.hardBounced = (pd.hardBounced || 0) + metrics.hardBounced
      pd.softBounced = (pd.softBounced || 0) + metrics.softBounced
      pd.unsubscribed += metrics.unsubscribed
      return
    }

    // ── Mailjet per-recipient format ─────────────────────────────────
    // One row per sent email. Headers (normalized):
    //   campaign-name  → from-domain (parse via extractSendingDomain / IP Matrix)
    //   email          → recipient email
    //   status         → "sent" | "opened" | "clicked" | etc. (informational)
    //   blocked        → TRUE/FALSE
    //   hard_bounce    → TRUE/FALSE
    //   soft_bounce    → TRUE/FALSE
    //   open           → TRUE/FALSE
    //   click          → TRUE/FALSE
    //   unsub          → TRUE/FALSE
    //   spam           → TRUE/FALSE (treated as complaint)
    //   date           → "yyyy-mm-ddTHH:mm:ss" ISO timestamp
    //
    // Per user spec: sent = delivered = 1 per row (Mailjet treats each row as an
    // accepted send; bounces are tracked separately). Rates (open/click/unsub) are
    // computed against delivered.
    if (isMailjet) {
      const rawDate = row['date'] || ''
      const parsed = parseDate(rawDate, false)
      if (!parsed) { skipped++; skippedNoDate++; return }
      const dateStr = parsed.str
      dateYears[dateStr] = parsed.year

      const email = row['email'] || ''
      if (!email) { skipped++; skippedNoEmail++; return }
      const providerDomain = extractDomain(email)

      const campaignName = row['campaign-name'] || ''
      const rawSendingDomain = extractSendingDomain(campaignName, knownDomains)
      const sendingDomain = normalizeDomainForEsp(rawSendingDomain, espName) || 'unknown'

      const isTrue = (v: string) => {
        const s = (v || '').trim().toUpperCase()
        return s === 'TRUE' || s === '1'
      }
      const isHard = isTrue(row['hard_bounce']) ? 1 : 0
      const isSoft = isTrue(row['soft_bounce']) ? 1 : 0

      const metrics = {
        sent:         1,
        delivered:    1,
        opened:       isTrue(row['open'])  ? 1 : 0,
        clicked:      isTrue(row['click']) ? 1 : 0,
        bounced:      (isHard || isSoft) ? 1 : 0,
        hardBounced:  isHard,
        softBounced:  isSoft,
        unsubscribed: isTrue(row['unsub']) ? 1 : 0,
        complained:   isTrue(row['spam'])  ? 1 : 0,
      }

      if (!byDate[dateStr]) byDate[dateStr] = { rows: 0, providers: {}, domains: {}, providerDomains: {} }
      const bucket = byDate[dateStr]
      bucket.rows++

      if (!bucket.providers[providerDomain]) bucket.providers[providerDomain] = blankMetrics()
      mergeMetrics(bucket.providers[providerDomain], metrics)

      if (!bucket.domains[sendingDomain]) bucket.domains[sendingDomain] = blankMetrics()
      mergeMetrics(bucket.domains[sendingDomain], metrics)

      if (!bucket.providerDomains[providerDomain]) bucket.providerDomains[providerDomain] = {}
      if (!bucket.providerDomains[providerDomain][sendingDomain]) {
        bucket.providerDomains[providerDomain][sendingDomain] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, hardBounced: 0, softBounced: 0, unsubscribed: 0 }
      }
      const pd = bucket.providerDomains[providerDomain][sendingDomain]
      pd.sent += metrics.sent; pd.delivered += metrics.delivered; pd.opened += metrics.opened
      pd.clicked += metrics.clicked; pd.bounced += metrics.bounced
      pd.hardBounced = (pd.hardBounced || 0) + metrics.hardBounced
      pd.softBounced = (pd.softBounced || 0) + metrics.softBounced
      pd.unsubscribed += metrics.unsubscribed
      return
    }

    // ── Elastic event-stream format ──────────────────────────────────
    // One row per EVENT (not per email). Column mapping:
    //   Column A (campaign-name) → campaign identifier (domain embedded at end)
    //   Column B (fromemail)     → sender address → sending (from) domain
    //   Column C (to)            → recipient email
    //   Column D (subject)       → unused
    //   Column E (eventtype)     → "Sent" | "Bounced" | "Opened" | "Clicked"
    //   Column F (eventdate)     → sending date, "M/D/YYYY H:MM:SS AM/PM" format ← used
    //   Column G (channel)       → ISO timestamp (ignored)
    //
    // Per user spec: aggregate counts from eventtype column.
    //   Sent = Delivered = count of rows where eventtype="Sent".
    //   Hard Bounce = count of rows where eventtype="Bounced" (no soft/hard split).
    //   Open / Click = count of "Opened" / "Clicked" rows.
    //   Unsubscribed / Complaints / Soft Bounce = not tracked (leave 0).
    // From-domain: extract from fromemail (Column B) — most reliable source.
    // Rates (open/click) computed against delivered.
    if (isElastic) {
      // Column F (eventdate): "5/20/2026 4:15:03 PM" — monthFirst=true for m/d/yyyy
      const rawDate = row['eventdate'] || ''
      const parsed = parseDate(rawDate, true)
      if (!parsed) { skipped++; skippedNoDate++; return }
      const dateStr = parsed.str
      dateYears[dateStr] = parsed.year

      const email = row['to'] || ''
      if (!email) { skipped++; skippedNoEmail++; return }
      const providerDomain = extractDomain(email)

      // Column B (fromemail): extract domain directly — e.g. "Olivia@ivaindex.com" → "ivaindex.com"
      const rawSendingDomain = extractDomain(row['fromemail'] || '') || extractSendingDomain(row['campaign-name'] || '', knownDomains)
      const sendingDomain = normalizeDomainForEsp(rawSendingDomain, espName) || 'unknown'

      const evt = (row['eventtype'] || '').trim().toLowerCase()
      const isSentEvt    = evt === 'sent'    ? 1 : 0
      const isBouncedEvt = evt === 'bounced' ? 1 : 0
      const isOpenedEvt  = evt === 'opened'  ? 1 : 0
      const isClickedEvt = evt === 'clicked' ? 1 : 0

      const metrics = {
        sent:         isSentEvt,
        delivered:    isSentEvt,
        opened:       isOpenedEvt,
        clicked:      isClickedEvt,
        bounced:      isBouncedEvt,
        hardBounced:  isBouncedEvt,
        softBounced:  0,
        unsubscribed: 0,
        complained:   0,
      }

      if (!byDate[dateStr]) byDate[dateStr] = { rows: 0, providers: {}, domains: {}, providerDomains: {} }
      const bucket = byDate[dateStr]
      bucket.rows++

      if (!bucket.providers[providerDomain]) bucket.providers[providerDomain] = blankMetrics()
      mergeMetrics(bucket.providers[providerDomain], metrics)

      if (!bucket.domains[sendingDomain]) bucket.domains[sendingDomain] = blankMetrics()
      mergeMetrics(bucket.domains[sendingDomain], metrics)

      if (!bucket.providerDomains[providerDomain]) bucket.providerDomains[providerDomain] = {}
      if (!bucket.providerDomains[providerDomain][sendingDomain]) {
        bucket.providerDomains[providerDomain][sendingDomain] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, hardBounced: 0, softBounced: 0, unsubscribed: 0 }
      }
      const pd = bucket.providerDomains[providerDomain][sendingDomain]
      pd.sent += metrics.sent; pd.delivered += metrics.delivered; pd.opened += metrics.opened
      pd.clicked += metrics.clicked; pd.bounced += metrics.bounced
      pd.hardBounced = (pd.hardBounced || 0) + metrics.hardBounced
      pd.softBounced = (pd.softBounced || 0) + metrics.softBounced
      pd.unsubscribed += metrics.unsubscribed
      return
    }

    // ── Inboxroad aggregated format ──────────────────────────────────
    // One row per recipient ISP per sending domain per date. The export has
    // stable, named headers, so map by NAME first and fall back to column index
    // only as a last resort. Indices below match the real export layout (A=0):
    //   A (0)  → Esp connection id (NOT a metric — never read as provider/sent)
    //   B (1)  → ESP, e.g. "InboxRoad - rp.example.com" → sending domain
    //   C (2)  → Domain Grouped by ESP → recipient ISP / provider domain
    //   E (4)  → Sent
    //   F (5)  → Success → delivered
    //   J (9)  → Last Stats Date (dd-mm-yyyy → monthFirst=false)
    //   L (11) → Hard Bounces
    //   N (13) → Soft Bounces
    //   R (17) → Unique Opens
    //   V (21) → Unique Clickers
    //   X (23) → Unsubscribes
    //   Z (25) → Complaints
    // NOTE: header names normalise spaces→hyphens, so "Hard Bounces" → "hard-bounces"
    // (plural). All numerics are NaN-guarded so a stray date/percentage string in a
    // positional fallback can never leak NaN into the metrics.
    if (isInboxroad) {
      const rv = Object.values(row)  // positional fallback (A=0, B=1, …)
      const num = (...candidates: unknown[]): number => {
        for (const c of candidates) {
          if (c == null || String(c).trim() === '') continue
          const n = Number(c)
          return Number.isFinite(n) ? n : 0
        }
        return 0
      }

      const rawDate = row['last-stats-date'] || row['last-sent-date'] || row['date'] ||
                      row['sending-date'] || row['send-date'] || row['sent-date'] || rv[9] || ''
      // xlsx exports stringify date cells as Excel serials (e.g. "46174.53125") —
      // convert numeric strings to a number so parseDate takes its serial branch.
      const parsed = parseDate(rawDate !== '' && !isNaN(Number(rawDate)) ? Number(rawDate) : rawDate, false)  // dd-mm-yyyy → monthFirst=false
      if (!parsed) { skipped++; skippedNoDate++; return }
      const dateStr = parsed.str
      dateYears[dateStr] = parsed.year

      const providerDomain = (
        row['domain-grouped-by-esp'] || row['isp'] || row['provider'] || row['isp-domain'] ||
        row['recipient-domain'] || row['inbox-provider'] || row['mailbox-provider'] || rv[2] || 'unknown'
      ).toLowerCase().trim()

      const rawSendingDomain = (
        row['esp'] || row['from-domain'] || row['from_domain'] || row['sending-domain'] ||
        row['sender-domain'] || row['domain'] || rv[1] || 'unknown'
      ).toLowerCase().trim()
      const sendingDomain = normalizeDomainForEsp(rawSendingDomain, espName) || 'unknown'

      const sent         = num(row['sent'], row['total-sent'], rv[4])
      const delivered    = num(row['success'], row['delivered'], row['total-delivered'], rv[5])
      const hardBounced  = num(row['hard-bounces'], row['hard-bounce'], row['hard_bounce'], row['hardbounce'], row['hard-bounced'], rv[11])
      const softBounced  = num(row['soft-bounces'], row['soft-bounce'], row['soft_bounce'], row['softbounce'], row['soft-bounced'], rv[13])
      const bounced      = hardBounced + softBounced
      const opened       = num(row['unique-opens'], row['unique_opens'], row['opens'], rv[17])
      const clicked      = num(row['unique-clickers'], row['unique-clicks'], row['unique_clicks'], row['clicks'], rv[21])
      const unsubscribed = num(row['unsubscribed'], row['unsubscribes'], rv[23])
      const complained   = num(row['complaints'], row['spam'], rv[25])

      if (!byDate[dateStr]) byDate[dateStr] = { rows: 0, providers: {}, domains: {}, providerDomains: {} }
      const bucket = byDate[dateStr]
      bucket.rows++

      const metrics = { sent, delivered, opened, clicked, bounced, hardBounced, softBounced, unsubscribed, complained }

      if (!bucket.providers[providerDomain]) bucket.providers[providerDomain] = blankMetrics()
      mergeMetrics(bucket.providers[providerDomain], metrics)

      if (!bucket.domains[sendingDomain]) bucket.domains[sendingDomain] = blankMetrics()
      mergeMetrics(bucket.domains[sendingDomain], metrics)

      if (!bucket.providerDomains[providerDomain]) bucket.providerDomains[providerDomain] = {}
      if (!bucket.providerDomains[providerDomain][sendingDomain]) {
        bucket.providerDomains[providerDomain][sendingDomain] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, hardBounced: 0, softBounced: 0, unsubscribed: 0 }
      }
      const pd = bucket.providerDomains[providerDomain][sendingDomain]
      pd.sent += sent; pd.delivered += delivered; pd.opened += opened; pd.clicked += clicked
      pd.bounced += bounced
      pd.hardBounced = (pd.hardBounced || 0) + hardBounced
      pd.softBounced = (pd.softBounced || 0) + softBounced
      pd.unsubscribed += unsubscribed
      return
    }

    // ── Map aggregate format ──────────────────────────────────────────
    // One row per recipient provider per campaign.
    // Columns: Campaign Name(0), Date(1), empty(2), Domains(3), Messages Sent(4),
    //          Rate%(5), Confirmed Openers(6), Rate%(7), Clickers(8), CTR%(9),
    //          Hard Bounces(10), Rate%(11), Soft Bounces(12), Rate%(13),
    //          Inbox Placement Rate(14), Spam Rate(15), Missing Rate(16),
    //          Unsubscribed(17), Rate%(18)
    // Delivered is not in the CSV — calculated as sent - hard_bounces - soft_bounces.
    if (isMap) {
      const rawDate = row['date'] || ''
      const parsed = parseMapDate(rawDate, mapOrder)
      if (!parsed) { skipped++; skippedNoDate++; return }
      const dateStr = parsed.str
      dateYears[dateStr] = parsed.year

      const providerDomain = (row['domains'] || 'unknown').toLowerCase().trim()

      const rawSendingDomain = extractSendingDomain(row['campaign-name'] || '', knownDomains, mpCodeMap)
      const sendingDomain = normalizeDomainForEsp(rawSendingDomain, espName || 'map') || 'unknown'

      const sent         = parseInt(row['messages-sent']     || '0') || 0
      const hardBounced  = parseInt(row['hard-bounces']      || '0') || 0
      const softBounced  = parseInt(row['soft-bounces']      || '0') || 0
      const bounced      = hardBounced + softBounced
      const delivered    = Math.max(0, sent - bounced)
      const opened       = parseInt(row['confirmed-openers'] || '0') || 0
      const clicked      = parseInt(row['clickers']          || '0') || 0
      const unsubscribed = parseInt(row['unsubscribed']      || '0') || 0

      if (!byDate[dateStr]) byDate[dateStr] = { rows: 0, providers: {}, domains: {}, providerDomains: {} }
      const bucket = byDate[dateStr]
      bucket.rows++

      const metrics = { sent, delivered, opened, clicked, bounced, hardBounced, softBounced, unsubscribed, complained: 0 }

      if (!bucket.providers[providerDomain]) bucket.providers[providerDomain] = blankMetrics()
      mergeMetrics(bucket.providers[providerDomain], metrics)

      if (!bucket.domains[sendingDomain]) bucket.domains[sendingDomain] = blankMetrics()
      mergeMetrics(bucket.domains[sendingDomain], metrics)

      if (!bucket.providerDomains[providerDomain]) bucket.providerDomains[providerDomain] = {}
      if (!bucket.providerDomains[providerDomain][sendingDomain]) {
        bucket.providerDomains[providerDomain][sendingDomain] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, hardBounced: 0, softBounced: 0, unsubscribed: 0 }
      }
      const pd = bucket.providerDomains[providerDomain][sendingDomain]
      pd.sent += sent; pd.delivered += delivered; pd.opened += opened; pd.clicked += clicked
      pd.bounced += bounced
      pd.hardBounced = (pd.hardBounced || 0) + hardBounced
      pd.softBounced = (pd.softBounced || 0) + softBounced
      pd.unsubscribed += unsubscribed
      return
    }

    // ── Per-email formats (Mailmodo / generic) ──────────────────────
    const rawDate = row['sent-time'] || row['date'] || row['action_timestamp_rounded'] || row['timestamp'] || ''
    const parsed = parseDate(rawDate !== '' && !isNaN(Number(rawDate)) ? Number(rawDate) : rawDate, isMailgun)
    if (!parsed) { skipped++; skippedNoDate++; return }
    const dateStr = parsed.str
    dateYears[dateStr] = parsed.year

    const email = row['email'] || row['email-address'] || row['email_address'] || row['recipient'] || row['to'] || ''
    if (!email) { skipped++; skippedNoEmail++; return }

    const providerDomain = extractDomain(email)
    // Extract sending (from) domain — check explicit columns first, then fall back to campaign name.
    // For campaign names, extractSendingDomain consults the IP Matrix registry first.
    const explicitFromDomain = row['from-domain'] || row['from_domain'] || row['sending_domain'] || row['sender-domain'] || ''
    const explicitFromEmail = row['from-email'] || row['from-address'] || row['from_address'] || row['sender'] || ''
    const rawSendingDomain = explicitFromDomain
      ? explicitFromDomain.toLowerCase().trim()
      : explicitFromEmail
        ? extractDomain(explicitFromEmail)
        : isMailmodo
          ? extractSendingDomain(row['campaign-name'] || '', knownDomains, mpCodeMap)
          : 'unknown'
    const sendingDomain = normalizeDomainForEsp(rawSendingDomain, espName)

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

  // Netcore: override clickRate (clicks/delivered) and unsubRate (unsub/delivered)
  if (isNetcore) {
    Object.values(byDate).forEach(d => {
      const fixRates = (m: DateMetrics) => {
        m.clickRate = m.delivered > 0 ? (m.clicked / m.delivered) * 100 : 0
        m.unsubRate = m.delivered > 0 ? ((m.unsubscribed || 0) / m.delivered) * 100 : 0
      }
      Object.values(d.providers).forEach(fixRates)
      Object.values(d.domains).forEach(fixRates)
    })
  }

  // MMS: rates relative to delivered (open/delivered, click/delivered, unsub/delivered)
  if (isMMS) {
    Object.values(byDate).forEach(d => {
      const fixRates = (m: DateMetrics) => {
        m.openRate  = m.delivered > 0 ? (m.opened  / m.delivered) * 100 : 0
        m.clickRate = m.delivered > 0 ? (m.clicked / m.delivered) * 100 : 0
        m.unsubRate = m.delivered > 0 ? ((m.unsubscribed || 0) / m.delivered) * 100 : 0
      }
      Object.values(d.providers).forEach(fixRates)
      Object.values(d.domains).forEach(fixRates)
    })
  }

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const dates = Object.keys(byDate).sort((a, b) => {
    const ay = dateYears[a] || 0, by_ = dateYears[b] || 0
    if (ay !== by_) return ay - by_
    const [am, ad] = a.split(' '), [bm, bd] = b.split(' ')
    return (MONTHS.indexOf(am) * 31 + parseInt(ad)) - (MONTHS.indexOf(bm) * 31 + parseInt(bd))
  })

  // Moosend: openRate = open/delivered, clickRate = click/delivered, unsubRate = unsub/delivered
  if (isMoosend) {
    Object.values(byDate).forEach(d => {
      const fixRates = (m: DateMetrics) => {
        m.openRate  = m.delivered > 0 ? (m.opened  / m.delivered) * 100 : 0
        m.clickRate = m.delivered > 0 ? (m.clicked / m.delivered) * 100 : 0
        m.unsubRate = m.delivered > 0 ? ((m.unsubscribed || 0) / m.delivered) * 100 : 0
      }
      Object.values(d.providers).forEach(fixRates)
      Object.values(d.domains).forEach(fixRates)
    })
  }

  // Map: openRate = open/delivered, clickRate = click/delivered, unsubRate = unsub/delivered
  if (isMap) {
    Object.values(byDate).forEach(d => {
      const fixRates = (m: DateMetrics) => {
        m.openRate  = m.delivered > 0 ? (m.opened  / m.delivered) * 100 : 0
        m.clickRate = m.delivered > 0 ? (m.clicked / m.delivered) * 100 : 0
        m.unsubRate = m.delivered > 0 ? ((m.unsubscribed || 0) / m.delivered) * 100 : 0
      }
      Object.values(d.providers).forEach(fixRates)
      Object.values(d.domains).forEach(fixRates)
    })
  }

  // Kenscio: openRate = open/delivered, clickRate = click/delivered, unsubRate = unsub/delivered
  if (isKenscio) {
    Object.values(byDate).forEach(d => {
      const fixRates = (m: DateMetrics) => {
        m.openRate  = m.delivered > 0 ? (m.opened  / m.delivered) * 100 : 0
        m.clickRate = m.delivered > 0 ? (m.clicked / m.delivered) * 100 : 0
        m.unsubRate = m.delivered > 0 ? ((m.unsubscribed || 0) / m.delivered) * 100 : 0
      }
      Object.values(d.providers).forEach(fixRates)
      Object.values(d.domains).forEach(fixRates)
    })
  }

  // Mailjet: openRate = open/delivered, clickRate = click/delivered, unsubRate = unsub/delivered
  if (isMailjet) {
    Object.values(byDate).forEach(d => {
      const fixRates = (m: DateMetrics) => {
        m.openRate  = m.delivered > 0 ? (m.opened  / m.delivered) * 100 : 0
        m.clickRate = m.delivered > 0 ? (m.clicked / m.delivered) * 100 : 0
        m.unsubRate = m.delivered > 0 ? ((m.unsubscribed || 0) / m.delivered) * 100 : 0
      }
      Object.values(d.providers).forEach(fixRates)
      Object.values(d.domains).forEach(fixRates)
    })
  }

  // Inboxroad: openRate = open/delivered, clickRate = click/delivered, unsubRate = unsub/delivered
  if (isInboxroad) {
    Object.values(byDate).forEach(d => {
      const fixRates = (m: DateMetrics) => {
        m.openRate  = m.delivered > 0 ? (m.opened  / m.delivered) * 100 : 0
        m.clickRate = m.delivered > 0 ? (m.clicked / m.delivered) * 100 : 0
        m.unsubRate = m.delivered > 0 ? ((m.unsubscribed || 0) / m.delivered) * 100 : 0
      }
      Object.values(d.providers).forEach(fixRates)
      Object.values(d.domains).forEach(fixRates)
    })
  }

  // Elastic: openRate = open/delivered, clickRate = click/delivered, unsubRate = unsub/delivered
  if (isElastic) {
    Object.values(byDate).forEach(d => {
      const fixRates = (m: DateMetrics) => {
        m.openRate  = m.delivered > 0 ? (m.opened  / m.delivered) * 100 : 0
        m.clickRate = m.delivered > 0 ? (m.clicked / m.delivered) * 100 : 0
        m.unsubRate = m.delivered > 0 ? ((m.unsubscribed || 0) / m.delivered) * 100 : 0
      }
      Object.values(d.providers).forEach(fixRates)
      Object.values(d.domains).forEach(fixRates)
    })
  }

  const format = isMap ? 'map' : isInboxroad ? 'inboxroad' : isElastic ? 'elastic' : isMailjet ? 'mailjet' : isKenscio ? 'kenscio' : isMoosend ? 'moosend' : isMMS ? 'mms' : isNetcore ? 'netcore' : isMailmodo ? 'mailmodo' : 'generic'
  return { byDate, dates, dateYears, totalRows, skipped, skippedNoDate, skippedNoEmail, newDates: 0, format, dateAmbiguous: mapDateAmbiguous }
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

    // Merge providerDomains — store per-date so MatrixView can filter by date range
    if (bucket.providerDomains) {
      if (!data.providerDomains) data.providerDomains = {}
      Object.entries(bucket.providerDomains).forEach(([prov, domMap]) => {
        if (!data.providerDomains[prov]) data.providerDomains[prov] = {}
        Object.entries(domMap).forEach(([dom, cell]) => {
          if (!data.providerDomains[prov][dom]) data.providerDomains[prov][dom] = {}
          const existing = data.providerDomains[prov][dom][date]
          if (!existing) {
            data.providerDomains[prov][dom][date] = {
              sent: cell.sent || 0, delivered: cell.delivered || 0,
              opened: cell.opened || 0, clicked: cell.clicked || 0,
              bounced: cell.bounced || 0, hardBounced: cell.hardBounced || 0,
              softBounced: cell.softBounced || 0, unsubscribed: cell.unsubscribed || 0,
            }
          } else {
            existing.sent += cell.sent || 0; existing.delivered += cell.delivered || 0
            existing.opened += cell.opened || 0; existing.clicked += cell.clicked || 0
            existing.bounced += cell.bounced || 0
            existing.hardBounced = (existing.hardBounced || 0) + (cell.hardBounced || 0)
            existing.softBounced = (existing.softBounced || 0) + (cell.softBounced || 0)
            existing.unsubscribed += cell.unsubscribed || 0
          }
        })
      })
    }

    // Overall
    if (!data.overallByDate[date]) data.overallByDate[date] = blankMetrics()
    mergeMetrics(data.overallByDate[date], bucket.providers ? Object.values(bucket.providers).reduce((acc, m) => {
      acc.sent += m.sent; acc.delivered += m.delivered; acc.opened += m.opened
      acc.clicked += m.clicked; acc.bounced += m.bounced
      acc.hardBounced = (acc.hardBounced || 0) + (m.hardBounced || 0)
      acc.softBounced = (acc.softBounced || 0) + (m.softBounced || 0)
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

/**
 * Parse a Throttling Matrix CSV into ThrottleRecord[].
 *
 * Expected CSV format (first column header is blank):
 *   ,IP,From Domain,Gmail,Hotmail,Outlook,Yahoo,Icloud,AOL,Live,Gmx,Web,Others
 *   Kenscio,103.162.246.126,dailypromote.com,3000,30,30,...
 *
 * Values: integer | "TBC" | "" (treated as 0)
 */
export function parseThrottleCsv(text: string): ThrottleRecord[] {
  const rows = splitCsvRows(text)
  if (rows.length < 2) return []

  function parseVal(raw: string): ThrottleValue {
    const t = raw.trim()
    if (t.toUpperCase() === 'TBC') return 'TBC'
    const n = Number(t)
    return isNaN(n) ? 0 : n
  }

  return rows
    .slice(1) // skip header row
    .filter(cols => cols.some(v => v.trim() !== ''))
    .map(cols => ({
      esp:        cols[0]?.trim() ?? '',
      ip:         cols[1]?.trim() ?? '',
      fromDomain: cols[2]?.trim() ?? '',
      gmail:      parseVal(cols[3]  ?? ''),
      hotmail:    parseVal(cols[4]  ?? ''),
      outlook:    parseVal(cols[5]  ?? ''),
      yahoo:      parseVal(cols[6]  ?? ''),
      icloud:     parseVal(cols[7]  ?? ''),
      aol:        parseVal(cols[8]  ?? ''),
      live:       parseVal(cols[9]  ?? ''),
      gmx:        parseVal(cols[10] ?? ''),
      web:        parseVal(cols[11] ?? ''),
      others:     parseVal(cols[12] ?? ''),
    }))
    .filter(r => r.esp || r.ip || r.fromDomain)
}

// Total send activity attributed to an unparseable sending domain ("unknown"),
// summed across all dates. A row contributes to a domain's `sent`, so this is a
// row-count proxy for how much data couldn't be matched to a real domain.
export function unknownDomainSends(parsed: ParseResult): number {
  return Object.values(parsed.byDate)
    .reduce((sum, b) => sum + (b.domains['unknown']?.sent ?? 0), 0)
}

export type UploadDataIssue =
  | { kind: 'all-skipped'; totalRows: number }   // rows present but none parsed into a date
  | { kind: 'zero-sent'; dates: number }         // dates parsed but 0 sends counted (column mismatch)

/**
 * Detect an upload that parsed but would be invisible — either every row was
 * skipped, or metrics all came out zero (usually a column-header mismatch).
 * Returns null when the upload has usable, visible data.
 */
export function checkUploadHasData(parsed: ParseResult): UploadDataIssue | null {
  if (parsed.dates.length === 0) return { kind: 'all-skipped', totalRows: parsed.totalRows }
  let sent = 0
  for (const b of Object.values(parsed.byDate)) {
    for (const m of Object.values(b.providers)) sent += m.sent || 0
  }
  if (sent === 0) return { kind: 'zero-sent', dates: parsed.dates.length }
  return null
}
