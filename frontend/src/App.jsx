import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { ScanFace, Images, HardDrive, Activity, LogOut, CalendarDays } from 'lucide-react'
import clsx from 'clsx'
import SearchPage      from './pages/SearchPage'
import LibraryPage     from './pages/LibraryPage'
import DrivePage       from './pages/DrivePage'
import EventsPage      from './pages/EventsPage'
import EventSearchPage from './pages/EventSearchPage'
import EventsAdminPage from './pages/EventsAdminPage'
import LoginPage       from './pages/LoginPage'
import AdminGuard      from './components/AdminGuard'

function AdminSidebar({ onLogout }) {
  const navigate = useNavigate()

  function logout() {
    localStorage.removeItem('admin_token')
    onLogout?.()
    navigate('/')
  }

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-gray-100 flex flex-col py-6 px-3">
      <div className="px-3 mb-8 flex items-center gap-3">
        <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center shadow-sm">
          <ScanFace size={20} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-sm leading-tight">Face Search</p>
          <p className="text-xs text-gray-400 leading-tight">Admin</p>
        </div>
      </div>

      <nav className="space-y-1 flex-1">
        {[
          { to: '/',           icon: ScanFace,     label: 'Tìm khuôn mặt', end: true },
          { to: '/library',    icon: Images,       label: 'Thư viện'               },
          { to: '/events',     icon: CalendarDays, label: 'Sự kiện'                },
          { to: '/admin',      icon: HardDrive,    label: 'Google Drive'            },
          { to: '/admin/events', icon: CalendarDays, label: 'Quản lý sự kiện'      },
        ].map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={!!end}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
              isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            )}>
            <Icon size={17} />{label}
          </NavLink>
        ))}

        <button onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all w-full text-left">
          <LogOut size={17} /> Đăng xuất
        </button>
      </nav>

      <div className="px-3 pt-4 border-t border-gray-100">
        <a href="/api/docs" target="_blank" rel="noreferrer"
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-brand-600 transition">
          <Activity size={13} /> API Docs
        </a>
      </div>
    </aside>
  )
}

function AdminLayout({ onLogout }) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <AdminSidebar onLogout={onLogout} />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/"              element={<SearchPage />} />
          <Route path="/library"       element={<LibraryPage />} />
          <Route path="/events"        element={<EventsPage />} />
          <Route path="/events/:id"    element={<EventSearchPage />} />
          <Route path="/admin"         element={<AdminGuard><DrivePage /></AdminGuard>} />
          <Route path="/admin/events"  element={<AdminGuard><EventsAdminPage /></AdminGuard>} />
          <Route path="*"              element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function RedirectToLogin() {
  return <Navigate to="/admin/login" replace />
}

function PublicLayout() {
  return (
    <div className="h-screen bg-gray-50 overflow-y-auto">
      <Routes>
        <Route path="/"           element={<SearchPage />} />
        <Route path="/library"    element={<LibraryPage />} />
        <Route path="/events"     element={<EventsPage />} />
        <Route path="/events/:id" element={<EventSearchPage />} />
        <Route path="/admin/*"    element={<RedirectToLogin />} />
        <Route path="*"           element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default function App() {
  const [isAdmin, setIsAdmin] = useState(!!localStorage.getItem('admin_token'))

  useEffect(() => {
    const handler = () => setIsAdmin(!!localStorage.getItem('admin_token'))
    window.addEventListener('storage', handler)
    window.addEventListener('auth-change', handler)
    return () => {
      window.removeEventListener('storage', handler)
      window.removeEventListener('auth-change', handler)
    }
  }, [])

  return (
    <Routes>
      <Route path="/admin/login" element={<LoginPage onLogin={() => { setIsAdmin(true); window.dispatchEvent(new Event('auth-change')) }} />} />
      <Route path="*" element={
        isAdmin
          ? <AdminLayout onLogout={() => setIsAdmin(false)} />
          : <PublicLayout />
      } />
    </Routes>
  )
}
