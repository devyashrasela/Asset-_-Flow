import { useState, useEffect, useRef } from 'react'
import {
  Search, Download, ChevronLeft, ChevronRight, ChevronDown,
  Activity, X, FileText
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/common/Button'
import { Input } from '../components/common/Input'
import { Label } from '../components/common/Label'
import { cn } from '../utils'
import api from '../api/axios'

// ── Action type categories ──────────────────────────────────────────────────────

const ACTION_TYPE_GROUPS = {
  Assets: [
    'ASSET_REGISTERED', 'ASSET_UPDATED', 'ASSET_RETIRED',
    'ASSET_DISPOSED', 'ASSET_MARKED_LOST',
  ],
  Allocations: [
    'ASSET_ALLOCATED', 'ASSET_RETURNED', 'ALLOCATION_OVERDUE',
  ],
  Bookings: [
    'BOOKING_CREATED', 'BOOKING_CANCELLED', 'BOOKING_REMINDER', 'BOOKING_COMPLETED',
  ],
  Maintenance: [
    'MAINTENANCE_REQUESTED', 'MAINTENANCE_APPROVED', 'MAINTENANCE_REJECTED',
    'MAINTENANCE_IN_PROGRESS', 'MAINTENANCE_RESOLVED',
  ],
  Transfers: [
    'TRANSFER_REQUESTED', 'TRANSFER_APPROVED', 'TRANSFER_REJECTED',
  ],
  Audit: [
    'AUDIT_CYCLE_CREATED', 'AUDIT_CYCLE_ACTIVATED', 'AUDIT_ITEM_VERIFIED',
    'AUDIT_ITEM_MISSING', 'AUDIT_ITEM_DAMAGED', 'AUDIT_DISCREPANCY',
    'AUDIT_DISCREPANCY_CONFIRMED', 'AUDIT_DISCREPANCY_DISMISSED', 'AUDIT_CYCLE_CLOSED',
  ],
  Organization: [
    'USER_INVITED', 'ROLE_UPDATED', 'USER_SUSPENDED', 'USER_REACTIVATED',
    'DEPARTMENT_CREATED', 'DEPARTMENT_DEACTIVATED', 'CATEGORY_CREATED',
  ],
}

const MODULE_COLORS = {
  Assets:       'bg-blue-50 text-blue-700',
  Allocations:  'bg-purple-50 text-purple-700',
  Bookings:     'bg-teal-50 text-teal-700',
  Maintenance:  'bg-orange-50 text-orange-700',
  Transfers:    'bg-indigo-50 text-indigo-700',
  Audit:        'bg-amber-50 text-amber-700',
  Organization: 'bg-emerald-50 text-emerald-700',
}

// Build a reverse lookup: action_type -> module name
const ACTION_TO_MODULE = {}
Object.entries(ACTION_TYPE_GROUPS).forEach(([module, actions]) => {
  actions.forEach((a) => { ACTION_TO_MODULE[a] = module })
})

function getModuleColor(actionType) {
  const mod = ACTION_TO_MODULE[actionType]
  return MODULE_COLORS[mod] || 'bg-neutral-100 text-neutral-600'
}

function formatActionLabel(actionType) {
  return actionType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bId\b/g, 'ID')
}

function formatTimestamp(ts) {
  const d = new Date(ts)
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

function getUserRole() {
  try {
    return JSON.parse(localStorage.getItem('auth-storage'))?.state?.orgMember?.role
  } catch { return null }
}

// ── Component ───────────────────────────────────────────────────────────────────

export function ActivityLog() {
  const role = getUserRole()
  const canExport = role === 'Admin' || role === 'Asset Manager'

  // Data
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [exporting, setExporting] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [selectedActions, setSelectedActions] = useState([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Multi-select dropdown
  const [actionDropdownOpen, setActionDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setActionDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Fetch logs
  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = { page }
      if (search) params.search = search
      if (selectedActions.length) params.action_type = selectedActions.join(',')
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate

      const { data } = await api.get('/activity-log', { params })
      setLogs(data.logs || data.data || [])
      setTotalPages(data.totalPages || data.total_pages || 1)
    } catch (err) {
      console.error('Failed to fetch activity logs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLogs() }, [page, selectedActions, startDate, endDate])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      fetchLogs()
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  // Export CSV
  const handleExport = async () => {
    setExporting(true)
    try {
      const { data } = await api.get('/activity-log/export', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  // Toggle action type in multi-select
  const toggleAction = (action) => {
    setSelectedActions((prev) =>
      prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]
    )
    setPage(1)
  }

  const clearActions = () => { setSelectedActions([]); setPage(1) }

  // ── Skeleton rows ──────────────────────────────────────────────────────────────

  const SkeletonRows = () => (
    <>
      {[...Array(8)].map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="py-3 px-4"><div className="h-4 bg-neutral-100 rounded w-32" /></td>
          <td className="py-3 px-4"><div className="h-4 bg-neutral-100 rounded w-24" /></td>
          <td className="py-3 px-4"><div className="h-5 bg-neutral-100 rounded-full w-28" /></td>
          <td className="py-3 px-4"><div className="h-4 bg-neutral-100 rounded w-64" /></td>
        </tr>
      ))}
    </>
  )

  return (
    <>
      <Header
        title="Activity Log"
        breadcrumbs={['Activity Log']}
        onRefresh={fetchLogs}
      />

      <div className="p-6 space-y-4">
        {/* Page title row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-page-title">Activity Log</h1>
            <p className="text-sm text-neutral-500 mt-0.5">Track all actions and events across your organization.</p>
          </div>
          {canExport && (
            <Button variant="secondary" onClick={handleExport} loading={exporting}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          )}
        </div>

        {/* Filters bar */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Search */}
          <div className="flex-1 min-w-[200px] max-w-sm space-y-1">
            <Label>Search</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input
                className="pl-8"
                placeholder="Search descriptions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Action Type multi-select */}
          <div className="min-w-[200px] space-y-1 relative" ref={dropdownRef}>
            <Label>Action Type</Label>
            <button
              type="button"
              onClick={() => setActionDropdownOpen((p) => !p)}
              className={cn(
                'flex items-center justify-between w-full h-9 rounded-md border bg-white px-3 text-sm transition-colors',
                'focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none',
                actionDropdownOpen ? 'border-primary-500 ring-1 ring-primary-500' : 'border-neutral-300'
              )}
            >
              <span className={cn('truncate', selectedActions.length === 0 && 'text-neutral-400')}>
                {selectedActions.length === 0
                  ? 'All Actions'
                  : `${selectedActions.length} selected`}
              </span>
              <ChevronDown className={cn('h-4 w-4 text-neutral-400 transition-transform', actionDropdownOpen && 'rotate-180')} />
            </button>

            {selectedActions.length > 0 && (
              <button
                type="button"
                onClick={clearActions}
                className="absolute right-8 top-[33px] text-neutral-400 hover:text-neutral-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            {actionDropdownOpen && (
              <div className="absolute z-40 top-full mt-1 left-0 w-72 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                {Object.entries(ACTION_TYPE_GROUPS).map(([group, actions]) => (
                  <div key={group}>
                    <div className="px-3 py-1.5 text-xs font-semibold text-neutral-500 uppercase tracking-wider bg-neutral-50 sticky top-0">
                      {group}
                    </div>
                    {actions.map((action) => (
                      <label
                        key={action}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedActions.includes(action)}
                          onChange={() => toggleAction(action)}
                          className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className={cn('px-1.5 py-0.5 rounded text-[11px] font-medium', getModuleColor(action))}>
                          {formatActionLabel(action)}
                        </span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Start Date */}
          <div className="space-y-1">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
            />
          </div>

          {/* End Date */}
          <div className="space-y-1">
            <Label>End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
            />
          </div>
        </div>

        {/* Selected action pills */}
        {selectedActions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedActions.map((action) => (
              <span
                key={action}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                  getModuleColor(action)
                )}
              >
                {formatActionLabel(action)}
                <button type="button" onClick={() => toggleAction(action)} className="hover:opacity-70">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={clearActions}
              className="text-xs text-neutral-500 hover:text-neutral-700 underline"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Table */}
        <div className="border border-neutral-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="text-table-header py-2.5 px-4">Timestamp</th>
                  <th className="text-table-header py-2.5 px-4">User</th>
                  <th className="text-table-header py-2.5 px-4">Action Type</th>
                  <th className="text-table-header py-2.5 px-4">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  <SkeletonRows />
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-16 text-center">
                      <FileText className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
                      <p className="text-sm font-medium text-neutral-500">No activity logs found</p>
                      <p className="text-xs text-neutral-400 mt-1">Try adjusting your filters or date range.</p>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-neutral-50/70 transition-colors">
                      <td className="py-2.5 px-4 text-sm text-neutral-600 whitespace-nowrap">
                        {formatTimestamp(log.created_at || log.timestamp)}
                      </td>
                      <td className="py-2.5 px-4 text-sm font-medium text-neutral-900">
                        {log.User?.name || log.user_name || '—'}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold',
                          getModuleColor(log.action_type)
                        )}>
                          {formatActionLabel(log.action_type)}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-sm text-neutral-600 max-w-md truncate">
                        {log.description}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="flex items-center justify-between p-3 border-t border-neutral-200 bg-neutral-50/50">
            <p className="text-xs text-neutral-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
