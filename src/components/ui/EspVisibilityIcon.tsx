'use client'
import { useDashboardStore } from '@/lib/store'

export default function EspVisibilityIcon({ espName, size = 14 }: { espName: string; size?: number }) {
  const { hiddenEsps, isLight, toggleEspVisibility } = useDashboardStore()
  const isHidden = hiddenEsps.includes(espName)

  const color = isLight
    ? (isHidden ? '#b45309' : '#64748b')
    : (isHidden ? '#ffd166' : '#a8b0be')

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        toggleEspVisibility(espName)
      }}
      title={isHidden ? `Show ${espName}` : `Hide ${espName} from all views`}
      aria-label={isHidden ? `Show ${espName}` : `Hide ${espName} from all views`}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size + 10, height: size + 10, borderRadius: 6,
        background: 'transparent', border: 'none', cursor: 'pointer',
        color, transition: 'background 0.12s, color 0.12s',
        outline: 'none',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
      onFocus={e => { e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }}
      onBlur={e => { e.currentTarget.style.background = 'transparent' }}
    >
      {isHidden ? (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
          <path d="M2 8c2-3 4-5 6-5s4 2 6 5c-2 3-4 5-6 5s-4-2-6-5z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 2l12 12" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
          <path d="M2 8c2-3 4-5 6-5s4 2 6 5c-2 3-4 5-6 5s-4-2-6-5z" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="8" cy="8" r="2" />
        </svg>
      )}
    </button>
  )
}
