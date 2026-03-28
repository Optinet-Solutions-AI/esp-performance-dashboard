'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { EspRecord, DailyRecord, MmData, IpmRecord, DmRecord, UploadHistoryEntry, ViewName, MmTabType, EspStatus } from './types'
import { INITIAL_ESPS, INITIAL_DAILY7, INITIAL_MM_DATA, INITIAL_IPM_DATA } from './data'
import { buildProviderDomains, getEspStatus } from './utils'

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

  // ESP data
  esps: EspRecord[]
  daily7: DailyRecord[]
  setEsps: (esps: EspRecord[]) => void

  // Mailmodo data
  mmData: MmData
  mmFromIdx: number
  mmToIdx: number
  mmTab: MmTabType
  mmSelectedRow: string | null
  setMmData: (data: MmData) => void
  setMmRange: (from: number, to: number) => void
  setMmTab: (tab: MmTabType) => void
  setMmSelectedRow: (row: string | null) => void

  // Ongage data
  ogData: MmData
  ogFromIdx: number
  ogToIdx: number
  setOgData: (data: MmData) => void
  setOgRange: (from: number, to: number) => void

  // Active review context: 'mailmodo' | 'ongage'
  activeReviewCtx: 'mailmodo' | 'ongage'
  setActiveReviewCtx: (ctx: 'mailmodo' | 'ongage') => void

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
}

const EMPTY_MM: MmData = {
  dates: [], datesFull: [], providers: {}, domains: {}, overallByDate: {}, providerDomains: {},
}

const initialMmData = {
  ...INITIAL_MM_DATA,
  providerDomains: buildProviderDomains(INITIAL_MM_DATA),
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      // Theme
      isLight: false,
      toggleTheme: () => set(s => ({ isLight: !s.isLight })),

      // Navigation
      activeView: 'home',
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

      // ESP data
      esps: INITIAL_ESPS,
      daily7: INITIAL_DAILY7,
      setEsps: (esps) => set({ esps }),

      // Mailmodo
      mmData: initialMmData,
      mmFromIdx: 0,
      mmToIdx: INITIAL_MM_DATA.dates.length - 1,
      mmTab: 'ip',
      mmSelectedRow: null,
      setMmData: (data) => set({ mmData: data, mmFromIdx: 0, mmToIdx: data.dates.length - 1 }),
      setMmRange: (from, to) => set({ mmFromIdx: from, mmToIdx: to }),
      setMmTab: (tab) => set({ mmTab: tab, mmSelectedRow: null }),
      setMmSelectedRow: (row) => set({ mmSelectedRow: row }),

      // Ongage
      ogData: EMPTY_MM,
      ogFromIdx: 0,
      ogToIdx: 0,
      setOgData: (data) => set({ ogData: data, ogFromIdx: 0, ogToIdx: data.dates.length - 1 }),
      setOgRange: (from, to) => set({ ogFromIdx: from, ogToIdx: to }),

      // Active review
      activeReviewCtx: 'mailmodo',
      setActiveReviewCtx: (ctx) => set({ activeReviewCtx: ctx }),

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
    }),
    {
      name: 'esp-dashboard-storage',
      partialize: (s) => ({
        isLight: s.isLight,
        mmData: s.mmData,
        ogData: s.ogData,
        ipmData: s.ipmData,
        dmData: s.dmData,
        uploadHistory: s.uploadHistory,
        esps: s.esps,
      }),
    }
  )
)
