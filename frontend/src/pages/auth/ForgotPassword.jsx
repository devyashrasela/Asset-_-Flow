import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/common/Card'
import { Input } from '../../components/common/Input'
import { Label } from '../../components/common/Label'
import { Button } from '../../components/common/Button'
import { Alert } from '../../components/common/Alert'
import api from '../../api/axios'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email) return

    setLoading(true)
    setError('')
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to send reset link.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-success-50">
              <CheckCircle2 className="h-6 w-6 text-success-600" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">Check your email</h3>
            <p className="text-sm text-neutral-500 mt-1">
              If an account exists for <span className="font-medium text-neutral-700">{email}</span>,
              a reset link has been sent.
            </p>
          </div>
          <Link to="/login">
            <Button variant="secondary" className="mt-2">
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
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a reset link
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}
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

          <Button type="submit" loading={loading} className="w-full">
            <Mail className="h-4 w-4" />
            Send reset link
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
