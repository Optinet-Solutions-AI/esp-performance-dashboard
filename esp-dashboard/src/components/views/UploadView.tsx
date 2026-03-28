'use client'
import { useState, useRef } from 'react'
import { useDashboardStore } from '@/lib/store'
import { parseFile, mergeIntoMmData } from '@/lib/parsers'
import { buildProviderDomains } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const ESP_LIST = ['Mailmodo', 'Ongage', 'Hotsol', 'MMS', 'Moosend', 'Omnisend', 'Klaviyo', 'Brevo']

export default function UploadView() {
  const { isLight, mmData, ogData, ipmData, setMmData, setOgData, addUploadHistory, esps, setEsps } = useDashboardStore()

  const [esp, setEsp] = useState('')
  const [category, setCategory] = useState<'mailmodo' | 'ongage'>('mailmodo')
  const [file, setFile] = useState<File | null>(null)
  const [step, setStep] = useState(1) // 1=esp, 2=file, 3=ready, 4=done
  const [processing, setProcessing] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [result, setResult] = useState<{ rows: number; dates: string[]; newDates: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function addLog(msg: string) {
    setLog(prev => [...prev, msg])
  }

  function handleEspChange(name: string) {
    setEsp(name)
    if (name) setStep(s => Math.max(s, 2))
  }

  function handleFileSelected(f: File) {
    setFile(f)
    setStep(3)
    setLog([])
    setResult(null)
  }

  async function handleProcess() {
    if (!file || !esp) return
    setProcessing(true)
    setLog([])
    setResult(null)

    try {
      addLog(`📂 Reading ${file.name}…`)
      const parsed = await parseFile(file)
      addLog(`✅ Parsed ${parsed.totalRows.toLocaleString()} rows (${parsed.skipped} skipped)`)
      addLog(`📅 Found ${parsed.dates.length} unique date(s): ${parsed.dates.join(', ')}`)
      addLog(`🔎 Detected format: ${parsed.format}`)

      const currentData = category === 'mailmodo' ? mmData : ogData
      const { data: merged, newDates } = mergeIntoMmData(currentData, parsed, esp)
      merged.providerDomains = buildProviderDomains(merged)

      if (category === 'mailmodo') {
        setMmData(merged)
      } else {
        setOgData(merged)
      }

      addLog(`🔀 Merged into ${category} data (+${newDates} new date${newDates !== 1 ? 's' : ''})`)

      // Persist to Supabase (upsert by category — one row per provider+category)
      try {
        const { error: sbErr } = await supabase.from('reports').upsert(
          { provider: esp, category, data: merged, updated_at: new Date().toISOString() },
          { onConflict: 'provider,category' }
        )
        if (sbErr) addLog(`⚠️ Supabase: ${sbErr.message}`)
        else addLog('☁️ Saved to Supabase.')
      } catch {
        addLog('⚠️ Supabase save failed (data still saved locally).')
      }

      const now = new Date()
      addUploadHistory({
        esp, file: file.name, rows: parsed.totalRows,
        dates: parsed.dates, time: now.toLocaleTimeString(),
        newDates, category,
      })

      setResult({ rows: parsed.totalRows, dates: parsed.dates, newDates })
      addLog('✨ Done! Dashboard updated.')
      setStep(4)
    } catch (err) {
      addLog(`❌ Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setProcessing(false)
    }
  }

  function reset() {
    setEsp(''); setCategory('mailmodo'); setFile(null)
    setStep(1); setLog([]); setResult(null)
  }

  function exportUpdatedDashboard() {
    const data = { mmData, ogData }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'esp-dashboard-data.json'
    a.click()
  }

  const cardClass = `rounded-xl border p-6 mb-4 ${isLight ? 'bg-white border-black/10' : 'bg-[#111418] border-white/13'}`
  const labelClass = `block text-[10px] font-mono tracking-[0.1em] uppercase mb-1.5 ${isLight ? 'text-gray-500' : 'text-[#d4dae6]'}`
  const selectClass = `px-3 py-2 rounded-lg border outline-none font-mono text-xs transition-all
    ${isLight ? 'bg-white border-black/20 text-gray-900 focus:border-[#009e88]' : 'bg-[#1e232b] border-white/18 text-white focus:border-[#00ffd5]'}`

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className={`text-2xl font-bold tracking-tight ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>
          Upload Report
        </h1>
        <p className={`text-sm mt-1 ${isLight ? 'text-gray-500' : 'text-[#d4dae6]'}`}>
          Import XLSX or CSV email data to update the dashboard
        </p>
      </div>

      {/* Step 1: Select ESP */}
      <div className={cardClass}>
        <h3 className={`text-sm font-semibold mb-1.5 ${isLight ? 'text-gray-900' : 'text-white'}`}>
          Step 1 — Select ESP &amp; Category
        </h3>
        <p className={`text-xs mb-4 ${isLight ? 'text-gray-500' : 'text-[#d4dae6]'}`}>
          Choose the email service provider and data category
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>ESP</label>
            <select value={esp} onChange={e => handleEspChange(e.target.value)} className={selectClass + ' w-full'}>
              <option value="">Select ESP…</option>
              {ESP_LIST.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value as 'mailmodo' | 'ongage')} className={selectClass + ' w-full'}>
              <option value="mailmodo">Mailmodo</option>
              <option value="ongage">Ongage</option>
            </select>
          </div>
        </div>
      </div>

      {/* Step 2: Select file */}
      <div className={`${cardClass} ${step < 2 ? 'opacity-50 pointer-events-none' : ''}`}>
        <h3 className={`text-sm font-semibold mb-1.5 ${isLight ? 'text-gray-900' : 'text-white'}`}>
          Step 2 — Select File
        </h3>
        <p className={`text-xs mb-4 ${isLight ? 'text-gray-500' : 'text-[#d4dae6]'}`}>
          Supported: XLSX, CSV. Mailmodo format auto-detected by column names.
        </p>
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelected(f) }}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
            ${dragOver || file
              ? 'border-[#00ffd5] bg-[#00ffd5]/4'
              : isLight
                ? 'border-black/20 bg-black/2 hover:border-[#009e88] hover:bg-[#009e88]/4'
                : 'border-white/20 bg-white/2 hover:border-[#00ffd5] hover:bg-[#00ffd5]/4'
            }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelected(f) }}
          />
          <div className="text-3xl mb-3">📎</div>
          {file ? (
            <>
              <div className="text-xs font-mono text-[#00ffd5]">{file.name}</div>
              <div className={`text-[11px] mt-1 ${isLight ? 'text-gray-400' : 'text-[#6b7280]'}`}>
                {(file.size / 1024).toFixed(1)} KB · Click to change
              </div>
            </>
          ) : (
            <>
              <div className={`text-sm ${isLight ? 'text-gray-600' : 'text-[#d4dae6]'}`}>
                Drop file here or click to browse
              </div>
              <div className={`text-[11px] font-mono mt-1 ${isLight ? 'text-gray-400' : 'text-[#6b7280]'}`}>
                .xlsx .xls .csv
              </div>
            </>
          )}
        </div>
      </div>

      {/* Step 3: Process */}
      <div className={`${cardClass} ${step < 3 ? 'opacity-50 pointer-events-none' : ''}`}>
        <h3 className={`text-sm font-semibold mb-1.5 ${isLight ? 'text-gray-900' : 'text-white'}`}>
          Step 3 — Process
        </h3>
        <p className={`text-xs mb-4 ${isLight ? 'text-gray-500' : 'text-[#d4dae6]'}`}>
          Parse and merge data into the dashboard
        </p>
        <button
          onClick={handleProcess}
          disabled={!esp || !file || processing}
          className="px-5 py-2.5 rounded-lg bg-[#4a2fa0] hover:bg-[#6040c8] text-white text-xs font-mono font-bold tracking-wider uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? '⏳ Processing…' : '▶ Process File'}
        </button>

        {log.length > 0 && (
          <div className={`mt-4 rounded-lg border px-4 py-3 font-mono text-[11px] space-y-1 max-h-36 overflow-y-auto
            ${isLight ? 'bg-gray-50 border-black/10 text-gray-700' : 'bg-[#0d0f13] border-white/10 text-[#d4dae6]'}`}>
            {log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        )}
      </div>

      {/* Step 4: Done */}
      {step === 4 && result && (
        <div className={cardClass}>
          <h3 className={`text-sm font-semibold mb-1.5 text-[#00e5c3]`}>
            ✅ Upload Complete
          </h3>
          <p className={`text-xs mb-4 ${isLight ? 'text-gray-500' : 'text-[#d4dae6]'}`}>
            {result.rows.toLocaleString()} rows · {result.dates.length} dates · +{result.newDates} new
          </p>
          <div className="flex gap-3">
            <button
              onClick={exportUpdatedDashboard}
              className="px-4 py-2 rounded-lg border border-[#00e5c3]/40 text-[#00e5c3] text-xs font-mono uppercase tracking-wider hover:bg-[#00e5c3]/10 transition-all"
            >
              ↓ Export Data JSON
            </button>
            <button
              onClick={reset}
              className={`px-4 py-2 rounded-lg border text-xs font-mono uppercase tracking-wider transition-all
                ${isLight ? 'border-black/20 text-gray-500 hover:border-black/40' : 'border-white/13 text-[#a8b0be] hover:border-white/30'}`}
            >
              Upload Another
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
