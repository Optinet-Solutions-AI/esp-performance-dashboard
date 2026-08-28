import type { AIContextInput, DateMetrics, MmData, ProviderData } from './types'
import { aggDates } from './utils'

// Caps how much daily history a single tool result can return, keeping
// drill-down responses cheap even for ESPs with long-running histories.
const MAX_DATES_RETURNED = 120

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
]

function round2(n: number): number {
  return Math.round(n * 100) / 100
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

    default:
      return { error: `Unknown tool "${name}"` }
  }
}
