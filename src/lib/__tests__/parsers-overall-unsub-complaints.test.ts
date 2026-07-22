import { describe, it, expect } from 'vitest'
import { parseFile, mergeIntoMmData } from '../parsers'
import type { MmData } from '../types'

function emptyMmData(): MmData {
  return { dates: [], datesFull: [], providers: {}, domains: {}, overallByDate: {}, providerDomains: {} }
}

// Netcore per-recipient format: a non-empty unsub-reason / abuse-reason cell
// counts as 1 unsubscribe / 1 complaint for that row.
const N_HEADER = 'Email (Primary Key),Domain,Sent Date,Bounce Type,Open Time,No. Of Clicks,Unsub Reason,Abuse Reason,Status'
const N_SENT   = 'a@gmail.com,test.com,23/06/2026 10:00,,,,,,Sent'
const N_UNSUB  = 'b@gmail.com,test.com,23/06/2026 10:00,,,,manual,,Sent'
const N_ABUSE  = 'c@gmail.com,test.com,23/06/2026 10:00,,,,,spam complaint,Sent'

function netcoreFile(): File {
  const csv = [N_HEADER, N_SENT, N_UNSUB, N_ABUSE].join('\n')
  return new File([csv], 'Netcore - 23062026.csv', { type: 'text/csv' })
}

describe('mergeIntoMmData — overallByDate carries unsubscribed/complained', () => {
  it('propagates unsubs and complaints into overallByDate (KPI/TOTAL source)', async () => {
    const res = await parseFile(netcoreFile(), 'Netcore')

    // provider-level parse already carries both fields
    expect(res.byDate['Jun 23'].providers['gmail.com'].unsubscribed).toBe(1)
    expect(res.byDate['Jun 23'].providers['gmail.com'].complained).toBe(1)

    const { data } = mergeIntoMmData(emptyMmData(), res, 'Netcore')
    const day = data.overallByDate['Jun 23']
    expect(day).toBeDefined()
    expect(day.unsubscribed).toBe(1)
    expect(day.complained).toBe(1)
  })
})
