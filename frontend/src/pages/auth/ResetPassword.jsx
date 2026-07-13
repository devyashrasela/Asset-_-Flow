import { useState } from 'react'
import { Link, useSearchParams, Navigate } from 'react-router-dom'
import { KeyRound, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/common/Card'
import { Input } from '../../components/common/Input'
import { Label } from '../../components/common/Label'
import { Button } from '../../components/common/Button'
import { Alert } from '../../components/common/Alert'
import api from '../../api/axios'

export function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // No token → redirect to forgot-password
  if (!token) {
    return <Navigate to="/forgot-password" replace />
  }

  const validate = () => {
    if (!password || !confirmPassword) return 'Please fill in all fields.'
    if (password.length < 8) return 'Password must be at least 8 characters.'
    if (!/[A-Z]/.test(password)) return 'Password must include at least 1 uppercase letter.'
    if (!/[a-z]/.test(password)) return 'Password must include at least 1 lowercase letter.'
    if (!/[0-9]/.test(password)) return 'Password must include at least 1 digit.'
    if (password !== confirmPassword) return 'Passwords do not match.'
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
      await api.post('/auth/reset-password', { token, password })
      setSuccess(true)
    } catch (err) {
      setError(err?.response?.data?.error || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-4">
          <Alert variant="success">Password reset successfully. Please log in.</Alert>
          <Link to="/login">
            <Button variant="primary" className="mt-2">
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set new password</CardTitle>
        <CardDescription>Choose a strong password for your account</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}

          <div className="space-y-1.5">
            <Label htmlFor="password" required>New Password</Label>
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
            <KeyRound className="h-4 w-4" />
            Reset password
          </Button>
        </form>
      </CardContent>

      <CardFooter>
        <p className="text-sm text-neutral-500 text-center w-full">
          <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
