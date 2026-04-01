'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { EspRecord, DailyRecord, MmData, IpmRecord, DmRecord, UploadHistoryEntry, ViewName, MmTabType, EspStatus } from './types'
import { INITIAL_ESPS, INITIAL_DAILY7, INITIAL_IPM_DATA } from './data'

interface DashboardState {
  // Theme
  isLight: boolean
  toggleTheme: () => void

  // Navigation
  activeView: ViewName
  setView: (v: ViewName) => void

  // Dashboard filters
  activeFilter: EspStatus | 'all'
  activeEsp: string | null
  sortKey: string | null
  sortDir: number
  searchQ: string
  setFilter: (f: EspStatus | 'all') => void
  setActiveEsp: (name: string | null) => void
  setSort: (key: string) => void
  setSearch: (q: string) => void

  // ESP records (cards on dashboard)
  esps: EspRecord[]
  daily7: DailyRecord[]
  setEsps: (esps: EspRecord[]) => void

  // Per-ESP data store
  espData: Record<string, MmData>
  espRanges: Record<string, { fromIdx: number; toIdx: number }>
  setEspData: (name: string, data: MmData) => void
  setEspRange: (name: string, from: number, to: number) => void

  // Which ESP to show when navigating to review views
  reviewEsp: string
  setReviewEsp: (esp: string) => void

  // Shared review UI state (tab + selected row for detail views)
  mmTab: MmTabType
  mmSelectedRow: string | null
  setMmTab: (tab: MmTabType) => void
  setMmSelectedRow: (row: string | null) => void

  // Upload
  uploadHistory: UploadHistoryEntry[]
  addUploadHistory: (entry: UploadHistoryEntry) => void

  // IP Matrix
  ipmData: IpmRecord[]
  setIpmData: (data: IpmRecord[]) => void
  addIpmRecord: (rec: IpmRecord) => void
  deleteIpmRecord: (idx: number) => void
  updateIpmRecord: (idx: number, rec: IpmRecord) => void

  // Data Management
  dmData: DmRecord[]
  setDmData: (data: DmRecord[]) => void

  // Reset
  resetAllData: () => void
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      // Theme
      isLight: false,
      toggleTheme: () => set(s => ({ isLight: !s.isLight })),

      // Navigation
      activeView: 'mailmodo',
      setView: (v) => set({ activeView: v }),

      // Dashboard filters
      activeFilter: 'all',
      activeEsp: null,
      sortKey: null,
      sortDir: -1,
      searchQ: '',
      setFilter: (f) => set({ activeFilter: f, activeEsp: null }),
      setActiveEsp: (name) => set(s => ({
        activeEsp: s.activeEsp === name ? null : name,
        activeFilter: 'all',
      })),
      setSort: (key) => set(s => ({
        sortKey: key,
        sortDir: s.sortKey === key ? s.sortDir * -1 : -1,
      })),
      setSearch: (q) => set({ searchQ: q }),

      // ESP records
      esps: INITIAL_ESPS,
      daily7: INITIAL_DAILY7,
      setEsps: (esps) => set({ esps }),

      // Per-ESP data
      espData: {},
      espRanges: {},
      setEspData: (name, data) => set(s => ({
        espData: { ...s.espData, [name]: data },
        espRanges: {
          ...s.espRanges,
          [name]: { fromIdx: 0, toIdx: Math.max(0, data.dates.length - 1) },
        },
      })),
      setEspRange: (name, from, to) => set(s => ({
        espRanges: { ...s.espRanges, [name]: { fromIdx: from, toIdx: to } },
      })),

      // Review context
      reviewEsp: '',
      setReviewEsp: (esp) => set({ reviewEsp: esp }),

      // Shared review UI
      mmTab: 'ip',
      mmSelectedRow: null,
      setMmTab: (tab) => set({ mmTab: tab, mmSelectedRow: null }),
      setMmSelectedRow: (row) => set({ mmSelectedRow: row }),

      // Upload
      uploadHistory: [],
      addUploadHistory: (entry) => set(s => ({ uploadHistory: [entry, ...s.uploadHistory] })),

      // IP Matrix
      ipmData: INITIAL_IPM_DATA,
      setIpmData: (data) => set({ ipmData: data }),
      addIpmRecord: (rec) => set(s => ({ ipmData: [...s.ipmData, rec] })),
      deleteIpmRecord: (idx) => set(s => ({ ipmData: s.ipmData.filter((_, i) => i !== idx) })),
      updateIpmRecord: (idx, rec) => set(s => ({
        ipmData: s.ipmData.map((r, i) => i === idx ? rec : r),
      })),

      // Data Management
      dmData: [],
      setDmData: (data) => set({ dmData: data }),

      // Reset
      resetAllData: () => set({
        esps: [], daily7: [], uploadHistory: [], ipmData: [],
        espData: {}, espRanges: {}, reviewEsp: '',
        mmTab: 'ip', mmSelectedRow: null,
      }),
    }),
    {
      name: 'esp-dashboard-storage',
      partialize: (s) => ({
        isLight: s.isLight,
      }),
    }
  )
)
