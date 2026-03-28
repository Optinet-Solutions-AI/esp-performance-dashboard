'use client'
import { useDashboardStore } from '@/lib/store'

interface KpiCardProps {
  label: string
  value: string | number
  delta?: React.ReactNode
  accent?: string
  onClick?: () => void
}

export default function KpiCard({ label, value, delta, accent = '#00e5c3', onClick }: KpiCardProps) {
  const isLight = useDashboardStore(s => s.isLight)

  return (
    <div
      onClick={onClick}
      className={`rounded-xl px-5 py-4 border transition-all duration-200
        ${onClick ? 'cursor-pointer' : ''}
        ${isLight
          ? 'bg-white border-black/10 hover:border-black/20'
          : 'bg-[#111418] border-white/7 hover:border-white/13'
        }`}
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className={`text-[10px] font-mono tracking-[0.1em] uppercase mb-1.5
        ${isLight ? 'text-gray-400' : 'text-[#a8b0be]'}`}>
        {label}
      </div>
      <div className={`text-2xl font-bold tracking-tight leading-none mb-1.5
        ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>
        {value}
      </div>
      {delta && (
        <div className="text-[11px] flex items-center gap-1">{delta}</div>
      )}
    </div>
  )
}
