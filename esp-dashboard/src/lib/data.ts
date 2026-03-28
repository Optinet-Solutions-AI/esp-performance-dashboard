import type { EspRecord, DailyRecord, MmData, IpmRecord } from './types'

export const INITIAL_ESPS: EspRecord[] = ((): EspRecord[] => {
  const raw = [
    { name: 'Mailmodo', color: '#7c5cfc', sent: 0, delivered: 0, opens: 0, clicks: 0, bounced: 0, unsub: 0 },
    { name: 'Ongage', color: '#c67cff', sent: 0, delivered: 0, opens: 0, clicks: 0, bounced: 0, unsub: 0 },
    { name: 'Hotsol', color: '#00e5c3', sent: 0, delivered: 0, opens: 0, clicks: 0, bounced: 0, unsub: 0 },
    { name: 'MMS', color: '#ffd166', sent: 0, delivered: 0, opens: 0, clicks: 0, bounced: 0, unsub: 0 },
    { name: 'Moosend', color: '#ff6b35', sent: 0, delivered: 0, opens: 0, clicks: 0, bounced: 0, unsub: 0 },
    { name: 'Omnisend', color: '#ff4757', sent: 0, delivered: 0, opens: 0, clicks: 0, bounced: 0, unsub: 0 },
    { name: 'Klaviyo', color: '#60d4f0', sent: 0, delivered: 0, opens: 0, clicks: 0, bounced: 0, unsub: 0 },
    { name: 'Brevo', color: '#c5f27a', sent: 0, delivered: 0, opens: 0, clicks: 0, bounced: 0, unsub: 0 },
  ]
  return raw.map(d => ({
    ...d,
    deliveryRate: d.sent > 0 ? (d.delivered / d.sent) * 100 : 0,
    openRate: d.delivered > 0 ? (d.opens / d.delivered) * 100 : 0,
    clickRate: d.opens > 0 ? (d.clicks / d.opens) * 100 : 0,
    bounceRate: d.sent > 0 ? (d.bounced / d.sent) * 100 : 0,
    unsubRate: d.delivered > 0 ? (d.unsub / d.delivered) * 100 : 0,
    status: (() => {
      const bounceRate = d.sent > 0 ? (d.bounced / d.sent) * 100 : 0
      const deliveryRate = d.sent > 0 ? (d.delivered / d.sent) * 100 : 0
      if (bounceRate > 10 || deliveryRate < 70) return 'critical' as const
      if (bounceRate > 2 || deliveryRate < 95) return 'warn' as const
      return 'healthy' as const
    })(),
  }))
})()

export const INITIAL_DAILY7: DailyRecord[] = []

export const INITIAL_MM_DATA: MmData = {
  dates: [], datesFull: [], providers: {}, domains: {}, overallByDate: {}, providerDomains: {},
}

export const INITIAL_IPM_DATA: IpmRecord[] = []

export const PROVIDER_COLORS: Record<string, string> = {
  'gmail.com': '#ff7b6b',
  'yahoo.com': '#a78bff',
  'zohomail.in': '#ffcc44',
  'myyahoo.com': '#c4a8ff',
}

export const DOMAIN_COLORS: Record<string, string> = {
  'alerts.dailypromosdeal.com': '#00ffd5',
  'alerts.dealdivaz.com': '#b39dff',
  'alerts.promoalertz.com': '#ffe066',
  'couponsdailypromo.com': '#ff9a5c',
  'dailypromosdeal.com': '#60d4f0',
  'dealdivaz.com': '#ff6b77',
  'promoalertz.com': '#c5f27a',
  'promocouponsdaily.com': '#f9a8e8',
}

export const IP_COLOR_PALETTE = [
  '#00ffd5', '#b39dff', '#ffe066', '#ff9a5c', '#ff6b77',
  '#60d4f0', '#c5f27a', '#f9a8e8', '#ff7b6b', '#a78bff', '#ffcc44', '#c4a8ff',
]
