import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

/**
 * Requires both auth + active workspace.
 * Redirects to /workspaces if no org selected.
 * Redirects to /login if not authenticated.
 */
export function WorkspaceGuard({ children }) {
  const accessToken = useAuthStore((s) => s.accessToken)
  const activeOrgId = useAuthStore((s) => s.activeOrgId)

  if (!accessToken) {
    return <Navigate to="/login" replace />
  }

  if (!activeOrgId) {
    return <Navigate to="/workspaces" replace />
  }

  return children
}
