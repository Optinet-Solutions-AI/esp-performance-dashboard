'use client'
import { useState, useEffect } from 'react'
import { useDashboardStore } from '@/lib/store'
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
  const { activeView, isLight } = useDashboardStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    document.body.classList.toggle('light', isLight)
  }, [isLight])

  useEffect(() => { setSidebarOpen(false) }, [activeView])

  const bg = isLight ? '#f0f2f6' : '#0a0c10'

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
