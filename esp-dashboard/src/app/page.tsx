'use client'
import { useEffect } from 'react'
import { useDashboardStore } from '@/lib/store'
import Sidebar from '@/components/layout/Sidebar'
import HomeView from '@/components/views/HomeView'
import DashboardView from '@/components/views/DashboardView'
import MailmodoView from '@/components/views/MailmodoView'
import UploadView from '@/components/views/UploadView'
import MatrixView from '@/components/views/MatrixView'
import DataMgmtView from '@/components/views/DataMgmtView'
import IPMatrixView from '@/components/views/IPMatrixView'

export default function Page() {
  const { activeView, isLight } = useDashboardStore()

  useEffect(() => {
    document.body.classList.toggle('light', isLight)
  }, [isLight])

  return (
    <div className={`relative z-[1] flex min-h-screen ${isLight ? 'bg-[#f0f2f6]' : 'bg-[#0a0c10]'}`}>
      <Sidebar />
      <main className={`flex-1 overflow-y-auto ${isLight ? 'bg-[#f0f2f6]' : 'bg-[#0a0c10]'}`}>
        {activeView === 'home' && <HomeView />}
        {activeView === 'dashboard' && <DashboardView />}
        {activeView === 'mailmodo' && <MailmodoView ctx="mailmodo" />}
        {activeView === 'ongage' && <MailmodoView ctx="ongage" />}
        {activeView === 'upload' && <UploadView />}
        {activeView === 'matrix' && <MatrixView />}
        {activeView === 'datamgmt' && <DataMgmtView />}
        {activeView === 'ipmatrix' && <IPMatrixView />}
        {activeView === 'performance' && (
          <div className="p-6">
            <h1 className={`text-2xl font-bold ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>Performance</h1>
            <p className={`text-sm mt-2 ${isLight ? 'text-gray-500' : 'text-[#a8b0be]'}`}>Performance benchmarking view — coming soon.</p>
          </div>
        )}
        {activeView === 'daily' && (
          <div className="p-6">
            <h1 className={`text-2xl font-bold ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>Daily View</h1>
            <p className={`text-sm mt-2 ${isLight ? 'text-gray-500' : 'text-[#a8b0be]'}`}>Daily trend analysis — coming soon.</p>
          </div>
        )}
        {(activeView === 'mmcharts' || activeView === 'ogcharts') && (
          <div className="p-6">
            <h1 className={`text-2xl font-bold ${isLight ? 'text-gray-900' : 'text-[#f0f2f5]'}`}>
              {activeView === 'mmcharts' ? 'Mailmodo' : 'Ongage'} Charts
            </h1>
            <p className={`text-sm mt-2 ${isLight ? 'text-gray-500' : 'text-[#a8b0be]'}`}>KPI chart view — coming soon.</p>
          </div>
        )}
      </main>
    </div>
  )
}
