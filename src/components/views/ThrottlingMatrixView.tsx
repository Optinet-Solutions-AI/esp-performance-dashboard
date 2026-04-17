'use client'
import { useRef, useState } from 'react'
import { useDashboardStore } from '@/lib/store'
import { parseThrottleCsv } from '@/lib/parsers'
import type { ThrottleRecord, ThrottleValue } from '@/lib/types'

const PROVIDERS = ['Gmail','Hotmail','Outlook','Yahoo','Icloud','AOL','Live','Gmx','Web','Others'] as const
const PROVIDER_KEYS: (keyof Omit<ThrottleRecord,'esp'|'ip'|'fromDomain'>)[] = [
  'gmail','hotmail','outlook','yahoo','icloud','aol','live','gmx','web','others',
]

const ESP_BADGE_COLORS: Record<string, string> = {
  Mailmodo: '#7c5cfc', Ongage: '#ffd166', Netcore: '#f97316',
  MMS: '#ffd166', Hotsol: '#00e5c3', '171 MailsApp': '#ff6b9d',
  Moosend: '#ff6b35', Kenscio: '#e63946',
}

function fmtVal(v: ThrottleValue): string {
  if (v === 'TBC') return 'TBC'
  if (v === 0) return '0'
  return v.toLocaleString()
}

export default function ThrottlingMatrixView() {
  const { isLight, throttleData, setThrottleData } = useDashboardStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const txt      = isLight ? '#111827' : '#f0f2f5'
  const muted    = isLight ? '#374151' : '#c8cdd6'
  const bdr      = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'
  const headerBg = isLight ? '#f1f3f7' : '#181c22'
  const surfBg   = isLight ? '#ffffff' : '#111418'

  // Group rows by ESP for display
  const byEsp: Record<string, ThrottleRecord[]> = {}
  throttleData.forEach(r => {
    if (!byEsp[r.esp]) byEsp[r.esp] = []
    byEsp[r.esp].push(r)
  })

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsed = parseThrottleCsv(text)
      if (parsed.length === 0) throw new Error('No rows parsed — check the file format.')
      setThrottleData(parsed)
      setMsg({ text: `Loaded ${parsed.length} rows from "${file.name}"`, ok: true })
    } catch (err) {
      setMsg({ text: String(err), ok: false })
    }
    e.target.value = ''
  }

  function downloadCsv() {
    const header = ['', 'IP', 'From Domain', ...PROVIDERS]
    const csvRows = [
      header,
      ...throttleData.map(r => [
        r.esp, r.ip, r.fromDomain,
        ...PROVIDER_KEYS.map(k => String(r[k])),
      ]),
    ]
    const csv = csvRows
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'Throttling Matrix.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const thCls = 'px-3 py-2.5 text-[11px] font-mono tracking-widest uppercase text-left border-b whitespace-nowrap'
  const tdCls = 'px-3 py-2 text-left text-[11px] font-mono border-b'

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: txt }}>
            Throttling Matrix
          </h1>
          <p className="text-sm mt-1" style={{ color: muted }}>
            Per-domain send limits by email provider
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          <button
            onClick={() => fileRef.current?.click()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-mono uppercase tracking-wider transition-all ${isLight ? 'border-black/20 text-gray-600 hover:border-[#0d9488] hover:text-[#0d9488]' : 'border-white/[0.13] text-[#a8b0be] hover:border-[#0d9488] hover:text-[#0d9488]'}`}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8V1M3.5 3.5L6 1l2.5 2.5"/><path d="M1 10h10"/>
            </svg>
            Upload CSV
          </button>
          {throttleData.length > 0 && (
            <button
              onClick={downloadCsv}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-mono uppercase tracking-wider transition-all ${isLight ? 'border-black/20 text-gray-600 hover:border-[#0d9488] hover:text-[#0d9488]' : 'border-white/[0.13] text-[#a8b0be] hover:border-[#0d9488] hover:text-[#0d9488]'}`}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 1v7M3.5 6l2.5 2.5L8.5 6"/><path d="M1 10h10"/>
              </svg>
              CSV
            </button>
          )}
        </div>
      </div>

      {/* Status message */}
      {msg && (
        <div
          className={`mb-4 px-4 py-2.5 rounded-lg text-[12px] font-mono border ${
            msg.ok
              ? isLight ? 'border-teal-300 bg-teal-50 text-teal-700' : 'border-[#00e5c3]/30 bg-[#00e5c3]/[0.08] text-[#00e5c3]'
              : isLight ? 'border-red-300 bg-red-50 text-red-600'   : 'border-[#ff4757]/30 bg-[#ff4757]/[0.08] text-[#ff4757]'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Empty state */}
      {throttleData.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ background: surfBg, borderColor: bdr }}>
          <div className="text-4xl mb-4">⚡</div>
          <div className="text-lg font-medium mb-2" style={{ color: txt }}>No throttle data</div>
          <div className="text-sm" style={{ color: muted }}>
            Upload a CSV with columns:{' '}
            <span className="font-mono">[ESP], IP, From Domain, Gmail, Hotmail, Outlook, Yahoo, Icloud, AOL, Live, Gmx, Web, Others</span>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border overflow-auto" style={{ background: surfBg, borderColor: bdr, maxHeight: 'calc(100vh - 200px)' }}>
          <table className="w-full border-collapse" style={{ minWidth: 1100 }}>
            <thead>
              <tr style={{ background: headerBg }}>
                {['ESP', 'IP', 'From Domain', ...PROVIDERS].map(col => (
                  <th
                    key={col}
                    className={`${thCls} sticky top-0 z-10`}
                    style={{ color: txt, borderColor: bdr, background: headerBg, width: col === 'From Domain' ? 180 : col === 'IP' ? 130 : col === 'ESP' ? 100 : 70 }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(byEsp).map(([esp, rows]) => {
                const espColor = ESP_BADGE_COLORS[esp] ?? '#a8b0be'
                return rows.map((r, i) => (
                  <tr key={`${esp}-${r.ip}-${r.fromDomain}`} style={{ borderBottom: `1px solid ${bdr}` }}>
                    {i === 0 ? (
                      <td
                        className={tdCls}
                        rowSpan={rows.length}
                        style={{ borderBottom: `1px solid ${bdr}`, color: espColor, fontWeight: 700, verticalAlign: 'top', paddingTop: 10 }}
                      >
                        {esp}
                      </td>
                    ) : null}
                    <td className={tdCls} style={{ borderBottom: `1px solid ${bdr}`, color: muted }}>{r.ip}</td>
                    <td className={tdCls} style={{ borderBottom: `1px solid ${bdr}`, color: txt }}>{r.fromDomain}</td>
                    {PROVIDER_KEYS.map(k => {
                      const v = r[k]
                      const isTbc = v === 'TBC'
                      return (
                        <td
                          key={k}
                          className={`${tdCls} text-center`}
                          style={{
                            borderBottom: `1px solid ${bdr}`,
                            color: isTbc    ? (isLight ? '#b45309' : '#ffd166')
                                 : v === 0 ? (isLight ? '#9ca3af' : '#4a5568')
                                 : txt,
                            fontStyle: isTbc ? 'italic' : 'normal',
                          }}
                        >
                          {fmtVal(v)}
                        </td>
                      )
                    })}
                  </tr>
                ))
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
