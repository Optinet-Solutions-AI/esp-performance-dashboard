'use client'
import React, { useState, useEffect } from 'react'
import { useDashboardStore } from '@/lib/store'
import { buildProviderDomains } from '@/lib/utils'
import { loadFromDB } from '@/lib/loadFromDB'
import Sidebar from '@/components/layout/Sidebar'
import AuthGate from '@/components/ui/AuthGate'
import MailmodoView from '@/components/views/MailmodoView'
import MailgunView from '@/components/views/MailgunView'
import UploadView from '@/components/views/UploadView'
import MatrixView from '@/components/views/MatrixView'
import DataMgmtView from '@/components/views/DataMgmtView'
import IPMatrixView from '@/components/views/IPMatrixView'
import LogsView from '@/components/views/LogsView'
import AnalyticsView from '@/components/views/AnalyticsView'
import KenscioView from '@/components/views/KenscioView'
import ThrottlingMatrixView from '@/components/views/ThrottlingMatrixView'
import RegFtdsView from '@/components/views/RegFtdsView'
import UsersView from '@/components/views/UsersView'
import { useAskAI } from '@/hooks/useAskAI'
import AskAIView from '@/components/views/AskAIView'
import AskAIBubble from '@/components/ui/AskAIBubble'

const VIEW_LABELS: Record<string, string> = {
  mailmodo: 'Mailmodo Review', mailgun: 'Mailgun Review', netcore: 'Netcore Review',
  mms: 'MMS Review', hotsol: 'Hotsol Review', '171mailsapp': '171 MailsApp Review',
  upload: 'Upload Report', throttling: 'Throttling Matrix', regftds: 'Reg & FTDs',
  matrix: 'ESP Deliverability Matrix', datamgmt: 'Data Management', ipmatrix: 'IPs Matrix',
  logs: 'Activity Logs', analytics: 'Analytics', moosend: 'Moosend Review',
  kenscio: 'Kenscio Review', mailjet: 'Mailjet Review', elastic: 'Elastic Review',
  inboxroad: 'Inboxroad Review', map: 'Map Review', users: 'Users', askai: 'Ask AI',
}

export default function Page() {
  const { activeView, isLight } = useDashboardStore()
  const askAI = useAskAI()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const sidebarWidth = sidebarCollapsed ? 60 : 240
  const [dbLoaded, setDbLoaded] = useState(false)
  const [mountedViews, setMountedViews] = useState<Set<string>>(new Set([activeView]))

  useEffect(() => {
    loadFromDB()
      .catch(err => console.error('Failed to load from Supabase:', err))
      .finally(() => setDbLoaded(true))
  }, [])

  useEffect(() => {
    document.body.classList.toggle('light', isLight)
  }, [isLight])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: close sidebar and track mounted views on route/view change, not derivable from render
    setSidebarOpen(false)
    setMountedViews(prev => { prev.add(activeView); return new Set(prev) })
  }, [activeView])

  const bg = isLight ? '#f0f2f6' : '#0a0c10'

  if (!dbLoaded) {
    return (
      <AuthGate>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', background: bg,
          flexDirection: 'column', gap: 16,
        }}>
          <div style={{
            width: 40, height: 40, border: '3px solid rgba(0,229,195,0.2)',
            borderTopColor: isLight ? '#006a5b' : '#00e5c3', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <div style={{ fontSize: 13, color: '#5a6478', fontFamily: 'Space Mono, monospace' }}>
            Loading from database…
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </AuthGate>
    )
  }

  return (
    <AuthGate>
    <div style={{ display: 'flex', minHeight: '100vh', background: bg }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.6)' }}
          className="lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar wrapper — drawer on mobile */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 40,
        width: 240, transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
      }} className="sidebar-wrapper lg:hidden">
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Desktop sidebar — collapsible */}
      <div style={{ width: sidebarWidth, flexShrink: 0, transition: 'width 0.2s ease' }} className="hidden lg:block">
        <div style={{ position: 'sticky', top: 0, height: '100vh' }}>
          <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(c => !c)} />
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar — always visible, toggles sidebar */}
        <header
          style={{
            position: 'sticky', top: 0, zIndex: 20,
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '0 16px', height: 48,
            background: isLight ? 'rgba(255,255,255,0.92)' : 'rgba(17,20,24,0.92)',
            borderBottom: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <button
            onClick={() => {
              // On mobile (< lg), open the drawer; on desktop, toggle collapse
              if (window.innerWidth < 1024) setSidebarOpen(true)
              else setSidebarCollapsed(c => !c)
            }}
            style={{
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer',
              color: isLight ? '#374151' : '#a8b0be',
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
              style={{ transition: 'transform 0.2s', transform: sidebarCollapsed ? 'rotate(180deg)' : 'none' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
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

        {/* View — keep-alive: mount once, hide with display:none when inactive */}
        <main style={{ flex: 1, overflowY: 'auto', background: bg }}>
          {([
            ['mailmodo',    <MailmodoView key="mailmodo" filter="mailmodo" />],
            ['mailgun',     <MailgunView key="mailgun" />],
            ['netcore',     <MailmodoView key="netcore" filter="netcore" />],
            ['mms',         <MailmodoView key="mms" filter="mms" />],
            ['hotsol',      <MailmodoView key="hotsol" filter="hotsol" />],
            ['171mailsapp', <MailmodoView key="171mailsapp" filter="171mailsapp" />],
            ['moosend',     <MailmodoView key="moosend" filter="moosend" />],
            ['kenscio',     <KenscioView key="kenscio" />],
            ['mailjet',     <MailmodoView key="mailjet" filter="mailjet" />],
            ['elastic',     <MailmodoView key="elastic" filter="elastic" />],
            ['inboxroad',   <MailmodoView key="inboxroad" filter="inboxroad" />],
            ['map',         <MailmodoView key="map" filter="map" />],
            ['upload',      <UploadView key="upload" />],
            ['throttling',  <ThrottlingMatrixView key="throttling" />],
            ['regftds',     <RegFtdsView key="regftds" />],
            ['matrix',      <MatrixView key="matrix" />],
            ['datamgmt',    <DataMgmtView key="datamgmt" />],
            ['ipmatrix',    <IPMatrixView key="ipmatrix" />],
            ['logs',        <LogsView key="logs" />],
            ['analytics',   <AnalyticsView key="analytics" />],
            ['users',       <UsersView key="users" />],
            ['askai',       <AskAIView key="askai" ai={askAI} />],
          ] as [string, React.ReactNode][]).map(([id, node]) =>
            mountedViews.has(id) ? (
              <div key={id} style={{ display: activeView === id ? 'contents' : 'none' }}>
                {node}
              </div>
            ) : null
          )}
        </main>
        <AskAIBubble ai={askAI} activeView={activeView} />
      </div>
    </div>
    </AuthGate>
  )
}
