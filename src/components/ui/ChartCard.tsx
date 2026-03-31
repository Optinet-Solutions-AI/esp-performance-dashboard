'use client'
import { useDashboardStore } from '@/lib/store'

interface ChartCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  legend?: React.ReactNode
  className?: string
  height?: number
  action?: React.ReactNode
}

export default function ChartCard({ title, subtitle, children, legend, className = '', height = 160, action }: ChartCardProps) {
  const isLight = useDashboardStore(s => s.isLight)

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all duration-200
      ${isLight
        ? 'bg-white border-black/8 hover:border-black/14'
        : 'bg-[#111418] border-white/6 hover:border-white/10'
      }
      ${className}`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-5 py-4 border-b
        ${isLight ? 'border-black/6' : 'border-white/5'}`}>
        <div>
          <div className={`text-[13px] font-semibold ${isLight ? 'text-gray-800' : 'text-[#e8eaf0]'}`}>
            {title}
          </div>
          {subtitle && (
            <div className={`text-[11px] mt-0.5 ${isLight ? 'text-gray-400' : 'text-[#5a6478]'}`}>
              {subtitle}
            </div>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>

      {/* Body */}
      <div className="px-5 pt-4 pb-5">
        <div style={{ height }} className="relative w-full">
          {children}
        </div>
        {legend && (
          <div className={`flex flex-wrap gap-3 mt-4 pt-3 border-t ${isLight ? 'border-black/6' : 'border-white/5'}`}>
            {legend}
          </div>
        )}
      </div>
    </div>
  )
}

export function LegendItem({ color, label }: { color: string; label: string }) {
  const isLight = useDashboardStore(s => s.isLight)
  return (
    <div className={`flex items-center gap-2 text-[11px] font-mono ${isLight ? 'text-gray-500' : 'text-[#a8b0be]'}`}>
      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
      {label}
    </div>
  )
}
