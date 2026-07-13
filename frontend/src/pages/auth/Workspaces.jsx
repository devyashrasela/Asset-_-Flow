import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, Plus, LogOut, Users, ArrowRight, Building2, Loader2 } from 'lucide-react'
import { Card, CardContent } from '../../components/common/Card'
import { Input } from '../../components/common/Input'
import { Label } from '../../components/common/Label'
import { Button } from '../../components/common/Button'
import { Alert } from '../../components/common/Alert'
import { useAuthStore } from '../../store/authStore'
import api from '../../api/axios'

export function Workspaces() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const workspaces = useAuthStore((s) => s.workspaces)
  const setWorkspaces = useAuthStore((s) => s.setWorkspaces)
  const selectWorkspace = useAuthStore((s) => s.selectWorkspace)
  const addWorkspace = useAuthStore((s) => s.addWorkspace)
  const logout = useAuthStore((s) => s.logout)

  const [showCreate, setShowCreate] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [slug, setSlug] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [loadingOrgs, setLoadingOrgs] = useState(true)

  // Fetch workspaces from real backend on mount
  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const { data } = await api.get('/auth/workspaces')
        // Backend returns array of workspaces: { org_id, org_name, slug, role, status }
        const mapped = data.map((ws) => ({
          org_id: ws.org_id,
          org_name: ws.org_name,
          slug: ws.slug,
          role: ws.role,
          status: ws.status,
          member_count: null,
        }))
        setWorkspaces(mapped)
      } catch (err) {
        console.error('Failed to fetch workspaces:', err)
      } finally {
        setLoadingOrgs(false)
      }
    }
    fetchOrgs()
  }, [setWorkspaces])

  const handleSelectWorkspace = async (orgId) => {
    setError('')
    try {
      const { data } = await api.post('/auth/workspaces/select', { org_id: orgId })
      if (data.success) {
        selectWorkspace(orgId)
        navigate('/dashboard', { replace: true })
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to select workspace.')
    }
  }

  const handleCreateOrg = async (e) => {
    e.preventDefault()
    setError('')

    if (!orgName || orgName.length < 2) {
      setError('Organization name must be at least 2 characters.')
      return
    }

    const orgSlug = slug || orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    setCreating(true)
    try {
      // POST /api/auth/workspaces → { message, organization }
      const { data } = await api.post('/auth/workspaces', {
        name: orgName,
        slug: orgSlug,
      })

      const newOrg = {
        org_id: data.organization.id,
        org_name: data.organization.name,
        slug: data.organization.slug,
        role: 'Admin', // Creator is always Admin
        status: 'Active',
        member_count: 1,
      }

      addWorkspace(newOrg)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to create workspace.')
    } finally {
      setCreating(false)
    }
  }

  const handleNameChange = (value) => {
    setOrgName(value)
    setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  }

  if (loadingOrgs) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Mini header */}
      <div className="border-b border-neutral-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary-600">
              <Package className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-semibold text-neutral-900">AssetFlow</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-500">{user?.email}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { logout(); navigate('/login', { replace: true }) }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-xl space-y-6">
          <div>
            <h1 className="text-page-title text-neutral-900">
              Welcome back, {user?.name?.split(' ')[0]}
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Select a workspace to continue, or create a new one.
            </p>
          </div>

          {error && <Alert variant="error">{error}</Alert>}

          {/* Workspace list */}
          {workspaces.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                Your Workspaces
              </h2>
              {workspaces.map((ws) => (
                <Card
                  key={ws.org_id}
                  className="cursor-pointer hover:border-primary-300 hover:shadow-md transition-all duration-150"
                  onClick={() => handleSelectWorkspace(ws.org_id)}
                >
                  <CardContent className="py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-neutral-100">
                        <Building2 className="h-5 w-5 text-neutral-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-neutral-900">{ws.org_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-neutral-500">{ws.slug}</span>
                          <span className="text-neutral-300">·</span>
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5">
                            {ws.role}
                          </span>
                          {ws.member_count && (
                            <>
                              <span className="text-neutral-300">·</span>
                              <span className="text-xs text-neutral-400 inline-flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {ws.member_count}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-neutral-400" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* No workspaces empty state */}
          {workspaces.length === 0 && !showCreate && (
            <Card>
              <CardContent className="py-10 text-center space-y-4">
                <div className="flex justify-center">
                  <div className="flex items-center justify-center h-14 w-14 rounded-full bg-neutral-100">
                    <Building2 className="h-7 w-7 text-neutral-400" />
                  </div>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-neutral-900">No workspaces yet</h3>
                  <p className="text-sm text-neutral-500 mt-1">
                    Create a new workspace to get started, or wait for an admin to invite you.
                  </p>
                </div>
                <Button onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4" />
                  Create a New Workspace
                </Button>
                <Alert variant="info" className="text-left mt-4">
                  <span className="text-xs">
                    If you&apos;re expecting an invitation, ask your workspace Admin to invite you via email.
                  </span>
                </Alert>
              </CardContent>
            </Card>
          )}

          {/* Create workspace form */}
          {(showCreate || workspaces.length > 0) && (
            <div>
              {workspaces.length > 0 && !showCreate && (
                <Button variant="secondary" onClick={() => setShowCreate(true)} className="w-full">
                  <Plus className="h-4 w-4" />
                  Create another workspace
                </Button>
              )}

              {showCreate && (
                <Card>
                  <CardContent className="py-5">
                    <h3 className="text-sm font-semibold text-neutral-900 mb-4">Create Workspace</h3>
                    <form onSubmit={handleCreateOrg} className="space-y-4">
                      {error && <Alert variant="error">{error}</Alert>}

                      <div className="space-y-1.5">
                        <Label htmlFor="orgName" required>Organization Name</Label>
                        <Input
                          id="orgName"
                          type="text"
                          placeholder="Acme Corporation"
                          value={orgName}
                          onChange={(e) => handleNameChange(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="slug" required>Workspace Slug</Label>
                        <Input
                          id="slug"
                          type="text"
                          placeholder="acme-corporation"
                          value={slug}
                          onChange={(e) => setSlug(e.target.value)}
                        />
                        <p className="text-xs text-neutral-400">Auto-generated. You can customize it.</p>
                      </div>

                      <div className="flex gap-2">
                        <Button type="submit" loading={creating}>
                          <Plus className="h-4 w-4" />
                          Create
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
