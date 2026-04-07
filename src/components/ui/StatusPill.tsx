'use client'
import { useDashboardStore } from '@/lib/store'
import type { EspStatus } from '@/lib/types'

const PILL_STYLES_DARK: Record<EspStatus, string> = {
  healthy: 'text-[#00e5c3] bg-[#00e5c3]/10 border-[#00e5c3]/30',
  warn:    'text-[#ffd166] bg-[#ffd166]/10 border-[#ffd166]/30',
  critical:'text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/30',
}
const PILL_STYLES_LIGHT: Record<EspStatus, string> = {
  healthy: 'text-[#006a5b] bg-[#006a5b]/10 border-[#006a5b]/25',
  warn:    'text-[#b45309] bg-[#b45309]/8 border-[#b45309]/20',
  critical:'text-[#dc2626] bg-[#dc2626]/7 border-[#dc2626]/18',
}
const PILL_DOTS_DARK: Record<EspStatus, string> = {
  healthy: 'bg-[#00e5c3]',
  warn:    'bg-[#ffd166]',
  critical:'bg-[#ff4757]',
}
const PILL_DOTS_LIGHT: Record<EspStatus, string> = {
  healthy: 'bg-[#006a5b]',
  warn:    'bg-[#b45309]',
  critical:'bg-[#dc2626]',
}
const PILL_LABELS: Record<EspStatus, string> = {
  healthy: 'HEALTHY', warn: 'WARN', critical: 'CRITICAL',
}

export default function StatusPill({ status, short }: { status: EspStatus; short?: boolean }) {
  const isLight = useDashboardStore(s => s.isLight)
  const pillStyles = isLight ? PILL_STYLES_LIGHT : PILL_STYLES_DARK
  const pillDots   = isLight ? PILL_DOTS_LIGHT   : PILL_DOTS_DARK
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border font-mono text-[9px] font-bold tracking-wider
      ${pillStyles[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${pillDots[status]}`} />
      {short ? status.toUpperCase().slice(0, 4) : PILL_LABELS[status]}
    </span>
  )
}
