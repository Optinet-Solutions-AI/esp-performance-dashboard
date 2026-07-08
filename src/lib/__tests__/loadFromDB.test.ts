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

// Emulates Supabase's real behavior: an unbounded request is capped at 1000
// rows, while `.range(from, to)` pages through the full set. This lets the
// pagination test below actually catch a regression to a single capped read.
const CAP = 1000
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        order: () => {
          const err = tableErrors[table] ?? null
          const rows = tableData[table] ?? []
          const p = Promise.resolve({ data: err ? null : rows.slice(0, CAP), error: err }) as Promise<unknown> & {
            range?: (from: number, to: number) => Promise<unknown>
          }
          p.range = (from: number, to: number) =>
            Promise.resolve({ data: err ? null : rows.slice(from, to + 1), error: err })
          return p
        },
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

  it('paginates reg_ftds_daily past Supabase\'s 1000-row cap so the newest rows are not dropped', async () => {
    // 1500 rows > the 1000-row cap. A single unbounded read returns only 1000;
    // pagination must recover all 1500 (the tail is the freshest data).
    tableData['reg_ftds_daily'] = Array.from({ length: 1500 }, (_, i) => ({
      id: `r${i}`, date: '2026-01-01', esp: 'Map', ip: '1.2.3.4', registrations: 1, ftds: 0,
    }))

    await loadFromDB()

    expect(useDashboardStore.getState().regFtdsDaily).toHaveLength(1500)
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
