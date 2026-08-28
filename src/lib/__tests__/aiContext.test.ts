import { describe, it, expect } from 'vitest'
import { buildAIContext } from '../aiContext'
import type { AIContextInput, EspRecord, MmData, IpmRecord, ThrottleRecord, RegFtdsDailyRecord } from '../types'

function makeEsp(overrides: Partial<EspRecord> = {}): EspRecord {
  return {
    name: 'TestESP',
    color: '#ffffff',
    sent: 1000,
    delivered: 950,
    opens: 400,
    clicks: 100,
    bounced: 10,
    unsub: 5,
    deliveryRate: 95.0,
    openRate: 42.1,
    clickRate: 25.0,
    bounceRate: 1.0,
    unsubRate: 1.25,
    status: 'healthy',
    ...overrides,
  }
}

function makeMmData(): MmData {
  return {
    dates: ['Mar 10'],
    datesFull: [{ label: 'Mar 10', year: 2025, iso: '2025-03-10' }],
    providers: {
      'gmail.com': {
        overall: {
          sent: 500, delivered: 480, opened: 200, clicked: 50, bounced: 5,
          deliveryRate: 96.0, openRate: 41.7, clickRate: 25.0, bounceRate: 1.0, unsubRate: 0,
        },
        byDate: {},
      },
    },
    domains: {
      'mydomain.com': {
        overall: {
          sent: 1000, delivered: 950, opened: 400, clicked: 100, bounced: 10,
          deliveryRate: 95.0, openRate: 42.1, clickRate: 25.0, bounceRate: 1.0, unsubRate: 1.25,
        },
        byDate: {},
      },
    },
    overallByDate: {},
    providerDomains: {},
  }
}

const emptyInput: AIContextInput = { esps: [], espData: {}, ipmData: [], throttleData: [], regFtdsDaily: [], dmData: [] }

describe('buildAIContext', () => {
  it('returns no-data message when esps array is empty', () => {
    const result = buildAIContext(emptyInput)
    expect(result).toContain('No ESP data')
  })

  it('includes ESP name in output', () => {
    const result = buildAIContext({ ...emptyInput, esps: [makeEsp({ name: 'Mailmodo' })] })
    expect(result).toContain('Mailmodo')
  })

  it('includes correct delivery rate formatted to 2 decimal places', () => {
    const result = buildAIContext({ ...emptyInput, esps: [makeEsp({ deliveryRate: 97.5 })] })
    expect(result).toContain('97.50%')
  })

  it('sums sent totals correctly for multiple ESPs', () => {
    const esps = [makeEsp({ name: 'ESP1', sent: 1000 }), makeEsp({ name: 'ESP2', sent: 2000 })]
    const result = buildAIContext({ ...emptyInput, esps })
    expect(result).toContain('3,000')
  })

  it('does not crash when espData has no entry for an ESP', () => {
    const esp = makeEsp({ name: 'Mailmodo' })
    expect(() => buildAIContext({ ...emptyInput, esps: [esp], espData: {} })).not.toThrow()
  })

  it('includes provider data when espData is present', () => {
    const esp = makeEsp({ name: 'Mailmodo' })
    const result = buildAIContext({ ...emptyInput, esps: [esp], espData: { Mailmodo: makeMmData() } })
    expect(result).toContain('gmail.com')
  })

  it('includes domain data when espData is present', () => {
    const esp = makeEsp({ name: 'Mailmodo' })
    const result = buildAIContext({ ...emptyInput, esps: [esp], espData: { Mailmodo: makeMmData() } })
    expect(result).toContain('mydomain.com')
  })

  it('includes IP Matrix summary when ipmData is present', () => {
    const ipmData: IpmRecord[] = [
      { id: '1', esp: 'Mailmodo', ip: '1.2.3.4', domain: 'test.com', registrations: 100, ftds: 10 },
    ]
    const result = buildAIContext({ ...emptyInput, esps: [makeEsp()], ipmData })
    expect(result).toContain('IP Matrix')
    expect(result).toContain('Total IPs tracked: 1')
    expect(result).toContain('Total Registrations: 100')
  })

  it('summarizes the partner roster by country when dmData is present', () => {
    const dmData = [
      { country: 'US', domain: 'a.com', partner: 'Acme' },
      { country: 'US', domain: 'b.com', partner: 'Beta' },
      { country: 'CA', domain: 'c.com', partner: 'Gamma' },
    ]
    const result = buildAIContext({ ...emptyInput, esps: [makeEsp()], dmData })
    expect(result).toContain('Partner Roster')
    expect(result).toContain('Total partner records: 3')
    expect(result).toContain('US (2)')
    expect(result).toContain('CA (1)')
  })

  it('omits the partner roster summary when dmData is empty', () => {
    const result = buildAIContext({ ...emptyInput, esps: [makeEsp()] })
    expect(result).not.toContain('Partner Roster')
  })

  it('flags throttle combos with non-zero rates', () => {
    const throttleData: ThrottleRecord[] = [
      {
        esp: 'Mailgun', ip: '5.6.7.8', fromDomain: 'domain.com',
        gmail: 5, hotmail: 0, outlook: 0, yahoo: 0, icloud: 0, aol: 0, live: 0, gmx: 0, web: 0, others: 0,
      },
    ]
    const result = buildAIContext({ ...emptyInput, esps: [makeEsp()], throttleData })
    expect(result).toContain('## Throttling Issues')
    expect(result).toContain('Mailgun')
  })

  it('does not include throttle section when all rates are zero', () => {
    const throttleData: ThrottleRecord[] = [
      {
        esp: 'Mailgun', ip: '5.6.7.8', fromDomain: 'domain.com',
        gmail: 0, hotmail: 0, outlook: 0, yahoo: 0, icloud: 0, aol: 0, live: 0, gmx: 0, web: 0, others: 0,
      },
    ]
    const result = buildAIContext({ ...emptyInput, esps: [makeEsp()], throttleData })
    expect(result).not.toContain('## Throttling Issues')
  })

  it('ranks ESPs by FTDs descending in the Reg & FTDs summary', () => {
    const regFtdsDaily: RegFtdsDailyRecord[] = [
      { date: '2026-08-01', esp: 'Mailmodo', ip: '1.1.1.1', registrations: 100, ftds: 5 },
      { date: '2026-08-01', esp: 'Inboxroad', ip: '2.2.2.2', registrations: 200, ftds: 40 },
      { date: '2026-08-02', esp: 'Inboxroad', ip: '2.2.2.2', registrations: 50, ftds: 10 },
    ]
    const result = buildAIContext({ ...emptyInput, esps: [makeEsp()], regFtdsDaily })
    expect(result).toContain('Reg & FTDs Summary')
    const inboxroadLine = result.split('\n').find(l => l.startsWith('| Inboxroad'))
    const mailmodoLine = result.split('\n').find(l => l.startsWith('| Mailmodo'))
    expect(inboxroadLine).toContain('250')
    expect(inboxroadLine).toContain('50')
    expect(mailmodoLine).toContain('100')
    expect(mailmodoLine).toContain('5')
    // Inboxroad (50 FTDs) should be ranked above Mailmodo (5 FTDs)
    expect(result.indexOf('| Inboxroad')).toBeLessThan(result.indexOf('| Mailmodo'))
  })

  it('omits Reg & FTDs summary when no daily data is loaded', () => {
    const result = buildAIContext({ ...emptyInput, esps: [makeEsp()] })
    expect(result).not.toContain('Reg & FTDs Summary')
  })

  it('does not include throttle section when all values are TBC', () => {
    const throttleData: ThrottleRecord[] = [
      {
        esp: 'Mailgun', ip: '1.1.1.1', fromDomain: 'd.com',
        gmail: 'TBC' as unknown as number, hotmail: 'TBC' as unknown as number,
        outlook: 'TBC' as unknown as number, yahoo: 'TBC' as unknown as number,
        icloud: 'TBC' as unknown as number, aol: 'TBC' as unknown as number,
        live: 'TBC' as unknown as number, gmx: 'TBC' as unknown as number,
        web: 'TBC' as unknown as number, others: 'TBC' as unknown as number,
      },
    ]
    const result = buildAIContext({ ...emptyInput, esps: [makeEsp()], throttleData })
    expect(result).not.toContain('## Throttling Issues')
  })
})
