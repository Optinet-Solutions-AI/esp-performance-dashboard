import type { EspRecord, DailyRecord, MmData, IpmRecord } from './types'

export const INITIAL_ESPS: EspRecord[] = ((): EspRecord[] => {
  const raw = [
    { name: 'Mailmodo', color: '#7c5cfc', sent: 34946, delivered: 32101, opens: 25132, clicks: 21709, bounced: 1067, unsub: 0 },
    { name: 'Ongage', color: '#c67cff', sent: 813966, delivered: 305713, opens: 13094, clicks: 135, bounced: 0, unsub: 0 },
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

export const INITIAL_DAILY7: DailyRecord[] = [
  { date: 'Feb 17', sent: 2607, delivered: 2607, opens: 3897, clicks: 1851, bounced: 0 },
  { date: 'Feb 20', sent: 868, delivered: 866, opens: 1392, clicks: 646, bounced: 2 },
  { date: 'Feb 21', sent: 13882, delivered: 13856, opens: 21715, clicks: 10257, bounced: 26 },
  { date: 'Feb 23', sent: 7798, delivered: 7794, opens: 12172, clicks: 5693, bounced: 4 },
  { date: 'Feb 24', sent: 2570, delivered: 2568, opens: 3716, clicks: 1847, bounced: 2 },
  { date: 'Feb 25', sent: 6856, delivered: 6848, opens: 10113, clicks: 4852, bounced: 8 },
  { date: 'Feb 26', sent: 1365, delivered: 334, opens: 210, clicks: 201, bounced: 1031 },
]

export const INITIAL_MM_DATA: MmData = {
  dates: ['Feb 17', 'Feb 20', 'Feb 21', 'Feb 23', 'Feb 24', 'Feb 25', 'Feb 26'],
  datesFull: [
    { label: 'Feb 17', year: 2026 }, { label: 'Feb 20', year: 2026 },
    { label: 'Feb 21', year: 2026 }, { label: 'Feb 23', year: 2026 },
    { label: 'Feb 24', year: 2026 }, { label: 'Feb 25', year: 2026 },
    { label: 'Feb 26', year: 2026 },
  ],
  providers: {
    'gmail.com': {
      overall: { sent: 39432, delivered: 31268, opened: 23528, clicked: 21759, bounced: 1073, unsubscribed: 0, complained: 0, deliveryRate: 79.3, openRate: 75.25, clickRate: 69.59, bounceRate: 2.72, unsubRate: 0, complaintRate: 0 },
      byDate: {
        'Feb 17': { sent: 2358, delivered: 2358, opened: 1755, clicked: 1623, bounced: 0, deliveryRate: 100, openRate: 74.43, clickRate: 68.83, bounceRate: 0 },
        'Feb 20': { sent: 786, delivered: 784, opened: 587, clicked: 538, bounced: 2, deliveryRate: 99.75, openRate: 74.87, clickRate: 68.62, bounceRate: 0.25 },
        'Feb 21': { sent: 12570, delivered: 12544, opened: 9612, clicked: 8906, bounced: 26, deliveryRate: 99.79, openRate: 76.63, clickRate: 71.0, bounceRate: 0.21 },
        'Feb 23': { sent: 7060, delivered: 7056, opened: 5211, clicked: 4832, bounced: 4, deliveryRate: 99.94, openRate: 73.85, clickRate: 68.48, bounceRate: 0.06 },
        'Feb 24': { sent: 2324, delivered: 2322, opened: 1720, clicked: 1587, bounced: 2, deliveryRate: 99.91, openRate: 74.07, clickRate: 68.35, bounceRate: 0.09 },
        'Feb 25': { sent: 6200, delivered: 6192, opened: 4634, clicked: 4266, bounced: 8, deliveryRate: 99.87, openRate: 74.84, clickRate: 68.9, bounceRate: 0.13 },
        'Feb 26': { sent: 1043, delivered: 12, opened: 9, clicked: 7, bounced: 1031, deliveryRate: 1.15, openRate: 75.0, clickRate: 58.33, bounceRate: 98.85 },
      },
    },
    'yahoo.com': {
      overall: { sent: 2355, delivered: 2170, opened: 1083, clicked: 1073, bounced: 0, deliveryRate: 92.14, openRate: 49.91, clickRate: 49.45, bounceRate: 0 },
      byDate: {
        'Feb 17': { sent: 144, delivered: 144, opened: 75, clicked: 72, bounced: 0, deliveryRate: 100, openRate: 52.08, clickRate: 50, bounceRate: 0 },
        'Feb 20': { sent: 47, delivered: 47, opened: 22, clicked: 21, bounced: 0, deliveryRate: 100, openRate: 46.81, clickRate: 44.68, bounceRate: 0 },
        'Feb 21': { sent: 752, delivered: 752, opened: 352, clicked: 350, bounced: 0, deliveryRate: 100, openRate: 46.81, clickRate: 46.54, bounceRate: 0 },
        'Feb 23': { sent: 423, delivered: 423, opened: 213, clicked: 210, bounced: 0, deliveryRate: 100, openRate: 50.35, clickRate: 49.65, bounceRate: 0 },
        'Feb 24': { sent: 141, delivered: 141, opened: 66, clicked: 66, bounced: 0, deliveryRate: 100, openRate: 46.81, clickRate: 46.81, bounceRate: 0 },
        'Feb 25': { sent: 376, delivered: 376, opened: 177, clicked: 177, bounced: 0, deliveryRate: 100, openRate: 47.07, clickRate: 47.07, bounceRate: 0 },
        'Feb 26': { sent: 287, delivered: 287, opened: 178, clicked: 177, bounced: 0, deliveryRate: 100, openRate: 62.02, clickRate: 61.67, bounceRate: 0 },
      },
    },
    'zohomail.in': {
      overall: { sent: 1400, delivered: 1200, opened: 874, clicked: 874, bounced: 0, deliveryRate: 85.71, openRate: 72.83, clickRate: 72.83, bounceRate: 0 },
      byDate: {
        'Feb 17': { sent: 90, delivered: 90, opened: 57, clicked: 57, bounced: 0, deliveryRate: 100, openRate: 63.33, clickRate: 63.33, bounceRate: 0 },
        'Feb 20': { sent: 30, delivered: 30, opened: 19, clicked: 19, bounced: 0, deliveryRate: 100, openRate: 63.33, clickRate: 63.33, bounceRate: 0 },
        'Feb 21': { sent: 480, delivered: 480, opened: 398, clicked: 398, bounced: 0, deliveryRate: 100, openRate: 82.92, clickRate: 82.92, bounceRate: 0 },
        'Feb 23': { sent: 270, delivered: 270, opened: 189, clicked: 189, bounced: 0, deliveryRate: 100, openRate: 70, clickRate: 70, bounceRate: 0 },
        'Feb 24': { sent: 90, delivered: 90, opened: 60, clicked: 60, bounced: 0, deliveryRate: 100, openRate: 66.67, clickRate: 66.67, bounceRate: 0 },
        'Feb 25': { sent: 240, delivered: 240, opened: 151, clicked: 151, bounced: 0, deliveryRate: 100, openRate: 62.92, clickRate: 62.92, bounceRate: 0 },
      },
    },
    'myyahoo.com': {
      overall: { sent: 235, delivered: 235, opened: 0, clicked: 0, bounced: 0, deliveryRate: 100, openRate: 0, clickRate: 0, bounceRate: 0 },
      byDate: {
        'Feb 17': { sent: 15, delivered: 15, opened: 0, clicked: 0, bounced: 0, deliveryRate: 100, openRate: 0, clickRate: 0, bounceRate: 0 },
        'Feb 20': { sent: 5, delivered: 5, opened: 0, clicked: 0, bounced: 0, deliveryRate: 100, openRate: 0, clickRate: 0, bounceRate: 0 },
        'Feb 21': { sent: 80, delivered: 80, opened: 0, clicked: 0, bounced: 0, deliveryRate: 100, openRate: 0, clickRate: 0, bounceRate: 0 },
        'Feb 23': { sent: 45, delivered: 45, opened: 0, clicked: 0, bounced: 0, deliveryRate: 100, openRate: 0, clickRate: 0, bounceRate: 0 },
        'Feb 24': { sent: 15, delivered: 15, opened: 0, clicked: 0, bounced: 0, deliveryRate: 100, openRate: 0, clickRate: 0, bounceRate: 0 },
        'Feb 25': { sent: 40, delivered: 40, opened: 0, clicked: 0, bounced: 0, deliveryRate: 100, openRate: 0, clickRate: 0, bounceRate: 0 },
        'Feb 26': { sent: 35, delivered: 35, opened: 0, clicked: 0, bounced: 0, deliveryRate: 100, openRate: 0, clickRate: 0, bounceRate: 0 },
      },
    },
  },
  domains: {
    'alerts.dailypromosdeal.com': {
      overall: { sent: 4614, delivered: 3517, opened: 2580, clicked: 2406, bounced: 156, deliveryRate: 76.22, openRate: 73.36, clickRate: 68.41, bounceRate: 3.38 },
      byDate: {
        'Feb 17': { sent: 869, delivered: 869, opened: 636, clicked: 588, bounced: 0, deliveryRate: 100, openRate: 73.19, clickRate: 67.66, bounceRate: 0 },
        'Feb 21': { sent: 1736, delivered: 1732, opened: 1295, clicked: 1210, bounced: 4, deliveryRate: 99.77, openRate: 74.77, clickRate: 69.86, bounceRate: 0.23 },
        'Feb 23': { sent: 867, delivered: 866, opened: 622, clicked: 581, bounced: 1, deliveryRate: 99.88, openRate: 71.82, clickRate: 67.09, bounceRate: 0.12 },
        'Feb 26': { sent: 201, delivered: 50, opened: 27, clicked: 27, bounced: 151, deliveryRate: 24.88, openRate: 54, clickRate: 54, bounceRate: 75.12 },
      },
    },
    'dealdivaz.com': {
      overall: { sent: 6489, delivered: 6055, opened: 4416, clicked: 4097, bounced: 7, deliveryRate: 93.31, openRate: 72.93, clickRate: 67.66, bounceRate: 0.11 },
      byDate: {
        'Feb 17': { sent: 869, delivered: 869, opened: 622, clicked: 579, bounced: 0, deliveryRate: 100, openRate: 71.58, clickRate: 66.63, bounceRate: 0 },
        'Feb 20': { sent: 868, delivered: 866, opened: 628, clicked: 578, bounced: 2, deliveryRate: 99.77, openRate: 72.52, clickRate: 66.74, bounceRate: 0.23 },
        'Feb 21': { sent: 1736, delivered: 1732, opened: 1298, clicked: 1210, bounced: 4, deliveryRate: 99.77, openRate: 74.94, clickRate: 69.86, bounceRate: 0.23 },
        'Feb 23': { sent: 1732, delivered: 1732, opened: 1247, clicked: 1156, bounced: 0, deliveryRate: 100, openRate: 72, clickRate: 66.74, bounceRate: 0 },
        'Feb 25': { sent: 857, delivered: 856, opened: 621, clicked: 574, bounced: 1, deliveryRate: 99.88, openRate: 72.55, clickRate: 67.06, bounceRate: 0.12 },
      },
    },
    'couponsdailypromo.com': {
      overall: { sent: 8322, delivered: 6934, opened: 5039, clicked: 4693, bounced: 10, deliveryRate: 83.32, openRate: 72.67, clickRate: 67.68, bounceRate: 0.12 },
      byDate: {
        'Feb 21': { sent: 1736, delivered: 1732, opened: 1294, clicked: 1205, bounced: 4, deliveryRate: 99.77, openRate: 74.71, clickRate: 69.57, bounceRate: 0.23 },
        'Feb 23': { sent: 1733, delivered: 1732, opened: 1249, clicked: 1165, bounced: 1, deliveryRate: 99.94, openRate: 72.11, clickRate: 67.26, bounceRate: 0.06 },
        'Feb 24': { sent: 1714, delivered: 1712, opened: 1231, clicked: 1145, bounced: 2, deliveryRate: 99.88, openRate: 71.9, clickRate: 66.88, bounceRate: 0.12 },
        'Feb 25': { sent: 1714, delivered: 1712, opened: 1238, clicked: 1151, bounced: 2, deliveryRate: 99.88, openRate: 72.31, clickRate: 67.23, bounceRate: 0.12 },
        'Feb 26': { sent: 47, delivered: 46, opened: 27, clicked: 27, bounced: 1, deliveryRate: 97.87, openRate: 58.7, clickRate: 58.7, bounceRate: 2.13 },
      },
    },
    'dailypromosdeal.com': {
      overall: { sent: 5541, delivered: 4362, opened: 3186, clicked: 2956, bounced: 799, deliveryRate: 78.72, openRate: 73.04, clickRate: 67.77, bounceRate: 14.42 },
      byDate: {
        'Feb 21': { sent: 1734, delivered: 1732, opened: 1296, clicked: 1204, bounced: 2, deliveryRate: 99.88, openRate: 74.83, clickRate: 69.52, bounceRate: 0.12 },
        'Feb 23': { sent: 867, delivered: 866, opened: 622, clicked: 582, bounced: 1, deliveryRate: 99.88, openRate: 71.82, clickRate: 67.21, bounceRate: 0.12 },
        'Feb 25': { sent: 1714, delivered: 1712, opened: 1240, clicked: 1143, bounced: 2, deliveryRate: 99.88, openRate: 72.43, clickRate: 66.76, bounceRate: 0.12 },
        'Feb 26': { sent: 846, delivered: 52, opened: 28, clicked: 27, bounced: 794, deliveryRate: 6.15, openRate: 53.85, clickRate: 51.92, bounceRate: 93.85 },
      },
    },
  },
  overallByDate: {
    'Feb 17': { sent: 2607, delivered: 2607, opened: 1887, clicked: 1752, bounced: 0, deliveryRate: 100, openRate: 72.38, clickRate: 67.2, bounceRate: 0 },
    'Feb 20': { sent: 868, delivered: 866, opened: 628, clicked: 578, bounced: 2, deliveryRate: 99.77, openRate: 72.52, clickRate: 66.74, bounceRate: 0.23 },
    'Feb 21': { sent: 13882, delivered: 13856, opened: 10362, clicked: 9654, bounced: 26, deliveryRate: 99.81, openRate: 74.78, clickRate: 69.67, bounceRate: 0.19 },
    'Feb 23': { sent: 7798, delivered: 7794, opened: 5613, clicked: 5231, bounced: 4, deliveryRate: 99.95, openRate: 72.02, clickRate: 67.12, bounceRate: 0.05 },
    'Feb 24': { sent: 2570, delivered: 2568, opened: 1846, clicked: 1713, bounced: 2, deliveryRate: 99.92, openRate: 71.88, clickRate: 66.71, bounceRate: 0.08 },
    'Feb 25': { sent: 6856, delivered: 6848, opened: 4962, clicked: 4594, bounced: 8, deliveryRate: 99.88, openRate: 72.46, clickRate: 67.09, bounceRate: 0.12 },
    'Feb 26': { sent: 1365, delivered: 334, opened: 187, clicked: 184, bounced: 1031, deliveryRate: 24.47, openRate: 55.99, clickRate: 55.09, bounceRate: 75.53 },
  },
  providerDomains: {},
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
