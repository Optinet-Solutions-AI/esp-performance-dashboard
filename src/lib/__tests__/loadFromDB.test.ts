// Runs in Vitest's node env (no DOM). Provide a minimal localStorage so the
// store's zustand persist middleware initialises cleanly on import.
if (typeof (globalThis as unknown as { localStorage?: unknown }).localStorage === 'undefined') {
  const mem: Record<string, string> = {}
  ;(globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem: (k: string) => (k in mem ? mem[k] : null),
    setItem: (k: string, v: string) => { mem[k] = String(v) },
    removeItem: (k: string) => { delete mem[k] },
    clear: () => { for (const k of Object.keys(mem)) delete mem[k] },
  }
}

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted so the vi.mock factory (also hoisted) can reference it.
const { tableData, tableErrors } = vi.hoisted(() => ({
  tableData: {} as Record<string, unknown[]>,
  tableErrors: {} as Record<string, { message: string } | null>,
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        order: () => Promise.resolve({ data: tableData[table] ?? [], error: tableErrors[table] ?? null }),
        eq: () => Promise.resolve({ data: tableData[table] ?? [], error: tableErrors[table] ?? null }),
      }),
    }),
  },
}))

import { loadFromDB } from '../loadFromDB'
import { useDashboardStore } from '../store'

beforeEach(() => {
  for (const k of Object.keys(tableData)) delete tableData[k]
  for (const k of Object.keys(tableErrors)) delete tableErrors[k]
})

describe('loadFromDB', () => {
  it('is independently callable and maps ip_matrix rows into the store (mp_code -> mpCode)', async () => {
    tableData['ip_matrix'] = [
      { id: 'a1', esp: 'Map', ip: '1.2.3.4', domain: 'x.com', mp_code: 'MP-86', upload_id: null, registrations: null, ftds: null },
    ]

    await loadFromDB()

    const row = useDashboardStore.getState().ipmData.find(r => r.ip === '1.2.3.4')
    expect(row).toBeDefined()
    expect(row!.mpCode).toBe('MP-86')
    expect(row!.domain).toBe('x.com')
  })

  it('resolves without throwing when every table is empty', async () => {
    await expect(loadFromDB()).resolves.toBeUndefined()
  })

  it('applies successful tables but still rejects with an aggregated error when a table query fails', async () => {
    tableData['ip_matrix'] = [
      { id: 'b2', esp: 'Mailgun', ip: '5.6.7.8', domain: 'y.com', mp_code: null, upload_id: null, registrations: null, ftds: null },
    ]
    tableErrors['esp_visibility'] = { message: 'permission denied' }

    await expect(loadFromDB()).rejects.toThrow(/partial failure/)

    const row = useDashboardStore.getState().ipmData.find(r => r.ip === '5.6.7.8')
    expect(row).toBeDefined()
  })
})
