import { useState, useEffect } from 'react'
import { Plus, Search, Filter, Edit, Tag } from 'lucide-react'
import { Button } from '../../components/common/Button'
import { Input } from '../../components/common/Input'
import { Label } from '../../components/common/Label'
import { Alert } from '../../components/common/Alert'
import { cn } from '../../utils'
import api from '../../api/axios'

export function CategoriesTab() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Statuses')
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCustomFields, setNewCustomFields] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  const fetchCats = async () => {
    setLoading(true)
    try {
      // GET /api/categories → array of AssetCategory objects
      const { data } = await api.get('/categories')
      setCategories(data)
    } catch (err) {
      console.error('Failed to fetch categories:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCats()
  }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    setAddError('')
    if (!newName.trim()) {
      setAddError('Category name is required.')
      return
    }
    setAdding(true)
    try {
      // POST /api/categories → { message, category }
      await api.post('/categories', {
        name: newName,
        custom_fields: newCustomFields ? JSON.parse(newCustomFields) : null,
      })
      setNewName('')
      setNewCustomFields('')
      setShowAdd(false)
      fetchCats()
    } catch (err) {
      setAddError(err?.response?.data?.error || 'Failed to create category.')
    } finally {
      setAdding(false)
    }
  }

  const filteredCats = categories.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase())
    // Backend AssetCategory may not have a status field — treat all as Active if missing
    const catStatus = c.status || 'Active'
    const matchStatus = statusFilter === 'All Statuses' || catStatus === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="bg-white border border-neutral-200 rounded-lg flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-200 bg-neutral-50/50">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative max-w-xs w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input placeholder="Search categories..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs text-neutral-500 font-medium">Showing {filteredCats.length} of {categories.length}</span>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-4 w-4" /> Add Category
          </Button>
        </div>
      </div>

      {/* Inline Add Form */}
      {showAdd && (
        <div className="p-4 border-b border-neutral-200 bg-primary-50/50">
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1 w-full space-y-1.5">
              <Label required>Category Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Office Furniture" />
            </div>
            <div className="flex-1 w-full space-y-1.5">
              <Label>Custom Fields (JSON, optional)</Label>
              <Input value={newCustomFields} onChange={(e) => setNewCustomFields(e.target.value)} placeholder='e.g. {"serial_number": "string"}' />
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
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="py-3 px-4 text-table-header">Category Name</th>
              <th className="py-3 px-4 text-table-header">Custom Fields</th>
              <th className="py-3 px-4 text-table-header">Created</th>
              <th className="py-3 px-4 text-table-header text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i}><td colSpan="4" className="p-4"><div className="h-6 bg-neutral-100 animate-pulse rounded" /></td></tr>
              ))
            ) : filteredCats.length === 0 ? (
              <tr><td colSpan="4" className="p-8 text-center text-sm text-neutral-500">No categories found.</td></tr>
            ) : (
              filteredCats.map((cat) => (
                <tr key={cat.id} className="hover:bg-neutral-50/70 transition-colors group h-12">
                  <td className="py-2 px-4 font-medium text-sm text-neutral-900 flex items-center gap-2">
                    <Tag className="h-4 w-4 text-neutral-400" />
                    {cat.name}
                  </td>
                  <td className="py-2 px-4 text-xs font-mono text-neutral-500 truncate max-w-xs">
                    {cat.custom_fields ? JSON.stringify(cat.custom_fields) : '--'}
                  </td>
                  <td className="py-2 px-4 text-sm text-neutral-600">
                    {cat.created_at ? new Date(cat.created_at).toLocaleDateString() : '--'}
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
        Categories defined here appear as options when registering new assets.
      </div>
    </div>
  )
}
