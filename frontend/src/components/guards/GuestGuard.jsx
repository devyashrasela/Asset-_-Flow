import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

/**
 * Protects auth pages from authenticated users.
 * Redirects to /workspaces if already logged in.
 */
export function GuestGuard({ children }) {
  const accessToken = useAuthStore((s) => s.accessToken)

  if (accessToken) {
    return <Navigate to="/workspaces" replace />
  }

  return children
}
