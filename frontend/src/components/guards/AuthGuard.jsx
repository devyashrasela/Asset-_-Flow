import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

/**
 * Protects routes that require authentication.
 * Redirects to /login if no token.
 */
export function AuthGuard({ children }) {
  const accessToken = useAuthStore((s) => s.accessToken)
  const location = useLocation()

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
