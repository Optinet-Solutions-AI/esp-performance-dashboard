import { supabase } from '@/lib/supabase'
import { useDashboardStore } from '@/lib/store'
import { syncEspFromData, overwriteMmData, isValidIsoDate } from '@/lib/utils'
import { ESP_COLORS, INITIAL_MM_DATA, normalizeEspName } from '@/lib/data'
import type { MmData } from '@/lib/types'

/**
 * Pull all DB-backed state from Supabase and reconcile it into the Zustand
 * store. Idempotent: espData is rebuilt from INITIAL_MM_DATA per ESP, so
 * repeated calls never double-count. Applies every table that loads
 * successfully — a failure in one table does not block the others. Once all
 * six queries have run, throws an aggregated error if ANY of them failed
 * (query-level Supabase errors resolve as `{ data: null, error }` rather than
 * rejecting, so this is checked explicitly rather than relying solely on
 * network-level promise rejection). Callers decide how to surface the error.
 * Does not touch page-local UI flags.
 */
export async function loadFromDB(): Promise<void> {
  const s = useDashboardStore.getState()
  const errors: string[] = []

  const { data: rows, error: rowsError } = await supabase
    .from('uploads')
    .select('esp, solo_data')
    .order('uploaded_at', { ascending: true })
  if (rowsError) errors.push(`uploads: ${rowsError.message}`)

  if (rows?.length) {
    const byEsp: Record<string, MmData[]> = {}
    for (const row of rows) {
      if (!row.esp || !row.solo_data) continue
      if (!byEsp[row.esp]) byEsp[row.esp] = []
      byEsp[row.esp].push(row.solo_data as MmData)
    }

    const newEsps = [...s.esps]
    for (const [espName, uploads] of Object.entries(byEsp)) {
      let merged = INITIAL_MM_DATA as MmData
      for (const data of uploads) {
        merged = overwriteMmData(merged, data)
      }
      s.setEspData(espName, merged)

      const existing = newEsps.find(e => e.name === espName)
      const base = existing ?? {
        name: espName,
        color: ESP_COLORS[espName] ?? '#a8b0be',
        sent: 0, delivered: 0, opens: 0, clicks: 0, bounced: 0, unsub: 0,
        deliveryRate: 0, openRate: 0, clickRate: 0, bounceRate: 0, unsubRate: 0,
        status: 'healthy' as const,
      }
      const updated = syncEspFromData(base, merged)
      if (existing) {
        newEsps[newEsps.findIndex(e => e.name === espName)] = updated
      } else {
        newEsps.push(updated)
      }
    }

    if (newEsps.length) s.setEsps(newEsps)
  }

  // IP Matrix
  const { data: ipmRows, error: ipmError } = await supabase
    .from('ip_matrix')
    .select('id, esp, ip, domain, mp_code, upload_id, registrations, ftds')
    .order('created_at', { ascending: true })
  if (ipmError) errors.push(`ip_matrix: ${ipmError.message}`)
  if (ipmRows?.length) {
    s.setIpmData(ipmRows.map(r => ({ id: r.id, upload_id: r.upload_id, esp: r.esp, ip: r.ip, domain: r.domain ?? '', mpCode: r.mp_code ?? undefined, registrations: r.registrations ?? undefined, ftds: r.ftds ?? undefined })))
  }

  // Data Management
  const { data: dmRows, error: dmError } = await supabase
    .from('data_management')
    .select('raw_data')
    .order('created_at', { ascending: true })
  if (dmError) errors.push(`data_management: ${dmError.message}`)
  if (dmRows?.length) {
    s.setDmData(dmRows.map(r => r.raw_data))
  }

  // Throttle Matrix (source of truth is Supabase, not localStorage)
  const { data: throttleRows, error: throttleError } = await supabase
    .from('throttle_matrix')
    .select('esp, ip, from_domain, gmail, hotmail, outlook, yahoo, icloud, aol, live, gmx, web, others')
    .order('created_at', { ascending: true })
  if (throttleError) errors.push(`throttle_matrix: ${throttleError.message}`)
  function parseThrottleVal(v: string | null): number | 'TBC' {
    if (!v || v.toUpperCase() === 'TBC') return 'TBC'
    const n = Number(v)
    return isNaN(n) ? 0 : n
  }
  if (!throttleError) {
    s.setThrottleData((throttleRows ?? []).map(r => ({
      esp: r.esp ?? '',
      ip: r.ip ?? '',
      fromDomain: r.from_domain ?? '',
      gmail:   parseThrottleVal(r.gmail),
      hotmail: parseThrottleVal(r.hotmail),
      outlook: parseThrottleVal(r.outlook),
      yahoo:   parseThrottleVal(r.yahoo),
      icloud:  parseThrottleVal(r.icloud),
      aol:     parseThrottleVal(r.aol),
      live:    parseThrottleVal(r.live),
      gmx:     parseThrottleVal(r.gmx),
      web:     parseThrottleVal(r.web),
      others:  parseThrottleVal(r.others),
    })))
  }

  // Reg & FTDs daily
  const { data: rfRows, error: rfError } = await supabase
    .from('reg_ftds_daily')
    .select('id, date, esp, ip, registrations, ftds')
    .order('date', { ascending: true })
  if (rfError) errors.push(`reg_ftds_daily: ${rfError.message}`)
  if (rfRows?.length) {
    s.setRegFtdsDaily(rfRows.filter(r => isValidIsoDate(r.date)).map(r => ({
      id: r.id, date: r.date, esp: normalizeEspName(r.esp), ip: r.ip,
      registrations: r.registrations ?? 0, ftds: r.ftds ?? 0,
    })))
  }

  // ESP visibility
  const { data: visRows, error: visError } = await supabase
    .from('esp_visibility')
    .select('esp')
    .eq('hidden', true)
  if (visError) errors.push(`esp_visibility: ${visError.message}`)
  if (!visError) {
    s.setHiddenEsps(visRows?.map(r => r.esp) ?? [])
  }

  if (errors.length) throw new Error(`loadFromDB partial failure: ${errors.join('; ')}`)
}
