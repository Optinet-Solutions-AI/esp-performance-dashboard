import { describe, it, expect } from 'vitest'
import { checkUploadHasData, type ParseResult } from '@/lib/parsers'

// Minimal structural fixture — checkUploadHasData reads dates, totalRows, and
// byDate[*].providers[*].sent.
const make = (dates: string[], totalRows: number, providersByDate: Record<string, Record<string, number>>): ParseResult => ({
  dates,
  totalRows,
  byDate: Object.fromEntries(
    Object.entries(providersByDate).map(([date, provs]) => [
      date,
      { rows: 0, domains: {}, providerDomains: {},
        providers: Object.fromEntries(Object.entries(provs).map(([p, sent]) => [p, { sent }])) },
    ]),
  ),
} as unknown as ParseResult)

describe('checkUploadHasData', () => {
  it('returns null for a healthy upload with sends', () => {
    expect(checkUploadHasData(make(['Jul 01'], 5, { 'Jul 01': { 'gmail.com': 100 } }))).toBeNull()
  })

  it('flags all-skipped when nothing parsed into a date', () => {
    expect(checkUploadHasData(make([], 20, {}))).toEqual({ kind: 'all-skipped', totalRows: 20 })
  })

  it('flags zero-sent when dates parsed but no sends counted', () => {
    expect(checkUploadHasData(make(['Jul 01'], 20, { 'Jul 01': { 'gmail.com': 0, 'yahoo.com': 0 } })))
      .toEqual({ kind: 'zero-sent', dates: 1 })
  })

  it('does not flag when at least one date has sends', () => {
    expect(checkUploadHasData(make(['Jul 01', 'Jul 02'], 10, { 'Jul 01': { 'gmail.com': 0 }, 'Jul 02': { 'gmail.com': 3 } })))
      .toBeNull()
  })
})
