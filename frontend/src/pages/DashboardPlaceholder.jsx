import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, LogOut } from 'lucide-react'
import { Button } from '../components/common/Button'
import { useAuthStore } from '../store/authStore'

/**
 * Placeholder dashboard — proves the full auth flow works.
 * Will be replaced with real dashboard in Phase 2.
 */
export function DashboardPlaceholder() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const currentRole = useAuthStore((s) => s.currentRole)
  const activeOrgId = useAuthStore((s) => s.activeOrgId)
  const workspaces = useAuthStore((s) => s.workspaces)
  const logout = useAuthStore((s) => s.logout)

  const activeOrg = workspaces.find((w) => w.org_id === activeOrgId)

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const handleSwitchWorkspace = () => {
    useAuthStore.getState().selectWorkspace(null)
    navigate('/workspaces', { replace: true })
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <div className="flex items-center justify-center h-16 w-16 rounded-xl bg-primary-50 border border-primary-200">
            <LayoutDashboard className="h-8 w-8 text-primary-600" />
          </div>
        </div>

        <div>
          <h1 className="text-page-title text-neutral-900">Dashboard</h1>
          <p className="text-sm text-neutral-500 mt-2">
            Auth flow complete. You are signed in.
          </p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-4 text-left text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-neutral-500">User</span>
            <span className="font-medium text-neutral-900">{user?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Email</span>
            <span className="font-medium text-neutral-900">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Workspace</span>
            <span className="font-medium text-neutral-900">{activeOrg?.org_name || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Role</span>
            <span className="inline-flex items-center text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5">
              {currentRole || '—'}
            </span>
          </div>
        </div>

        <div className="flex gap-2 justify-center">
          <Button variant="secondary" onClick={handleSwitchWorkspace}>
            Switch workspace
          </Button>
          <Button variant="danger" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}
