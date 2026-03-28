'use client'
import { useState, useRef } from 'react'
import { useDashboardStore } from '@/lib/store'
import type { DmRecord } from '@/lib/types'

export default function DataMgmtView() {
  const { isLight, dmData, setDmData } = useDashboardStore()
  const [search, setSearch] = useState('')
  const [filterCountry, setFilterCountry] = useState('')
  const [pinModal, setPinModal] = useState(false)
  const [pinValue, setPinValue] = useState('')
  const [pinError, setPinError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const countries = [...new Set(dmData.map(r => r.country).filter(Boolean))]
  const domains = [...new Set(dmData.map(r => r.domain).filter(Boolean))]

  const filtered = dmData.filter(r => {
    const matchSearch = !search || Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase()))
    const matchCountry = !filterCountry || r.country === filterCountry
    return matchSearch && matchCountry
  })

  async function handleFileLoad(file: File) {
    const text = await file.text()
    const lines = text.trim().split('\n')
    if (lines.length < 2) return
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
    const rows: DmRecord[] = lines.slice(1).map(line => {
      const vals = line.split(',')
      const row: DmRecord = {}
      headers.forEach((h, i) => { row[h] = vals[i]?.trim() || '' })
      return row
    })
    setDmData(rows)
  }

  function handleDownload() {
    if (!dmData.length) return
    setPinModal(true)
    setPinValue('')
    setPinError('')
  }

  function confirmDownload() {
    if (pinValue !== '1234') { setPinError('Incorrect PIN'); return }
    const headers = Object.keys(dmData[0] || {})
    const csv = [headers.join(','), ...dmData.map(r => headers.map(h => r[h] || '').join(','))].join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = 'partner_roster.csv'
    a.click()
    setPinModal(false)
  }

  const cardClass = `rounded-xl border ${isLight ? 'bg-white border-black/10' : 'bg-[#111418] border-white/7'}`

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className={`text-2xl font-bold tracking-tight ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>
            Data Management
          </h1>
          <p className={`text-sm mt-1 ${isLight ? 'text-gray-500' : 'text-[#a8b0be]'}`}>
            Partner roster and analytics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 rounded-lg bg-[#4a2fa0] hover:bg-[#6040c8] text-white text-xs font-mono font-bold tracking-wider uppercase transition-all"
          >
            ↑ Import CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileLoad(f) }}
          />
          {dmData.length > 0 && (
            <button
              onClick={handleDownload}
              className={`px-3 py-2 rounded-lg border text-xs font-mono uppercase tracking-wider transition-all
                ${isLight ? 'border-black/20 text-gray-600 hover:border-[#009e88]' : 'border-white/13 text-[#a8b0be] hover:border-[#00e5c3]'}`}
            >
              ↓ Export CSV
            </button>
          )}
        </div>
      </div>

      {dmData.length === 0 ? (
        <div className={`${cardClass} p-12 text-center`}>
          <div className="text-4xl mb-4">📊</div>
          <div className={`text-lg font-medium mb-2 ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>No roster data</div>
          <div className={`text-sm ${isLight ? 'text-gray-400' : 'text-[#a8b0be]'}`}>
            Import a CSV file with partner data to get started.
          </div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Total Records', value: dmData.length },
              { label: 'Countries', value: countries.length },
              { label: 'Domains', value: domains.length },
            ].map(s => (
              <div key={s.label} className={`${cardClass} px-4 py-3`}>
                <div className={`text-[10px] font-mono tracking-wider uppercase mb-1 ${isLight ? 'text-gray-400' : 'text-[#a8b0be]'}`}>{s.label}</div>
                <div className={`text-2xl font-bold ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 mb-4">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono outline-none transition-all w-44
                ${isLight ? 'bg-gray-50 border-black/15 text-gray-900 placeholder-gray-400 focus:border-[#009e88]' : 'bg-[#181c22] border-white/13 text-[#f0f2f5] placeholder-[#a8b0be] focus:border-[#00e5c3]'}`}
            />
            <select
              value={filterCountry}
              onChange={e => setFilterCountry(e.target.value)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono outline-none
                ${isLight ? 'bg-white border-black/20 text-gray-800' : 'bg-[#1e232b] border-white/18 text-white'}`}
            >
              <option value="">All Countries</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {(search || filterCountry) && (
              <button
                onClick={() => { setSearch(''); setFilterCountry('') }}
                className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-mono transition-all
                  ${isLight ? 'border-black/20 text-gray-500' : 'border-white/13 text-[#a8b0be]'}`}
              >
                Clear
              </button>
            )}
          </div>

          {/* Table */}
          <div className={`${cardClass} overflow-auto max-h-[500px]`}>
            <table className="w-full border-collapse">
              <thead className={`sticky top-0 ${isLight ? 'bg-gray-50' : 'bg-[#181c22]'}`}>
                <tr>
                  {Object.keys(dmData[0] || {}).slice(0, 8).map(h => (
                    <th key={h} className={`px-4 py-3 text-left text-[9px] font-mono tracking-wider uppercase border-b
                      ${isLight ? 'border-black/8 text-gray-700' : 'border-white/7 text-[#d4dae6]'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((row, i) => (
                  <tr key={i} className={`border-b last:border-0 ${isLight ? 'border-black/8 hover:bg-black/3' : 'border-white/7 hover:bg-white/3'}`}>
                    {Object.keys(dmData[0] || {}).slice(0, 8).map(h => (
                      <td key={h} className={`px-4 py-2.5 text-xs ${isLight ? 'text-gray-800' : 'text-[#f0f2f5]'}`}>
                        {row[h] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
                {filtered.length > 200 && (
                  <tr><td colSpan={8} className={`px-4 py-3 text-center text-xs ${isLight ? 'text-gray-400' : 'text-[#a8b0be]'}`}>
                    Showing 200 of {filtered.length} records
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* PIN Modal */}
      {pinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setPinModal(false)} />
          <div className={`relative z-10 rounded-xl border p-6 w-72 ${isLight ? 'bg-white border-black/10' : 'bg-[#1a1d27] border-white/13'}`}>
            <h3 className={`text-sm font-semibold mb-3 ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>Enter PIN to download</h3>
            <input
              type="password"
              value={pinValue}
              onChange={e => { setPinValue(e.target.value); setPinError('') }}
              onKeyDown={e => e.key === 'Enter' && confirmDownload()}
              placeholder="4-digit PIN"
              maxLength={4}
              className={`w-full px-3 py-2 rounded-lg border outline-none font-mono text-sm mb-1
                ${isLight ? 'bg-white border-black/20 text-gray-900' : 'bg-[#1e232b] border-white/18 text-white'}`}
            />
            {pinError && <div className="text-xs text-[#ff4757] mb-3">{pinError}</div>}
            <div className="flex gap-2 mt-3">
              <button onClick={confirmDownload} className="flex-1 py-2 rounded-lg bg-[#4a2fa0] text-white text-xs font-mono font-bold uppercase">Confirm</button>
              <button onClick={() => setPinModal(false)} className={`flex-1 py-2 rounded-lg border text-xs font-mono uppercase ${isLight ? 'border-black/20 text-gray-500' : 'border-white/13 text-[#a8b0be]'}`}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
