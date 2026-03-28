import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from './dashboard/Header.jsx'
import Sidebar from './dashboard/Sidebar.jsx'

export default function AdminLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-[#F7FAFC] font-sans text-slate-800 antialiased">
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex min-h-screen flex-1 flex-col lg:ml-[260px]">
        <Header onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
