import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ClipboardCheck, Plus, Trash2, X, Search, Users, FileText, AlertTriangle,
  CheckCircle2, XCircle, ChevronDown, Package
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/common/Button'
import { Input } from '../components/common/Input'
import { Label } from '../components/common/Label'
import { Alert } from '../components/common/Alert'
import { Card, CardHeader, CardTitle, CardContent } from '../components/common/Card'
import { cn } from '../utils'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'

const CYCLE_STATUS_COLORS = {
  Draft:  'bg-slate-100 text-slate-600',
  Active: 'bg-blue-50 text-blue-700',
  Closed: 'bg-neutral-100 text-neutral-600',
}

const ITEM_STATUS_COLORS = {
  Pending:  'bg-neutral-100 text-neutral-600',
  Verified: 'bg-emerald-50 text-emerald-700',
  Missing:  'bg-red-50 text-red-700',
  Damaged:  'bg-amber-50 text-amber-700',
}

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--'

function getUserRole() {
  try {
    const stored = JSON.parse(localStorage.getItem('auth-storage'))
    return stored?.state?.orgMember?.role || null
  } catch { return null }
}

export function AuditDetail() {
  const { cycleId } = useParams()
  const navigate = useNavigate()
  const activeOrgId = useAuthStore((s) => s.activeOrgId)
  const workspaces = useAuthStore((s) => s.workspaces)
  const activeOrg = workspaces.find((w) => w.org_id === activeOrgId)
  const currentRole = useAuthStore((s) => s.currentRole) || getUserRole()
  const canManage = currentRole === 'Admin' || currentRole === 'Asset Manager'

  const [cycle, setCycle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Auditors
  const [members, setMembers] = useState([])
  const [selectedMembers, setSelectedMembers] = useState([])
  const [assigning, setAssigning] = useState(false)
  const [showMemberDropdown, setShowMemberDropdown] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')

  // Items
  const [assetSearch, setAssetSearch] = useState('')
  const [assetSuggestions, setAssetSuggestions] = useState([])
  const [addingItem, setAddingItem] = useState(false)
  const [itemError, setItemError] = useState('')
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkTags, setBulkTags] = useState('')
  const [bulkAdding, setBulkAdding] = useState(false)
  const [bulkErrors, setBulkErrors] = useState([])

  // Verification modal
  const [verifyModal, setVerifyModal] = useState(null) // item object
  const [verifyStatus, setVerifyStatus] = useState('Verified')
  const [verifyNotes, setVerifyNotes] = useState('')
  const [verifying, setVerifying] = useState(false)

  // Close cycle
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [closing, setClosing] = useState(false)

  const fetchCycle = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/audit/cycles/${cycleId}`)
      setCycle(data)
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load audit cycle.')
    } finally {
      setLoading(false)
    }
  }, [cycleId])

  const fetchMembers = async () => {
    try {
      const { data } = await api.get('/org/members')
      setMembers(data)
    } catch (err) {
      console.error('Failed to fetch members:', err)
    }
  }

  useEffect(() => {
    fetchCycle()
    fetchMembers()
  }, [fetchCycle, activeOrgId])

  // Asset search autocomplete
  useEffect(() => {
    if (!assetSearch.trim()) {
      setAssetSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/assets', { params: { search: assetSearch } })
        setAssetSuggestions(data.slice(0, 8))
      } catch { setAssetSuggestions([]) }
    }, 300)
    return () => clearTimeout(timer)
  }, [assetSearch])

  // ── Auditor actions ──
  const handleAssignAuditors = async () => {
    if (selectedMembers.length === 0) return
    setAssigning(true)
    try {
      await api.post(`/audit/cycles/${cycleId}/auditors`, { user_ids: selectedMembers })
      setSelectedMembers([])
      fetchCycle()
    } catch (err) {
      console.error('Failed to assign auditors:', err)
    } finally {
      setAssigning(false)
    }
  }

  const handleRemoveAuditor = async (userId) => {
    try {
      await api.delete(`/audit/cycles/${cycleId}/auditors/${userId}`)
      fetchCycle()
    } catch (err) {
      console.error('Failed to remove auditor:', err)
    }
  }

  // ── Item actions ──
  const handleAddItem = async (tag) => {
    setItemError('')
    setAddingItem(true)
    try {
      await api.post(`/audit/cycles/${cycleId}/items`, { asset_tag: tag || assetSearch })
      setAssetSearch('')
      setAssetSuggestions([])
      fetchCycle()
    } catch (err) {
      setItemError(err?.response?.data?.error || 'Failed to add item.')
    } finally {
      setAddingItem(false)
    }
  }

  const handleBulkAdd = async () => {
    setBulkErrors([])
    const tags = bulkTags.split(/[,\n]+/).map((t) => t.trim()).filter(Boolean)
    if (tags.length === 0) return
    setBulkAdding(true)
    try {
      const { data } = await api.post(`/audit/cycles/${cycleId}/items/bulk`, { asset_tags: tags })
      if (data.errors && data.errors.length > 0) {
        setBulkErrors(data.errors)
      } else {
        setShowBulkModal(false)
        setBulkTags('')
      }
      fetchCycle()
    } catch (err) {
      setBulkErrors([err?.response?.data?.error || 'Bulk add failed.'])
    } finally {
      setBulkAdding(false)
    }
  }

  const handleRemoveItem = async (itemId) => {
    try {
      await api.delete(`/audit/cycles/${cycleId}/items/${itemId}`)
      fetchCycle()
    } catch (err) {
      console.error('Failed to remove item:', err)
    }
  }

  // ── Verify action ──
  const handleVerify = async () => {
    if (!verifyModal) return
    setVerifying(true)
    try {
      await api.patch(`/audit/items/${verifyModal.id}`, {
        status: verifyStatus,
        notes: verifyNotes,
      })
      setVerifyModal(null)
      setVerifyStatus('Verified')
      setVerifyNotes('')
      fetchCycle()
    } catch (err) {
      console.error('Failed to verify item:', err)
    } finally {
      setVerifying(false)
    }
  }

  // ── Close cycle ──
  const handleClose = async () => {
    setClosing(true)
    try {
      await api.post(`/audit/cycles/${cycleId}/close`)
      fetchCycle()
      setShowCloseModal(false)
    } catch (err) {
      console.error('Failed to close cycle:', err)
    } finally {
      setClosing(false)
    }
  }

  if (loading) {
    return (
      <>
        <Header breadcrumbs={[activeOrg?.org_name || 'Workspace', 'Audit', '...']} />
        <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-neutral-100 animate-pulse rounded-lg" />
          ))}
        </div>
      </>
    )
  }

  if (error || !cycle) {
    return (
      <>
        <Header breadcrumbs={[activeOrg?.org_name || 'Workspace', 'Audit']} />
        <div className="p-6 max-w-[1400px] mx-auto">
          <Alert variant="error">{error || 'Cycle not found.'}</Alert>
        </div>
      </>
    )
  }

  const items = cycle.Items || cycle.items || []
  const auditors = cycle.Auditors || cycle.auditors || []
  const pendingCount = items.filter((i) => i.status === 'Pending').length
  const verifiedCount = items.filter((i) => i.status !== 'Pending').length
  const totalItems = items.length
  const canClose = canManage && pendingCount === 0 && totalItems > 0 && cycle.status !== 'Closed'
  const isEditable = cycle.status === 'Draft' || cycle.status === 'Active'

  // Members not yet assigned
  const availableMembers = members.filter(
    (m) => !auditors.some((a) => (a.user_id || a.id) === (m.user_id || m.id))
  )
  const filteredMembers = availableMembers.filter((m) => {
    if (!memberSearch) return true
    const q = memberSearch.toLowerCase()
    return (m.name || m.User?.name || '').toLowerCase().includes(q) || (m.email || m.User?.email || '').toLowerCase().includes(q)
  })

  return (
    <>
      <Header breadcrumbs={[activeOrg?.org_name || 'Workspace', 'Audit', cycle.name]} />

      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        {/* ── Header Bar ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-page-title text-neutral-900">{cycle.name}</h1>
              <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold', CYCLE_STATUS_COLORS[cycle.status])}>
                {cycle.status}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1.5 text-sm text-neutral-500">
              {(cycle.Department?.name || cycle.department_name) && (
                <span className="inline-flex items-center gap-1">
                  <Package className="h-3.5 w-3.5" />
                  {cycle.Department?.name || cycle.department_name}
                </span>
              )}
              <span>{formatDate(cycle.start_date)} — {formatDate(cycle.end_date)}</span>
            </div>
          </div>
        </div>

        {/* ── Progress Bar ── */}
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-neutral-700">Verification Progress</span>
            <span className="text-sm text-neutral-500">
              {verifiedCount} / {totalItems} items verified
            </span>
          </div>
          <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: totalItems > 0 ? `${Math.round((verifiedCount / totalItems) * 100)}%` : '0%' }}
            />
          </div>
        </div>

        {/* ── Section A: Auditor Assignment ── */}
        {canManage && isEditable && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4 text-neutral-400" />
                Auditor Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Assigned auditors chips */}
              {auditors.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {auditors.map((a) => {
                    const name = a.name || a.User?.name || a.email || 'Unknown'
                    const id = a.user_id || a.id
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary-50 text-primary-700 text-xs font-medium border border-primary-200"
                      >
                        {name}
                        <button
                          onClick={() => handleRemoveAuditor(id)}
                          className="hover:bg-primary-100 rounded p-0.5 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}

              {/* Multi-select */}
              <div className="flex items-end gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Label className="mb-1.5 block">Add Auditors</Label>
                  <div
                    className="flex h-9 w-full items-center rounded-md border border-neutral-300 bg-white px-3 text-sm cursor-pointer"
                    onClick={() => setShowMemberDropdown(!showMemberDropdown)}
                  >
                    <span className="text-neutral-500 flex-1">
                      {selectedMembers.length > 0
                        ? `${selectedMembers.length} member${selectedMembers.length > 1 ? 's' : ''} selected`
                        : 'Select members...'}
                    </span>
                    <ChevronDown className="h-4 w-4 text-neutral-400" />
                  </div>
                  {showMemberDropdown && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-neutral-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                      <div className="p-2 border-b border-neutral-100">
                        <Input
                          placeholder="Search members..."
                          value={memberSearch}
                          onChange={(e) => setMemberSearch(e.target.value)}
                          className="h-8 text-xs"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      {filteredMembers.length === 0 ? (
                        <p className="p-3 text-xs text-neutral-400 text-center">No available members.</p>
                      ) : (
                        filteredMembers.map((m) => {
                          const id = m.user_id || m.id
                          const name = m.name || m.User?.name || m.email || 'Unknown'
                          const checked = selectedMembers.includes(id)
                          return (
                            <label
                              key={id}
                              className="flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 cursor-pointer text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setSelectedMembers((prev) =>
                                    checked ? prev.filter((x) => x !== id) : [...prev, id]
                                  )
                                }}
                                className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                              />
                              <span className="text-neutral-700">{name}</span>
                            </label>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
                <Button onClick={handleAssignAuditors} loading={assigning} disabled={selectedMembers.length === 0}>
                  Assign
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Non-editable auditor display */}
        {(!canManage || !isEditable) && auditors.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4 text-neutral-400" />
                Assigned Auditors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {auditors.map((a) => (
                  <span
                    key={a.user_id || a.id}
                    className="inline-flex items-center px-2.5 py-1 rounded-md bg-neutral-50 text-neutral-700 text-xs font-medium border border-neutral-200"
                  >
                    {a.name || a.User?.name || a.email || 'Unknown'}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Section B: Item Management ── */}
        {isEditable && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-4 w-4 text-neutral-400" />
                Add Items
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {itemError && <Alert variant="error">{itemError}</Alert>}
              <div className="flex items-end gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Label className="mb-1.5 block">Asset Tag</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <Input
                      placeholder="Search by tag or name..."
                      className="pl-9"
                      value={assetSearch}
                      onChange={(e) => setAssetSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddItem()
                        }
                      }}
                    />
                  </div>
                  {assetSuggestions.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-neutral-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {assetSuggestions.map((a) => (
                        <button
                          key={a.tag}
                          className="w-full text-left px-3 py-2 hover:bg-neutral-50 text-sm flex items-center justify-between"
                          onClick={() => {
                            handleAddItem(a.tag)
                          }}
                        >
                          <span className="font-medium text-primary-600">{a.tag}</span>
                          <span className="text-neutral-500 text-xs">{a.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button onClick={() => handleAddItem()} loading={addingItem} disabled={!assetSearch.trim()}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
                <Button variant="secondary" onClick={() => setShowBulkModal(true)}>
                  <FileText className="h-4 w-4" /> Bulk Add
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Section C: Checklist Grid ── */}
        <div className="bg-white border border-neutral-200 rounded-lg">
          <div className="px-6 py-4 border-b border-neutral-200">
            <h3 className="text-section-title text-neutral-900">Checklist</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200">
                  <th className="py-3 px-4 text-table-header">Asset Tag</th>
                  <th className="py-3 px-4 text-table-header">Asset Name</th>
                  <th className="py-3 px-4 text-table-header">Status</th>
                  <th className="py-3 px-4 text-table-header">Verified By</th>
                  <th className="py-3 px-4 text-table-header">Notes</th>
                  <th className="py-3 px-4 text-table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-12 text-center">
                      <ClipboardCheck className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
                      <p className="text-sm text-neutral-500">No items in this audit cycle yet.</p>
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="hover:bg-neutral-50/70 transition-colors h-12">
                      <td className="py-2 px-4 text-sm font-semibold text-primary-600">
                        {item.asset_tag || item.Asset?.tag || '--'}
                      </td>
                      <td className="py-2 px-4 text-sm font-medium text-neutral-900">
                        {item.asset_name || item.Asset?.name || '--'}
                      </td>
                      <td className="py-2 px-4">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold', ITEM_STATUS_COLORS[item.status] || '')}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-sm text-neutral-600">
                        {item.verified_by_name || item.VerifiedBy?.name || '--'}
                      </td>
                      <td className="py-2 px-4 text-sm text-neutral-500 max-w-[200px] truncate">
                        {item.notes || '--'}
                      </td>
                      <td className="py-2 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {item.status === 'Pending' && isEditable && (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setVerifyModal(item)
                                  setVerifyStatus('Verified')
                                  setVerifyNotes('')
                                }}
                              >
                                Verify
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-neutral-400 hover:text-red-600"
                                onClick={() => handleRemoveItem(item.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-neutral-200 bg-neutral-50/50 text-xs text-neutral-500">
            {totalItems} item{totalItems !== 1 ? 's' : ''} · {verifiedCount} verified · {pendingCount} pending
          </div>
        </div>

        {/* ── Bottom Actions ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Button variant="secondary" onClick={() => navigate(`/audit/${cycleId}/report`)}>
            <FileText className="h-4 w-4" /> View Discrepancy Report
          </Button>
          {canManage && cycle.status !== 'Closed' && (
            <Button
              variant="danger"
              disabled={!canClose}
              onClick={() => setShowCloseModal(true)}
            >
              <XCircle className="h-4 w-4" /> Close Cycle
            </Button>
          )}
        </div>

        {/* ── Verify Modal ── */}
        {verifyModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setVerifyModal(null)}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-neutral-200">
                <h2 className="text-lg font-semibold text-neutral-900">Verify Item</h2>
                <p className="text-sm text-neutral-500 mt-1">
                  {verifyModal.asset_tag || verifyModal.Asset?.tag} — {verifyModal.asset_name || verifyModal.Asset?.name}
                </p>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label required>Status</Label>
                  <div className="space-y-2">
                    {['Verified', 'Missing', 'Damaged'].map((s) => (
                      <label key={s} className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="radio"
                          name="verify-status"
                          value={s}
                          checked={verifyStatus === s}
                          onChange={() => setVerifyStatus(s)}
                          className="text-primary-600 focus:ring-primary-500"
                        />
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold', ITEM_STATUS_COLORS[s])}>
                          {s}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <textarea
                    className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none resize-none"
                    rows={3}
                    placeholder="Optional notes about the item condition..."
                    value={verifyNotes}
                    onChange={(e) => setVerifyNotes(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200">
                  <Button variant="ghost" onClick={() => setVerifyModal(null)}>Cancel</Button>
                  <Button onClick={handleVerify} loading={verifying}>
                    <CheckCircle2 className="h-4 w-4" /> Submit
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Bulk Add Modal ── */}
        {showBulkModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowBulkModal(false)}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-neutral-200">
                <h2 className="text-lg font-semibold text-neutral-900">Bulk Add Items</h2>
                <p className="text-sm text-neutral-500 mt-1">Paste comma-separated or newline-separated asset tags.</p>
              </div>
              <div className="p-6 space-y-4">
                {bulkErrors.length > 0 && (
                  <Alert variant="error">
                    <div>
                      {bulkErrors.map((e, i) => (
                        <p key={i}>{typeof e === 'string' ? e : e.tag ? `${e.tag}: ${e.error}` : JSON.stringify(e)}</p>
                      ))}
                    </div>
                  </Alert>
                )}
                <textarea
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none resize-none font-mono"
                  rows={6}
                  placeholder="AST-001, AST-002, AST-003"
                  value={bulkTags}
                  onChange={(e) => setBulkTags(e.target.value)}
                />
                <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200">
                  <Button variant="ghost" onClick={() => { setShowBulkModal(false); setBulkErrors([]) }}>Cancel</Button>
                  <Button onClick={handleBulkAdd} loading={bulkAdding} disabled={!bulkTags.trim()}>
                    <Plus className="h-4 w-4" /> Add Items
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Close Cycle Modal ── */}
        {showCloseModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowCloseModal(false)}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-neutral-200">
                <h2 className="text-lg font-semibold text-neutral-900">Close Audit Cycle</h2>
              </div>
              <div className="p-6 space-y-4">
                <Alert variant="warning">
                  Closing this cycle is permanent. All items flagged as <strong>Missing</strong> or <strong>Damaged</strong> will cascade their status to the corresponding assets. This action cannot be undone.
                </Alert>
                <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200">
                  <Button variant="ghost" onClick={() => setShowCloseModal(false)}>Cancel</Button>
                  <Button variant="danger" onClick={handleClose} loading={closing}>
                    <AlertTriangle className="h-4 w-4" /> Close Cycle
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
