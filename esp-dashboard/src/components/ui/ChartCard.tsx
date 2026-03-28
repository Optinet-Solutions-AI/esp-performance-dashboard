'use client'
import { useDashboardStore } from '@/lib/store'

interface ChartCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  legend?: React.ReactNode
  className?: string
  height?: number
}

export default function ChartCard({ title, subtitle, children, legend, className = '', height = 160 }: ChartCardProps) {
  const isLight = useDashboardStore(s => s.isLight)

  return (
    <div className={`rounded-xl border p-5 transition-colors
      ${isLight ? 'bg-white border-black/10 hover:border-black/20' : 'bg-[#111418] border-white/7 hover:border-white/13'}
      ${className}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className={`text-[13px] font-medium ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>
            {title}
          </div>
          {subtitle && (
            <div className="text-[11px] font-mono text-[#c8cdd6] mt-0.5">{subtitle}</div>
          )}
        </div>
      </div>
      <div style={{ height }} className="relative w-full">
        {children}
      </div>
      {legend && <div className="flex flex-wrap gap-3 mt-3">{legend}</div>}
    </div>
  )
}

export function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#a8b0be] cursor-pointer hover:text-[#f0f2f5] transition-colors">
      <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: color }} />
      {label}
    </div>
  )
}
