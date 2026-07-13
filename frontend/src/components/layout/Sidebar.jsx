import { NavLink, useNavigate } from 'react-router-dom'
import {
  Package,
  LayoutDashboard,
  Box,
  UserCheck,
  Calendar,
  Wrench,
  ClipboardCheck,
  BarChart3,
  History,
  Building2,
  Settings,
  LogOut,
  ChevronDown,
} from 'lucide-react'
import { cn } from '../../utils'
import { useAuthStore } from '../../store/authStore'

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Assets', icon: Box, path: '/assets' },
  { label: 'Allocations', icon: UserCheck, path: '/allocations' },
  { label: 'Bookings', icon: Calendar, path: '/bookings' },
  { label: 'Maintenance', icon: Wrench, path: '/maintenance' },
  { label: 'Audit', icon: ClipboardCheck, path: '/audit' },
  { label: 'Reports', icon: BarChart3, path: '/reports' },
  { label: 'Activity Log', icon: History, path: '/activity-log' },
  { label: 'Organization', icon: Building2, path: '/organization-setup' },
  { label: 'Settings', icon: Settings, path: '/settings' },
]

export function Sidebar() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const workspaces = useAuthStore((s) => s.workspaces)
  const activeOrgId = useAuthStore((s) => s.activeOrgId)
  const currentRole = useAuthStore((s) => s.currentRole)
  const logout = useAuthStore((s) => s.logout)

  const activeOrg = workspaces.find((w) => w.org_id === activeOrgId)

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  // Filter nav by role
  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.path === '/organization-setup' && currentRole === 'Employee') return false
    if (item.path === '/audit' && !['Admin', 'Asset Manager'].includes(currentRole)) return false
    if (item.path === '/reports' && !['Admin', 'Asset Manager'].includes(currentRole)) return false
    if (item.path === '/activity-log' && currentRole === 'Employee') return false
    return true
  })

  return (
    <aside className="fixed top-0 left-0 z-40 h-screen w-[260px] bg-neutral-900 text-white flex flex-col">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg">
            <img src="/favicon.png" alt="Logo" className="h-8 w-8" />
          </div>
          <span className="text-base font-semibold tracking-tight">AssetFlow</span>
        </div>
      </div>

      {/* Workspace Switcher */}
      <div className="px-3 py-3 border-b border-white/10">
        <button
          onClick={() => {
            useAuthStore.getState().selectWorkspace(null)
            navigate('/workspaces')
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-white/5 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center justify-center h-8 w-8 rounded-md bg-white/10 text-sm font-semibold shrink-0">
            {activeOrg?.org_name?.charAt(0) || 'W'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {activeOrg?.org_name || 'Workspace'}
            </p>
            <p className="text-xs text-neutral-400 truncate">{currentRole}</p>
          </div>
          <ChevronDown className="h-4 w-4 text-neutral-400 shrink-0" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {visibleNav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-white/10">
        <div className="flex items-center gap-2.5 px-2.5">
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary-600/20 text-primary-400 text-xs font-semibold shrink-0">
            {user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-neutral-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
