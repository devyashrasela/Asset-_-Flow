import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardCheck, Plus, Filter, Search, ChevronRight, Calendar, Users
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/common/Button'
import { Input } from '../components/common/Input'
import { Label } from '../components/common/Label'
import { Alert } from '../components/common/Alert'
import { cn } from '../utils'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'

const STATUS_COLORS = {
  Draft:  'bg-slate-100 text-slate-600',
  Active: 'bg-blue-50 text-blue-700',
  Closed: 'bg-neutral-100 text-neutral-600',
}

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--'

export function AuditCycles() {
  const navigate = useNavigate()
  const activeOrgId = useAuthStore((s) => s.activeOrgId)
  const workspaces = useAuthStore((s) => s.workspaces)
  const activeOrg = workspaces.find((w) => w.org_id === activeOrgId)
  const currentRole = useAuthStore((s) => s.currentRole)
  const canManage = currentRole === 'Admin' || currentRole === 'Asset Manager'

  const [cycles, setCycles] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [search, setSearch] = useState('')

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', department_id: '', start_date: '', end_date: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const fetchCycles = async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      if (deptFilter) params.department_id = deptFilter
      if (search) params.search = search
      const { data } = await api.get('/audit/cycles', { params })
      setCycles(data)
    } catch (err) {
      console.error('Failed to fetch audit cycles:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchDepartments = async () => {
    try {
      const { data } = await api.get('/org/departments')
      setDepartments(data)
    } catch (err) {
      console.error('Failed to fetch departments:', err)
    }
  }

  useEffect(() => {
    fetchCycles()
    fetchDepartments()
  }, [activeOrgId])

  useEffect(() => {
    const timer = setTimeout(() => fetchCycles(), 300)
    return () => clearTimeout(timer)
  }, [search, statusFilter, deptFilter])

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreateError('')
    if (!createForm.name.trim()) {
      setCreateError('Cycle name is required.')
      return
    }
    if (!createForm.department_id) {
      setCreateError('Target department is required.')
      return
    }
    if (!createForm.start_date || !createForm.end_date) {
      setCreateError('Start and end dates are required.')
      return
    }

    const todayStr = new Date().toISOString().split('T')[0]
    if (createForm.start_date < todayStr) {
      setCreateError('Start date cannot be in the past.')
      return
    }
    if (createForm.end_date < createForm.start_date) {
      setCreateError('End date must be on or after start date.')
      return
    }

    setCreating(true)
    try {
      await api.post('/audit/cycles', {
        name: createForm.name,
        target_department_id: createForm.department_id,
        start_date: createForm.start_date,
        end_date: createForm.end_date,
      })
      setShowCreate(false)
      setCreateForm({ name: '', department_id: '', start_date: '', end_date: '' })
      fetchCycles()
    } catch (err) {
      setCreateError(err?.response?.data?.error || 'Failed to create audit cycle.')
    } finally {
      setCreating(false)
    }
  }

  const filtered = cycles.filter((c) => {
    if (search) {
      const q = search.toLowerCase()
      if (!c.name?.toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <>
      <Header breadcrumbs={[activeOrg?.org_name || 'Workspace', 'Audit']} />

      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        {/* Page Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-page-title text-neutral-900">Audit Cycles</h1>
            <p className="text-sm text-neutral-500 mt-1">Physical verification cycles for organizational assets.</p>
          </div>
          {canManage && (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> Create Audit Cycle
            </Button>
          )}
        </div>

        {/* Filters + Table */}
        <div className="bg-white border border-neutral-200 rounded-lg">
          <div className="p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-neutral-200">
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input
                  placeholder="Search cycles..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Status: All</option>
                <option>Draft</option>
                <option>Active</option>
                <option>Closed</option>
              </select>
              <select
                className="h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <span className="text-xs text-neutral-500 font-medium">{filtered.length} cycle{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200">
                  <th className="py-3 px-4 text-table-header">Cycle Name</th>
                  <th className="py-3 px-4 text-table-header">Department</th>
                  <th className="py-3 px-4 text-table-header">Date Range</th>
                  <th className="py-3 px-4 text-table-header">Status</th>
                  <th className="py-3 px-4 text-table-header">Auditors</th>
                  <th className="py-3 px-4 text-table-header">Progress</th>
                  <th className="py-3 px-4 text-table-header w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan="7" className="p-4">
                        <div className="h-6 bg-neutral-100 animate-pulse rounded" />
                      </td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-12 text-center">
                      <ClipboardCheck className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
                      <p className="text-sm text-neutral-500">
                        No audit cycles found.{' '}
                        {canManage && 'Click "Create Audit Cycle" to start one.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((cycle) => {
                    const verified = cycle.verified_count ?? 0
                    const total = cycle.total_items ?? 0
                    return (
                      <tr
                        key={cycle.id}
                        className="hover:bg-neutral-50/70 transition-colors cursor-pointer h-12"
                        onClick={() => navigate(`/audit/${cycle.id}`)}
                      >
                        <td className="py-2 px-4 text-sm font-medium text-neutral-900">{cycle.name}</td>
                        <td className="py-2 px-4 text-sm text-neutral-600">{cycle.Department?.name || cycle.department_name || '--'}</td>
                        <td className="py-2 px-4 text-sm text-neutral-600">
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                            {formatDate(cycle.start_date)} — {formatDate(cycle.end_date)}
                          </span>
                        </td>
                        <td className="py-2 px-4">
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold', STATUS_COLORS[cycle.status] || '')}>
                            {cycle.status}
                          </span>
                        </td>
                        <td className="py-2 px-4">
                          <span className="inline-flex items-center gap-1 text-sm text-neutral-600">
                            <Users className="h-3.5 w-3.5 text-neutral-400" />
                            {cycle.auditor_count ?? cycle.Auditors?.length ?? 0}
                          </span>
                        </td>
                        <td className="py-2 px-4">
                          {total > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full transition-all"
                                  style={{ width: `${Math.round((verified / total) * 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-neutral-500 font-medium">{verified}/{total}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-neutral-400">No items</span>
                          )}
                        </td>
                        <td className="py-2 px-4">
                          <ChevronRight className="h-4 w-4 text-neutral-400" />
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 border-t border-neutral-200 bg-neutral-50/50 text-xs text-neutral-500">
            Showing {filtered.length} entries
          </div>
        </div>

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-neutral-200">
                <h2 className="text-lg font-semibold text-neutral-900">Create Audit Cycle</h2>
                <p className="text-sm text-neutral-500 mt-1">Set up a new physical verification cycle.</p>
              </div>
              <form onSubmit={handleCreate} className="p-6 space-y-4">
                {createError && <Alert variant="error">{createError}</Alert>}

                <div className="space-y-1.5">
                  <Label required>Cycle Name</Label>
                  <Input
                    value={createForm.name}
                    onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Q3 2026 IT Equipment Audit"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label required>Target Department</Label>
                  <select
                    className="w-full h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                    value={createForm.department_id}
                    onChange={(e) => setCreateForm((p) => ({ ...p, department_id: e.target.value }))}
                  >
                    <option value="">Select a department...</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label required>Start Date</Label>
                    <Input
                      type="date"
                      value={createForm.start_date}
                      onChange={(e) => setCreateForm((p) => ({ ...p, start_date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label required>End Date</Label>
                    <Input
                      type="date"
                      value={createForm.end_date}
                      onChange={(e) => setCreateForm((p) => ({ ...p, end_date: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-neutral-200">
                  <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
                  <Button type="submit" loading={creating}>
                    <Plus className="h-4 w-4" /> Create Cycle
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
