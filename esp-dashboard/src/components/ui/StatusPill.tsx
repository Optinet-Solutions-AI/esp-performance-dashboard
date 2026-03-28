'use client'
import type { EspStatus } from '@/lib/types'

const PILL_STYLES: Record<EspStatus, string> = {
  healthy: 'text-[#00e5c3] bg-[#00e5c3]/10 border-[#00e5c3]/30',
  warn:    'text-[#ffd166] bg-[#ffd166]/10 border-[#ffd166]/30',
  critical:'text-[#ff4757] bg-[#ff4757]/10 border-[#ff4757]/30',
}
const PILL_DOTS: Record<EspStatus, string> = {
  healthy: 'bg-[#00e5c3]',
  warn:    'bg-[#ffd166]',
  critical:'bg-[#ff4757]',
}
const PILL_LABELS: Record<EspStatus, string> = {
  healthy: 'HEALTHY', warn: 'WARN', critical: 'CRITICAL',
}

export default function StatusPill({ status, short }: { status: EspStatus; short?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border font-mono text-[9px] font-bold tracking-wider
      ${PILL_STYLES[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${PILL_DOTS[status]}`} />
      {short ? status.toUpperCase().slice(0, 4) : PILL_LABELS[status]}
    </span>
  )
}
