import { describe, it, expect } from 'vitest'
import { matchMpCode, parseFile } from '../parsers'

describe('matchMpCode', () => {
  const map = { 'MP-86': 'brand86.com', 'MP-16': 'brand16.com' }

  it('matches a boundary-delimited code in a campaign name', () => {
    expect(matchMpCode('BLA-RB-WO-NZ-ACT-D1-MP-86-07-15-2026', map)).toBe('brand86.com')
  })

  it('is case-insensitive', () => {
    expect(matchMpCode('promo_mp-16_july', map)).toBe('brand16.com')
  })

  it('does NOT match a code embedded in a longer number (MP-86 vs MP-861)', () => {
    expect(matchMpCode('BLA-MP-861-07-15-2026', map)).toBeNull()
  })

  it('does NOT match a code glued to letters (xMP-86)', () => {
    expect(matchMpCode('BLAxMP-86y', map)).toBeNull()
  })

  it('returns null when the matched code maps to a blank domain', () => {
    expect(matchMpCode('BLA-MP-86-2026', { 'MP-86': '' })).toBeNull()
  })

  it('returns null with no map or no campaign name', () => {
    expect(matchMpCode('BLA-MP-86', undefined)).toBeNull()
    expect(matchMpCode('', map)).toBeNull()
  })
})

function mapFile(campaign: string): File {
  // MAP layout: header row keyed by name (normaliseKeys keys by header text).
  // 'confirmed-openers' triggers MAP detection. Date 07/15/2026 has a part >12
  // so month/day order resolves unambiguously (mdy), no ambiguity pause.
  const csv = [
    'Campaign Name,Date,Domains,Messages Sent,Confirmed Openers,Clickers,Hard Bounces,Soft Bounces,Unsubscribed',
    `${campaign},07/15/2026,gmail.com,100,40,10,2,3,1`,
  ].join('\n')
  return new File([csv], 'map.csv', { type: 'text/csv' })
}

describe('parseFile — MAP MP-code resolution', () => {
  it('resolves the sending domain from an MP-code when no subdomain is present', async () => {
    const r = await parseFile(mapFile('BLA-RB-WO-NZ-ACT-D1-MP-86-07-15-2026'), 'Map', [], undefined, { 'MP-86': 'brand86.com' })
    expect(r.format).toBe('map')
    const day = r.byDate['Jul 15']
    expect(day.domains['brand86.com']?.sent).toBe(100)
    expect(day.domains['unknown']).toBeUndefined()
  })

  it('lets a registered subdomain win over a present MP-code (subdomain authoritative)', async () => {
    const r = await parseFile(
      mapFile('brand16.com-ACT-D1-MP-86-07-15-2026'), 'Map',
      ['brand16.com'], undefined, { 'MP-86': 'brand86.com' },
    )
    const day = r.byDate['Jul 15']
    expect(day.domains['brand16.com']?.sent).toBe(100)
    expect(day.domains['brand86.com']).toBeUndefined()
  })

  it('does not resolve MP-86 from a campaign containing MP-861', async () => {
    const r = await parseFile(mapFile('BLA-MP-861-07-15-2026'), 'Map', [], undefined, { 'MP-86': 'brand86.com' })
    const day = r.byDate['Jul 15']
    expect(day.domains['brand86.com']).toBeUndefined()
  })
})
