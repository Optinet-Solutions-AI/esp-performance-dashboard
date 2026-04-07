'use client'
import { useDashboardStore } from '@/lib/store'

interface KpiCardProps {
  label: string
  value: string | number
  delta?: React.ReactNode
  accent?: string
  icon?: React.ReactNode
  onClick?: () => void
}

export default function KpiCard({ label, value, delta, accent = '#00e5c3', icon, onClick }: KpiCardProps) {
  const isLight = useDashboardStore(s => s.isLight)

  return (
    <div
      onClick={onClick}
      className={`relative rounded-2xl px-5 py-5 border overflow-hidden transition-all duration-200 group
        ${onClick ? 'cursor-pointer' : ''}
        ${isLight
          ? 'bg-white border-black/[0.09] shadow-sm hover:border-black/[0.16] hover:shadow-md hover:shadow-black/[0.07]'
          : 'bg-[#111418] border-white/6 hover:border-white/12 hover:shadow-xl hover:shadow-black/30'
        }`}
    >
      {/* Top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, ${accent}, ${accent}44)` }} />

      {/* Subtle bg glow */}
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-[0.06] pointer-events-none"
        style={{ background: accent }} />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className={`text-[10px] font-mono tracking-[0.12em] uppercase mb-2.5 select-none
            ${isLight ? 'text-[#64748b]' : 'text-[#5a6478]'}`}>
            {label}
          </div>
          <div className={`text-[26px] font-bold tracking-tight leading-none mb-2
            ${isLight ? 'text-[#0f172a]' : 'text-[#f0f2f5]'}`}>
            {value}
          </div>
          {delta && (
            <div className="text-[11px] flex items-center gap-1 leading-none">{delta}</div>
          )}
        </div>
        {icon && (
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 transition-transform group-hover:scale-110"
            style={{ background: `${accent}18`, color: accent }}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
