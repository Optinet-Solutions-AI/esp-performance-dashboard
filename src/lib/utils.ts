import type { MmData, DateMetrics, EspRecord, EspStatus } from './types'

export const fmtN = (n: number): string => {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return String(Math.round(n))
}

export const fmtP = (n: number, d = 1): string => n.toFixed(d) + '%'

export function getEspStatus(bounceRate: number, deliveryRate: number): EspStatus {
  if (bounceRate > 10 || deliveryRate < 70) return 'critical'
  if (bounceRate > 2 || deliveryRate < 95) return 'warn'
  return 'healthy'
}

export function aggDates(
  byDate: Record<string, DateMetrics>,
  dates: string[]
): DateMetrics | null {
  let sent = 0, delivered = 0, opened = 0, clicked = 0,
    bounced = 0, unsubscribed = 0, complained = 0

  dates.forEach(d => {
    const r = byDate[d]
    if (!r) return
    sent += r.sent || 0
    delivered += r.delivered || 0
    opened += r.opened || 0
    clicked += r.clicked || 0
    bounced += r.bounced || 0
    unsubscribed += r.unsubscribed || 0
    complained += r.complained || 0
  })

  if (sent === 0) return null

  return {
    sent, delivered, opened, clicked, bounced, unsubscribed, complained,
    deliveryRate: (delivered / sent) * 100,
    successRate: (delivered / sent) * 100,
    openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
    clickRate: opened > 0 ? (clicked / opened) * 100 : 0,
    bounceRate: (bounced / sent) * 100,
    unsubRate: opened > 0 ? (unsubscribed / opened) * 100 : 0,
    complaintRate: delivered > 0 ? (complained / delivered) * 100 : 0,
  }
}

export function buildProviderDomains(data: MmData): MmData['providerDomains'] {
  const pd: MmData['providerDomains'] = {}

  data.dates.forEach(date => {
    const provTotal = Object.values(data.providers).reduce((s, p) => {
      const r = p.byDate[date]
      return r ? s + r.sent : s
    }, 0)
    if (!provTotal) return

    Object.entries(data.providers).forEach(([prov, pData]) => {
      const pr = pData.byDate[date]
      if (!pr || !pr.sent) return
      const pFrac = pr.sent / provTotal

      Object.entries(data.domains).forEach(([dom, dData]) => {
        const dr = dData.byDate[date]
        if (!dr || !dr.sent) return
        const domSent = Math.round(dr.sent * pFrac)
        if (!domSent) return

        if (!pd[prov]) pd[prov] = {}
        if (!pd[prov][dom]) pd[prov][dom] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 }
        const x = pd[prov][dom]
        x.sent += Math.round(dr.sent * pFrac)
        x.delivered += Math.round(dr.delivered * pFrac)
        x.opened += Math.round(dr.opened * pFrac)
        x.clicked += Math.round(dr.clicked * pFrac)
        x.bounced += Math.round(dr.bounced * pFrac)
        x.unsubscribed += Math.round((dr.unsubscribed || 0) * pFrac)
      })
    })
  })

  return pd
}

export function syncEspFromData(
  esp: EspRecord,
  data: MmData
): EspRecord {
  const dates = data.dates
  let sent = 0, delivered = 0, opened = 0, clicked = 0, bounced = 0, unsub = 0
  dates.forEach(d => {
    const r = data.overallByDate[d]
    if (r) {
      sent += r.sent || 0
      delivered += r.delivered || 0
      opened += r.opened || 0
      clicked += r.clicked || 0
      bounced += r.bounced || 0
      unsub += r.unsubscribed || 0
    }
  })
  if (sent === 0) return esp

  const deliveryRate = (delivered / sent) * 100
  const openRate = delivered > 0 ? (opened / delivered) * 100 : 0
  const clickRate = opened > 0 ? (clicked / opened) * 100 : 0
  const bounceRate = (bounced / sent) * 100
  const unsubRate = opened > 0 ? (unsub / opened) * 100 : 0

  return {
    ...esp,
    sent, delivered, opens: opened, clicks: clicked, bounced, unsub,
    deliveryRate, openRate, clickRate, bounceRate, unsubRate,
    status: getEspStatus(bounceRate, deliveryRate),
  }
}

export function exportCSV(rows: EspRecord[]): void {
  const headers = ['ESP', 'Sent', 'Delivered', 'Delivery%', 'Opens', 'Open%', 'Clicks', 'Click%', 'Bounced', 'Bounce%', 'Unsub']
  const data = rows.map(d => [
    d.name, d.sent, d.delivered, d.deliveryRate.toFixed(2),
    d.opens, d.openRate.toFixed(2), d.clicks, d.clickRate.toFixed(2),
    d.bounced, d.bounceRate.toFixed(2), d.unsub,
  ])
  const csv = [headers, ...data].map(r => r.join(',')).join('\n')
  const a = document.createElement('a')
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
  a.download = 'esp_performance.csv'
  a.click()
}

export const CHART_TOOLTIP_OPTS = {
  backgroundColor: '#1a1e26',
  titleColor: '#f0f2f5',
  bodyColor: '#e8ecf2',
  borderColor: 'rgba(255,255,255,0.1)',
  borderWidth: 1,
}

export const getGridColor = (isLight: boolean) =>
  isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.05)'

export const getTextColor = (isLight: boolean) =>
  isLight ? '#111827' : '#c8cdd6'
