import { useState, useEffect, useCallback } from 'react'
import {
  UserCheck, AlertTriangle, Clock, ArrowRightLeft, Plus,
  Search, Filter, X, ChevronRight, RotateCcw, Send,
  CheckCircle, XCircle, Loader2, Package, CalendarDays
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/common/Button'
import { Input } from '../components/common/Input'
import { Label } from '../components/common/Label'
import { Alert } from '../components/common/Alert'
import { cn } from '../utils'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'

// ─── Status Colors ──────────────────────────────────────────────────────────

const ALLOC_STATUS = {
  'Active':   'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'Returned': 'bg-neutral-100 text-neutral-500 border border-neutral-300',
}
const OVERDUE_BADGE = 'bg-red-50 text-red-700 border border-red-200'
const DUE_SOON_BADGE = 'bg-amber-50 text-amber-700 border border-amber-200'

const TRANSFER_STATUS = {
  'Pending':  'bg-amber-50 text-amber-700 border border-amber-200',
  'Approved': 'bg-blue-50 text-blue-700 border border-blue-200',
  'Rejected': 'bg-red-50 text-red-700 border border-red-200',
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function Allocations() {
  const currentRole = useAuthStore((s) => s.currentRole)
  const isOwner = useAuthStore((s) => {
    const ws = s.workspaces.find(w => w.org_id === s.activeOrgId)
    return ws?.role === 'Admin'
  })
  const canManage = currentRole === 'Admin' || currentRole === 'Asset Manager' || isOwner

  // Tab state
  const [activeTab, setActiveTab] = useState('allocations') // allocations | transfers

  // Data
  const [allocations, setAllocations] = useState([])
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Modals
  const [showAllocateModal, setShowAllocateModal] = useState(false)
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showDetailDrawer, setShowDetailDrawer] = useState(false)

  // Selected
  const [selectedAllocation, setSelectedAllocation] = useState(null)
  const [detailData, setDetailData] = useState(null)

  // KPIs
  const [kpis, setKpis] = useState({ active: 0, overdue: 0, dueSoon: 0, returnedToday: 0 })

  // ── Data Fetching ───────────────────────────────────────────────────────

  const fetchAllocations = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      const { data } = await api.get('/allocations', { params })
      setAllocations(data)

      // Compute KPIs
      const today = new Date().toISOString().split('T')[0]
      const active = data.filter(a => a.status === 'Active').length
      const overdue = data.filter(a => a.is_overdue).length
      const dueSoon = data.filter(a => a.is_due_soon).length
      const returnedToday = data.filter(a =>
        a.status === 'Returned' && a.created_at?.startsWith(today)
      ).length

      setKpis({ active, overdue, dueSoon, returnedToday })
    } catch (err) {
      console.error('Failed to fetch allocations:', err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  const fetchTransfers = useCallback(async () => {
    try {
      const { data } = await api.get('/allocations/transfers')
      setTransfers(data)
    } catch (err) {
      console.error('Failed to fetch transfers:', err)
    }
  }, [])

  useEffect(() => {
    fetchAllocations()
    fetchTransfers()
  }, [fetchAllocations, fetchTransfers])

  const refresh = () => {
    fetchAllocations()
    fetchTransfers()
  }

  // ── Search Filter ───────────────────────────────────────────────────────

  const filteredAllocations = allocations.filter(a => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      a.asset_tag?.toLowerCase().includes(q) ||
      a.Asset?.name?.toLowerCase().includes(q) ||
      a.User?.name?.toLowerCase().includes(q)
    )
  })

  const filteredTransfers = transfers.filter(t => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.asset_tag?.toLowerCase().includes(q) ||
      t.Asset?.name?.toLowerCase().includes(q) ||
      t.Requester?.name?.toLowerCase().includes(q)
    )
  })

  // ── Open Detail ─────────────────────────────────────────────────────────

  const openDetail = async (allocation) => {
    setSelectedAllocation(allocation)
    setShowDetailDrawer(true)
    try {
      const { data } = await api.get(`/allocations/${allocation.id}`)
      setDetailData(data)
    } catch (err) {
      console.error('Failed to fetch detail:', err)
      setDetailData(allocation)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <Header
        title="Allocations"
        breadcrumbs={['AssetFlow', 'Allocations']}
        onRefresh={refresh}
      />

      <div className="p-6 space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={UserCheck} label="Active Allocations" value={kpis.active} color="text-emerald-600 bg-emerald-50" />
          <KpiCard icon={AlertTriangle} label="Overdue" value={kpis.overdue} color="text-red-600 bg-red-50" accent />
          <KpiCard icon={Clock} label="Due This Week" value={kpis.dueSoon} color="text-amber-600 bg-amber-50" />
          <KpiCard icon={RotateCcw} label="Returned Today" value={kpis.returnedToday} color="text-blue-600 bg-blue-50" />
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            {/* Tabs */}
            <div className="flex bg-neutral-100 rounded-lg p-0.5">
              <button
                onClick={() => setActiveTab('allocations')}
                className={cn(
                  'px-4 py-1.5 text-sm font-medium rounded-md transition-all cursor-pointer',
                  activeTab === 'allocations'
                    ? 'bg-white text-neutral-900 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700'
                )}
              >
                Allocations
              </button>
              <button
                onClick={() => setActiveTab('transfers')}
                className={cn(
                  'px-4 py-1.5 text-sm font-medium rounded-md transition-all cursor-pointer relative',
                  activeTab === 'transfers'
                    ? 'bg-white text-neutral-900 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700'
                )}
              >
                Transfers
                {transfers.filter(t => t.status === 'Pending').length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                    {transfers.filter(t => t.status === 'Pending').length}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search allocations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-9 pr-3 rounded-md border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent w-60"
              />
            </div>

            {/* Status Filter */}
            {activeTab === 'allocations' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 px-3 rounded-md border border-neutral-200 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
              >
                <option value="">All Status</option>
                <option value="Active">Active</option>
                <option value="Returned">Returned</option>
              </select>
            )}

            {/* Action Buttons */}
            {canManage && (
              <Button onClick={() => setShowAllocateModal(true)}>
                <Plus className="h-4 w-4" />
                Allocate Assets
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          </div>
        ) : activeTab === 'allocations' ? (
          <AllocationTable
            allocations={filteredAllocations}
            onRowClick={openDetail}
            canManage={canManage}
          />
        ) : (
          <TransferTable
            transfers={filteredTransfers}
            canManage={canManage}
            onApprove={async (id) => {
              try {
                await api.patch(`/allocations/transfers/${id}/approve`)
                refresh()
              } catch (err) {
                alert(err.response?.data?.error || 'Failed to approve')
              }
            }}
            onReject={async (id) => {
              try {
                await api.patch(`/allocations/transfers/${id}/reject`)
                refresh()
              } catch (err) {
                alert(err.response?.data?.error || 'Failed to reject')
              }
            }}
          />
        )}
      </div>

      {/* Modals */}
      {showAllocateModal && (
        <AllocateModal
          onClose={() => setShowAllocateModal(false)}
          onSuccess={() => { setShowAllocateModal(false); refresh() }}
        />
      )}

      {showReturnModal && selectedAllocation && (
        <ReturnModal
          allocation={selectedAllocation}
          onClose={() => setShowReturnModal(false)}
          onSuccess={() => { setShowReturnModal(false); setShowDetailDrawer(false); refresh() }}
        />
      )}

      {showTransferModal && selectedAllocation && (
        <TransferModal
          allocation={selectedAllocation}
          onClose={() => setShowTransferModal(false)}
          onSuccess={() => { setShowTransferModal(false); setShowDetailDrawer(false); refresh() }}
        />
      )}

      {showDetailDrawer && detailData && (
        <DetailDrawer
          data={detailData}
          canManage={canManage}
          onClose={() => { setShowDetailDrawer(false); setDetailData(null) }}
          onReturn={() => { setSelectedAllocation(detailData); setShowReturnModal(true) }}
          onTransfer={() => { setSelectedAllocation(detailData); setShowTransferModal(true) }}
        />
      )}
    </>
  )
}

// ─── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, color, accent }) {
  return (
    <div className={cn(
      'rounded-xl border border-neutral-200 bg-white p-4 flex items-center gap-4 transition-shadow hover:shadow-md',
      accent && value > 0 && 'border-red-200 bg-red-50/30'
    )}>
      <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-neutral-900">{value}</p>
        <p className="text-xs text-neutral-500 font-medium">{label}</p>
      </div>
    </div>
  )
}

// ─── Allocation Table ───────────────────────────────────────────────────────

function AllocationTable({ allocations, onRowClick, canManage }) {
  if (allocations.length === 0) {
    return (
      <div className="text-center py-16 text-neutral-400">
        <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p className="text-sm font-medium">No allocations found</p>
        <p className="text-xs mt-1">Assets allocated to users will appear here.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50/50">
              <th className="text-table-header text-left px-4 py-3">Asset</th>
              <th className="text-table-header text-left px-4 py-3">Allocated To</th>
              <th className="text-table-header text-left px-4 py-3">Allocated On</th>
              <th className="text-table-header text-left px-4 py-3">Expected Return</th>
              <th className="text-table-header text-left px-4 py-3">Status</th>
              <th className="text-table-header text-left px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {allocations.map((a) => (
              <tr
                key={a.id}
                onClick={() => onRowClick(a)}
                className={cn(
                  'border-b border-neutral-100 hover:bg-neutral-50/70 cursor-pointer transition-colors',
                  a.is_overdue && 'bg-red-50/40',
                  a.is_due_soon && !a.is_overdue && 'bg-amber-50/30'
                )}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-md bg-primary-50 flex items-center justify-center">
                      <Package className="h-4 w-4 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{a.Asset?.name || a.asset_tag}</p>
                      <p className="text-xs text-neutral-400 font-mono">{a.asset_tag}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm text-neutral-700">{a.User?.name || '—'}</p>
                  <p className="text-xs text-neutral-400">{a.User?.email || ''}</p>
                </td>
                <td className="px-4 py-3 text-sm text-neutral-600">
                  {a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-neutral-600">
                      {a.expected_return_date || 'Open-ended'}
                    </span>
                    {a.is_overdue && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                    {a.is_due_soon && !a.is_overdue && <Clock className="h-3.5 w-3.5 text-amber-500" />}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                    a.is_overdue ? OVERDUE_BADGE :
                    a.is_due_soon ? DUE_SOON_BADGE :
                    ALLOC_STATUS[a.status] || 'bg-neutral-100 text-neutral-500'
                  )}>
                    {a.is_overdue ? 'Overdue' : a.is_due_soon ? 'Due Soon' : a.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <ChevronRight className="h-4 w-4 text-neutral-300" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Transfer Table ─────────────────────────────────────────────────────────

function TransferTable({ transfers, canManage, onApprove, onReject }) {
  if (transfers.length === 0) {
    return (
      <div className="text-center py-16 text-neutral-400">
        <ArrowRightLeft className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p className="text-sm font-medium">No transfer requests</p>
        <p className="text-xs mt-1">Transfer requests will appear here.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50/50">
              <th className="text-table-header text-left px-4 py-3">Asset</th>
              <th className="text-table-header text-left px-4 py-3">From</th>
              <th className="text-table-header text-left px-4 py-3">To</th>
              <th className="text-table-header text-left px-4 py-3">Reason</th>
              <th className="text-table-header text-left px-4 py-3">Urgency</th>
              <th className="text-table-header text-left px-4 py-3">Status</th>
              {canManage && <th className="text-table-header text-left px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {transfers.map((t) => (
              <tr key={t.id} className="border-b border-neutral-100 hover:bg-neutral-50/70 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-neutral-900">{t.Asset?.name || t.asset_tag}</p>
                  <p className="text-xs text-neutral-400 font-mono">{t.asset_tag}</p>
                </td>
                <td className="px-4 py-3 text-sm text-neutral-700">{t.CurrentHolder?.name || '—'}</td>
                <td className="px-4 py-3 text-sm text-neutral-700">{t.RequestedNewHolder?.name || '—'}</td>
                <td className="px-4 py-3 text-sm text-neutral-600 max-w-[200px] truncate">{t.reason || '—'}</td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                    t.urgency === 'Urgent' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-neutral-100 text-neutral-600'
                  )}>
                    {t.urgency || 'Normal'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                    TRANSFER_STATUS[t.status] || 'bg-neutral-100 text-neutral-500'
                  )}>
                    {t.status}
                  </span>
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    {t.status === 'Pending' && (
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="success" onClick={() => onApprove(t.id)}>
                          <CheckCircle className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => onReject(t.id)}>
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Detail Drawer (View 4) ─────────────────────────────────────────────────

function DetailDrawer({ data, canManage, onClose, onReturn, onTransfer }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white shadow-xl overflow-y-auto animate-in slide-in-from-right">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Allocation Detail</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Asset Info */}
          <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-primary-100 flex items-center justify-center">
                <Package className="h-6 w-6 text-primary-600" />
              </div>
              <div>
                <p className="text-base font-semibold text-neutral-900">{data.Asset?.name || data.asset_tag}</p>
                <p className="text-xs text-neutral-500 font-mono">{data.asset_tag}</p>
              </div>
            </div>
          </div>

          {/* Holder */}
          <div>
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Holder</h3>
            <div className="flex items-center gap-3 bg-white border border-neutral-200 rounded-lg p-3">
              <div className="h-9 w-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold">
                {data.User?.name?.[0] || '?'}
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-900">{data.User?.name || '—'}</p>
                <p className="text-xs text-neutral-400">{data.User?.email || ''}</p>
              </div>
            </div>
          </div>

          {/* Allocation Details */}
          <div>
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <DetailField label="Status" value={
                <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                  data.is_overdue ? OVERDUE_BADGE : ALLOC_STATUS[data.status]
                )}>
                  {data.is_overdue ? '⚠ Overdue' : data.status}
                </span>
              } />
              <DetailField label="Allocated On" value={data.created_at ? new Date(data.created_at).toLocaleDateString() : '—'} />
              <DetailField label="Expected Return" value={data.expected_return_date || 'Open-ended'} />
              <DetailField label="Condition" value={data.return_condition || data.Asset?.condition || '—'} />
            </div>
            {data.notes && (
              <div className="mt-3 bg-neutral-50 rounded-lg p-3">
                <p className="text-xs text-neutral-400 font-medium mb-1">Notes</p>
                <p className="text-sm text-neutral-600">{data.notes}</p>
              </div>
            )}
          </div>

          {/* Timeline */}
          {data.timeline && data.timeline.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Activity Timeline</h3>
              <div className="space-y-3">
                {data.timeline.slice(0, 10).map((entry, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <div className="h-2 w-2 rounded-full bg-neutral-300 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-neutral-700">{entry.description}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {entry.User?.name || 'System'} • {new Date(entry.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {data.status === 'Active' && (
            <div className="flex gap-3 pt-2">
              {canManage && (
                <Button className="flex-1" onClick={onReturn}>
                  <RotateCcw className="h-4 w-4" />
                  Process Return
                </Button>
              )}
              <Button variant="secondary" className="flex-1" onClick={onTransfer}>
                <ArrowRightLeft className="h-4 w-4" />
                {canManage ? 'Initiate Transfer' : 'Request Transfer'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DetailField({ label, value }) {
  return (
    <div className="bg-white border border-neutral-100 rounded-lg p-2.5">
      <p className="text-[11px] text-neutral-400 font-medium uppercase">{label}</p>
      <div className="mt-0.5 text-sm font-medium text-neutral-800">{value}</div>
    </div>
  )
}

// ─── Allocate Modal (View 3) ────────────────────────────────────────────────

function AllocateModal({ onClose, onSuccess }) {
  const [assets, setAssets] = useState([])
  const [members, setMembers] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [assignTo, setAssignTo] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [conflicts, setConflicts] = useState([])

  useEffect(() => {
    const load = async () => {
      try {
        const [assetsRes, membersRes] = await Promise.all([
          api.get('/assets'),
          api.get('/org/members')
        ])
        setAssets(assetsRes.data.filter(a => a.status === 'Available'))
        setMembers(membersRes.data.filter(m => m.status === 'Active'))
      } catch (err) {
        console.error('Failed to load data:', err)
      }
    }
    load()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (selectedTags.length === 0 || !assignTo) {
      setError('Select at least one asset and a user.')
      return
    }
    setSubmitting(true)
    setError('')
    setConflicts([])

    try {
      await api.post('/allocations', {
        asset_tags: selectedTags,
        assigned_to_user_id: parseInt(assignTo),
        expected_return_date: returnDate || null,
        notes: notes || null
      })
      onSuccess()
    } catch (err) {
      const data = err.response?.data
      if (data?.conflicts?.length > 0) {
        setConflicts(data.conflicts)
        setError('Some assets are not available.')
      } else {
        setError(data?.error || 'Failed to allocate.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const toggleTag = (tag) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Allocate Assets</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && <Alert variant="danger">{error}</Alert>}

          {/* Conflict display */}
          {conflicts.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-red-800">Conflicts detected:</p>
              {conflicts.map((c, i) => (
                <p key={i} className="text-sm text-red-600">
                  <span className="font-mono">{c.asset_tag}</span> — held by {c.current_holder_name}
                </p>
              ))}
            </div>
          )}

          {/* Asset Selection */}
          <div>
            <Label className="form-label-required">Assets</Label>
            <div className="mt-1.5 max-h-40 overflow-y-auto border border-neutral-200 rounded-lg p-2 space-y-1">
              {assets.length === 0 ? (
                <p className="text-sm text-neutral-400 p-2">No available assets</p>
              ) : assets.map(a => (
                <label key={a.tag} className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-neutral-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedTags.includes(a.tag)}
                    onChange={() => toggleTag(a.tag)}
                    className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-neutral-700">{a.name}</span>
                  <span className="text-xs text-neutral-400 font-mono ml-auto">{a.tag}</span>
                </label>
              ))}
            </div>
            {selectedTags.length > 0 && (
              <p className="text-xs text-primary-600 mt-1">{selectedTags.length} asset(s) selected</p>
            )}
          </div>

          {/* Assign To */}
          <div>
            <Label className="form-label-required">Allocate To</Label>
            <select
              value={assignTo}
              onChange={(e) => setAssignTo(e.target.value)}
              className="mt-1.5 w-full h-9 px-3 rounded-md border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
            >
              <option value="">Select user...</option>
              {members.map(m => (
                <option key={m.User?.id || m.user_id} value={m.User?.id || m.user_id}>
                  {m.User?.name || 'Unknown'} ({m.role})
                </option>
              ))}
            </select>
          </div>

          {/* Return Date */}
          <div>
            <Label>Expected Return Date</Label>
            <Input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              className="mt-1.5"
            />
            <p className="text-xs text-neutral-400 mt-1">Leave empty for open-ended allocation</p>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              rows={2}
              placeholder="Optional allocation notes..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={submitting}>
              <UserCheck className="h-4 w-4" />
              Allocate {selectedTags.length > 0 ? `(${selectedTags.length})` : ''}
            </Button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}

// ─── Return Modal (View 5) ──────────────────────────────────────────────────

function ReturnModal({ allocation, onClose, onSuccess }) {
  const [condition, setCondition] = useState('Good')
  const [checkinNotes, setCheckinNotes] = useState('')
  const [triggerMaintenance, setTriggerMaintenance] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      await api.patch(`/allocations/${allocation.id}/return`, {
        condition,
        checkin_notes: checkinNotes || null,
        trigger_maintenance: triggerMaintenance
      })
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process return.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Process Return</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && <Alert variant="danger">{error}</Alert>}

          <div className="bg-neutral-50 rounded-lg p-3 flex items-center gap-3">
            <Package className="h-5 w-5 text-neutral-400" />
            <div>
              <p className="text-sm font-medium text-neutral-900">{allocation.Asset?.name || allocation.asset_tag}</p>
              <p className="text-xs text-neutral-400 font-mono">{allocation.asset_tag}</p>
            </div>
          </div>

          {/* Condition */}
          <div>
            <Label className="form-label-required">Condition</Label>
            <div className="mt-2 flex gap-2">
              {['Good', 'Minor Wear', 'Damaged'].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCondition(c)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all cursor-pointer',
                    condition === c
                      ? c === 'Good' ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : c === 'Minor Wear' ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-red-500 bg-red-50 text-red-700'
                      : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Check-in Notes */}
          <div>
            <Label>Check-in Notes</Label>
            <textarea
              value={checkinNotes}
              onChange={(e) => setCheckinNotes(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              rows={3}
              placeholder="Condition details, accessories returned, etc..."
            />
          </div>

          {/* Auto-maintenance */}
          {condition === 'Damaged' && (
            <label className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-lg p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={triggerMaintenance}
                onChange={(e) => setTriggerMaintenance(e.target.checked)}
                className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <div>
                <p className="text-sm font-medium text-amber-800">Trigger Maintenance Request</p>
                <p className="text-xs text-amber-600">Auto-create a High priority maintenance ticket</p>
              </div>
            </label>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={submitting}>
              <RotateCcw className="h-4 w-4" />
              Process Return
            </Button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}

// ─── Transfer Modal (View 7) ────────────────────────────────────────────────

function TransferModal({ allocation, onClose, onSuccess }) {
  const [members, setMembers] = useState([])
  const [newHolderId, setNewHolderId] = useState('')
  const [reason, setReason] = useState('')
  const [urgency, setUrgency] = useState('Normal')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/org/members')
        setMembers(data.filter(m => m.status === 'Active'))
      } catch (err) {
        console.error('Failed to load members:', err)
      }
    }
    load()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!newHolderId || !reason) {
      setError('New holder and reason are required.')
      return
    }
    setSubmitting(true)
    setError('')

    try {
      await api.post('/allocations/transfers', {
        asset_tag: allocation.asset_tag,
        requested_new_holder_id: parseInt(newHolderId),
        reason,
        urgency
      })
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit transfer request.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Request Transfer</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && <Alert variant="danger">{error}</Alert>}

          {/* Asset (Read-only) */}
          <div className="bg-neutral-50 rounded-lg p-3 flex items-center gap-3">
            <Package className="h-5 w-5 text-neutral-400" />
            <div>
              <p className="text-sm font-medium text-neutral-900">{allocation.Asset?.name || allocation.asset_tag}</p>
              <p className="text-xs text-neutral-400">Current holder: {allocation.User?.name || '—'}</p>
            </div>
          </div>

          {/* New Holder */}
          <div>
            <Label className="form-label-required">Transfer To</Label>
            <select
              value={newHolderId}
              onChange={(e) => setNewHolderId(e.target.value)}
              className="mt-1.5 w-full h-9 px-3 rounded-md border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
            >
              <option value="">Select recipient...</option>
              {members.map(m => (
                <option key={m.User?.id || m.user_id} value={m.User?.id || m.user_id}>
                  {m.User?.name || 'Unknown'} ({m.role})
                </option>
              ))}
            </select>
          </div>

          {/* Reason */}
          <div>
            <Label className="form-label-required">Reason</Label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              rows={3}
              placeholder="Why is this transfer needed?"
            />
          </div>

          {/* Urgency */}
          <div>
            <Label>Urgency</Label>
            <div className="mt-2 flex gap-2">
              {['Normal', 'Urgent'].map(u => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUrgency(u)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all cursor-pointer',
                    urgency === u
                      ? u === 'Normal' ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-red-500 bg-red-50 text-red-700'
                      : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'
                  )}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={submitting}>
              <Send className="h-4 w-4" />
              Submit Request
            </Button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}

// ─── Modal Overlay ──────────────────────────────────────────────────────────

function ModalOverlay({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
