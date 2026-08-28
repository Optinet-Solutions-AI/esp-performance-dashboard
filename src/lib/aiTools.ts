import type { AIContextInput, DateMetrics, MmData, ProviderData } from './types'
import { aggDates } from './utils'

// Caps how much daily history a single tool result can return, keeping
// drill-down responses cheap even for ESPs with long-running histories.
const MAX_DATES_RETURNED = 120

// Caps how many matching records a lookup tool can return in one call.
const MAX_MATCHES_RETURNED = 20

interface AiToolDef {
  type: 'function'
  function: {
    name: string
    description: string
    strict: true
    parameters: Record<string, unknown>
  }
}

export const AI_TOOLS: AiToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'list_providers',
      description: 'List every recipient email provider (e.g. gmail.com, yahoo.com) tracked for a given ESP, sorted by volume sent. Use this to discover providers beyond the default top-5 summary.',
      strict: true,
      parameters: {
        type: 'object',
        properties: { esp: { type: 'string', description: 'ESP name, e.g. "Mailmodo"' } },
        required: ['esp'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_domains',
      description: 'List every sending domain tracked for a given ESP, sorted by volume sent. Use this to discover sending domains beyond the default top-5 summary.',
      strict: true,
      parameters: {
        type: 'object',
        properties: { esp: { type: 'string', description: 'ESP name, e.g. "Mailmodo"' } },
        required: ['esp'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_provider_detail',
      description: 'Get full metrics for one recipient provider under one ESP: overall totals plus a daily breakdown (up to the most recent 120 days).',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          esp: { type: 'string', description: 'ESP name, e.g. "Mailmodo"' },
          provider: { type: 'string', description: 'Recipient provider domain, e.g. "gmail.com"' },
        },
        required: ['esp', 'provider'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_domain_detail',
      description: 'Get full metrics for one sending domain under one ESP: overall totals plus a daily breakdown (up to the most recent 120 days).',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          esp: { type: 'string', description: 'ESP name, e.g. "Mailmodo"' },
          domain: { type: 'string', description: 'Sending domain, e.g. "example.com"' },
        },
        required: ['esp', 'domain'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_date_range_summary',
      description: 'Get aggregated metrics for an ESP over a specific date range, plus the daily breakdown within that range (up to 120 days). Use ISO dates (YYYY-MM-DD). Pass null for startDate/endDate to leave that bound open.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          esp: { type: 'string', description: 'ESP name, e.g. "Mailmodo"' },
          startDate: { type: ['string', 'null'], description: 'ISO start date (YYYY-MM-DD), inclusive, or null for no lower bound' },
          endDate: { type: ['string', 'null'], description: 'ISO end date (YYYY-MM-DD), inclusive, or null for no upper bound' },
        },
        required: ['esp', 'startDate', 'endDate'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_ftds_detail',
      description: 'Get exact registrations and FTDs for one ESP over a specific date range, from the daily Reg & FTDs uploads, including a daily breakdown (up to 120 days). Use for any FTD/registration question about a specific date, date range, or conversion rate — the default summary only covers all-time totals per ESP.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          esp: { type: 'string', description: 'ESP name, e.g. "Mailmodo"' },
          startDate: { type: ['string', 'null'], description: 'ISO start date (YYYY-MM-DD), inclusive, or null for no lower bound' },
          endDate: { type: ['string', 'null'], description: 'ISO end date (YYYY-MM-DD), inclusive, or null for no upper bound' },
        },
        required: ['esp', 'startDate', 'endDate'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_ip_detail',
      description: `Look up exact IP Matrix registry entries (ESP, IP, sending domain, MAP campaign code, static registrations/FTDs). Filter by any combination of esp, ip, domain — pass null for filters you don't need. Returns up to ${MAX_MATCHES_RETURNED} matching records.`,
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          esp: { type: ['string', 'null'], description: 'ESP name to filter by, e.g. "Mailmodo", or null for any' },
          ip: { type: ['string', 'null'], description: 'IP address (or substring) to filter by, or null for any' },
          domain: { type: ['string', 'null'], description: 'Sending domain (or substring) to filter by, or null for any' },
        },
        required: ['esp', 'ip', 'domain'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_throttle_detail',
      description: 'Get the exact throttle rate for every mailbox provider (gmail, hotmail, outlook, yahoo, icloud, aol, live, gmx, web, others) for one ESP, optionally narrowed to a specific IP and/or sending domain.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          esp: { type: 'string', description: 'ESP name, e.g. "Mailgun"' },
          ip: { type: ['string', 'null'], description: 'IP address to filter by, or null for any IP under this ESP' },
          domain: { type: ['string', 'null'], description: 'Sending domain to filter by, or null for any domain under this ESP' },
        },
        required: ['esp', 'ip', 'domain'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_partner_detail',
      description: `Search the Data Management partner roster for records matching a query (matches against any field — partner name, domain, country, etc), case-insensitive substring match. Returns up to ${MAX_MATCHES_RETURNED} full matching records.`,
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Text to search for across all partner roster fields' },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
]

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

function roundMetrics(m: DateMetrics): DateMetrics {
  const out: DateMetrics = { ...m }
  for (const key of Object.keys(out) as (keyof DateMetrics)[]) {
    const v = out[key]
    if (typeof v === 'number') (out[key] as number) = round2(v)
  }
  return out
}

function findEsp(espData: Record<string, MmData>, name: string): { key: string; data: MmData } | null {
  const keys = Object.keys(espData)
  const key = keys.find(k => k.toLowerCase() === name.toLowerCase())
    ?? keys.find(k => k.toLowerCase().includes(name.toLowerCase()))
  return key ? { key, data: espData[key] } : null
}

function findEntry(map: Record<string, ProviderData>, name: string): { key: string; data: ProviderData } | null {
  const keys = Object.keys(map)
  const key = keys.find(k => k.toLowerCase() === name.toLowerCase())
    ?? keys.find(k => k.toLowerCase().includes(name.toLowerCase()))
  return key ? { key, data: map[key] } : null
}

function labelsInRange(mm: MmData, startDate?: string | null, endDate?: string | null): string[] {
  if (!startDate && !endDate) return mm.dates
  return mm.dates.filter(label => {
    const iso = mm.datesFull.find(d => d.label === label)?.iso
    if (!iso) return false
    if (startDate && iso < startDate) return false
    if (endDate && iso > endDate) return false
    return true
  })
}

function byDateSlice(byDate: Record<string, DateMetrics>, labels: string[]): Record<string, DateMetrics> {
  const out: Record<string, DateMetrics> = {}
  for (const label of labels.slice(-MAX_DATES_RETURNED)) {
    if (byDate[label]) out[label] = roundMetrics(byDate[label])
  }
  return out
}

function listEntries(map: Record<string, ProviderData>) {
  return Object.entries(map)
    .filter(([, pd]) => pd.overall && pd.overall.sent > 0)
    .map(([name, pd]) => ({
      name,
      sent: pd.overall.sent,
      deliveryRate: round2(pd.overall.deliveryRate),
      bounceRate: round2(pd.overall.bounceRate),
    }))
    .sort((a, b) => b.sent - a.sent)
}

export function executeAiTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AIContextInput
): unknown {
  const { espData } = ctx
  const espArg = typeof args.esp === 'string' ? args.esp : ''

  switch (name) {
    case 'list_providers': {
      const found = findEsp(espData, espArg)
      if (!found) return { error: `No data found for ESP "${espArg}"` }
      return { esp: found.key, providers: listEntries(found.data.providers) }
    }

    case 'list_domains': {
      const found = findEsp(espData, espArg)
      if (!found) return { error: `No data found for ESP "${espArg}"` }
      return { esp: found.key, domains: listEntries(found.data.domains) }
    }

    case 'get_provider_detail': {
      const found = findEsp(espData, espArg)
      if (!found) return { error: `No data found for ESP "${espArg}"` }
      const providerArg = typeof args.provider === 'string' ? args.provider : ''
      const entry = findEntry(found.data.providers, providerArg)
      if (!entry) return { error: `No provider matching "${providerArg}" found for ${found.key}` }
      return {
        esp: found.key,
        provider: entry.key,
        overall: roundMetrics(entry.data.overall),
        byDate: byDateSlice(entry.data.byDate, found.data.dates),
      }
    }

    case 'get_domain_detail': {
      const found = findEsp(espData, espArg)
      if (!found) return { error: `No data found for ESP "${espArg}"` }
      const domainArg = typeof args.domain === 'string' ? args.domain : ''
      const entry = findEntry(found.data.domains, domainArg)
      if (!entry) return { error: `No domain matching "${domainArg}" found for ${found.key}` }
      return {
        esp: found.key,
        domain: entry.key,
        overall: roundMetrics(entry.data.overall),
        byDate: byDateSlice(entry.data.byDate, found.data.dates),
      }
    }

    case 'get_date_range_summary': {
      const found = findEsp(espData, espArg)
      if (!found) return { error: `No data found for ESP "${espArg}"` }
      const startDate = typeof args.startDate === 'string' ? args.startDate : null
      const endDate = typeof args.endDate === 'string' ? args.endDate : null
      const labels = labelsInRange(found.data, startDate, endDate)
      if (labels.length === 0) return { error: 'No data found in that date range' }
      const summary = aggDates(found.data.overallByDate, labels)
      return {
        esp: found.key,
        dateRange: { start: startDate, end: endDate, daysMatched: labels.length },
        overall: summary ? roundMetrics(summary) : null,
        byDate: byDateSlice(found.data.overallByDate, labels),
      }
    }

    case 'get_ftds_detail': {
      const pool = ctx.regFtdsDaily.filter(r => r.esp.toLowerCase() === espArg.toLowerCase())
      const rows = pool.length > 0
        ? pool
        : ctx.regFtdsDaily.filter(r => r.esp.toLowerCase().includes(espArg.toLowerCase()))
      if (rows.length === 0) return { error: `No Reg & FTDs data found for ESP "${espArg}"` }

      const startDate = typeof args.startDate === 'string' ? args.startDate : null
      const endDate = typeof args.endDate === 'string' ? args.endDate : null
      const filtered = rows.filter(r => (!startDate || r.date >= startDate) && (!endDate || r.date <= endDate))
      if (filtered.length === 0) return { error: 'No data found in that date range' }

      const byDate = new Map<string, { reg: number; ftds: number }>()
      for (const r of filtered) {
        const prev = byDate.get(r.date) ?? { reg: 0, ftds: 0 }
        byDate.set(r.date, { reg: prev.reg + r.registrations, ftds: prev.ftds + r.ftds })
      }
      const sortedDates = [...byDate.keys()].sort()
      const totalReg = filtered.reduce((s, r) => s + r.registrations, 0)
      const totalFtds = filtered.reduce((s, r) => s + r.ftds, 0)

      const byDateOut: Record<string, { registrations: number; ftds: number; conversionRate: number }> = {}
      for (const d of sortedDates.slice(-MAX_DATES_RETURNED)) {
        const v = byDate.get(d)!
        byDateOut[d] = { registrations: v.reg, ftds: v.ftds, conversionRate: v.reg > 0 ? round2((v.ftds / v.reg) * 100) : 0 }
      }

      return {
        esp: rows[0].esp,
        dateRange: { start: startDate, end: endDate, daysMatched: sortedDates.length },
        overall: {
          registrations: totalReg,
          ftds: totalFtds,
          conversionRate: totalReg > 0 ? round2((totalFtds / totalReg) * 100) : 0,
        },
        byDate: byDateOut,
      }
    }

    case 'get_ip_detail': {
      const espFilter = strOrNull(args.esp)
      const ipFilter = strOrNull(args.ip)
      const domainFilter = strOrNull(args.domain)
      if (!espFilter && !ipFilter && !domainFilter) {
        return { error: 'Provide at least one of esp, ip, or domain to search for' }
      }
      const matches = ctx.ipmData.filter(r =>
        (!espFilter || r.esp.toLowerCase().includes(espFilter.toLowerCase())) &&
        (!ipFilter || r.ip.toLowerCase().includes(ipFilter.toLowerCase())) &&
        (!domainFilter || r.domain.toLowerCase().includes(domainFilter.toLowerCase()))
      )
      if (matches.length === 0) return { error: 'No IP Matrix records match those filters' }
      return {
        matchCount: matches.length,
        records: matches.slice(0, MAX_MATCHES_RETURNED).map(r => ({
          esp: r.esp, ip: r.ip, domain: r.domain, mpCode: r.mpCode,
          registrations: r.registrations, ftds: r.ftds,
        })),
      }
    }

    case 'get_throttle_detail': {
      const ipFilter = strOrNull(args.ip)
      const domainFilter = strOrNull(args.domain)
      const matches = ctx.throttleData.filter(r =>
        r.esp.toLowerCase().includes(espArg.toLowerCase()) &&
        (!ipFilter || r.ip.toLowerCase().includes(ipFilter.toLowerCase())) &&
        (!domainFilter || r.fromDomain.toLowerCase().includes(domainFilter.toLowerCase()))
      )
      if (matches.length === 0) return { error: `No Throttle Matrix records found for ESP "${espArg}" with those filters` }
      return {
        matchCount: matches.length,
        records: matches.slice(0, MAX_MATCHES_RETURNED).map(r => ({
          esp: r.esp, ip: r.ip, domain: r.fromDomain,
          gmail: r.gmail, hotmail: r.hotmail, outlook: r.outlook, yahoo: r.yahoo,
          icloud: r.icloud, aol: r.aol, live: r.live, gmx: r.gmx, web: r.web, others: r.others,
        })),
      }
    }

    case 'get_partner_detail': {
      const query = typeof args.query === 'string' ? args.query.toLowerCase() : ''
      if (!query) return { error: 'A search query is required' }
      const matches = ctx.dmData.filter(r =>
        Object.values(r).some(v => typeof v === 'string' && v.toLowerCase().includes(query))
      )
      if (matches.length === 0) return { error: `No partner roster records match "${query}"` }
      return { matchCount: matches.length, records: matches.slice(0, MAX_MATCHES_RETURNED) }
    }

    default:
      return { error: `Unknown tool "${name}"` }
  }
}
