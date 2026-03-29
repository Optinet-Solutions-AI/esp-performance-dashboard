'use client'
import { useState, useRef } from 'react'
import { useDashboardStore } from '@/lib/store'
import type { IpmRecord } from '@/lib/types'

const ESP_LIST = ['Mailmodo', 'Ongage', 'Hotsol', 'MMS', 'Moosend', 'Omnisend', 'Klaviyo', 'Brevo']

const ESP_COLORS: Record<string, string> = {
  Mailmodo: '#7c5cfc', Ongage: '#c67cff', Hotsol: '#00e5c3',
  MMS: '#ffd166', Moosend: '#ff6b35', Omnisend: '#ff4757',
  Klaviyo: '#60d4f0', Brevo: '#c5f27a',
}

export default function IPMatrixView() {
  const { isLight, ipmData, addIpmRecord, deleteIpmRecord, updateIpmRecord } = useDashboardStore()
  const [search, setSearch] = useState('')
  const [filterEsp, setFilterEsp] = useState('')
  const [modal, setModal] = useState<{ open: boolean; idx: number | null; rec: IpmRecord }>({
    open: false, idx: null, rec: { esp: '', ip: '', domain: '' },
  })
  const [sortCol, setSortCol] = useState<keyof IpmRecord>('esp')
  const [sortDir, setSortDir] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function filtered(): IpmRecord[] {
    let data = [...ipmData]
    if (filterEsp) data = data.filter(r => r.esp === filterEsp)
    if (search) data = data.filter(r =>
      r.esp.toLowerCase().includes(search.toLowerCase()) ||
      r.ip.toLowerCase().includes(search.toLowerCase()) ||
      r.domain.toLowerCase().includes(search.toLowerCase())
    )
    data.sort((a, b) => {
      return String(a[sortCol]).localeCompare(String(b[sortCol])) * sortDir
    })
    return data
  }

  function openModal(idx: number | null = null) {
    const rec = idx !== null ? { ...ipmData[idx] } : { esp: '', ip: '', domain: '' }
    setModal({ open: true, idx, rec })
  }

  function saveModal() {
    if (!modal.rec.esp || !modal.rec.ip) return
    if (modal.idx !== null) updateIpmRecord(modal.idx, modal.rec)
    else addIpmRecord(modal.rec)
    setModal({ open: false, idx: null, rec: { esp: '', ip: '', domain: '' } })
  }

  function handleSort(col: keyof IpmRecord) {
    if (sortCol === col) setSortDir(d => d * -1)
    else { setSortCol(col); setSortDir(1) }
  }

  async function handleFileLoad(file: File) {
    const text = await file.text()
    const lines = text.trim().split('\n')
    if (lines.length < 2) return
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const rows: IpmRecord[] = lines.slice(1).map(line => {
      const vals = line.split(',')
      return {
        esp: vals[headers.indexOf('esp')]?.trim() || '',
        ip: vals[headers.indexOf('ip')]?.trim() || '',
        domain: vals[headers.indexOf('domain')]?.trim() || '',
      }
    }).filter(r => r.esp && r.ip)
    rows.forEach(r => addIpmRecord(r))
  }

  const rows = filtered()
  const espGroups = [...new Set(rows.map(r => r.esp))]

  const inputClass = `w-full px-3 py-2 rounded-lg border outline-none font-mono text-sm transition-all
    ${isLight ? 'bg-white border-black/20 text-gray-900 focus:border-[#009e88]' : 'bg-[#1e232b] border-white/18 text-white focus:border-[#00ffd5]'}`

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className={`text-2xl font-bold tracking-tight ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>
            IPs Matrix
          </h1>
          <p className={`text-sm mt-1 ${isLight ? 'text-gray-500' : 'text-[#a8b0be]'}`}>
            IP registry by ESP and sending domain
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`px-3 py-2 rounded-lg border text-xs font-mono uppercase tracking-wider transition-all
              ${isLight ? 'border-black/20 text-gray-600 hover:border-[#009e88]' : 'border-white/13 text-[#a8b0be] hover:border-[#00e5c3]'}`}
          >
            ↑ Import CSV
          </button>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileLoad(f) }} />
          <button
            onClick={() => openModal(null)}
            className="px-3 py-2 rounded-lg bg-[#4a2fa0] hover:bg-[#6040c8] text-white text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1.5"
          >
            + Add Record
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total IPs', value: ipmData.length },
          { label: 'ESPs', value: new Set(ipmData.map(r => r.esp)).size },
          { label: 'Domains', value: new Set(ipmData.map(r => r.domain).filter(Boolean)).size },
          { label: 'Filtered', value: rows.length },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${isLight ? 'bg-white border-black/10' : 'bg-[#111418] border-white/7'}`}>
            <div className={`text-[10px] font-mono tracking-wider uppercase mb-1 ${isLight ? 'text-gray-400' : 'text-[#a8b0be]'}`}>{s.label}</div>
            <div className={`text-xl font-bold ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search IP, domain, ESP…"
          className={`px-3 py-1.5 rounded-lg border text-xs font-mono outline-none transition-all w-52
            ${isLight ? 'bg-gray-50 border-black/15 text-gray-900 placeholder-gray-400 focus:border-[#009e88]' : 'bg-[#181c22] border-white/13 text-[#f0f2f5] placeholder-[#a8b0be] focus:border-[#00e5c3]'}`}
        />
        <select
          value={filterEsp}
          onChange={e => setFilterEsp(e.target.value)}
          className={`px-3 py-1.5 rounded-lg border text-xs font-mono outline-none
            ${isLight ? 'bg-white border-black/20 text-gray-800' : 'bg-[#1e232b] border-white/18 text-white'}`}
        >
          <option value="">All ESPs</option>
          {ESP_LIST.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className={`rounded-xl border overflow-hidden ${isLight ? 'bg-white border-black/10' : 'bg-[#111418] border-white/7'}`}>
        <table className="w-full border-collapse">
          <thead className={isLight ? 'bg-gray-50' : 'bg-[#181c22]'}>
            <tr>
              {(['esp', 'ip', 'domain'] as const).map(col => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className={`px-4 py-3 text-left text-[9px] font-mono tracking-wider uppercase border-b cursor-pointer select-none transition-colors
                    ${isLight ? 'border-black/8 text-gray-700 hover:text-gray-900' : 'border-white/7 text-[#d4dae6] hover:text-[#f0f2f5]'}`}
                >
                  {col.toUpperCase()}
                  <i className="ml-1 opacity-40 not-italic">
                    {sortCol === col ? (sortDir === 1 ? '↑' : '↓') : '⇅'}
                  </i>
                </th>
              ))}
              <th className={`px-4 py-3 text-right text-[9px] font-mono tracking-wider uppercase border-b
                ${isLight ? 'border-black/8 text-gray-700' : 'border-white/7 text-[#d4dae6]'}`}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className={`px-4 py-10 text-center text-sm ${isLight ? 'text-gray-400' : 'text-[#a8b0be]'}`}>
                  {ipmData.length === 0 ? 'No records yet. Click "+ Add Record" to start.' : 'No records match filter.'}
                </td>
              </tr>
            ) : rows.map((row, i) => {
              const origIdx = ipmData.indexOf(row)
              const espColor = ESP_COLORS[row.esp] || '#a8b0be'
              return (
                <tr key={i} className={`border-b last:border-0 ${isLight ? 'border-black/8 hover:bg-black/3' : 'border-white/7 hover:bg-white/3'}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: espColor }} />
                      <span className={`text-xs font-medium ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>{row.esp}</span>
                    </div>
                  </td>
                  <td className={`px-4 py-2.5 text-xs font-mono ${isLight ? 'text-gray-700' : 'text-[#a8b0be]'}`}>{row.ip}</td>
                  <td className={`px-4 py-2.5 text-xs font-mono ${isLight ? 'text-gray-700' : 'text-[#a8b0be]'}`}>{row.domain || '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openModal(origIdx)}
                        className={`px-2 py-1 rounded border text-[10px] font-mono uppercase transition-all
                          ${isLight ? 'border-black/15 text-gray-500 hover:border-[#009e88] hover:text-[#009e88]' : 'border-white/13 text-[#a8b0be] hover:border-[#00e5c3] hover:text-[#00e5c3]'}`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteIpmRecord(origIdx)}
                        className="px-2 py-1 rounded border border-[#ff4757]/30 text-[#ff4757] text-[10px] font-mono uppercase hover:bg-[#ff4757]/10 transition-all"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setModal(m => ({ ...m, open: false }))} />
          <div className={`relative z-10 rounded-xl border p-6 w-80 ${isLight ? 'bg-white border-black/10' : 'bg-[#1a1d27] border-white/13'}`}>
            <h3 className={`text-sm font-semibold mb-4 ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>
              {modal.idx !== null ? 'Edit Record' : 'Add Record'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className={`block text-[10px] font-mono tracking-wider uppercase mb-1 ${isLight ? 'text-gray-500' : 'text-[#d4dae6]'}`}>ESP</label>
                <select
                  value={modal.rec.esp}
                  onChange={e => setModal(m => ({ ...m, rec: { ...m.rec, esp: e.target.value } }))}
                  className={inputClass}
                >
                  <option value="">Select…</option>
                  {ESP_LIST.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className={`block text-[10px] font-mono tracking-wider uppercase mb-1 ${isLight ? 'text-gray-500' : 'text-[#d4dae6]'}`}>IP Address</label>
                <input
                  value={modal.rec.ip}
                  onChange={e => setModal(m => ({ ...m, rec: { ...m.rec, ip: e.target.value } }))}
                  placeholder="e.g. 192.168.1.1"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={`block text-[10px] font-mono tracking-wider uppercase mb-1 ${isLight ? 'text-gray-500' : 'text-[#d4dae6]'}`}>Domain (optional)</label>
                <input
                  value={modal.rec.domain}
                  onChange={e => setModal(m => ({ ...m, rec: { ...m.rec, domain: e.target.value } }))}
                  placeholder="e.g. example.com"
                  className={inputClass}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={saveModal} className="flex-1 py-2 rounded-lg bg-[#4a2fa0] hover:bg-[#6040c8] text-white text-xs font-mono font-bold uppercase transition-all">
                Save
              </button>
              <button onClick={() => setModal(m => ({ ...m, open: false }))} className={`flex-1 py-2 rounded-lg border text-xs font-mono uppercase transition-all
                ${isLight ? 'border-black/20 text-gray-500' : 'border-white/13 text-[#a8b0be]'}`}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
