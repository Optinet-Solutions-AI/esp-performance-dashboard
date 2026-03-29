'use client'
import { useState, useEffect } from 'react'
import { useDashboardStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { buildProviderDomains, syncEspFromData } from '@/lib/utils'
import { ESP_COLORS } from '@/lib/data'
import type { MmData } from '@/lib/types'
import Sidebar from '@/components/layout/Sidebar'
import HomeView from '@/components/views/HomeView'
import DashboardView from '@/components/views/DashboardView'
import MailmodoView from '@/components/views/MailmodoView'
import UploadView from '@/components/views/UploadView'
import MatrixView from '@/components/views/MatrixView'
import DataMgmtView from '@/components/views/DataMgmtView'
import IPMatrixView from '@/components/views/IPMatrixView'
import PerformanceView from '@/components/views/PerformanceView'
import DailyView from '@/components/views/DailyView'
import MmChartsView from '@/components/views/MmChartsView'
import OgChartsView from '@/components/views/OgChartsView'

const VIEW_LABELS: Record<string, string> = {
  home: 'Overview', dashboard: 'Dashboard', mailmodo: 'Mailmodo Review',
  ongage: 'Ongage Review', upload: 'Upload Report', matrix: 'Deliverability Matrix',
  datamgmt: 'Data Management', ipmatrix: 'IPs Matrix', performance: 'Performance',
  daily: 'Daily Report', mmcharts: 'Mailmodo Charts', ogcharts: 'Ongage Charts',
}

export default function Page() {
  const { activeView, isLight, setMmData, setOgData, setEsps, esps } = useDashboardStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dbLoaded, setDbLoaded] = useState(false)

  useEffect(() => {
    async function loadFromDB() {
      try {
        const { data: rows, error } = await supabase
          .from('reports')
          .select('provider, category, data, updated_at')
          .order('updated_at', { ascending: false })

        if (error || !rows?.length) return

        // Most recent row per category = the most complete accumulated state
        const mmRow = rows.find(r => r.category === 'mailmodo')
        const ogRow = rows.find(r => r.category === 'ongage')

        const newEsps = [...esps]

        if (mmRow) {
          const mmData = mmRow.data as MmData
          mmData.providerDomains = buildProviderDomains(mmData)
          setMmData(mmData)

          // Build/update ESP records from each mailmodo provider row
          const mmRows = rows.filter(r => r.category === 'mailmodo')
          mmRows.forEach(row => {
            const existing = newEsps.find(e => e.name === row.provider)
            const base = existing ?? {
              name: row.provider,
              color: ESP_COLORS[row.provider] ?? '#a8b0be',
              sent: 0, delivered: 0, opens: 0, clicks: 0, bounced: 0, unsub: 0,
              deliveryRate: 0, openRate: 0, clickRate: 0, bounceRate: 0, unsubRate: 0,
              status: 'healthy' as const,
            }
            const updated = syncEspFromData(base, row.data as MmData)
            if (existing) {
              const idx = newEsps.findIndex(e => e.name === row.provider)
              newEsps[idx] = updated
            } else {
              newEsps.push(updated)
            }
          })
        }

        if (ogRow) {
          const ogData = ogRow.data as MmData
          ogData.providerDomains = buildProviderDomains(ogData)
          setOgData(ogData)

          const ogRows = rows.filter(r => r.category === 'ongage')
          ogRows.forEach(row => {
            const existing = newEsps.find(e => e.name === row.provider)
            const base = existing ?? {
              name: row.provider,
              color: ESP_COLORS[row.provider] ?? '#a8b0be',
              sent: 0, delivered: 0, opens: 0, clicks: 0, bounced: 0, unsub: 0,
              deliveryRate: 0, openRate: 0, clickRate: 0, bounceRate: 0, unsubRate: 0,
              status: 'healthy' as const,
            }
            const updated = syncEspFromData(base, row.data as MmData)
            if (existing) {
              const idx = newEsps.findIndex(e => e.name === row.provider)
              newEsps[idx] = updated
            } else {
              newEsps.push(updated)
            }
          })
        }

        if (newEsps.length) setEsps(newEsps)
      } catch (err) {
        console.error('Failed to load from Supabase:', err)
      } finally {
        setDbLoaded(true)
      }
    }
    loadFromDB()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    document.body.classList.toggle('light', isLight)
  }, [isLight])

  useEffect(() => { setSidebarOpen(false) }, [activeView])

  const bg = isLight ? '#f0f2f6' : '#0a0c10'

  if (!dbLoaded) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: bg,
        flexDirection: 'column', gap: 16,
      }}>
        <div style={{
          width: 40, height: 40, border: '3px solid rgba(0,229,195,0.2)',
          borderTopColor: '#00e5c3', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <div style={{ fontSize: 13, color: '#5a6478', fontFamily: 'Space Mono, monospace' }}>
          Loading from database…
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: bg }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.6)' }}
          className="lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar wrapper — drawer on mobile, static in flow on desktop */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 40,
        width: 240, transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
      }} className="sidebar-wrapper lg:hidden">
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Desktop sidebar — always in flow */}
      <div style={{ width: 240, flexShrink: 0 }} className="hidden lg:block">
        <div style={{ position: 'sticky', top: 0, height: '100vh' }}>
          <Sidebar />
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Mobile top bar */}
        <header
          className="lg:hidden"
          style={{
            position: 'sticky', top: 0, zIndex: 20,
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '0 16px', height: 56,
            background: isLight ? 'rgba(255,255,255,0.92)' : 'rgba(17,20,24,0.92)',
            borderBottom: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer',
              color: isLight ? '#374151' : '#a8b0be',
            }}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div>
            <div style={{ fontSize: 8, fontFamily: 'Space Mono, monospace', letterSpacing: '0.18em', textTransform: 'uppercase', color: isLight ? '#9ca3af' : '#4a5568' }}>
              Email Ops
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: isLight ? '#111827' : '#f0f2f5', lineHeight: 1 }}>
              {VIEW_LABELS[activeView] ?? 'ESP Control'}
            </div>
          </div>
        </header>

        {/* View */}
        <main style={{ flex: 1, overflowY: 'auto', background: bg }}>
          {activeView === 'home' && <HomeView />}
          {activeView === 'dashboard' && <DashboardView />}
          {activeView === 'mailmodo' && <MailmodoView ctx="mailmodo" />}
          {activeView === 'ongage' && <MailmodoView ctx="ongage" />}
          {activeView === 'upload' && <UploadView />}
          {activeView === 'matrix' && <MatrixView />}
          {activeView === 'datamgmt' && <DataMgmtView />}
          {activeView === 'ipmatrix' && <IPMatrixView />}
          {activeView === 'performance' && <PerformanceView />}
          {activeView === 'daily' && <DailyView />}
          {activeView === 'mmcharts' && <MmChartsView />}
          {activeView === 'ogcharts' && <OgChartsView />}
        </main>
      </div>
    </div>
  )
}
