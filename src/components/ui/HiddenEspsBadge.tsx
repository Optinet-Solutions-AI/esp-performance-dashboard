'use client'
import { useDashboardStore } from '@/lib/store'

export default function HiddenEspsBadge() {
  const { hiddenEsps, espData, isLight, setView } = useDashboardStore()
  if (hiddenEsps.length === 0) return null

  const totalEsps = Object.keys(espData).length
  const allHidden = totalEsps > 0 && hiddenEsps.length >= totalEsps
  const label = allHidden
    ? 'All ESPs hidden — show some'
    : `${hiddenEsps.length} ESP${hiddenEsps.length > 1 ? 's' : ''} hidden — show all`

  const bg = isLight ? 'rgba(180,83,9,0.08)' : 'rgba(255,209,102,0.08)'
  const border = isLight ? 'rgba(180,83,9,0.25)' : 'rgba(255,209,102,0.25)'
  const color = isLight ? '#b45309' : '#ffd166'
  const focusRing = isLight ? 'rgba(180,83,9,0.45)' : 'rgba(255,209,102,0.45)'

  function handleClick() {
    setView('datamgmt')
    // Scroll the visibility section into view after the view switch renders.
    setTimeout(() => {
      document.getElementById('esp-visibility-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  return (
    <button
      onClick={handleClick}
      aria-label={`${label}. Manage ESP visibility.`}
      title="Manage ESP visibility"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', borderRadius: 999,
        fontSize: 11, fontFamily: 'Space Mono, monospace', fontWeight: 600,
        letterSpacing: '0.04em',
        background: bg, color, border: `1px solid ${border}`,
        cursor: 'pointer', transition: 'opacity 0.15s, box-shadow 0.15s',
        outline: 'none',
      }}
      onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
      onFocus={e => { e.currentTarget.style.boxShadow = `0 0 0 2px ${focusRing}` }}
      onBlur={e => { e.currentTarget.style.boxShadow = 'none' }}
    >
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
        <path d="M2 8c2-3 4-5 6-5s4 2 6 5c-2 3-4 5-6 5s-4-2-6-5z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 2l12 12" strokeLinecap="round" />
      </svg>
      <span>{label}</span>
    </button>
  )
}
