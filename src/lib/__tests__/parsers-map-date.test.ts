import { describe, it, expect } from 'vitest'
import { resolveMapDateOrder, parseMapDate, parseFile } from '../parsers'

const MAP_HEADER = 'Campaign Name,Date,Domains,Messages Sent,Rate,Confirmed Openers,Rate,Clickers,CTR,Hard Bounces,Rate,Soft Bounces,Rate,Inbox Placement Rate,Spam Rate,Missing Rate,Unsubscribed'
function mapRow(date: string, sent = 100): string {
  return `CMP-${date}-su.testdomain.com,${date},gmail.com,${sent},90%,10,10%,1,1%,0,0%,0,0%,,,,0`
}
function mapCsv(dates: string[]): File {
  const text = [MAP_HEADER, ...dates.map(d => mapRow(d))].join('\n')
  return new File([text], 'map.csv', { type: 'text/csv' })
}

describe('resolveMapDateOrder — file-level order inference', () => {
  it('infers month-first when a second component is > 12', () => {
    expect(resolveMapDateOrder(['07/15/2026'])).toEqual({ order: 'mdy', ambiguous: false })
  })

  it('infers day-first when a first component is > 12', () => {
    expect(resolveMapDateOrder(['15/07/2026'])).toEqual({ order: 'dmy', ambiguous: false })
  })

  it('infers day-first from a dashed date with day > 12', () => {
    expect(resolveMapDateOrder(['13-07-2026'])).toEqual({ order: 'dmy', ambiguous: false })
  })

  it('is ambiguous when every date has both parts <= 12', () => {
    expect(resolveMapDateOrder(['07/01/2026'])).toEqual({ order: null, ambiguous: true })
  })

  it('locks the whole file from a single disambiguating row', () => {
    // one row proves month-first; the ambiguous rows inherit it
    expect(resolveMapDateOrder(['07/01/2026', '07/15/2026', '07/02/2026']))
      .toEqual({ order: 'mdy', ambiguous: false })
  })

  it('flags conflicting evidence as ambiguous', () => {
    // 15/07 says day-first, 07/15 says month-first — contradictory
    expect(resolveMapDateOrder(['15/07/2026', '07/15/2026'])).toEqual({ order: null, ambiguous: true })
  })

  it('is not ambiguous when there are no two-part numeric dates', () => {
    expect(resolveMapDateOrder(['2026-07-01', ''])).toEqual({ order: null, ambiguous: false })
  })
})

describe('parseMapDate — order-aware parsing', () => {
  it('reads 07/01/2026 as Jul 01 under month-first (the reported bug)', () => {
    expect(parseMapDate('07/01/2026', 'mdy')).toEqual({ str: 'Jul 01', year: 2026 })
  })

  it('reads 07/01/2026 as Jan 07 under day-first', () => {
    expect(parseMapDate('07/01/2026', 'dmy')).toEqual({ str: 'Jan 07', year: 2026 })
  })

  it('reads dd-mm-yyyy under day-first', () => {
    expect(parseMapDate('01-07-2026', 'dmy')).toEqual({ str: 'Jul 01', year: 2026 })
  })

  it('reads mm-dd-yyyy under month-first', () => {
    expect(parseMapDate('07-01-2026', 'mdy')).toEqual({ str: 'Jul 01', year: 2026 })
  })

  it('value > 12 overrides the requested order', () => {
    // even asked for month-first, 15 can only be the day
    expect(parseMapDate('15/07/2026', 'mdy')).toEqual({ str: 'Jul 15', year: 2026 })
  })

  it('passes ISO dates through unchanged', () => {
    expect(parseMapDate('2026-07-01', 'mdy')).toEqual({ str: 'Jul 01', year: 2026 })
  })

  it('returns null for empty or unparseable input', () => {
    expect(parseMapDate('', 'mdy')).toBeNull()
    expect(parseMapDate('nope', 'mdy')).toBeNull()
  })
})

describe('parseFile — MAP unsubscribed column', () => {
  it('reads unsubscribed counts from a "Unsubscribed" header', async () => {
    const text = [MAP_HEADER, 'CMP-07/01/2026-su.testdomain.com,07/01/2026,gmail.com,100,90%,10,10%,1,1%,0,0%,0,0%,,,,5']
      .join('\n')
    const file = new File([text], 'map.csv', { type: 'text/csv' })
    const r = await parseFile(file, 'Map')
    expect(r.byDate['Jul 01'].providers['gmail.com'].unsubscribed).toBe(5)
  })

  it('reads unsubscribed counts from a "Unsubscribes" header (current MAP export format)', async () => {
    const header = MAP_HEADER.replace('Unsubscribed', 'Unsubscribes')
    const text = [header, 'CMP-07/01/2026-su.testdomain.com,07/01/2026,gmail.com,100,90%,10,10%,1,1%,0,0%,0,0%,,,,5']
      .join('\n')
    const file = new File([text], 'map.csv', { type: 'text/csv' })
    const r = await parseFile(file, 'Map')
    expect(r.byDate['Jul 01'].providers['gmail.com'].unsubscribed).toBe(5)
  })
})

describe('parseFile — MAP date resolution', () => {
  it('auto-resolves month-first from a disambiguating row and is not ambiguous', async () => {
    const r = await parseFile(mapCsv(['07/15/2026', '07/01/2026']), 'Map')
    expect(r.dateAmbiguous).toBe(false)
    expect(r.dates.sort()).toEqual(['Jul 01', 'Jul 15'])
  })

  it('flags a single-day both-parts-<=12 file as ambiguous (needs operator pick)', async () => {
    const r = await parseFile(mapCsv(['07/01/2026']), 'Map')
    expect(r.dateAmbiguous).toBe(true)
  })

  it('honors an explicit order hint and is not ambiguous', async () => {
    const r = await parseFile(mapCsv(['07/01/2026']), 'Map', undefined, 'dmy')
    expect(r.dateAmbiguous).toBe(false)
    expect(r.dates).toEqual(['Jan 07'])
  })
})
