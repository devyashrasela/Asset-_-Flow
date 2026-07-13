import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus, Eye, EyeOff } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/common/Card'
import { Input } from '../../components/common/Input'
import { Label } from '../../components/common/Label'
import { Button } from '../../components/common/Button'
import { Alert } from '../../components/common/Alert'
import api from '../../api/axios'

export function Signup() {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const validate = () => {
    if (!name || !email || !password || !confirmPassword) {
      return 'Please fill in all fields.'
    }
    if (name.length < 2 || name.length > 100) {
      return 'Full name must be between 2 and 100 characters.'
    }
    if (password.length < 8) {
      return 'Password must be at least 8 characters.'
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must include at least 1 uppercase letter.'
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must include at least 1 lowercase letter.'
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must include at least 1 digit.'
    }
    if (password !== confirmPassword) {
      return 'Passwords do not match.'
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    try {
      // POST /api/auth/register → { message, user }
      await api.post('/auth/register', { name, email, password })

      // Backend doesn't return a token on register.
      // Redirect to login with success state.
      navigate('/login', {
        replace: true,
        state: { registrationSuccess: 'Account created successfully! Please sign in.' }
      })
    } catch (err) {
      setError(err?.response?.data?.error || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>Sign up to start managing your assets</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}

          <div className="space-y-1.5">
            <Label htmlFor="name" required>Full Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Jane Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" required>Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" required>Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Min 8 chars, 1 upper, 1 lower, 1 digit"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
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

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" required>Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 focus:outline-none"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" loading={loading} className="w-full">
            <UserPlus className="h-4 w-4" />
            Create account
          </Button>
        </form>
      </CardContent>

      <CardFooter>
        <p className="text-sm text-neutral-500 text-center w-full">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
