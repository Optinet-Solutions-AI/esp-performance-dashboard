import { describe, it, expect } from 'vitest'
import { fetchAllRows } from '../paginate'

describe('fetchAllRows', () => {
  it('fetches every row across pages when the table exceeds the page size', async () => {
    // 1012 rows with pageSize 1000 reproduces the reg_ftds_daily cap: a single
    // request returns only 1000, silently dropping the newest 12.
    const rows = Array.from({ length: 1012 }, (_, i) => ({ id: i }))
    const calls: [number, number][] = []
    const makeBuilder = () => ({
      range: (from: number, to: number) => {
        calls.push([from, to])
        return Promise.resolve({ data: rows.slice(from, to + 1), error: null })
      },
    })

    const { data, error } = await fetchAllRows(makeBuilder, 1000)

    expect(error).toBeNull()
    expect(data).toHaveLength(1012)
    expect(calls).toEqual([[0, 999], [1000, 1999]])
  })

  it('makes one extra empty page when the total is an exact multiple of the page size', async () => {
    const rows = Array.from({ length: 2000 }, (_, i) => ({ id: i }))
    const calls: [number, number][] = []
    const makeBuilder = () => ({
      range: (from: number, to: number) => {
        calls.push([from, to])
        return Promise.resolve({ data: rows.slice(from, to + 1), error: null })
      },
    })

    const { data } = await fetchAllRows(makeBuilder, 1000)

    expect(data).toHaveLength(2000)
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it('stops and surfaces the error when a page query fails', async () => {
    const makeBuilder = () => ({
      range: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
    })

    const { data, error } = await fetchAllRows(makeBuilder, 1000)

    expect(data).toBeNull()
    expect(error).toEqual({ message: 'boom' })
  })
})
