import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, Filter, Package, CheckCircle, Wrench, AlertTriangle,
  LayoutList, LayoutGrid, MoreVertical, Share2, QrCode, Download,
  Edit, Archive, Trash2, RefreshCw
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

const CONDITION_COLORS = {
  'New':  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Good': 'bg-blue-50 text-blue-700 border-blue-200',
  'Fair': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'Poor': 'bg-red-50 text-red-700 border-red-200',
}

export function AssetDirectory() {
  const navigate = useNavigate()
  const currentRole = useAuthStore((s) => s.currentRole)
  const activeOrgId = useAuthStore((s) => s.activeOrgId)
  const workspaces = useAuthStore((s) => s.workspaces)
  const activeOrg = workspaces.find((w) => w.org_id === activeOrgId)

  const canManage = currentRole === 'Admin' || currentRole === 'Asset Manager'

  const [assets, setAssets] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [viewMode, setViewMode] = useState('table') // table | grid

  // Register modal state
  const [showRegister, setShowRegister] = useState(false)
  const [regForm, setRegForm] = useState({
    name: '', category_id: '', is_shared_resource: false,
    serial_number: '', acquisition_date: '', acquisition_cost: '',
    condition: 'New', location: '', photo_url: ''
  })
  const [registering, setRegistering] = useState(false)
  const [regError, setRegError] = useState('')
  const [openDropdownId, setOpenDropdownId] = useState(null)
  const [statusAction, setStatusAction] = useState(null) // { key, asset }
  const [statusReason, setStatusReason] = useState('')
  const [changingStatus, setChangingStatus] = useState(false)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = () => setOpenDropdownId(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  const fetchAssets = async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      if (categoryFilter) params.category_id = categoryFilter
      const { data } = await api.get('/assets', { params })
      setAssets(data)
    } catch (err) {
      console.error('Failed to fetch assets:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/categories')
      setCategories(data)
    } catch (err) {
      console.error('Failed to fetch categories:', err)
    }
  }

  const handleExport = async () => {
    try {
      const params = {}
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      if (categoryFilter) params.category_id = categoryFilter
      const response = await api.get('/assets/export', {
        params,
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'assets-export.csv')
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      console.error('Failed to export CSV:', err)
    }
  }

  useEffect(() => {
    fetchAssets()
    fetchCategories()
  }, [activeOrgId])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => fetchAssets(), 300)
    return () => clearTimeout(timer)
  }, [search, statusFilter, categoryFilter])

  const handleRegister = async (e) => {
    e.preventDefault()
    setRegError('')
    if (!regForm.name.trim()) {
      setRegError('Asset name is required.')
      return
    }
    setRegistering(true)
    try {
      await api.post('/assets', {
        ...regForm,
        category_id: regForm.category_id || null,
        acquisition_cost: regForm.acquisition_cost ? parseFloat(regForm.acquisition_cost) : null,
      })
      setShowRegister(false)
      setRegForm({
        name: '', category_id: '', is_shared_resource: false,
        serial_number: '', acquisition_date: '', acquisition_cost: '',
        condition: 'New', location: '', photo_url: ''
      })
      fetchAssets()
    } catch (err) {
      setRegError(err?.response?.data?.error || 'Failed to register asset.')
    } finally {
      setRegistering(false)
    }
  }

  // Summary counts
  const totalAssets = assets.length
  const availableCount = assets.filter(a => a.status === 'Available').length
  const allocatedCount = assets.filter(a => a.status === 'Allocated').length
  const maintenanceCount = assets.filter(a => a.status === 'Under Maintenance').length
  const lostCount = assets.filter(a => a.status === 'Lost').length

  const handleStatusChange = async () => {
    if (!statusAction) return
    setChangingStatus(true)
    setRegError('') // Reusing regError for global errors, but better to use a dedicated error or toast. 
    // We'll just alert on failure.

    const statusMap = {
      'lost': 'Lost',
      'retire': 'Retired',
      'dispose': 'Disposed',
      'recover': 'Available',
    }
    const newStatus = statusMap[statusAction.key]

    try {
      await api.patch(`/assets/${statusAction.asset.tag}/status`, { status: newStatus, reason: statusReason })
      setStatusAction(null)
      setStatusReason('')
      fetchAssets()
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to change status.')
    } finally {
      setChangingStatus(false)
    }
  }

  const getStatusActions = (asset) => {
    if (!asset || !canManage) return []
    const s = asset.status
    const actions = []
    
    // Always provide Edit
    actions.push({ key: 'edit', label: 'Edit Asset', icon: Edit, color: 'text-neutral-700 hover:bg-neutral-50' })

    if (s === 'Available' || s === 'Allocated') {
      actions.push({ key: 'lost', label: 'Mark as Lost', icon: AlertTriangle, color: 'text-red-600 hover:bg-red-50' })
    }
    if (s === 'Available' || s === 'Allocated') {
      actions.push({ key: 'retire', label: 'Retire', icon: Archive, color: 'text-neutral-600 hover:bg-neutral-50' })
    }
    if (s === 'Available' || s === 'Retired') {
      actions.push({ key: 'dispose', label: 'Dispose', icon: Trash2, color: 'text-red-600 hover:bg-red-50' })
    }
    if (s === 'Lost') {
      actions.push({ key: 'recover', label: 'Mark as Recovered', icon: RefreshCw, color: 'text-emerald-600 hover:bg-emerald-50' })
    }
    return actions
  }

  return (
    <>
      <Header breadcrumbs={[activeOrg?.org_name || 'Workspace', 'Assets']} />

      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        {/* Page Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-page-title text-neutral-900">Asset Directory</h1>
            <p className="text-sm text-neutral-500 mt-1">Manage and track all organizational physical assets across departments.</p>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleExport}>
                <Download className="h-4 w-4" /> Export CSV
              </Button>
              <Button onClick={() => setShowRegister(true)}>
                <Plus className="h-4 w-4" /> Register Asset
              </Button>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Assets', value: totalAssets, icon: Package, color: 'text-neutral-600 bg-neutral-100' },
            { label: 'Available', value: availableCount, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Allocated', value: allocatedCount, icon: Share2, color: 'text-blue-600 bg-blue-50' },
            { label: 'Under Repair', value: maintenanceCount, icon: Wrench, color: 'text-orange-600 bg-orange-50' },
            { label: 'Lost', value: lostCount, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
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

        {/* Filters + View Toggle */}
        <div className="bg-white border border-neutral-200 rounded-lg">
          <div className="p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-neutral-200">
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input placeholder="Search by tag, name, serial, location..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <select
                className="h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select
                className="h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Status: All</option>
                <option>Available</option>
                <option>Allocated</option>
                <option>Reserved</option>
                <option>Under Maintenance</option>
                <option>Lost</option>
                <option>Retired</option>
                <option>Disposed</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-neutral-500 font-medium">Viewing {assets.length} assets</span>
              <div className="flex border border-neutral-200 rounded-md overflow-hidden">
                <button
                  onClick={() => setViewMode('table')}
                  className={cn('p-2 transition-colors', viewMode === 'table' ? 'bg-primary-50 text-primary-600' : 'bg-white text-neutral-400 hover:bg-neutral-50')}
                >
                  <LayoutList className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn('p-2 transition-colors', viewMode === 'grid' ? 'bg-primary-50 text-primary-600' : 'bg-white text-neutral-400 hover:bg-neutral-50')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Table View */}
          {viewMode === 'table' && (
            <div className="overflow-x-auto min-h-[240px]">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200">
                    <th className="py-3 px-4 text-table-header">Asset Tag</th>
                    <th className="py-3 px-4 text-table-header">Name</th>
                    <th className="py-3 px-4 text-table-header">Category</th>
                    <th className="py-3 px-4 text-table-header">Status</th>
                    <th className="py-3 px-4 text-table-header">Condition</th>
                    <th className="py-3 px-4 text-table-header">Location</th>
                    <th className="py-3 px-4 text-table-header">Assigned To</th>
                    <th className="py-3 px-4 text-table-header text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {loading ? (
                    [...Array(8)].map((_, i) => (
                      <tr key={i}><td colSpan="8" className="p-4"><div className="h-6 bg-neutral-100 animate-pulse rounded" /></td></tr>
                    ))
                  ) : assets.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-12 text-center">
                        <Package className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
                        <p className="text-sm text-neutral-500">No assets found. {canManage && 'Click "Register Asset" to add your first asset.'}</p>
                      </td>
                    </tr>
                  ) : (
                    assets.map((asset) => (
                      <tr
                        key={asset.tag}
                        className={cn(
                          'hover:bg-neutral-50/70 transition-colors cursor-pointer h-12',
                          (asset.status === 'Retired' || asset.status === 'Disposed') && 'opacity-60'
                        )}
                        onClick={() => navigate(`/assets/${asset.tag}`)}
                      >
                        <td className="py-2 px-4 text-sm font-semibold text-primary-600">{asset.tag}</td>
                        <td className={cn('py-2 px-4 text-sm font-medium text-neutral-900', asset.status === 'Disposed' && 'line-through')}>{asset.name}</td>
                        <td className="py-2 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-700 border border-neutral-200">
                            {asset.Category?.name || '--'}
                          </span>
                        </td>
                        <td className="py-2 px-4">
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border', STATUS_COLORS[asset.status] || '')}>
                            {asset.status}
                          </span>
                        </td>
                        <td className="py-2 px-4">
                          {asset.condition ? (
                            <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border', CONDITION_COLORS[asset.condition] || 'bg-neutral-100 text-neutral-600 border-neutral-200')}>
                              {asset.condition}
                            </span>
                          ) : '--'}
                        </td>
                        <td className="py-2 px-4 text-sm text-neutral-600">{asset.location || '--'}</td>
                        <td className="py-2 px-4 text-sm text-neutral-600">{asset.CurrentHolder?.name || '—'}</td>
                        <td className="py-2 px-4 text-right relative" onClick={(e) => e.stopPropagation()}>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenDropdownId(openDropdownId === asset.tag ? null : asset.tag)
                            }}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                          {openDropdownId === asset.tag && getStatusActions(asset).length > 0 && (
                            <div className="absolute right-4 top-10 mt-1 w-48 bg-white rounded-md shadow-lg border border-neutral-200 z-50 py-1" onClick={e => e.stopPropagation()}>
                              {getStatusActions(asset).map(action => (
                                <button
                                  key={action.key}
                                  className={cn("w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors", action.color)}
                                  onClick={() => {
                                    setOpenDropdownId(null)
                                    if (action.key === 'edit') {
                                      navigate(`/assets/${asset.tag}`) // Redirects to details for editing
                                    } else {
                                      setStatusAction({ key: action.key, asset })
                                    }
                                  }}
                                >
                                  <action.icon className="h-4 w-4" />
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Grid View */}
          {viewMode === 'grid' && (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <div key={i} className="h-40 bg-neutral-100 animate-pulse rounded-lg border border-neutral-200" />
                ))
              ) : assets.length === 0 ? (
                <div className="col-span-full p-12 text-center">
                  <Package className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
                  <p className="text-sm text-neutral-500">No assets found.</p>
                </div>
              ) : (
                assets.map((asset) => (
                  <div
                    key={asset.tag}
                    className={cn(
                      'bg-white border border-neutral-200 rounded-lg p-4 cursor-pointer hover:border-primary-300 hover:shadow-md transition-all',
                      (asset.status === 'Retired' || asset.status === 'Disposed') && 'opacity-60 border-dashed'
                    )}
                    onClick={() => navigate(`/assets/${asset.tag}`)}
                  >
                    <div className="flex items-start justify-between mb-3 relative">
                      <span className="text-xs font-bold text-primary-600">{asset.tag}</span>
                      <div className="flex items-center gap-1">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border', STATUS_COLORS[asset.status] || '')}>
                          {asset.status}
                        </span>
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded"
                            onClick={() => setOpenDropdownId(openDropdownId === asset.tag ? null : asset.tag)}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          {openDropdownId === asset.tag && getStatusActions(asset).length > 0 && (
                            <div className="absolute right-0 top-6 mt-1 w-48 bg-white rounded-md shadow-lg border border-neutral-200 z-50 py-1" onClick={e => e.stopPropagation()}>
                              {getStatusActions(asset).map(action => (
                                <button
                                  key={action.key}
                                  className={cn("w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors", action.color)}
                                  onClick={() => {
                                    setOpenDropdownId(null)
                                    if (action.key === 'edit') {
                                      navigate(`/assets/${asset.tag}`)
                                    } else {
                                      setStatusAction({ key: action.key, asset })
                                    }
                                  }}
                                >
                                  <action.icon className="h-4 w-4" />
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <h3 className={cn('text-sm font-semibold text-neutral-900 mb-1', asset.status === 'Disposed' && 'line-through')}>{asset.name}</h3>
                    <p className="text-xs text-neutral-500 mb-2">{asset.Category?.name || 'Uncategorized'}</p>
                    <div className="flex items-center justify-between text-xs text-neutral-400">
                      <span>{asset.location || 'No location'}</span>
                      {asset.is_shared_resource && <Share2 className="h-3 w-3 text-blue-400" />}
                    </div>
                    {asset.CurrentHolder && (
                      <p className="text-xs text-neutral-500 mt-2 pt-2 border-t border-neutral-100">
                        Assigned to <span className="font-medium text-neutral-700">{asset.CurrentHolder.name}</span>
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Pagination footer */}
          <div className="p-3 border-t border-neutral-200 bg-neutral-50/50 text-xs text-neutral-500">
            Showing {assets.length} entries
          </div>
        </div>

        {/* Register Asset Modal */}
        {showRegister && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowRegister(false)}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-neutral-200">
                <h2 className="text-lg font-semibold text-neutral-900">Register New Asset</h2>
                <p className="text-sm text-neutral-500 mt-1">Fill in the details to register a new asset. Tag will be auto-generated.</p>
              </div>
              <form onSubmit={handleRegister} className="p-6 space-y-4">
                {regError && <Alert variant="error">{regError}</Alert>}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label required>Asset Name</Label>
                    <Input value={regForm.name} onChange={(e) => setRegForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Dell Latitude 5420" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <select
                      className="w-full h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                      value={regForm.category_id} onChange={(e) => setRegForm(p => ({ ...p, category_id: e.target.value }))}
                    >
                      <option value="">Select Category</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Serial Number</Label>
                    <Input value={regForm.serial_number} onChange={(e) => setRegForm(p => ({ ...p, serial_number: e.target.value }))} placeholder="e.g. SN-98472-X" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Condition</Label>
                    <select
                      className="w-full h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                      value={regForm.condition} onChange={(e) => setRegForm(p => ({ ...p, condition: e.target.value }))}
                    >
                      <option>New</option>
                      <option>Good</option>
                      <option>Fair</option>
                      <option>Poor</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Acquisition Date</Label>
                    <Input type="date" value={regForm.acquisition_date} onChange={(e) => setRegForm(p => ({ ...p, acquisition_date: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Acquisition Cost</Label>
                    <Input type="number" step="0.01" value={regForm.acquisition_cost} onChange={(e) => setRegForm(p => ({ ...p, acquisition_cost: e.target.value }))} placeholder="0.00" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Location</Label>
                    <Input value={regForm.location} onChange={(e) => setRegForm(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Floor 3, Cabinet B" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Photo URL</Label>
                    <Input value={regForm.photo_url} onChange={(e) => setRegForm(p => ({ ...p, photo_url: e.target.value }))} placeholder="https://..." />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={regForm.is_shared_resource}
                      onChange={(e) => setRegForm(p => ({ ...p, is_shared_resource: e.target.checked }))}
                      className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    />
                    Shared Resource (bookable)
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-neutral-200">
                  <Button type="button" variant="ghost" onClick={() => setShowRegister(false)}>Cancel</Button>
                  <Button type="submit" loading={registering}>
                    <Plus className="h-4 w-4" /> Register Asset
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Status Change Confirmation Modal */}
        {statusAction && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={() => setStatusAction(null)}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 space-y-4">
                <h3 className="text-base font-semibold text-neutral-900">
                  {statusAction.key === 'lost' && 'Mark Asset as Lost'}
                  {statusAction.key === 'retire' && 'Retire Asset'}
                  {statusAction.key === 'dispose' && 'Dispose Asset'}
                  {statusAction.key === 'recover' && 'Mark Asset as Recovered'}
                </h3>
                <p className="text-sm text-neutral-500">
                  {statusAction.key === 'lost' && `This will mark "${statusAction.asset.name}" (${statusAction.asset.tag}) as Lost.`}
                  {statusAction.key === 'retire' && `This will retire "${statusAction.asset.name}" (${statusAction.asset.tag}). It cannot be allocated or booked.`}
                  {statusAction.key === 'dispose' && `This will permanently mark "${statusAction.asset.name}" (${statusAction.asset.tag}) as Disposed. This cannot be undone.`}
                  {statusAction.key === 'recover' && `This will mark "${statusAction.asset.name}" (${statusAction.asset.tag}) as Available again.`}
                </p>
                {statusAction.key !== 'recover' && (
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
                    className={statusAction.key === 'dispose' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
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
