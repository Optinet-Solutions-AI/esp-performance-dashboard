// Supabase caps a single request at 1000 rows by default. An unbounded
// `.select().order()` therefore silently returns only the first 1000 rows —
// and with an ascending order that drops the NEWEST data. fetchAllRows pages
// through with `.range()` until a short page, so callers always get every row.
//
// `makeBuilder` must return a FRESH query builder each call (a Supabase builder
// is single-use); the builder's `.range(from, to)` resolves to Supabase's
// standard `{ data, error }` shape.

const DEFAULT_PAGE_SIZE = 1000

interface PageResult<T> { data: T[] | null; error: { message: string } | null }
interface RangeBuilder<T> { range: (from: number, to: number) => PromiseLike<PageResult<T>> }

export async function fetchAllRows<T>(
  makeBuilder: () => RangeBuilder<T>,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<PageResult<T>> {
  const all: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeBuilder().range(from, from + pageSize - 1)
    if (error) return { data: null, error }
    const page = data ?? []
    all.push(...page)
    if (page.length < pageSize) break
  }
  return { data: all, error: null }
}
