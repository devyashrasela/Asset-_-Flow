import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Plus, Search, Wrench, Clock, CheckCircle, XCircle, PlayCircle,
  ChevronRight, X, AlertTriangle, Camera, User
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/common/Button'
import { Input } from '../components/common/Input'
import { Label } from '../components/common/Label'
import { Alert } from '../components/common/Alert'
import { cn } from '../utils'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'

// ── Status & Priority color maps (light theme) ──────────────────────────────────
const STATUS_COLORS = {
  'Pending':      'bg-amber-50 text-amber-700 border-amber-200',
  'Approved':     'bg-blue-50 text-blue-700 border-blue-200',
  'In Progress':  'bg-orange-50 text-orange-700 border-orange-200',
  'Resolved':     'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Rejected':     'bg-red-50 text-red-700 border-red-200',
}

const PRIORITY_COLORS = {
  'Low':      'bg-blue-50 text-blue-600 border-blue-200',
  'Medium':   'bg-amber-50 text-amber-600 border-amber-200',
  'High':     'bg-orange-50 text-orange-600 border-orange-200',
  'Critical': 'bg-red-50 text-red-600 border-red-200',
}

const KANBAN_LANE = {
  'Pending':     { icon: Clock,       color: 'border-amber-300',   dot: 'bg-amber-400',   header: 'text-amber-700' },
  'Approved':    { icon: CheckCircle, color: 'border-blue-300',    dot: 'bg-blue-400',     header: 'text-blue-700' },
  'In Progress': { icon: PlayCircle,  color: 'border-orange-300',  dot: 'bg-orange-400',   header: 'text-orange-700' },
  'Resolved':    { icon: CheckCircle, color: 'border-emerald-300', dot: 'bg-emerald-400',  header: 'text-emerald-700' },
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function Maintenance() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const currentRole = useAuthStore((s) => s.currentRole)
  const activeOrgId = useAuthStore((s) => s.activeOrgId)
  const workspaces = useAuthStore((s) => s.workspaces)
  const activeOrg = workspaces.find((w) => w.org_id === activeOrgId)

  const isManager = ['Admin', 'Asset Manager'].includes(currentRole)
  const isListView = pathname.includes('/list')

  // ── Shared state ────────────────────────────────────────────────────────────
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [assetSearch, setAssetSearch] = useState('')

  // Modals
  const [showRaiseModal, setShowRaiseModal] = useState(false)
  const [showDetailDrawer, setShowDetailDrawer] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showTechModal, setShowTechModal] = useState(false)
  const [showResolveConfirm, setShowResolveConfirm] = useState(false)
  const [activeRequest, setActiveRequest] = useState(null)
  const [detailData, setDetailData] = useState(null)

  // Raise form
  const [raiseAssetTag, setRaiseAssetTag] = useState('')
  const [raiseDescription, setRaiseDescription] = useState('')
  const [raisePriority, setRaisePriority] = useState('Medium')
  const [raisePhotoUrl, setRaisePhotoUrl] = useState('')
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  // Reject / Tech form
  const [rejectReason, setRejectReason] = useState('')
  const [techName, setTechName] = useState('')
  const [techNotes, setTechNotes] = useState('')

  // ── Fetch requests ──────────────────────────────────────────────────────────
  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.append('status', statusFilter)
      if (priorityFilter) params.append('priority', priorityFilter)
      if (assetSearch) params.append('asset_tag', assetSearch)
      const { data } = await api.get(`/maintenance?${params.toString()}`)
      setRequests(data)
    } catch (err) {
      console.error('Error fetching maintenance requests:', err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, priorityFilter, assetSearch])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  // ── Fetch detail ────────────────────────────────────────────────────────────
  const openDetail = async (req) => {
    setActiveRequest(req)
    try {
      const { data } = await api.get(`/maintenance/${req.id}`)
      setDetailData(data)
      setShowDetailDrawer(true)
    } catch {
      setDetailData(req)
      setShowDetailDrawer(true)
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleRaiseSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    setFormLoading(true)
    try {
      await api.post('/maintenance', {
        asset_tag: raiseAssetTag.trim(),
        issue_description: raiseDescription,
        priority: raisePriority,
        photo_url: raisePhotoUrl || null,
      })
      setShowRaiseModal(false)
      setRaiseAssetTag(''); setRaiseDescription(''); setRaisePriority('Medium'); setRaisePhotoUrl('')
      fetchRequests()
    } catch (err) {
      setFormError(err.response?.data?.error || err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const handleApprove = async (id) => {
    if (!window.confirm('Approve this maintenance request? The asset will be marked Under Maintenance.')) return
    try {
      await api.patch(`/maintenance/${id}/approve`)
      setShowDetailDrawer(false)
      fetchRequests()
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    }
  }

  const handleRejectSubmit = async (e) => {
    e.preventDefault()
    try {
      await api.patch(`/maintenance/${activeRequest.id}/reject`, { reason: rejectReason })
      setShowRejectModal(false); setRejectReason(''); setShowDetailDrawer(false)
      fetchRequests()
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    }
  }

  const handleStartSubmit = async (e) => {
    e.preventDefault()
    if (!techName.trim()) return
    try {
      await api.patch(`/maintenance/${activeRequest.id}/start`, { technician_name: techName, notes: techNotes })
      setShowTechModal(false); setTechName(''); setTechNotes(''); setShowDetailDrawer(false)
      fetchRequests()
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    }
  }

  const handleResolve = async () => {
    try {
      await api.patch(`/maintenance/${activeRequest.id}/resolve`)
      setShowResolveConfirm(false); setShowDetailDrawer(false)
      fetchRequests()
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    }
  }

  // ── Drag & Drop ─────────────────────────────────────────────────────────────
  const [dragItem, setDragItem] = useState(null)
  const allowedTransitions = { 'Pending': ['Approved'], 'Approved': ['In Progress'], 'In Progress': ['Resolved'] }

  const handleDragStart = (e, request) => { setDragItem(request); e.dataTransfer.effectAllowed = 'move' }
  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
  const handleDrop = (e, targetStatus) => {
    e.preventDefault()
    if (!dragItem) return
    const allowed = allowedTransitions[dragItem.status] || []
    if (!allowed.includes(targetStatus)) { setDragItem(null); return }
    setActiveRequest(dragItem)
    if (targetStatus === 'Approved') handleApprove(dragItem.id)
    else if (targetStatus === 'In Progress') { setTechName(''); setTechNotes(''); setShowTechModal(true) }
    else if (targetStatus === 'Resolved') setShowResolveConfirm(true)
    setDragItem(null)
  }

  const [resolvedCollapsed, setResolvedCollapsed] = useState(true)

  // ── Summary counts ──────────────────────────────────────────────────────────
  const pendingCount = requests.filter(r => r.status === 'Pending').length
  const approvedCount = requests.filter(r => r.status === 'Approved').length
  const inProgressCount = requests.filter(r => r.status === 'In Progress').length
  const resolvedCount = requests.filter(r => r.status === 'Resolved').length

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <>
      <Header breadcrumbs={[activeOrg?.org_name || 'Workspace', 'Maintenance']} onRefresh={fetchRequests} />

      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        {/* Page Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-page-title text-neutral-900">Maintenance Management</h1>
            <p className="text-sm text-neutral-500 mt-1">Track repair requests, assign technicians, and manage the maintenance lifecycle.</p>
          </div>
          <div className="flex gap-2 items-center">
            {isManager && (
              <div className="flex border border-neutral-200 rounded-md overflow-hidden mr-2">
                <button
                  onClick={() => navigate('/maintenance')}
                  className={cn('px-3 py-1.5 text-xs font-medium transition-colors', !isListView ? 'bg-primary-50 text-primary-600' : 'bg-white text-neutral-500 hover:bg-neutral-50')}
                >
                  Kanban
                </button>
                <button
                  onClick={() => navigate('/maintenance/list')}
                  className={cn('px-3 py-1.5 text-xs font-medium transition-colors', isListView ? 'bg-primary-50 text-primary-600' : 'bg-white text-neutral-500 hover:bg-neutral-50')}
                >
                  List
                </button>
              </div>
            )}
            <Button onClick={() => { setFormError(''); setRaiseAssetTag(''); setRaiseDescription(''); setRaisePriority('Medium'); setRaisePhotoUrl(''); setShowRaiseModal(true) }}>
              <Plus className="h-4 w-4" /> Raise Request
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Pending', value: pendingCount, icon: Clock, color: 'text-amber-600 bg-amber-50' },
            { label: 'Approved', value: approvedCount, icon: CheckCircle, color: 'text-blue-600 bg-blue-50' },
            { label: 'In Progress', value: inProgressCount, icon: PlayCircle, color: 'text-orange-600 bg-orange-50' },
            { label: 'Resolved', value: resolvedCount, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
          ].map(c => (
            <div key={c.label} className="bg-white border border-neutral-200 rounded-lg p-4 flex items-center gap-3">
              <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', c.color)}>
                <c.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider font-medium">{c.label}</p>
                <p className="text-xl font-semibold text-neutral-900">{c.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ────────────────────────────────────────────────────────────────────── */}
        {/* KANBAN VIEW                                                           */}
        {/* ────────────────────────────────────────────────────────────────────── */}
        {!isListView && isManager && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {['Pending', 'Approved', 'In Progress', 'Resolved'].map((status) => {
              const lane = KANBAN_LANE[status]
              const cards = requests.filter(r => r.status === status)
              const isResolved = status === 'Resolved'
              const visibleCards = isResolved && resolvedCollapsed ? cards.slice(0, 3) : cards

              return (
                <div
                  key={status}
                  className={cn('flex flex-col rounded-lg border bg-white overflow-hidden', lane.color)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, status)}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-neutral-50/50">
                    <div className="flex items-center gap-2">
                      <span className={cn('w-2 h-2 rounded-full', lane.dot)} />
                      <span className={cn('font-semibold text-sm', lane.header)}>{status}</span>
                    </div>
                    <span className="bg-neutral-100 text-neutral-600 text-xs font-bold px-2 py-0.5 rounded-full">{cards.length}</span>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[520px]">
                    {visibleCards.map((req) => (
                      <div
                        key={req.id}
                        draggable={!['Resolved', 'Rejected'].includes(req.status)}
                        onDragStart={(e) => handleDragStart(e, req)}
                        onClick={() => openDetail(req)}
                        className="bg-white border border-neutral-200 rounded-lg p-3.5 cursor-pointer hover:border-primary-300 hover:shadow-sm transition-all active:scale-[0.98]"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-neutral-900 truncate">{req.Asset?.name || req.asset_tag}</p>
                            <p className="text-[11px] text-neutral-400 font-mono">{req.asset_tag}</p>
                          </div>
                          <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ml-2', PRIORITY_COLORS[req.priority])}>
                            {req.priority}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500 line-clamp-2 mb-2">{req.issue_description}</p>
                        {req.photo_url && (
                          <div className="flex items-center gap-1 text-[10px] text-neutral-400 mb-2">
                            <Camera className="h-3 w-3" /> Photo attached
                          </div>
                        )}
                        <div className="flex justify-between items-center text-[11px] text-neutral-400 border-t border-neutral-100 pt-2">
                          <span className="flex items-center gap-1"><User className="h-3 w-3" />{req.RaisedBy?.name || 'User'}</span>
                          <span>{timeAgo(req.created_at)}</span>
                        </div>
                      </div>
                    ))}

                    {isResolved && resolvedCollapsed && cards.length > 3 && (
                      <button
                        onClick={() => setResolvedCollapsed(false)}
                        className="w-full text-center text-xs text-neutral-500 hover:text-primary-600 py-2.5 border border-dashed border-neutral-200 rounded-md transition-colors"
                      >
                        Show {cards.length - 3} more resolved…
                      </button>
                    )}
                    {cards.length === 0 && (
                      <div className="text-center py-8">
                        <Wrench className="h-8 w-8 text-neutral-200 mx-auto mb-2" />
                        <p className="text-xs text-neutral-400">No requests</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────── */}
        {/* LIST VIEW                                                             */}
        {/* ────────────────────────────────────────────────────────────────────── */}
        {(isListView || !isManager) && (
          <div className="bg-white border border-neutral-200 rounded-lg">
            {/* Filters */}
            <div className="p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-neutral-200">
              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <Input
                    placeholder="Search by asset tag..."
                    className="pl-9"
                    value={assetSearch}
                    onChange={(e) => setAssetSearch(e.target.value)}
                  />
                </div>
                <select
                  className="h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option>Pending</option>
                  <option>Approved</option>
                  <option>Rejected</option>
                  <option>In Progress</option>
                  <option>Resolved</option>
                </select>
                <select
                  className="h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  <option value="">All Priorities</option>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
              </div>
              <span className="text-xs text-neutral-500 font-medium">Showing {requests.length} requests</span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200">
                    <th className="py-3 px-4 text-table-header">ID</th>
                    <th className="py-3 px-4 text-table-header">Asset</th>
                    <th className="py-3 px-4 text-table-header">Raised By</th>
                    <th className="py-3 px-4 text-table-header">Issue</th>
                    <th className="py-3 px-4 text-table-header">Priority</th>
                    <th className="py-3 px-4 text-table-header">Status</th>
                    <th className="py-3 px-4 text-table-header">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {loading ? (
                    [...Array(6)].map((_, i) => (
                      <tr key={i}><td colSpan="7" className="p-4"><div className="h-6 bg-neutral-100 animate-pulse rounded" /></td></tr>
                    ))
                  ) : requests.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-12 text-center">
                        <Wrench className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
                        <p className="text-sm text-neutral-500">No maintenance requests found.</p>
                      </td>
                    </tr>
                  ) : (
                    requests.map(req => (
                      <tr key={req.id} className="hover:bg-neutral-50/70 transition-colors cursor-pointer h-12" onClick={() => openDetail(req)}>
                        <td className="py-2 px-4 text-sm font-mono font-semibold text-primary-600">#{req.id}</td>
                        <td className="py-2 px-4">
                          <p className="text-sm font-medium text-neutral-900">{req.Asset?.name || '-'}</p>
                          <p className="text-[11px] font-mono text-neutral-400">{req.asset_tag}</p>
                        </td>
                        <td className="py-2 px-4 text-sm text-neutral-600">{req.RaisedBy?.name || '-'}</td>
                        <td className="py-2 px-4 text-xs text-neutral-500 max-w-[200px] truncate">{req.issue_description}</td>
                        <td className="py-2 px-4">
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border', PRIORITY_COLORS[req.priority])}>
                            {req.priority}
                          </span>
                        </td>
                        <td className="py-2 px-4">
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border', STATUS_COLORS[req.status])}>
                            {req.status}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-xs text-neutral-400">{new Date(req.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 border-t border-neutral-200 bg-neutral-50/50 text-xs text-neutral-500">
              Showing {requests.length} entries
            </div>
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* RAISE REQUEST MODAL                                                   */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {showRaiseModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowRaiseModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Raise Maintenance Request</h2>
                <p className="text-sm text-neutral-500 mt-0.5">Describe the issue and assign a priority level.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowRaiseModal(false)}><X className="h-4 w-4" /></Button>
            </div>
            <form onSubmit={handleRaiseSubmit} className="p-6 space-y-4">
              {formError && <Alert variant="error">{formError}</Alert>}

              <div className="space-y-1.5">
                <Label required>Asset Tag</Label>
                <Input placeholder="e.g. AF-0012" value={raiseAssetTag} onChange={(e) => setRaiseAssetTag(e.target.value)} required disabled={formLoading} />
              </div>

              <div className="space-y-1.5">
                <Label required>Issue Description (min 10 chars)</Label>
                <textarea
                  className="flex w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none disabled:opacity-50"
                  placeholder="Describe the issue in detail..."
                  value={raiseDescription}
                  onChange={(e) => setRaiseDescription(e.target.value)}
                  required minLength={10} disabled={formLoading} rows={4}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Priority</Label>
                <div className="flex gap-2 flex-wrap">
                  {['Low', 'Medium', 'High', 'Critical'].map(p => (
                    <label key={p} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="priority" value={p} checked={raisePriority === p} onChange={() => setRaisePriority(p)} disabled={formLoading} className="text-primary-600 focus:ring-primary-500" />
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', PRIORITY_COLORS[p])}>{p}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Photo URL (optional)</Label>
                <Input placeholder="https://..." value={raisePhotoUrl} onChange={(e) => setRaisePhotoUrl(e.target.value)} disabled={formLoading} />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-neutral-200">
                <Button type="button" variant="ghost" onClick={() => setShowRaiseModal(false)} disabled={formLoading}>Cancel</Button>
                <Button type="submit" loading={formLoading}><Plus className="h-4 w-4" /> Submit Request</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* REQUEST DETAIL DRAWER                                                 */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {showDetailDrawer && detailData && (
        <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowDetailDrawer(false)}>
          <div
            className="absolute right-0 top-0 bottom-0 w-full max-w-[440px] bg-white border-l border-neutral-200 shadow-xl flex flex-col overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'slideInRight 0.2s ease-out' }}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-neutral-200 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg text-neutral-900">Request #{detailData.id}</h3>
                <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border', STATUS_COLORS[detailData.status])}>{detailData.status}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowDetailDrawer(false)}><X className="h-4 w-4" /></Button>
            </div>

            <div className="p-6 space-y-5 flex-1">
              {/* Priority */}
              <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border', PRIORITY_COLORS[detailData.priority])}>
                Priority: {detailData.priority}
              </span>

              {/* Asset info */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400">Asset</p>
                <p className="text-sm font-semibold text-neutral-900">{detailData.Asset?.name || detailData.asset_tag}</p>
                <p className="text-xs font-mono text-neutral-400">Tag: {detailData.asset_tag}</p>
                {detailData.Asset?.status && (
                  <p className="text-xs text-neutral-500 mt-1">
                    Asset Status: <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border', STATUS_COLORS[detailData.Asset.status] || 'bg-neutral-100 text-neutral-600 border-neutral-200')}>{detailData.Asset.status}</span>
                  </p>
                )}
              </div>

              {/* Issue description */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400">Issue Description</p>
                <p className="text-sm text-neutral-700 bg-neutral-50 p-3 rounded-md border border-neutral-200">{detailData.issue_description}</p>
              </div>

              {/* Photo */}
              {detailData.photo_url && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400">Photo</p>
                  <img src={detailData.photo_url} alt="Issue" className="w-full rounded-md border border-neutral-200 max-h-48 object-cover" />
                </div>
              )}

              {/* Raised by */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400">Raised By</p>
                <p className="text-sm font-medium text-neutral-900">{detailData.RaisedBy?.name || 'User'}</p>
                <p className="text-xs text-neutral-400">{new Date(detailData.created_at).toLocaleString()}</p>
              </div>

              {/* Technician */}
              {detailData.technician_name && (
                <div className="bg-orange-50 border border-orange-200 p-3 rounded-md space-y-1">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-orange-600">Assigned Technician</p>
                  <p className="text-sm font-semibold text-neutral-900">{detailData.technician_name}</p>
                </div>
              )}

              {/* Timeline */}
              {detailData.timeline && detailData.timeline.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400">Timeline</p>
                  <div className="space-y-3 border-l-2 border-neutral-200 pl-4">
                    {detailData.timeline.map((log, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-neutral-300 border-2 border-white" />
                        <p className="text-xs text-neutral-500">{log.User?.name || 'System'} — {new Date(log.created_at).toLocaleString()}</p>
                        <p className="text-xs text-neutral-700 mt-0.5">{log.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            {isManager && (
              <div className="border-t border-neutral-200 p-6 space-y-2 bg-neutral-50/50">
                {detailData.status === 'Pending' && (
                  <>
                    <Button className="w-full" onClick={() => handleApprove(detailData.id)}>
                      <CheckCircle className="h-4 w-4" /> Approve Request
                    </Button>
                    <Button variant="danger" className="w-full" onClick={() => { setActiveRequest(detailData); setRejectReason(''); setShowRejectModal(true) }}>
                      <XCircle className="h-4 w-4" /> Reject Request
                    </Button>
                  </>
                )}
                {detailData.status === 'Approved' && (
                  <Button className="w-full" onClick={() => { setActiveRequest(detailData); setTechName(''); setTechNotes(''); setShowTechModal(true) }}>
                    <PlayCircle className="h-4 w-4" /> Assign Technician & Start
                  </Button>
                )}
                {detailData.status === 'In Progress' && (
                  <Button className="w-full" onClick={() => { setActiveRequest(detailData); setShowResolveConfirm(true) }}>
                    <CheckCircle className="h-4 w-4" /> Mark Resolved
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* REJECT REASON MODAL                                                   */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={() => setShowRejectModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-neutral-200">
              <h2 className="text-lg font-semibold text-neutral-900">Reject Maintenance Request</h2>
            </div>
            <form onSubmit={handleRejectSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label>Rejection Reason (optional)</Label>
                <textarea
                  className="flex w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                  placeholder="Provide reason for rejection..."
                  value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200">
                <Button type="button" variant="ghost" onClick={() => setShowRejectModal(false)}>Cancel</Button>
                <Button type="submit" variant="danger"><XCircle className="h-4 w-4" /> Confirm Rejection</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TECHNICIAN ASSIGNMENT MODAL                                           */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {showTechModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={() => setShowTechModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-neutral-200">
              <h2 className="text-lg font-semibold text-neutral-900">Assign Technician & Start Work</h2>
              <p className="text-sm text-neutral-500 mt-0.5">The request will move to In Progress.</p>
            </div>
            <form onSubmit={handleStartSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label required>Technician Name</Label>
                <Input placeholder="Name of internal/external technician" value={techName} onChange={(e) => setTechName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Notes (optional)</Label>
                <textarea
                  className="flex w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                  placeholder="Any additional instructions..."
                  value={techNotes} onChange={(e) => setTechNotes(e.target.value)} rows={3}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200">
                <Button type="button" variant="ghost" onClick={() => setShowTechModal(false)}>Cancel</Button>
                <Button type="submit"><PlayCircle className="h-4 w-4" /> Assign & Start</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* RESOLVE CONFIRMATION MODAL                                            */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {showResolveConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={() => setShowResolveConfirm(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-neutral-200">
              <h2 className="text-lg font-semibold text-neutral-900">Resolve Maintenance Request</h2>
            </div>
            <div className="p-6">
              <p className="text-sm text-neutral-600">
                Mark this maintenance request as resolved? The asset status will be automatically restored
                to <strong className="text-neutral-900">Allocated</strong> (if an active allocation exists) or <strong className="text-neutral-900">Available</strong>.
              </p>
            </div>
            <div className="p-6 pt-0 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowResolveConfirm(false)}>Cancel</Button>
              <Button onClick={handleResolve}><CheckCircle className="h-4 w-4" /> Confirm Resolve</Button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-in animation */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  )
}
