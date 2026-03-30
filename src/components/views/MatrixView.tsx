'use client'
import { useState, useEffect } from 'react'
import { useDashboardStore } from '@/lib/store'
import { fmtP } from '@/lib/utils'
import { PROVIDER_COLORS } from '@/lib/data'

const EMPTY_DATA = { dates: [], datesFull: [], providers: {}, domains: {}, overallByDate: {}, providerDomains: {} }

export default function MatrixView() {
  const store = useDashboardStore()
  const { isLight } = store
  const espList = Object.keys(store.espData)

  const [selectedEsp, setSelectedEsp] = useState<string>('')

  useEffect(() => {
    if (!selectedEsp || !store.espData[selectedEsp]) {
      setSelectedEsp(espList[0] || '')
    }
  }, [espList.length])

  const data = store.espData[selectedEsp] ?? EMPTY_DATA
  const fromIdx = store.espRanges[selectedEsp]?.fromIdx ?? 0
  const toIdx = store.espRanges[selectedEsp]?.toIdx ?? 0
  const setRange = (from: number, to: number) => store.setEspRange(selectedEsp, from, to)

  const providers = Object.keys(data.providers || {})
  const domains = Object.keys(data.domains || {})

  function getCellData(prov: string, dom: string) {
    const pd = data.providerDomains[prov]?.[dom]
    if (!pd || !pd.sent) return null
    const deliveryRate = pd.sent > 0 ? (pd.delivered / pd.sent) * 100 : 0
    const bounceRate = pd.sent > 0 ? ((pd.sent - pd.delivered) / pd.sent) * 100 : 0
    return { ...pd, deliveryRate, bounceRate }
  }

  function getCellColor(rate: number) {
    if (rate < 85) return 'bg-[#ff4757]/15 text-[#ff4757]'
    if (rate < 95) return 'bg-[#ffd166]/15 text-[#ffd166]'
    return 'bg-[#00e5c3]/10 text-[#00e5c3]'
  }

  const selectCls = `px-3 py-1.5 rounded-lg border text-xs font-mono outline-none appearance-none
    ${isLight ? 'bg-white border-black/20 text-gray-800' : 'bg-[#1e232b] border-white/18 text-white'}`

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className={`text-2xl font-bold tracking-tight ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>
            Deliverability Matrix
          </h1>
          <p className={`text-sm mt-1 ${isLight ? 'text-gray-500' : 'text-[#a8b0be]'}`}>
            Provider × Domain cross-reference
          </p>
        </div>
        <div className="flex items-center gap-2">
          {espList.length > 0 && (
            <select value={selectedEsp} onChange={e => setSelectedEsp(e.target.value)} className={selectCls}>
              {espList.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          )}
          <select
            value={fromIdx}
            onChange={e => setRange(Number(e.target.value), toIdx)}
            className={selectCls}
          >
            {data.dates.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
          <span className={`text-xs ${isLight ? 'text-gray-400' : 'text-[#a8b0be]'}`}>→</span>
          <select
            value={toIdx}
            onChange={e => setRange(fromIdx, Number(e.target.value))}
            className={selectCls}
          >
            {data.dates.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
          <button
            onClick={() => setRange(0, data.dates.length - 1)}
            className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-mono uppercase transition-all
              ${isLight ? 'border-black/20 text-gray-500 hover:border-[#009e88]' : 'border-white/13 text-[#a8b0be] hover:border-[#00e5c3]'}`}
          >
            All
          </button>
        </div>
      </div>

      {data.dates.length === 0 ? (
        <div className={`rounded-xl border p-12 text-center ${isLight ? 'bg-white border-black/10' : 'bg-[#111418] border-white/7'}`}>
          <div className="text-4xl mb-4">🔢</div>
          <div className={`text-lg font-medium ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>No matrix data</div>
          <div className={`text-sm mt-2 ${isLight ? 'text-gray-400' : 'text-[#a8b0be]'}`}>Upload data first.</div>
        </div>
      ) : (
        <div className={`rounded-xl border overflow-auto ${isLight ? 'bg-white border-black/10' : 'bg-[#111418] border-white/7'}`}>
          <table className="border-collapse" style={{ minWidth: `${180 + domains.length * 110}px` }}>
            <thead className={isLight ? 'bg-gray-50' : 'bg-[#181c22]'}>
              <tr>
                <th className={`px-4 py-3 text-left text-[9px] font-mono tracking-wider uppercase sticky left-0 z-10 border-b border-r
                  ${isLight ? 'border-black/8 text-gray-700 bg-gray-50' : 'border-white/7 text-[#d4dae6] bg-[#181c22]'}`}>
                  Provider ↓ / Domain →
                </th>
                {domains.map(dom => (
                  <th key={dom} className={`px-3 py-3 text-[9px] font-mono tracking-wider border-b border-r last:border-r-0 text-center max-w-[110px]
                    ${isLight ? 'border-black/8 text-gray-700' : 'border-white/7 text-[#d4dae6]'}`}>
                    <div className="truncate max-w-[100px]" title={dom}>{dom.split('.')[0]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {providers.map(prov => {
                const provColor = PROVIDER_COLORS[prov] || '#a8b0be'
                return (
                  <tr key={prov} className={`border-b last:border-0 ${isLight ? 'border-black/8' : 'border-white/7'}`}>
                    <td className={`px-4 py-2.5 sticky left-0 z-10 border-r
                      ${isLight ? 'bg-white border-black/8' : 'bg-[#111418] border-white/7'}`}>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: provColor }} />
                        <span className={`text-[11px] font-mono truncate max-w-[140px] ${isLight ? 'text-gray-800' : 'text-[#f0f2f5]'}`}>
                          {prov}
                        </span>
                      </div>
                    </td>
                    {domains.map(dom => {
                      const cell = getCellData(prov, dom)
                      return (
                        <td key={dom} className={`px-3 py-2.5 text-center border-r last:border-r-0 ${isLight ? 'border-black/8' : 'border-white/7'}`}>
                          {cell ? (
                            <div className={`rounded px-1.5 py-1 text-[10px] font-mono font-bold ${getCellColor(cell.deliveryRate)}`}>
                              {fmtP(cell.deliveryRate, 0)}
                            </div>
                          ) : (
                            <span className="text-[10px] font-mono text-[#6b7280]">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-4 mt-4">
        <span className={`text-[10px] font-mono uppercase tracking-wider ${isLight ? 'text-gray-400' : 'text-[#a8b0be]'}`}>Delivery rate:</span>
        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          <span className="px-2 py-0.5 rounded bg-[#00e5c3]/10 text-[#00e5c3]">≥95% OK</span>
          <span className="px-2 py-0.5 rounded bg-[#ffd166]/15 text-[#ffd166]">≥85% WARN</span>
          <span className="px-2 py-0.5 rounded bg-[#ff4757]/15 text-[#ff4757]">&lt;85% CRIT</span>
        </div>
      </div>
    </div>
  )
}
