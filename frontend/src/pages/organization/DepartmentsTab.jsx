import { useState, useEffect } from 'react'
import { Plus, Search, Filter, Edit, CornerDownRight, Network, Check, X } from 'lucide-react'
import { Button } from '../../components/common/Button'
import { Input } from '../../components/common/Input'
import { Label } from '../../components/common/Label'
import { Alert } from '../../components/common/Alert'
import { cn } from '../../utils'
import api from '../../api/axios'

export function DepartmentsTab() {
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Statuses')
  const [showAdd, setShowAdd] = useState(false)
  const [newDeptName, setNewDeptName] = useState('')
  const [newDeptParent, setNewDeptParent] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  const fetchDepts = async () => {
    setLoading(true)
    try {
      // GET /api/departments → array of dept objects with ParentDepartment + HeadUser includes
      const { data } = await api.get('/departments')
      setDepartments(data)
    } catch (err) {
      console.error('Failed to fetch departments:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDepts()
  }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    setAddError('')
    if (!newDeptName.trim()) {
      setAddError('Department name is required.')
      return
    }
    setAdding(true)
    try {
      // POST /api/departments → { message, department }
      await api.post('/departments', {
        name: newDeptName,
        parent_id: newDeptParent || null,
      })
      setNewDeptName('')
      setNewDeptParent('')
      setShowAdd(false)
      fetchDepts()
    } catch (err) {
      setAddError(err?.response?.data?.error || 'Failed to create department.')
    } finally {
      setAdding(false)
    }
  }

  // Build tree: top-level first, then children underneath
  const topLevel = departments.filter(d => !d.parent_id)
  let orderedDepts = []
  topLevel.forEach(parent => {
    orderedDepts.push({ ...parent, isChild: false })
    const children = departments.filter(d => d.parent_id === parent.id)
    children.forEach(child => {
      orderedDepts.push({ ...child, isChild: true })
    })
  })
  // Orphans
  departments.forEach(d => {
    if (d.parent_id && !topLevel.find(t => t.id === d.parent_id)) {
      if (!orderedDepts.find(o => o.id === d.id)) {
        orderedDepts.push({ ...d, isChild: false })
      }
    }
  })

  const filteredDepts = orderedDepts.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'All Statuses' || d.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="bg-white border border-neutral-200 rounded-lg flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-200 bg-neutral-50/50">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative max-w-xs w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input placeholder="Search departments..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <select
              className="pl-9 pr-8 h-9 rounded-md border border-neutral-300 bg-white text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none appearance-none"
              value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option>All Statuses</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs text-neutral-500 font-medium">Showing {filteredDepts.length} of {departments.length}</span>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-4 w-4" /> Add Department
          </Button>
        </div>
      </div>

      {/* Inline Add Form */}
      {showAdd && (
        <div className="p-4 border-b border-neutral-200 bg-primary-50/50">
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full space-y-1.5">
              <Label required>Department Name</Label>
              <Input value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} placeholder="e.g. Sales" />
            </div>
            <div className="flex-1 w-full space-y-1.5">
              <Label>Parent Department</Label>
              <select
                className="w-full h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                value={newDeptParent} onChange={(e) => setNewDeptParent(e.target.value)}
              >
                <option value="">None (Top Level)</option>
                {topLevel.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}
              </select>
            </div>
            <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
              <Button type="submit" loading={adding}>Save</Button>
              <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </form>
          {addError && <Alert variant="error" className="mt-3">{addError}</Alert>}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="py-3 px-4 text-table-header">Department</th>
              <th className="py-3 px-4 text-table-header">Head</th>
              <th className="py-3 px-4 text-table-header">Parent Dept</th>
              <th className="py-3 px-4 text-table-header">Status</th>
              <th className="py-3 px-4 text-table-header text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i}><td colSpan="5" className="p-4"><div className="h-6 bg-neutral-100 animate-pulse rounded" /></td></tr>
              ))
            ) : filteredDepts.length === 0 ? (
              <tr><td colSpan="5" className="p-8 text-center text-sm text-neutral-500">No departments found matching your filters.</td></tr>
            ) : (
              filteredDepts.map((dept) => (
                <tr key={dept.id} className="hover:bg-neutral-50/70 transition-colors group h-12">
                  <td className="py-2 px-4 font-medium text-sm text-neutral-900 flex items-center gap-2">
                    {dept.isChild && <CornerDownRight className="h-4 w-4 text-neutral-400 ml-4" />}
                    {!dept.isChild && <Network className="h-4 w-4 text-neutral-400" />}
                    {dept.name}
                  </td>
                  <td className="py-2 px-4 text-sm text-neutral-600">{dept.HeadUser?.name || '--'}</td>
                  <td className="py-2 px-4 text-sm text-neutral-600">{dept.ParentDepartment?.name || '--'}</td>
                  <td className="py-2 px-4">
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border',
                      dept.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                    )}>{dept.status}</span>
                  </td>
                  <td className="py-2 px-4 text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="p-3 bg-neutral-50 border-t border-neutral-200 text-xs text-neutral-500 flex items-center gap-2">
        <div className="h-4 w-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">i</div>
        Editing a department here also drives the picklist in Asset Registrations and Transfers.
      </div>
    </div>
  )
}
