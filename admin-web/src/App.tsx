import { Routes, Route, NavLink } from 'react-router-dom'
import { LayoutDashboard, Route as RouteIcon, Megaphone, Settings } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import RoutesPage from './pages/Routes'
import News from './pages/News'
import SettingsPage from './pages/Settings'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/routes', label: 'Trasee', icon: RouteIcon },
  { to: '/news', label: 'Noutăți', icon: Megaphone },
  { to: '/settings', label: 'Setări & QR', icon: Settings },
]

function App() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Sidebar ─────────────────────────── */}
      <aside className="w-64 flex-shrink-0 bg-slate-900 text-slate-300 flex flex-col">
        <div className="px-6 py-6">
          <span className="text-xl font-extrabold tracking-tight text-white">
            CLaiMB <span className="text-cyan-400">Admin</span>
          </span>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'hover:bg-slate-800/60 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 text-xs text-slate-500">
          © 2026 CLaiMB
        </div>
      </aside>

      {/* ── Main Area ───────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 flex-shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <span className="text-sm font-semibold text-slate-700">Panou Administrare Sală</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">Admin</span>
            <div className="w-8 h-8 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center text-sm font-bold">
              A
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/routes" element={<RoutesPage />} />
            <Route path="/news" element={<News />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default App
