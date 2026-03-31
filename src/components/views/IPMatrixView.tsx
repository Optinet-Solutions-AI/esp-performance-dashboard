'use client'
import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { useDashboardStore } from '@/lib/store'
import type { IpmRecord } from '@/lib/types'

/* ── Colors ─────────────────────────────────────────────────────── */
const ESP_PALETTE: Record<string, { bg: string; text: string }> = {
  Mailmodo: { bg: '#7c3aed', text: '#fff' },
  Ongage:   { bg: '#059669', text: '#fff' },
  Hotsol:   { bg: '#0891b2', text: '#fff' },
  MMS:      { bg: '#dc2626', text: '#fff' },
  Moosend:  { bg: '#db2777', text: '#fff' },
  Omnisend: { bg: '#d97706', text: '#fff' },
  Klaviyo:  { bg: '#0369a1', text: '#fff' },
  Brevo:    { bg: '#065f46', text: '#fff' },
}
const FALLBACK_PALETTE = [
  { bg: '#7c3aed', text: '#fff' }, { bg: '#0891b2', text: '#fff' },
  { bg: '#059669', text: '#fff' }, { bg: '#d97706', text: '#fff' },
  { bg: '#db2777', text: '#fff' }, { bg: '#dc2626', text: '#fff' },
  { bg: '#0369a1', text: '#fff' }, { bg: '#065f46', text: '#fff' },
]

function espColor(esp: string, allEsps: string[]): { bg: string; text: string } {
  if (ESP_PALETTE[esp]) return ESP_PALETTE[esp]
  const idx = allEsps.indexOf(esp)
  return FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length] ?? { bg: '#4a5568', text: '#fff' }
}

/* ── Icons ──────────────────────────────────────────────────────── */
const IconPencil = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M11 2l3 3-8 8H3v-3L11 2z" strokeLinejoin="round" />
  </svg>
)
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 4h10M6 4V2h4v2M5 4l1 9h4l1-9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IconSearch = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="6" cy="6" r="4" /><path d="M10 10l3 3" strokeLinecap="round" />
  </svg>
)
const IconUpload = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M8 10V2M5 5l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="2" y="11" width="12" height="3" rx="1" />
  </svg>
)
const IconPlus = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8 2v12M2 8h12" strokeLinecap="round" />
  </svg>
)

/* ── Component ──────────────────────────────────────────────────── */
export default function IPMatrixView() {
  const { isLight, ipmData, addIpmRecord, deleteIpmRecord, updateIpmRecord } = useDashboardStore()

  // Search
  const [searchEsp,    setSearchEsp]    = useState('')
  const [searchIp,     setSearchIp]     = useState('')
  const [searchDomain, setSearchDomain] = useState('')
  // Filters
  const [filterEsp,    setFilterEsp]    = useState('')
  const [filterIp,     setFilterIp]     = useState('')
  const [filterDomain, setFilterDomain] = useState('')
  // Sort
  const [sortCol, setSortCol] = useState<keyof IpmRecord | null>(null)
  const [sortDir, setSortDir] = useState(1)
  // Summary expand
  const [expandedEsp, setExpandedEsp] = useState<Record<string, boolean>>({})
  // Modal
  const [modal, setModal] = useState<{ open: boolean; idx: number | null; rec: IpmRecord & { espNew?: string } }>({
    open: false, idx: null, rec: { esp: '', ip: '', domain: '' },
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const allEspsSorted = [...new Set(ipmData.map(r => r.esp).filter(Boolean))].sort()

  /* ── Filtering ─────────────────────────────────────────────────── */
  function getFiltered(): IpmRecord[] {
    let data = [...ipmData]
    if (filterEsp)    data = data.filter(r => r.esp    === filterEsp)
    if (filterIp)     data = data.filter(r => r.ip     === filterIp)
    if (filterDomain) data = data.filter(r => r.domain === filterDomain)
    if (searchEsp)    data = data.filter(r => r.esp.toLowerCase().includes(searchEsp.toLowerCase()))
    if (searchIp)     data = data.filter(r => r.ip.toLowerCase().includes(searchIp.toLowerCase()))
    if (searchDomain) data = data.filter(r => r.domain.toLowerCase().includes(searchDomain.toLowerCase()))
    if (sortCol) data.sort((a, b) => String(a[sortCol]).localeCompare(String(b[sortCol])) * sortDir)
    return data
  }

  function handleSort(col: keyof IpmRecord) {
    if (sortCol === col) setSortDir(d => d * -1)
    else { setSortCol(col); setSortDir(1) }
  }

  function clearAll() {
    setSearchEsp(''); setSearchIp(''); setSearchDomain('')
    setFilterEsp(''); setFilterIp(''); setFilterDomain('')
    setSortCol(null); setSortDir(1)
  }

  /* ── Dropdown options ──────────────────────────────────────────── */
  const uniqueIps     = [...new Set(ipmData.map(r => r.ip).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const uniqueDomains = [...new Set(ipmData.map(r => r.domain).filter(Boolean))].sort()

  /* ── Modal ─────────────────────────────────────────────────────── */
  function openModal(idx: number | null = null) {
    const rec = idx !== null ? { ...ipmData[idx] } : { esp: '', ip: '', domain: '' }
    setModal({ open: true, idx, rec })
  }

  function saveModal() {
    const esp = (modal.rec.esp === '__new__' ? (modal.rec.espNew ?? '') : modal.rec.esp).trim()
    const ip  = modal.rec.ip.trim()
    if (!esp || !ip) return
    const saved: IpmRecord = { esp, ip, domain: modal.rec.domain.trim() }
    if (modal.idx !== null) updateIpmRecord(modal.idx, saved)
    else addIpmRecord(saved)
    setModal({ open: false, idx: null, rec: { esp: '', ip: '', domain: '' } })
  }

  /* ── File upload ───────────────────────────────────────────────── */
  async function handleFile(file: File) {
    const isExcel = file.name.match(/\.xlsx?$/i)
    let rows: string[][]

    if (isExcel) {
      const buf = await file.arrayBuffer()
      const wb  = XLSX.read(buf, { type: 'array' })
      const ws  = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' }) as string[][]
      rows = raw.filter(r => r.some(c => String(c).trim() !== ''))
    } else {
      const text = await file.text()
      rows = text.trim().split('\n').map(l => l.split(','))
    }

    if (rows.length < 2) return
    const headers = rows[0].map(h => String(h).trim().toLowerCase().replace(/[^a-z]/g, ''))
    const find = (...cands: string[]) => headers.findIndex(h => cands.some(c => h.includes(c)))
    const ci = {
      esp:    find('esp', 'provider', 'service'),
      ip:     find('ip', 'ipaddress', 'address'),
      domain: find('domain', 'fromdomain', 'from', 'sender'),
    }
    rows.slice(1).forEach(cols => {
      const r: IpmRecord = {
        esp:    ci.esp    >= 0 ? String(cols[ci.esp]    ?? '').trim() : '',
        ip:     ci.ip     >= 0 ? String(cols[ci.ip]     ?? '').trim() : '',
        domain: ci.domain >= 0 ? String(cols[ci.domain] ?? '').trim() : '',
      }
      if (r.esp || r.ip) addIpmRecord(r)
    })
  }

  /* ── Styles ────────────────────────────────────────────────────── */
  const rows     = getFiltered()
  const txt      = isLight ? 'text-gray-900' : 'text-[#f0f2f5]'
  const muted    = isLight ? 'text-gray-400' : 'text-[#6b7280]'
  const bdr      = isLight ? 'border-black/10' : 'border-white/7'
  const surfaceA = isLight ? 'bg-white' : 'bg-[#111418]'
  const surfaceB = isLight ? 'bg-gray-50' : 'bg-[#181c22]'
  const hdrCls   = `font-family-mono text-[9px] font-mono tracking-widest uppercase border-b ${bdr} ${isLight ? 'text-gray-600' : 'text-[#6b7280]'}`

  const searchCls = `w-full pl-7 pr-3 py-2 rounded-lg border text-xs font-mono outline-none transition-all
    ${isLight ? 'bg-[#f4f5f8] border-black/18 text-gray-900 placeholder-gray-400 focus:border-violet-400' : 'bg-[#1e232b] border-white/14 text-white placeholder-[#4a5568] focus:border-[#7c5cfc]'}`

  const selectCls = `w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none cursor-pointer
    ${isLight ? 'bg-[#f4f5f8] border-black/18 text-gray-800' : 'bg-[#1e232b] border-white/14 text-white'}`

  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm font-mono outline-none transition-all
    ${isLight ? 'bg-[#f4f5f8] border-black/20 text-gray-900 focus:border-violet-400' : 'bg-[#1e232b] border-white/18 text-white focus:border-[#7c5cfc]'}`

  /* ── Summary section ───────────────────────────────────────────── */
  const espGroups = allEspsSorted.map(esp => {
    const recs    = ipmData.filter(r => r.esp === esp)
    const ips     = [...new Set(recs.map(r => r.ip).filter(Boolean))]
    const domains = [...new Set(recs.map(r => r.domain).filter(Boolean))]
    return { esp, ips, domains, color: espColor(esp, allEspsSorted) }
  }).sort((a, b) => b.ips.length - a.ips.length)

  const grandIps     = new Set(ipmData.map(r => r.ip).filter(Boolean)).size
  const grandDomains = new Set(ipmData.map(r => r.domain).filter(Boolean)).size

  return (
    <div className="p-6 space-y-5">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className={`text-xl font-bold tracking-tight ${txt}`}>IPs Matrix</h1>
          <p className={`text-[11px] mt-1 font-mono ${muted}`}>
            {ipmData.length} records · {allEspsSorted.length} ESPs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-mono uppercase tracking-wider transition-all
              ${isLight ? 'border-black/20 text-gray-600 hover:border-violet-400' : 'border-white/13 text-[#a8b0be] hover:border-[#00e5c3]'}`}
          >
            <IconUpload /> Upload File
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,.xls,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) { handleFile(f); e.target.value = '' } }} />
          <button
            onClick={() => openModal(null)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#4a2fa0] hover:bg-[#6040c8] text-white text-xs font-mono font-bold uppercase tracking-wider transition-all"
          >
            <IconPlus /> Add Record
          </button>
        </div>
      </div>

      {/* ── ESP Summary ─────────────────────────────────────────── */}
      <div>
        <div className={`text-[9px] font-mono tracking-widest uppercase mb-2 ${muted}`}>ESP Summary</div>
        <div className={`rounded-xl border overflow-hidden ${surfaceA} ${bdr}`}>
          <table className="w-full border-collapse text-xs font-mono">
            <thead>
              <tr className={surfaceB}>
                <th className={`w-8 px-3 py-2.5 border-b ${bdr}`} />
                <th className={`px-3 py-2.5 text-left border-b ${hdrCls}`}>ESP</th>
                <th className={`px-3 py-2.5 text-right border-b ${hdrCls}`}>IPs</th>
                <th className={`px-3 py-2.5 text-right border-b ${hdrCls}`}>From Domains</th>
              </tr>
            </thead>
            <tbody>
              {espGroups.length === 0 ? (
                <tr><td colSpan={4} className={`px-3 py-6 text-center text-xs font-mono ${muted}`}>No data loaded</td></tr>
              ) : espGroups.map(({ esp, ips, domains, color }) => {
                const expanded = !!expandedEsp[esp]
                const subBg = isLight ? 'rgba(0,0,0,.02)' : 'rgba(255,255,255,.025)'
                const borderC = isLight ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.06)'
                return (
                  <>
                    {/* ESP row */}
                    <tr key={esp}
                      className={`cursor-pointer border-b transition-colors ${isLight ? 'border-black/7 hover:bg-black/2' : 'border-white/5 hover:bg-white/2'}`}
                      onClick={() => setExpandedEsp(p => ({ ...p, [esp]: !p[esp] }))}
                    >
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-flex items-center justify-center w-4 h-4 rounded border text-[11px] font-mono ${isLight ? 'border-black/15 text-gray-500' : 'border-white/13 text-[#6b7280]'}`}>
                          {expanded ? '−' : '+'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold tracking-wide"
                          style={{ background: color.bg, color: color.text }}>
                          {esp}
                        </span>
                      </td>
                      <td className={`px-3 py-2.5 text-right font-semibold ${txt}`}>{ips.length}</td>
                      <td className={`px-3 py-2.5 text-right font-semibold ${txt}`}>{domains.length}</td>
                    </tr>
                    {/* Expanded rows */}
                    {expanded && ips.map(ip => {
                      const ipDomains = ipmData.filter(r => r.esp === esp && r.ip === ip).map(r => r.domain).filter(Boolean)
                      return (
                        <>
                          <tr key={ip} style={{ background: subBg }}>
                            <td />
                            <td className="px-3 py-1.5 pl-8 text-[11px] font-mono font-semibold" style={{ color: color.bg }}>{ip}</td>
                            <td className={`px-3 py-1.5 text-right text-[10px] ${muted}`}>1</td>
                            <td className={`px-3 py-1.5 text-right text-[10px] ${muted}`}>{ipDomains.length}</td>
                          </tr>
                          {ipDomains.map(domain => (
                            <tr key={ip + domain} style={{ background: subBg }}>
                              <td />
                              <td colSpan={3} className={`px-3 py-1 pl-14 text-[10px] font-mono ${muted}`}>
                                <span className="opacity-40 mr-2">↳</span>{domain}
                              </td>
                            </tr>
                          ))}
                          <tr style={{ background: subBg, borderTop: `1px solid ${borderC}` }}>
                            <td />
                            <td className={`px-3 py-1 pl-8 text-[9px] font-mono italic ${muted}`}>total for {ip}</td>
                            <td className={`px-3 py-1 text-right text-[10px] font-semibold ${txt}`}>1</td>
                            <td className={`px-3 py-1 text-right text-[10px] font-semibold ${txt}`}>{ipDomains.length}</td>
                          </tr>
                        </>
                      )
                    })}
                    {/* ESP subtotal */}
                    {expanded && (
                      <tr style={{ background: color.bg + '18', borderTop: `2px solid ${isLight ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.08)'}` }}>
                        <td />
                        <td className="px-3 py-2 pl-5 text-[10px] font-mono font-bold" style={{ color: color.bg }}>{esp} — Total</td>
                        <td className="px-3 py-2 text-right text-[10px] font-bold" style={{ color: color.bg }}>{ips.length}</td>
                        <td className="px-3 py-2 text-right text-[10px] font-bold" style={{ color: color.bg }}>{domains.length}</td>
                      </tr>
                    )}
                  </>
                )
              })}
              {/* Grand total */}
              {espGroups.length > 0 && (
                <tr style={{ background: isLight ? 'rgba(0,0,0,.04)' : 'rgba(255,255,255,.04)', borderTop: `2px solid ${isLight ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.08)'}` }}>
                  <td />
                  <td className={`px-3 py-2.5 text-[10px] font-mono font-bold tracking-widest uppercase ${txt}`}>Grand Total</td>
                  <td className="px-3 py-2.5 text-right text-sm font-bold text-[#00e5c3]">{grandIps}</td>
                  <td className="px-3 py-2.5 text-right text-sm font-bold text-[#00e5c3]">{grandDomains}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Search row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
        {[
          { label: 'Search ESP',         val: searchEsp,    set: setSearchEsp    },
          { label: 'Search IP',          val: searchIp,     set: setSearchIp     },
          { label: 'Search From Domain', val: searchDomain, set: setSearchDomain },
        ].map(({ label, val, set }) => (
          <div key={label}>
            <div className={`text-[9px] font-mono tracking-widest uppercase mb-1.5 ${muted}`}>{label}</div>
            <div className="relative">
              <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${muted}`}><IconSearch /></span>
              <input value={val} onChange={e => set(e.target.value)} placeholder="Type to search…" className={searchCls} />
            </div>
          </div>
        ))}
        <div className="flex items-end pb-0.5">
          <button onClick={clearAll}
            className={`px-3 py-2 rounded-lg border text-xs font-mono uppercase tracking-wider transition-all
              ${isLight ? 'border-black/20 text-gray-500 hover:border-violet-400' : 'border-white/13 text-[#a8b0be] hover:border-[#00e5c3]'}`}>
            Clear All
          </button>
        </div>
      </div>

      {/* ── Filter row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
        <div>
          <div className={`text-[9px] font-mono tracking-widest uppercase mb-1.5 ${muted}`}>Filter by ESP</div>
          <select value={filterEsp} onChange={e => setFilterEsp(e.target.value)} className={selectCls}>
            <option value="">All ESPs</option>
            {allEspsSorted.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div>
          <div className={`text-[9px] font-mono tracking-widest uppercase mb-1.5 ${muted}`}>Filter by IP</div>
          <select value={filterIp} onChange={e => setFilterIp(e.target.value)} className={selectCls}>
            <option value="">All IPs</option>
            {uniqueIps.map(ip => <option key={ip} value={ip}>{ip}</option>)}
          </select>
        </div>
        <div>
          <div className={`text-[9px] font-mono tracking-widest uppercase mb-1.5 ${muted}`}>Filter by From Domain</div>
          <select value={filterDomain} onChange={e => setFilterDomain(e.target.value)} className={selectCls}>
            <option value="">All Domains</option>
            {uniqueDomains.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="flex items-end pb-0.5">
          <span className={`text-[11px] font-mono ${muted}`}>{rows.length} of {ipmData.length} records</span>
        </div>
      </div>

      {/* ── All Records table ───────────────────────────────────── */}
      <div>
        <div className={`text-[9px] font-mono tracking-widest uppercase mb-2 ${muted}`}>All Records</div>
        <div className={`rounded-xl border overflow-hidden ${surfaceA} ${bdr}`}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs font-mono">
              <thead>
                <tr className={surfaceB}>
                  <th className={`w-8 px-3 py-2.5 text-center border-b ${hdrCls}`}>#</th>
                  {(['esp', 'ip', 'domain'] as const).map(col => (
                    <th key={col}
                      onClick={() => handleSort(col)}
                      className={`px-3 py-2.5 text-left border-b cursor-pointer select-none transition-colors ${hdrCls}
                        ${isLight ? 'hover:text-gray-900' : 'hover:text-[#f0f2f5]'}`}>
                      {col === 'esp' ? 'ESP' : col === 'ip' ? 'IP Address' : 'From Domain'}
                      <span className={`ml-1 ${sortCol === col ? (isLight ? 'text-violet-500' : 'text-[#00e5c3]') : 'opacity-30'}`}>
                        {sortCol === col ? (sortDir === 1 ? '↑' : '↓') : '⇅'}
                      </span>
                    </th>
                  ))}
                  <th className={`w-14 px-3 py-2.5 text-center border-b ${hdrCls}`}>Edit</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={`px-3 py-14 text-center text-xs font-mono ${muted}`}>
                      {ipmData.length === 0 ? 'No records yet — upload a file or add records manually' : 'No records match your search'}
                    </td>
                  </tr>
                ) : rows.map((row, i) => {
                  const origIdx = ipmData.indexOf(row)
                  const color = espColor(row.esp, allEspsSorted)
                  return (
                    <tr key={i} className={`border-b last:border-0 transition-colors ${isLight ? 'border-black/7 hover:bg-[#4a2fa0]/4' : 'border-white/5 hover:bg-[#4a2fa0]/8'}`}>
                      <td className={`px-3 py-2.5 text-center text-[10px] ${muted}`}>{i + 1}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold tracking-wide"
                          style={{ background: color.bg, color: color.text }}>
                          {row.esp}
                        </span>
                      </td>
                      <td className={`px-3 py-2.5 ${isLight ? 'text-gray-700' : 'text-[#c8cdd6]'}`}>{row.ip}</td>
                      <td className={`px-3 py-2.5 ${isLight ? 'text-gray-700' : 'text-[#c8cdd6]'}`}>{row.domain || '—'}</td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openModal(origIdx)}
                            title="Edit"
                            className={`p-1.5 rounded-md transition-all ${isLight ? 'text-gray-400 hover:text-violet-600 hover:bg-violet-50' : 'text-[#6b7280] hover:text-[#7c5cfc] hover:bg-[#7c5cfc]/10'}`}>
                            <IconPencil />
                          </button>
                          <button
                            onClick={() => { if (confirm('Delete this record?')) deleteIpmRecord(origIdx) }}
                            title="Delete"
                            className={`p-1.5 rounded-md transition-all ${isLight ? 'text-gray-400 hover:text-red-500 hover:bg-red-50' : 'text-[#6b7280] hover:text-[#ff4757] hover:bg-[#ff4757]/10'}`}>
                            <IconTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────── */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60" onClick={() => setModal(m => ({ ...m, open: false }))} />
          <div className={`relative z-10 rounded-2xl border p-7 w-96 ${isLight ? 'bg-white border-black/10' : 'bg-[#181c22] border-white/12'}`}>
            <h3 className={`text-sm font-semibold mb-5 flex items-center gap-2 ${txt}`}>
              {modal.idx !== null
                ? <><IconPencil /> Edit Record</>
                : <><IconPlus /> Add Record</>}
            </h3>
            <div className="space-y-4">
              <div>
                <label className={`block text-[9px] font-mono tracking-widest uppercase mb-1.5 ${muted}`}>ESP</label>
                <select
                  value={modal.rec.esp}
                  onChange={e => setModal(m => ({ ...m, rec: { ...m.rec, esp: e.target.value, espNew: '' } }))}
                  className={inputCls}
                >
                  <option value="">— Select ESP —</option>
                  {allEspsSorted.map(e => <option key={e} value={e}>{e}</option>)}
                  <option value="__new__">+ Add new ESP…</option>
                </select>
                {modal.rec.esp === '__new__' && (
                  <input
                    value={modal.rec.espNew ?? ''}
                    onChange={e => setModal(m => ({ ...m, rec: { ...m.rec, espNew: e.target.value } }))}
                    placeholder="New ESP name…"
                    className={`${inputCls} mt-2`}
                    autoFocus
                  />
                )}
              </div>
              <div>
                <label className={`block text-[9px] font-mono tracking-widest uppercase mb-1.5 ${muted}`}>IP Address</label>
                <input
                  value={modal.rec.ip}
                  onChange={e => setModal(m => ({ ...m, rec: { ...m.rec, ip: e.target.value } }))}
                  placeholder="e.g. 192.168.1.1"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={`block text-[9px] font-mono tracking-widest uppercase mb-1.5 ${muted}`}>From Domain <span className={`normal-case ${muted}`}>(optional)</span></label>
                <input
                  value={modal.rec.domain}
                  onChange={e => setModal(m => ({ ...m, rec: { ...m.rec, domain: e.target.value } }))}
                  placeholder="e.g. mail.example.com"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={saveModal}
                className="flex-1 py-2.5 rounded-xl bg-[#4a2fa0] hover:bg-[#6040c8] text-white text-xs font-mono font-bold uppercase tracking-wider transition-all">
                Save
              </button>
              <button onClick={() => setModal(m => ({ ...m, open: false }))}
                className={`flex-1 py-2.5 rounded-xl border text-xs font-mono uppercase tracking-wider transition-all
                  ${isLight ? 'border-black/20 text-gray-500 hover:border-black/40' : 'border-white/13 text-[#a8b0be] hover:border-white/25'}`}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
