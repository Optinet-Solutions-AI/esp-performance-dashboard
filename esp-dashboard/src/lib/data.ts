import type { EspRecord, DailyRecord, MmData, IpmRecord } from './types'

export const INITIAL_ESPS: EspRecord[] = []

export const ESP_COLORS: Record<string, string> = {
  Mailmodo: '#7c5cfc',
  Ongage: '#c67cff',
  Hotsol: '#00e5c3',
  MMS: '#ffd166',
  Moosend: '#ff6b35',
  Omnisend: '#ff4757',
  Klaviyo: '#60d4f0',
  Brevo: '#c5f27a',
}

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
