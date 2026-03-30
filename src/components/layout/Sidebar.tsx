'use client'
import { useState } from 'react'
import { useDashboardStore } from '@/lib/store'
import type { ViewName } from '@/lib/types'

const STATUS_LABEL = { healthy: 'OK', warn: 'WARN', critical: 'CRIT' } as const
const STATUS_COLORS = {
  healthy: { color: '#00e5c3', bg: 'rgba(0,229,195,0.08)', border: 'rgba(0,229,195,0.25)' },
  warn:    { color: '#ffd166', bg: 'rgba(255,209,102,0.08)', border: 'rgba(255,209,102,0.25)' },
  critical:{ color: '#ff4757', bg: 'rgba(255,71,87,0.08)',  border: 'rgba(255,71,87,0.25)' },
} as const

interface SidebarProps { onClose?: () => void }

export default function Sidebar({ onClose }: SidebarProps) {
  const { activeView, setView, isLight, toggleTheme, esps, activeEsp, setActiveEsp } = useDashboardStore()
  const [providersOpen, setProvidersOpen] = useState(true)
  const [espListOpen, setEspListOpen] = useState(false)

  function navTo(v: ViewName) { setView(v); onClose?.() }

  const bg = isLight ? '#ffffff' : '#0e1116'
  const borderColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.05)'
  const mutedColor = isLight ? '#9ca3af' : '#4a5568'
  const textColor = isLight ? '#374151' : '#8a94a6'
  const textHover = isLight ? '#111827' : '#d4dae6'
  const activeAccent = '#00e5c3'
  const activeBg = isLight ? 'rgba(0,229,195,0.1)' : 'rgba(0,229,195,0.08)'
  const activeText = isLight ? '#007a67' : '#00e5c3'
  const hoverBg = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)'

  const NavItem = ({ id, label, icon }: { id: ViewName; label: string; icon: React.ReactNode }) => {
    const active = activeView === id
    return (
      <button
        onClick={() => navTo(id)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: active ? 600 : 400, textAlign: 'left',
          background: active ? activeBg : 'transparent',
          color: active ? activeText : textColor,
          transition: 'background 0.12s, color 0.12s',
        }}
        onMouseEnter={e => { if (!active) { e.currentTarget.style.background = hoverBg; e.currentTarget.style.color = textHover } }}
        onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = textColor } }}
      >
        <span style={{ width: 18, height: 18, flexShrink: 0, opacity: active ? 1 : 0.55, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        {active && <span style={{ width: 5, height: 5, borderRadius: '50%', background: activeAccent, flexShrink: 0 }} />}
      </button>
    )
  }

  const SectionLabel = ({ text }: { text: string }) => (
    <div style={{
      fontSize: 9, fontFamily: 'Space Mono, monospace', letterSpacing: '0.15em',
      textTransform: 'uppercase', color: mutedColor,
      padding: '16px 12px 6px',
    }}>
      {text}
    </div>
  )

  const iconHome = <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ width: 18, height: 18 }}><path d="M1.5 8L9 1.5l7.5 6.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M3.5 7v8.5h4v-4.5h3v4.5h4V7" strokeLinecap="round" strokeLinejoin="round" /></svg>
  const iconDash = <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ width: 18, height: 18 }}><rect x="1.5" y="1.5" width="6" height="6" rx="1.5" /><rect x="10.5" y="1.5" width="6" height="6" rx="1.5" /><rect x="1.5" y="10.5" width="6" height="6" rx="1.5" /><rect x="10.5" y="10.5" width="6" height="6" rx="1.5" /></svg>
  const iconPerf = <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ width: 18, height: 18 }}><polyline points="1.5,14 5,9 9,11 13,5 16.5,7" strokeLinecap="round" strokeLinejoin="round" /></svg>
  const iconCal  = <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ width: 18, height: 18 }}><rect x="1.5" y="3" width="15" height="13" rx="2" /><path d="M6 3V1.5M12 3V1.5M1.5 7h15" strokeLinecap="round" /></svg>
  const iconChart= <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ width: 18, height: 18 }}><polyline points="1.5,14.5 5,9 8,11 11.5,5.5 15,8 16.5,3.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  const iconUp   = <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ width: 18, height: 18 }}><path d="M9 11.5V3M6 6l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" /><rect x="2" y="12.5" width="14" height="3.5" rx="1.5" /></svg>
  const iconGrid = <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ width: 18, height: 18 }}><rect x="1.5" y="1.5" width="15" height="3" rx="1" /><rect x="1.5" y="7.5" width="15" height="3" rx="1" /><rect x="1.5" y="13.5" width="15" height="3" rx="1" /></svg>
  const iconDb   = <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ width: 18, height: 18 }}><ellipse cx="9" cy="4.5" rx="6" ry="2.5" /><path d="M3 4.5v4.5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V4.5" strokeLinecap="round" /><path d="M3 9v4.5C3 14.9 5.7 16 9 16s6-1.1 6-2.5V9" strokeLinecap="round" /></svg>
  const iconIP   = <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ width: 18, height: 18 }}><rect x="1.5" y="3.5" width="15" height="11" rx="2.5" /><path d="M5.5 8h7M5.5 11h5" strokeLinecap="round" /></svg>
  const iconEmail= <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ width: 18, height: 18 }}><rect x="1.5" y="3.5" width="15" height="11" rx="2" /><path d="M1.5 7l7.5 5 7.5-5" strokeLinecap="round" /></svg>

  return (
    <aside style={{
      width: '100%', height: '100vh', display: 'flex', flexDirection: 'column',
      background: bg, borderRight: `1px solid ${borderColor}`,
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: `1px solid ${borderColor}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <button onClick={() => navTo('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
            <div style={{ fontSize: 9, fontFamily: 'Space Mono,monospace', letterSpacing: '0.2em', textTransform: 'uppercase', color: mutedColor, marginBottom: 3 }}>
              Email Ops
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}>
              <span style={{ color: isLight ? '#111827' : '#f0f2f5' }}>ESP</span>
              <span style={{ color: activeAccent }}> Control</span>
            </div>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent',
                cursor: 'pointer', color: mutedColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
        <SectionLabel text="Main" />
        <NavItem id="home" label="Overview" icon={iconHome} />
        <NavItem id="dashboard" label="Dashboard" icon={iconDash} />
        <NavItem id="performance" label="Performance" icon={iconPerf} />
        <NavItem id="daily" label="Daily Report" icon={iconCal} />

        <SectionLabel text="Providers" />

        {/* Email Providers group */}
        <button
          onClick={() => setProvidersOpen(p => !p)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 400, textAlign: 'left',
            background: 'transparent', color: textColor, transition: 'background 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = hoverBg }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <span style={{ width: 18, height: 18, flexShrink: 0, opacity: 0.55 }}>{iconEmail}</span>
          <span style={{ flex: 1 }}>Email Providers</span>
          <span style={{ fontSize: 10, opacity: 0.5, transition: 'transform 0.2s', transform: providersOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
        </button>

        {providersOpen && (
          <div style={{ marginLeft: 16, paddingLeft: 12, borderLeft: '1px solid rgba(0,229,195,0.2)', marginTop: 2, marginBottom: 4 }}>
            {[
              { id: 'mailmodo' as ViewName, label: 'Mailmodo Review', color: '#7c5cfc', ctx: 'mailmodo' as const },
              { id: 'ongage' as ViewName, label: 'Ongage Review', color: '#ffd166', ctx: 'ongage' as const },
            ].map(item => {
              const active = activeView === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => navTo(item.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    fontSize: 12.5, fontWeight: active ? 600 : 400, textAlign: 'left',
                    background: active ? `${item.color}14` : 'transparent',
                    color: active ? item.color : textColor,
                    transition: 'background 0.12s, color 0.12s',
                  }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = hoverBg; e.currentTarget.style.color = textHover } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = textColor } }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: item.color, flexShrink: 0, opacity: 0.85 }} />
                  {item.label}
                </button>
              )
            })}
          </div>
        )}

        <SectionLabel text="Charts" />
        <NavItem id="mmcharts" label="Mailmodo Charts" icon={iconChart} />
        <NavItem id="ogcharts" label="Ongage Charts" icon={iconChart} />

        <SectionLabel text="Tools" />
        <NavItem id="upload" label="Upload Report" icon={iconUp} />
        <NavItem id="matrix" label="Deliverability" icon={iconGrid} />
        <NavItem id="datamgmt" label="Data Mgmt" icon={iconDb} />
        <NavItem id="ipmatrix" label="IPs Matrix" icon={iconIP} />

        {/* Active ESP list */}
        {(() => {
          const activeEsps = esps.filter(e => e.sent > 0)
          if (activeEsps.length === 0) return null
          return (
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => setEspListOpen(p => !p)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 12px 6px', fontSize: 9, fontFamily: 'Space Mono,monospace',
                  letterSpacing: '0.15em', textTransform: 'uppercase', background: 'none', border: 'none',
                  cursor: 'pointer', color: mutedColor,
                }}
              >
                <span>Active ESPs ({activeEsps.length})</span>
                <span style={{ transition: 'transform 0.2s', transform: espListOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
              </button>
              {espListOpen && activeEsps.map(e => {
                const sc = STATUS_COLORS[e.status]
                return (
                  <button
                    key={e.name}
                    onClick={() => setActiveEsp(e.name)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: activeEsp === e.name ? 600 : 400,
                      background: activeEsp === e.name ? hoverBg : 'transparent',
                      color: activeEsp === e.name ? (isLight ? '#111827' : '#f0f2f5') : textColor,
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={ev => { ev.currentTarget.style.background = hoverBg }}
                    onMouseLeave={ev => { if (activeEsp !== e.name) ev.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span style={{ width: 3, height: 20, borderRadius: 99, background: e.color, flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                    </span>
                    <span style={{
                      fontSize: 9, fontFamily: 'Space Mono,monospace', fontWeight: 700,
                      padding: '3px 7px', borderRadius: 6,
                      color: sc.color, background: sc.bg, border: `1px solid ${sc.border}`,
                      flexShrink: 0,
                    }}>
                      {STATUS_LABEL[e.status]}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })()}
      </nav>

      {/* Footer */}
      <div style={{ flexShrink: 0, padding: '12px 8px 16px', borderTop: `1px solid ${borderColor}` }}>
        <button
          onClick={toggleTheme}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderRadius: 12, border: `1px solid ${borderColor}`, cursor: 'pointer',
            fontSize: 11, fontFamily: 'Space Mono,monospace', letterSpacing: '0.12em', textTransform: 'uppercase',
            background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
            color: textColor, transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = isLight ? '#d1d5db' : 'rgba(255,255,255,0.15)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = borderColor }}
        >
          <span>{isLight ? '☀ Light' : '🌙 Dark'}</span>
          <span style={{
            width: 36, height: 20, borderRadius: 99, flexShrink: 0, position: 'relative', display: 'inline-block',
            background: isLight ? '#00c4a7' : '#2d3748',
            border: `1px solid ${isLight ? '#00c4a7' : 'rgba(255,255,255,0.1)'}`,
            transition: 'background 0.2s',
          }}>
            <span style={{
              width: 14, height: 14, borderRadius: '50%', position: 'absolute', top: 2,
              left: isLight ? 19 : 2,
              background: isLight ? '#ffffff' : '#6b7280',
              transition: 'left 0.2s',
            }} />
          </span>
        </button>
        <div style={{ fontSize: 10, fontFamily: 'Space Mono,monospace', textAlign: 'center', marginTop: 10, color: isLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.12)' }}>
          {esps.length} provider{esps.length !== 1 ? 's' : ''} loaded
        </div>
      </div>
    </aside>
  )
}
