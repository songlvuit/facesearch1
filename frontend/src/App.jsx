import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { ScanFace, Images, HardDrive, Activity } from 'lucide-react'
import clsx from 'clsx'
import SearchPage  from './pages/SearchPage'
import LibraryPage from './pages/LibraryPage'
import DrivePage   from './pages/DrivePage'

const NAV = [
  { to: '/',        icon: ScanFace,  label: 'Tìm khuôn mặt' },
  { to: '/library', icon: Images,    label: 'Thư viện'       },
  { to: '/drive',   icon: HardDrive, label: 'Google Drive'   },
]

export default function App() {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-white border-r border-gray-100 flex flex-col py-6 px-3">
        {/* Logo */}
        <div className="px-3 mb-8 flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center shadow-sm shadow-brand-200">
            <ScanFace size={20} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm leading-tight">Face Search</p>
            <p className="text-xs text-gray-400 leading-tight">Tìm ảnh theo khuôn mặt</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="space-y-1 flex-1">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 pt-4 border-t border-gray-100">
          <a href="/api/docs" target="_blank" rel="noreferrer"
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-brand-600 transition">
            <Activity size={13} /> API Docs
          </a>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/"        element={<SearchPage  />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/drive"   element={<DrivePage   />} />
        </Routes>
      </main>
    </div>
  )
}
