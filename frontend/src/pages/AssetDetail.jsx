import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Edit, AlertTriangle, Archive, Trash2, RefreshCw, Save, X,
  Clock, UserCheck, Wrench, Calendar, Download, Activity, User
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
  'Available':          'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Allocated':          'bg-blue-50 text-blue-700 border-blue-200',
  'Reserved':           'bg-purple-50 text-purple-700 border-purple-200',
  'Under Maintenance':  'bg-orange-50 text-orange-700 border-orange-200',
  'Lost':               'bg-red-50 text-red-700 border-red-200',
  'Retired':            'bg-neutral-100 text-neutral-500 border-neutral-300',
  'Disposed':           'bg-neutral-200 text-neutral-400 border-neutral-300',
}

export function AssetDetail() {
  const { tag } = useParams()
  const navigate = useNavigate()
  const currentRole = useAuthStore((s) => s.currentRole)
  const activeOrgId = useAuthStore((s) => s.activeOrgId)
  const workspaces = useAuthStore((s) => s.workspaces)
  const activeOrg = workspaces.find((w) => w.org_id === activeOrgId)

  const canManage = currentRole === 'Admin' || currentRole === 'Asset Manager'

  const [asset, setAsset] = useState(null)
  const [history, setHistory] = useState({ allocations: [], maintenance: [], bookings: [], timeline: [] })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('details')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Status change modal
  const [statusAction, setStatusAction] = useState(null)
  const [statusReason, setStatusReason] = useState('')
  const [changingStatus, setChangingStatus] = useState(false)

  const fetchAsset = async () => {
    setLoading(true)
    setError('')
    try {
      const [assetRes, allocRes, maintRes, timelineRes] = await Promise.all([
        api.get(`/assets/${tag}`),
        api.get(`/assets/${tag}/history/allocations`),
        api.get(`/assets/${tag}/history/maintenance`),
        api.get(`/assets/${tag}/history/timeline`)
      ])

      setAsset(assetRes.data)
      setHistory({
        allocations: allocRes.data,
        maintenance: maintRes.data,
        bookings: assetRes.data.history?.bookings || [],
        timeline: timelineRes.data
      })

      setEditForm({
        name: assetRes.data.name,
        serial_number: assetRes.data.serial_number || '',
        condition: assetRes.data.condition || 'New',
        location: assetRes.data.location || '',
        photo_url: assetRes.data.photo_url || '',
        acquisition_cost: assetRes.data.acquisition_cost || '',
        is_shared_resource: assetRes.data.is_shared_resource || false,
      })
    } catch (err) {
      console.error('Failed to fetch asset details or history:', err)
      setError(err?.response?.data?.error || 'Asset not found or access denied.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAsset()
  }, [tag])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await api.put(`/assets/${tag}`, editForm)
      setEditing(false)
      fetchAsset()
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to update asset.')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async () => {
    if (!statusAction) return
    setChangingStatus(true)
    setError('')

    const statusMap = {
      'lost': 'Lost',
      'retire': 'Retired',
      'dispose': 'Disposed',
      'recover': 'Available',
    }
    const newStatus = statusMap[statusAction]

    try {
      await api.patch(`/assets/${tag}/status`, { status: newStatus, reason: statusReason })
      setStatusAction(null)
      setStatusReason('')
      fetchAsset()
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to change status.')
    } finally {
      setChangingStatus(false)
    }
  }

  const getStatusActions = () => {
    if (!asset || !canManage) return []
    const s = asset.status
    const actions = []
    if (s === 'Available' || s === 'Allocated') {
      actions.push({ key: 'lost', label: 'Mark as Lost', icon: AlertTriangle, color: 'text-red-600 hover:bg-red-50' })
    }
    if (s === 'Available' || s === 'Allocated') {
      actions.push({ key: 'retire', label: 'Retire', icon: Archive, color: 'text-neutral-600 hover:bg-neutral-50' })
    }
    if (s === 'Available' || s === 'Retired') {
      actions.push({ key: 'dispose', label: 'Dispose', icon: Trash2, color: 'text-neutral-500 hover:bg-neutral-50' })
    }
    if (s === 'Lost') {
      actions.push({ key: 'recover', label: 'Mark as Recovered', icon: RefreshCw, color: 'text-emerald-600 hover:bg-emerald-50' })
    }
    return actions
  }

  const TABS = [
    { key: 'details', label: 'Details' },
    { key: 'allocations', label: `Allocations (${history.allocations.length})` },
    { key: 'maintenance', label: `Maintenance (${history.maintenance.length})` },
    { key: 'bookings', label: `Bookings (${history.bookings.length})` },
    { key: 'timeline', label: `Timeline (${history.timeline.length})` },
  ]

  if (loading) {
    return (
      <>
        <Header breadcrumbs={[activeOrg?.org_name || 'Workspace', 'Assets', tag]} />
        <div className="p-6 space-y-4 max-w-[1000px] mx-auto">
          {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-neutral-100 animate-pulse rounded-lg" />)}
        </div>
      </>
    )
  }

  if (!asset) {
    return (
      <>
        <Header breadcrumbs={[activeOrg?.org_name || 'Workspace', 'Assets', tag]} />
        <div className="p-6 max-w-[1000px] mx-auto">
          {error && <Alert variant="error" className="mb-4">{error}</Alert>}
          <Button variant="secondary" onClick={() => navigate('/assets')}>
            <ArrowLeft className="h-4 w-4" /> Back to Directory
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <Header breadcrumbs={[activeOrg?.org_name || 'Workspace', 'Assets', asset.tag]} />

      <div className="p-6 space-y-6 max-w-[1000px] mx-auto">
        {error && <Alert variant="error">{error}</Alert>}

        {/* Asset Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/assets')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className={cn('text-xl font-semibold text-neutral-900', asset.status === 'Disposed' && 'line-through')}>{asset.name}</h1>
                <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border', STATUS_COLORS[asset.status] || '')}>
                  {asset.status}
                </span>
              </div>
              <p className="text-sm text-neutral-500 mt-0.5">{asset.tag} · {asset.Category?.name || 'Uncategorized'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canManage && asset.status !== 'Disposed' && (
              editing ? (
                <>
                  <Button onClick={handleSave} loading={saving}><Save className="h-4 w-4" /> Save</Button>
                  <Button variant="ghost" onClick={() => setEditing(false)}><X className="h-4 w-4" /> Cancel</Button>
                </>
              ) : (
                <Button variant="secondary" onClick={() => setEditing(true)}><Edit className="h-4 w-4" /> Edit</Button>
              )
            )}
            {getStatusActions().map(action => (
              <Button key={action.key} variant="ghost" className={action.color} onClick={() => setStatusAction(action.key)}>
                <action.icon className="h-4 w-4" /> {action.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-neutral-200">
          <nav className="flex gap-6">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'pb-3 text-sm font-medium border-b-2 transition-colors',
                  activeTab === tab.key
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700'
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Details Tab */}
        {activeTab === 'details' && (
          <div className="bg-white border border-neutral-200 rounded-lg divide-y divide-neutral-100">
            {[
              { label: 'Asset Tag', value: asset.tag, locked: true },
              { label: 'Name', field: 'name', value: asset.name },
              { label: 'Category', value: asset.Category?.name || '--', locked: true },
              { label: 'Serial Number', field: 'serial_number', value: asset.serial_number || '--' },
              { label: 'Condition', field: 'condition', value: asset.condition || '--', type: 'select', options: ['New', 'Good', 'Fair', 'Poor'] },
              { label: 'Location', field: 'location', value: asset.location || '--' },
              { label: 'Acquisition Date', value: asset.acquisition_date ? new Date(asset.acquisition_date).toLocaleDateString() : '--', locked: true },
              { label: 'Acquisition Cost', field: 'acquisition_cost', value: asset.acquisition_cost ? `₹${Number(asset.acquisition_cost).toLocaleString()}` : '--' },
              { label: 'Current Holder', value: asset.CurrentHolder?.name || '—', locked: true },
              { label: 'Shared Resource', field: 'is_shared_resource', value: asset.is_shared_resource ? 'Yes' : 'No', type: 'toggle' },
              { label: 'Registered On', value: asset.created_at ? new Date(asset.created_at).toLocaleDateString() : '--', locked: true },
            ].map(row => (
              <div key={row.label} className="flex items-center py-3 px-5">
                <span className="text-sm text-neutral-500 w-40 shrink-0">{row.label}</span>
                {editing && !row.locked && row.field ? (
                  row.type === 'select' ? (
                    <select
                      className="h-8 rounded-md border border-neutral-300 bg-white px-2 text-sm"
                      value={editForm[row.field] || ''} onChange={(e) => setEditForm(p => ({ ...p, [row.field]: e.target.value }))}
                    >
                      {row.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : row.type === 'toggle' ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={!!editForm[row.field]} onChange={(e) => setEditForm(p => ({ ...p, [row.field]: e.target.checked }))} className="rounded border-neutral-300" />
                      <span className="text-sm">{editForm[row.field] ? 'Yes' : 'No'}</span>
                    </label>
                  ) : (
                    <Input
                      className="h-8 max-w-xs"
                      value={editForm[row.field] || ''} onChange={(e) => setEditForm(p => ({ ...p, [row.field]: e.target.value }))}
                    />
                  )
                ) : (
                  <span className="text-sm font-medium text-neutral-900">{row.value}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Allocations Tab */}
        {activeTab === 'allocations' && (
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            {history.allocations.length === 0 ? (
              <div className="p-8 text-center text-sm text-neutral-500">
                <UserCheck className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                No allocation history for this asset.
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200">
                    <th className="py-3 px-4 text-table-header">Assigned To</th>
                    <th className="py-3 px-4 text-table-header">Expected Return</th>
                    <th className="py-3 px-4 text-table-header">Status</th>
                    <th className="py-3 px-4 text-table-header">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {history.allocations.map(a => (
                    <tr key={a.id} className="h-11">
                      <td className="py-2 px-4 text-sm text-neutral-900 font-medium">{a.User?.name || '--'}</td>
                      <td className="py-2 px-4 text-sm text-neutral-600">{a.expected_return_date ? new Date(a.expected_return_date).toLocaleDateString() : '--'}</td>
                      <td className="py-2 px-4">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border',
                          a.status === 'Active' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-neutral-100 text-neutral-500 border-neutral-200'
                        )}>{a.status}</span>
                      </td>
                      <td className="py-2 px-4 text-sm text-neutral-500">{a.created_at ? new Date(a.created_at).toLocaleDateString() : '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Maintenance Tab */}
        {activeTab === 'maintenance' && (
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            {history.maintenance.length === 0 ? (
              <div className="p-8 text-center text-sm text-neutral-500">
                <Wrench className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                No maintenance history for this asset.
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200">
                    <th className="py-3 px-4 text-table-header">Issue</th>
                    <th className="py-3 px-4 text-table-header">Priority</th>
                    <th className="py-3 px-4 text-table-header">Status</th>
                    <th className="py-3 px-4 text-table-header">Raised By</th>
                    <th className="py-3 px-4 text-table-header">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {history.maintenance.map(m => (
                    <tr key={m.id} className="h-11">
                      <td className="py-2 px-4 text-sm text-neutral-900 max-w-xs truncate">{m.issue_description}</td>
                      <td className="py-2 px-4">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border',
                          m.priority === 'Critical' ? 'bg-red-50 text-red-700 border-red-200' :
                          m.priority === 'High' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          'bg-neutral-100 text-neutral-600 border-neutral-200'
                        )}>{m.priority}</span>
                      </td>
                      <td className="py-2 px-4 text-sm text-neutral-600">{m.status}</td>
                      <td className="py-2 px-4 text-sm text-neutral-600">{m.RaisedBy?.name || '--'}</td>
                      <td className="py-2 px-4 text-sm text-neutral-500">{m.created_at ? new Date(m.created_at).toLocaleDateString() : '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            {history.bookings.length === 0 ? (
              <div className="p-8 text-center text-sm text-neutral-500">
                <Calendar className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                No booking history for this asset.
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200">
                    <th className="py-3 px-4 text-table-header">Booked By</th>
                    <th className="py-3 px-4 text-table-header">Start</th>
                    <th className="py-3 px-4 text-table-header">End</th>
                    <th className="py-3 px-4 text-table-header">Status</th>
                    <th className="py-3 px-4 text-table-header">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {history.bookings.map(b => (
                    <tr key={b.id} className="h-11">
                      <td className="py-2 px-4 text-sm text-neutral-900 font-medium">{b.BookedBy?.name || '--'}</td>
                      <td className="py-2 px-4 text-sm text-neutral-600">{b.start_time ? new Date(b.start_time).toLocaleString() : '--'}</td>
                      <td className="py-2 px-4 text-sm text-neutral-600">{b.end_time ? new Date(b.end_time).toLocaleString() : '--'}</td>
                      <td className="py-2 px-4 text-sm text-neutral-600">{b.status}</td>
                      <td className="py-2 px-4 text-sm text-neutral-500 max-w-xs truncate">{b.purpose || '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Timeline Tab */}
        {activeTab === 'timeline' && (
          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            {history.timeline.length === 0 ? (
              <div className="text-center text-sm text-neutral-500 py-8">
                <Activity className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                No timeline logs found for this asset.
              </div>
            ) : (
              <div className="relative border-l border-neutral-200 ml-3 pl-6 space-y-6">
                {history.timeline.map((log, i) => (
                  <div key={log.id || i} className="relative">
                    <div className="absolute -left-[31px] top-1 bg-white border border-neutral-200 rounded-full p-1 flex items-center justify-center">
                      <Activity className="h-3 w-3 text-neutral-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{log.description}</p>
                      <div className="flex items-center gap-2 text-xs text-neutral-500 mt-1">
                        <span className="flex items-center gap-1 font-semibold">
                          <User className="h-3 w-3" /> {log.User?.name || 'System'}
                        </span>
                        <span>·</span>
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Status Change Confirmation Modal */}
        {statusAction && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setStatusAction(null)}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 space-y-4">
                <h3 className="text-base font-semibold text-neutral-900">
                  {statusAction === 'lost' && 'Mark Asset as Lost'}
                  {statusAction === 'retire' && 'Retire Asset'}
                  {statusAction === 'dispose' && 'Dispose Asset'}
                  {statusAction === 'recover' && 'Mark Asset as Recovered'}
                </h3>
                <p className="text-sm text-neutral-500">
                  {statusAction === 'lost' && `This will mark "${asset.name}" (${asset.tag}) as Lost.`}
                  {statusAction === 'retire' && `This will retire "${asset.name}" (${asset.tag}). It cannot be allocated or booked.`}
                  {statusAction === 'dispose' && `This will permanently mark "${asset.name}" (${asset.tag}) as Disposed. This cannot be undone.`}
                  {statusAction === 'recover' && `This will mark "${asset.name}" (${asset.tag}) as Available again.`}
                </p>
                {statusAction !== 'recover' && (
                  <div className="space-y-1.5">
                    <Label>Reason</Label>
                    <textarea
                      className="w-full h-20 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none resize-none"
                      value={statusReason} onChange={(e) => setStatusReason(e.target.value)} placeholder="Provide a reason..."
                    />
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setStatusAction(null)}>Cancel</Button>
                  <Button
                    onClick={handleStatusChange}
                    loading={changingStatus}
                    className={statusAction === 'dispose' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
                  >
                    Confirm
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
