'use client'
import { useState } from 'react'
import { useDashboardStore } from '@/lib/store'
import type { ViewName } from '@/lib/types'

const STATUS_LABEL = { healthy: 'OK', warn: 'WARN', critical: 'CRIT' } as const
const STATUS_COLOR = {
  healthy: 'text-[#00e5c3] border-[#00e5c3]/30 bg-[#00e5c3]/10',
  warn: 'text-[#ffd166] border-[#ffd166]/30 bg-[#ffd166]/10',
  critical: 'text-[#ff4757] border-[#ff4757]/30 bg-[#ff4757]/10',
} as const

export default function Sidebar() {
  const { activeView, setView, isLight, toggleTheme, esps, activeEsp, setActiveEsp } = useDashboardStore()
  const [providersOpen, setProvidersOpen] = useState(true)
  const [espListOpen, setEspListOpen] = useState(false)

  function navTo(v: ViewName) {
    setView(v)
  }

  const navItem = (id: ViewName, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => navTo(id)}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer
        ${activeView === id
          ? 'bg-[#00e5c3]/10 text-[#00e5c3] border border-[#00e5c3]/20'
          : isLight
            ? 'text-gray-600 hover:bg-black/5 hover:text-gray-900 border border-transparent'
            : 'text-[#a8b0be] hover:bg-white/5 hover:text-[#f0f2f5] border border-transparent'
        }`}
    >
      <span className="w-4 h-4 flex-shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  )

  return (
    <aside className={`w-[220px] flex-shrink-0 flex flex-col h-screen sticky top-0 border-r z-10
      ${isLight ? 'bg-white border-black/10' : 'bg-[#111418] border-white/7'}`}
    >
      {/* Logo */}
      <button
        onClick={() => navTo('home')}
        className="px-5 pt-5 pb-4 text-left group flex-shrink-0"
      >
        <div className={`text-[9px] font-mono tracking-[0.15em] uppercase mb-0.5
          ${isLight ? 'text-gray-400' : 'text-[#a8b0be]'}`}>
          Email Ops
        </div>
        <div className={`text-[17px] font-bold tracking-tight
          ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>
          ESP Control
        </div>
      </button>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        <div className={`text-[9px] font-mono tracking-[0.12em] uppercase px-2 mb-2
          ${isLight ? 'text-gray-400' : 'text-[#a8b0be]'}`}>
          Navigation
        </div>

        {/* Email Providers group */}
        <div>
          <button
            onClick={() => setProvidersOpen(p => !p)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-150
              ${isLight ? 'text-gray-600 hover:bg-black/5' : 'text-[#a8b0be] hover:bg-white/5'}`}
          >
            <span className="flex items-center gap-2.5">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="2" width="14" height="3" rx="1" />
                <path d="M3 7h10M3 7l-1 6h10l-1-6" />
                <path d="M6 10h4" />
              </svg>
              Email Providers
            </span>
            <span className="text-xs opacity-50">{providersOpen ? '▼' : '▶'}</span>
          </button>

          {providersOpen && (
            <div className="ml-3 mt-0.5 space-y-0.5">
              <button
                onClick={() => { useDashboardStore.getState().setActiveReviewCtx('mailmodo'); navTo('mailmodo') }}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-150
                  ${activeView === 'mailmodo'
                    ? 'bg-[#7c5cfc]/10 text-[#7c5cfc] border border-[#7c5cfc]/20'
                    : isLight ? 'text-gray-500 hover:text-gray-800 hover:bg-black/5' : 'text-[#a8b0be] hover:text-[#f0f2f5] hover:bg-white/5'
                  }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="6" /><path d="M5 8l2 2 4-4" />
                </svg>
                Mailmodo Review
              </button>
              <button
                onClick={() => { useDashboardStore.getState().setActiveReviewCtx('ongage'); navTo('ongage') }}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-150
                  ${activeView === 'ongage'
                    ? 'bg-[#ffd166]/10 text-[#ffd166] border border-[#ffd166]/20'
                    : isLight ? 'text-gray-500 hover:text-gray-800 hover:bg-black/5' : 'text-[#a8b0be] hover:text-[#f0f2f5] hover:bg-white/5'
                  }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="6" /><path d="M5 8l2 2 4-4" />
                </svg>
                Ongage Review
              </button>
            </div>
          )}
        </div>

        {navItem('upload', 'Upload Report', (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 10V2M5 5l3-3 3 3" /><rect x="2" y="11" width="12" height="3" rx="1" />
          </svg>
        ))}
        {navItem('matrix', 'Deliverability Matrix', (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="1" width="14" height="3" rx="1" />
            <rect x="1" y="6" width="14" height="3" rx="1" />
            <rect x="1" y="11" width="14" height="3" rx="1" />
          </svg>
        ))}
        {navItem('datamgmt', 'Data Management', (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <ellipse cx="8" cy="4" rx="6" ry="2" />
            <path d="M2 4v4c0 1.1 2.7 2 6 2s6-.9 6-2V4" />
            <path d="M2 8v4c0 1.1 2.7 2 6 2s6-.9 6-2V8" />
          </svg>
        ))}
        {navItem('ipmatrix', 'IPs Matrix', (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="3" width="14" height="10" rx="2" />
            <path d="M5 7h6M5 10h4" />
          </svg>
        ))}

        {/* ESP provider list */}
        <div className="pt-2">
          <button
            onClick={() => setEspListOpen(p => !p)}
            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-mono tracking-widest uppercase transition-all
              ${isLight ? 'text-gray-400 hover:text-gray-600' : 'text-[#a8b0be] hover:text-[#d4dae6]'}`}
          >
            <span>Providers</span>
            <span className="opacity-50">{espListOpen ? '▼' : '▶'}</span>
          </button>
          {espListOpen && (
            <div className="mt-1 space-y-0.5">
              {esps.map(e => (
                <button
                  key={e.name}
                  onClick={() => setActiveEsp(e.name)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-all
                    ${activeEsp === e.name
                      ? 'bg-white/8 ' + (isLight ? 'text-gray-900' : 'text-[#f0f2f5]')
                      : isLight ? 'text-gray-500 hover:bg-black/5' : 'text-[#a8b0be] hover:bg-white/5'
                    }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-4 rounded-sm flex-shrink-0" style={{ background: e.color }} />
                    {e.name}
                  </span>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${STATUS_COLOR[e.status]}`}>
                    {STATUS_LABEL[e.status]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-3 pb-4 pt-2 border-t border-white/7">
        <div className={`text-[10px] font-mono px-2 mb-2 ${isLight ? 'text-gray-400' : 'text-[#6b7280]'}`}>
          {esps.length} providers loaded
        </div>
        <button
          onClick={toggleTheme}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-[10px] font-mono tracking-widest uppercase transition-all
            ${isLight
              ? 'bg-gray-100 border-black/15 text-gray-500 hover:border-[#009e88] hover:text-gray-900'
              : 'bg-[#181c22] border-white/13 text-[#a8b0be] hover:border-[#00e5c3] hover:text-[#f0f2f5]'
            }`}
        >
          <span id="themeLabel">{isLight ? '☀ Light mode' : '🌙 Dark mode'}</span>
          <span className={`w-8 h-[18px] rounded-full relative flex-shrink-0 border transition-all
            ${isLight ? 'bg-[#009e88] border-[#009e88]' : 'bg-[#1e232b] border-white/13'}`}>
            <span className={`w-3 h-3 rounded-full absolute top-[2px] transition-all
              ${isLight ? 'left-[16px] bg-white' : 'left-[2px] bg-[#a8b0be]'}`} />
          </span>
        </button>
      </div>
    </aside>
  )
}
