import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { LogIn, Eye, EyeOff } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/common/Card'
import { Input } from '../../components/common/Input'
import { Label } from '../../components/common/Label'
import { Button } from '../../components/common/Button'
import { Alert } from '../../components/common/Alert'
import { useAuthStore } from '../../store/authStore'
import api from '../../api/axios'

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((s) => s.login)

  const registrationSuccess = location.state?.registrationSuccess
  const sessionExpired = new URLSearchParams(location.search).get('session_expired')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Please fill in all fields.')
      return
    }

    setLoading(true)
    try {
      // POST /api/auth/login → { token, user: { id, name, email } }
      const { data } = await api.post('/auth/login', { email, password })

      // Store token + user in Zustand (no workspaces yet — fetched on /workspaces page)
      login({
        user: data.user,
        accessToken: data.token,
        workspaces: []
      })

      navigate('/workspaces')
    } catch (err) {
      console.error('Login error:', err)
      setError(err?.response?.data?.error || err.message || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in to your account</CardTitle>
        <CardDescription>Enter your credentials to access your workspace</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {registrationSuccess && <Alert variant="success">{registrationSuccess}</Alert>}
          {sessionExpired && <Alert variant="warning">Your session has expired. Please log in again.</Alert>}
          {error && <Alert variant="error">{error}</Alert>}

          <div className="space-y-1.5">
            <Label htmlFor="email" required>Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={!!error}
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" required>Password</Label>
              <Link
                to="/forgot-password"
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={!!error}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 focus:outline-none"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" loading={loading} className="w-full">
            <LogIn className="h-4 w-4" />
            Sign in
          </Button>
        </form>
      </CardContent>

      <CardFooter>
        <p className="text-sm text-neutral-500 text-center w-full">
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="text-primary-600 hover:text-primary-700 font-medium">
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
