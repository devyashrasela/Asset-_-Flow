import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Search } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { Input } from '../components/common/Input'
import { Alert } from '../components/common/Alert'
import { cn } from '../utils'
import api from '../api/axios'

export function AuditReport() {
  const { cycleId } = useParams()
  const navigate = useNavigate()
  const [cycle, setCycle] = useState(null)
  const [discrepancies, setDiscrepancies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  const authState = JSON.parse(localStorage.getItem('auth-storage'))?.state
  const role = authState?.orgMember?.role
  const canResolve = (role === 'Admin' || role === 'Asset Manager') && cycle?.status === 'Active'

  useEffect(() => {
    fetchData()
  }, [cycleId])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [cycleRes, discRes] = await Promise.all([
        api.get(`/api/audit/cycles/${cycleId}`),
        api.get(`/api/audit/cycles/${cycleId}/discrepancies`)
      ])
      setCycle(cycleRes.data)
      setDiscrepancies(discRes.data)
      setError(null)
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.error || 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  const handleResolve = async (itemId, resolution) => {
    try {
      await api.patch(`/api/audit/items/${itemId}/resolve`, { resolution })
      fetchData() // Refresh list
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to resolve')
    }
  }

  const filteredItems = discrepancies.filter(item => 
    item.Asset?.tag?.toLowerCase().includes(search.toLowerCase()) ||
    item.Asset?.name?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex-1 flex flex-col h-full bg-neutral-50/50">
        <Header 
          breadcrumbs={['Audit Cycles', 'Detail', 'Discrepancy Report']} 
          title="Loading..." 
        />
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-neutral-200 rounded w-1/4"></div>
            <div className="h-64 bg-neutral-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !cycle) {
    return (
      <div className="flex-1 flex flex-col h-full bg-neutral-50/50">
        <Header breadcrumbs={['Audit Cycles', 'Error']} />
        <div className="p-6">
          <Alert variant="danger">{error || 'Cycle not found'}</Alert>
          <Button variant="secondary" className="mt-4" onClick={() => navigate('/audit')}>
            Back to Audits
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-50/50 overflow-hidden">
      <Header 
        breadcrumbs={['Audit Cycles', cycle.name, 'Discrepancy Report']} 
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/audit/${cycleId}`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-page-title text-neutral-900">Discrepancy Report</h1>
              <p className="text-sm text-neutral-500 mt-1">
                {cycle.TargetDepartment?.name} • {new Date(cycle.start_date).toLocaleDateString()} to {new Date(cycle.end_date).toLocaleDateString()}
              </p>
            </div>
          </div>
          {cycle.status === 'Closed' && (
            <span className="px-3 py-1 bg-neutral-100 text-neutral-600 rounded-full text-sm font-medium border border-neutral-200">
              Closed
            </span>
          )}
        </div>

        <Card className="flex flex-col overflow-hidden h-[calc(100vh-12rem)]">
          <div className="p-4 border-b border-neutral-200 bg-white flex justify-between items-center shrink-0">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input 
                placeholder="Search assets..." 
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-auto p-4">
            <table className="w-full text-left text-sm border-collapse border border-neutral-200 rounded-lg overflow-hidden">
              <thead className="bg-neutral-50 text-table-header text-neutral-500 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Asset</th>
                  <th className="px-4 py-3 font-medium">Flagged Status</th>
                  <th className="px-4 py-3 font-medium">Flagged By</th>
                  <th className="px-4 py-3 font-medium">Notes</th>
                  <th className="px-4 py-3 font-medium">Resolution</th>
                  {canResolve && <th className="px-4 py-3 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={canResolve ? 6 : 5} className="px-4 py-8 text-center text-neutral-500">
                      No discrepancies found.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(item => (
                    <tr key={item.id} className="hover:bg-neutral-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-neutral-900">{item.asset_tag}</div>
                        <div className="text-xs text-neutral-500">{item.Asset?.name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
                          item.verification_status === 'Missing' ? "bg-red-50 text-red-700 border-red-200" :
                          "bg-amber-50 text-amber-700 border-amber-200"
                        )}>
                          {item.verification_status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-neutral-900">{item.VerifiedBy?.name || '-'}</div>
                        <div className="text-xs text-neutral-500">
                          {item.verified_at ? new Date(item.verified_at).toLocaleDateString() : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-600 max-w-xs truncate" title={item.notes}>
                        {item.notes || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {item.discrepancy_resolution ? (
                          <div className="flex flex-col gap-1">
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border w-fit",
                              item.discrepancy_resolution === 'Confirmed' 
                                ? "bg-red-50 text-red-700 border-red-200" 
                                : "bg-slate-100 text-slate-700 border-slate-200"
                            )}>
                              {item.discrepancy_resolution === 'Confirmed' ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                              {item.discrepancy_resolution}
                            </span>
                            <span className="text-[10px] text-neutral-400">By {item.ResolvedBy?.name}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-amber-50 text-amber-700 border-amber-200">
                            Unresolved
                          </span>
                        )}
                      </td>
                      {canResolve && (
                        <td className="px-4 py-3 text-right space-x-2">
                          <Button 
                            variant="danger" 
                            size="sm" 
                            onClick={() => handleResolve(item.id, 'Confirmed')}
                          >
                            Confirm
                          </Button>
                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => handleResolve(item.id, 'Dismissed')}
                          >
                            Dismiss
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
