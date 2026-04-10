'use client'
import { useState, useRef, useEffect } from 'react'

interface Option { value: string; label: string }

interface Props {
  value: string
  onChange: (val: string) => void
  options: Option[]
  isLight: boolean
  minWidth?: number
  maxHeight?: number
  className?: string
  align?: 'left' | 'right' | 'auto'
}

export default function CustomSelect({ value, onChange, options, isLight, minWidth = 100, maxHeight = 220, className, align = 'auto' }: Props) {
  const [open, setOpen]     = useState(false)
  const [above, setAbove]   = useState(false)
  const [autoRight, setAutoRight] = useState(false)
  const wrapRef             = useRef<HTMLDivElement>(null)
  const btnRef              = useRef<HTMLButtonElement>(null)

  // Outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect       = btnRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      setAbove(spaceBelow < maxHeight && spaceAbove > spaceBelow)
      setAutoRight(rect.left + minWidth > window.innerWidth - 8)
    }
    setOpen(o => !o)
  }

  const isRightAligned = align === 'right' || (align === 'auto' && autoRight)

  const selected = options.find(o => o.value === value)?.label ?? options[0]?.label ?? ''

  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    ...(above ? { bottom: '100%', marginBottom: 6 } : { top: '100%', marginTop: 6 }),
    ...(isRightAligned ? { right: 0 } : { left: 0 }),
    zIndex: 50,
    minWidth,
    maxHeight,
    overflowY: 'auto',
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
    background: isLight ? '#ffffff' : '#181c22',
    border: `1px solid ${isLight ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.12)'}`,
  }

  return (
    <div ref={wrapRef} className={`relative ${className ?? ''}`}>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all
          ${isLight
            ? `bg-white border-black/20 text-gray-800 hover:border-[#0d9488] ${open ? 'border-[#0d9488]' : ''}`
            : `bg-[#1e232b] border-white/18 text-white hover:border-[#0d9488] ${open ? 'border-[#0d9488]' : ''}`
          }`}
        style={{ minWidth }}
      >
        <span className="flex-1 text-left truncate">{selected}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-50 flex-shrink-0"
          style={{ transform: above ? 'rotate(180deg)' : undefined }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={panelStyle}>
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full text-left px-4 py-2.5 text-xs font-mono font-semibold transition-all
                ${value === opt.value
                  ? 'bg-[#0d9488] text-white'
                  : isLight ? 'text-gray-700 hover:bg-[#0d9488]/10' : 'text-[#c8cdd6] hover:bg-[#0d9488]/15'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
