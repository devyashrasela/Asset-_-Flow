import { useState, useEffect, useCallback } from 'react'
import {
  BarChart3, Activity, Wrench, CalendarClock, Building2, CalendarDays,
  Download, TrendingUp, AlertTriangle, Package, Clock, Loader2,
  ChevronRight, FileSpreadsheet
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/common/Button'
import { cn } from '../utils'
import api from '../api/axios'

// ─── Color Palettes ─────────────────────────────────────────────────────────

const CHART_COLORS = ['#2563eb', '#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f97316']
const STATUS_COLORS = {
  Available: '#22c55e', Allocated: '#3b82f6', Reserved: '#8b5cf6',
  'Under Maintenance': '#f59e0b', Lost: '#ef4444', Retired: '#94a3b8', Disposed: '#6b7280'
}
const PRIORITY_COLORS = { Critical: '#ef4444', High: '#f59e0b', Medium: '#3b82f6', Low: '#6b7280' }

// ─── Report Sections ────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'utilization', label: 'Asset Utilization', icon: TrendingUp },
  { id: 'maintenance', label: 'Maintenance Analytics', icon: Wrench },
  { id: 'lifecycle', label: 'Lifecycle & Retirement', icon: CalendarClock },
  { id: 'departments', label: 'Department Summary', icon: Building2 },
  { id: 'bookings', label: 'Booking Heatmap', icon: CalendarDays },
  { id: 'export', label: 'Custom Export', icon: FileSpreadsheet },
]

// ─── Main Component ─────────────────────────────────────────────────────────

export function Reports() {
  const [activeSection, setActiveSection] = useState('utilization')
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date().toISOString().split('T')[0]
    const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    return { start_date: start, end_date: end }
  })
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchSummary = useCallback(async () => {
    try {
      const { data } = await api.get('/reports/summary')
      setSummary(data)
    } catch (err) { console.error('Summary fetch failed:', err) }
  }, [])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  return (
    <>
      <Header title="Reports & Analytics" breadcrumbs={['AssetFlow', 'Reports']} onRefresh={fetchSummary} />

      <div className="p-6 space-y-6">
        {/* KPI Summary Strip */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard icon={Package} label="Total Assets" value={summary.total_assets} color="bg-blue-50 text-blue-600" />
            <SummaryCard icon={TrendingUp} label="Utilization Rate" value={`${summary.utilization_rate}%`} color="bg-emerald-50 text-emerald-600" />
            <SummaryCard icon={Wrench} label="Active Maintenance" value={summary.active_maintenance} color="bg-amber-50 text-amber-600" />
            <SummaryCard icon={AlertTriangle} label="Overdue Allocations" value={summary.overdue_allocations} color="bg-red-50 text-red-600" accent={summary.overdue_allocations > 0} />
          </div>
        )}

        {/* Layout: Sidebar + Content */}
        <div className="flex gap-6">
          {/* Report Sidebar */}
          <nav className="w-56 shrink-0">
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              {SECTIONS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium transition-colors text-left cursor-pointer border-b border-neutral-100 last:border-b-0',
                    activeSection === s.id
                      ? 'bg-primary-50 text-primary-700 border-l-2 border-l-primary-600'
                      : 'text-neutral-600 hover:bg-neutral-50'
                  )}
                >
                  <s.icon className="h-4 w-4 shrink-0" />
                  {s.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Report Content */}
          <div className="flex-1 min-w-0">
            {/* Date Range Picker */}
            {activeSection !== 'export' && activeSection !== 'lifecycle' && (
              <div className="flex items-center gap-3 mb-5 bg-white rounded-xl border border-neutral-200 px-4 py-3">
                <span className="text-sm text-neutral-500 font-medium">Date Range:</span>
                <input type="date" value={dateRange.start_date}
                  onChange={(e) => setDateRange(p => ({ ...p, start_date: e.target.value }))}
                  className="h-8 px-2 rounded-md border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                <span className="text-neutral-400">→</span>
                <input type="date" value={dateRange.end_date}
                  onChange={(e) => setDateRange(p => ({ ...p, end_date: e.target.value }))}
                  className="h-8 px-2 rounded-md border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            )}

            {activeSection === 'utilization' && <UtilizationSection dateRange={dateRange} />}
            {activeSection === 'maintenance' && <MaintenanceSection dateRange={dateRange} />}
            {activeSection === 'lifecycle' && <LifecycleSection />}
            {activeSection === 'departments' && <DepartmentsSection dateRange={dateRange} />}
            {activeSection === 'bookings' && <BookingsSection dateRange={dateRange} />}
            {activeSection === 'export' && <ExportSection dateRange={dateRange} />}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Summary Card ───────────────────────────────────────────────────────────

function SummaryCard({ icon: Icon, label, value, color, accent }) {
  return (
    <div className={cn('rounded-xl border border-neutral-200 bg-white p-4 flex items-center gap-4 hover:shadow-md transition-shadow',
      accent && 'border-red-200 bg-red-50/30')}>
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

// ─── Section Wrapper ────────────────────────────────────────────────────────

function SectionCard({ title, children, onExport }) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden mb-5">
      <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        {onExport && (
          <Button size="sm" variant="secondary" onClick={onExport}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div className="text-center py-10 text-neutral-400">
      <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-30" />
      <p className="text-sm">{message || 'No data available for the selected date range.'}</p>
    </div>
  )
}

// ─── Simple Bar Chart (CSS-based) ───────────────────────────────────────────

function HorizontalBar({ items, maxVal, labelKey, valueKey, colorFn }) {
  if (!items || items.length === 0) return <EmptyState />
  const max = maxVal || Math.max(...items.map(i => i[valueKey] || 0), 1)
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-neutral-600 w-36 truncate shrink-0 text-right">{item[labelKey]}</span>
          <div className="flex-1 bg-neutral-100 rounded-full h-5 relative overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max((item[valueKey] / max) * 100, 2)}%`, backgroundColor: colorFn ? colorFn(i) : CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="absolute right-2 top-0 h-full flex items-center text-[11px] font-semibold text-neutral-700">
              {item[valueKey]}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Donut Chart (SVG) ──────────────────────────────────────────────────────

function DonutChart({ segments, size = 160, strokeWidth = 28 }) {
  if (!segments || segments.length === 0) return <EmptyState />
  const total = segments.reduce((s, seg) => s + (seg.value || 0), 0)
  if (total === 0) return <EmptyState />

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} className="shrink-0">
        {segments.map((seg, i) => {
          const pct = seg.value / total
          const dash = pct * circumference
          const gap = circumference - dash
          const currentOffset = offset
          offset += dash
          return (
            <circle key={i} cx={size / 2} cy={size / 2} r={radius} fill="none"
              stroke={seg.color || CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={strokeWidth} strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-currentOffset} strokeLinecap="butt"
              style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }} />
          )
        })}
        <text x="50%" y="50%" textAnchor="middle" dy=".3em" className="text-xl font-bold fill-neutral-900">{total}</text>
      </svg>
      <div className="space-y-1.5">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: seg.color || CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="text-neutral-600">{seg.label}</span>
            <span className="font-semibold text-neutral-800 ml-auto">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Report 1: Asset Utilization ────────────────────────────────────────────

function UtilizationSection({ dateRange }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data: d } = await api.get('/reports/utilization', { params: dateRange })
        setData(d)
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    load()
  }, [dateRange])

  if (loading) return <LoadingState />
  if (!data) return <EmptyState />

  const downloadCSV = () => window.open(`/api/reports/export?type=utilization&start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`, '_blank')

  return (
    <>
      <SectionCard title="Most-Used Assets (Top 20)" onExport={downloadCSV}>
        <HorizontalBar items={data.most_used} labelKey="name" valueKey="total_activity" />
      </SectionCard>

      <SectionCard title={`Idle Assets (${data.idle_assets?.length || 0})`}>
        {data.idle_assets?.length > 0 ? (
          <DataTable headers={['Tag', 'Name', 'Category', 'Status']}
            rows={data.idle_assets.map(a => [a.tag, a.name, a.category_name, a.status])} />
        ) : <EmptyState message="No idle assets in this period — all assets have activity!" />}
      </SectionCard>

      <SectionCard title="Utilization Trend (Monthly Allocations)">
        {data.utilization_trend?.length > 0 ? (
          <div className="flex items-end gap-2 h-40">
            {data.utilization_trend.map((m, i) => {
              const max = Math.max(...data.utilization_trend.map(t => t.allocations_count), 1)
              const height = (m.allocations_count / max) * 100
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold text-neutral-700">{m.allocations_count}</span>
                  <div className="w-full rounded-t-md bg-primary-500 transition-all duration-500"
                    style={{ height: `${Math.max(height, 4)}%` }} />
                  <span className="text-[10px] text-neutral-400">{m.month.slice(5)}</span>
                </div>
              )
            })}
          </div>
        ) : <EmptyState message="No allocation data for this period." />}
      </SectionCard>
    </>
  )
}

// ─── Report 2: Maintenance Analytics ────────────────────────────────────────

function MaintenanceSection({ dateRange }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data: d } = await api.get('/reports/maintenance', { params: dateRange })
        setData(d)
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    load()
  }, [dateRange])

  if (loading) return <LoadingState />
  if (!data) return <EmptyState />

  const downloadCSV = () => window.open(`/api/reports/export?type=maintenance&start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`, '_blank')

  return (
    <>
      <SectionCard title="Maintenance Frequency by Asset (Top 20)" onExport={downloadCSV}>
        <HorizontalBar items={data.by_asset} labelKey="asset_name" valueKey="total_requests"
          colorFn={(i) => data.by_asset[i]?.critical_count > 0 ? '#ef4444' : CHART_COLORS[i % CHART_COLORS.length]} />
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="By Category">
          <DonutChart segments={data.by_category?.map((c, i) => ({
            label: c.category_name, value: Number(c.total_requests), color: CHART_COLORS[i % CHART_COLORS.length]
          })) || []} />
        </SectionCard>

        <SectionCard title="Priority Distribution">
          <DonutChart segments={data.priority_distribution?.map(p => ({
            label: p.priority, value: Number(p.count), color: PRIORITY_COLORS[p.priority] || '#6b7280'
          })) || []} />
        </SectionCard>
      </div>

      <SectionCard title="Status Breakdown">
        <div className="flex gap-3 flex-wrap">
          {(data.status_breakdown || []).map((s, i) => (
            <div key={i} className="flex items-center gap-2 bg-neutral-50 rounded-lg px-4 py-2.5 border border-neutral-200">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
              <span className="text-sm text-neutral-700">{s.status}</span>
              <span className="text-lg font-bold text-neutral-900 ml-1">{s.count}</span>
            </div>
          ))}
          {(!data.status_breakdown || data.status_breakdown.length === 0) && <EmptyState />}
        </div>
      </SectionCard>
    </>
  )
}

// ─── Report 3: Lifecycle & Retirement ───────────────────────────────────────

function LifecycleSection() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data: d } = await api.get('/reports/lifecycle')
        setData(d)
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) return <LoadingState />
  if (!data) return <EmptyState />

  return (
    <>
      <SectionCard title={`Assets Due for Maintenance (${data.due_for_maintenance?.length || 0})`}>
        {data.due_for_maintenance?.length > 0 ? (
          <DataTable
            headers={['Tag', 'Name', 'Category', 'Status', 'Maintenance Count', 'Last Request']}
            rows={data.due_for_maintenance.map(a => [
              a.tag, a.name, a.category_name, a.status,
              <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold',
                a.maintenance_count >= 3 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              )}>{a.maintenance_count}</span>,
              a.last_request_date ? new Date(a.last_request_date).toLocaleDateString() : '—'
            ])} />
        ) : <EmptyState message="No assets with recurring maintenance issues." />}
      </SectionCard>

      <SectionCard title={`Assets Nearing Retirement (${data.nearing_retirement?.length || 0})`}>
        {data.nearing_retirement?.length > 0 ? (
          <DataTable
            headers={['Tag', 'Name', 'Category', 'Age', 'Condition', 'Maintenance Count']}
            rows={data.nearing_retirement.map(a => {
              const years = Math.floor(a.age_in_days / 365)
              return [
                a.tag, a.name, a.category_name,
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold',
                  years >= 4 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                )}>{years}y {a.age_in_days % 365}d</span>,
                a.condition || '—',
                a.lifetime_maintenance_count
              ]
            })} />
        ) : <EmptyState message="No assets nearing retirement threshold (4+ years)." />}
      </SectionCard>

      <SectionCard title="Asset Status Distribution">
        <DonutChart segments={data.status_distribution?.map(s => ({
          label: s.status, value: Number(s.count), color: STATUS_COLORS[s.status] || '#6b7280'
        })) || []} />
      </SectionCard>
    </>
  )
}

// ─── Report 4: Department Summary ───────────────────────────────────────────

function DepartmentsSection({ dateRange }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data: d } = await api.get('/reports/departments', { params: dateRange })
        setData(d)
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    load()
  }, [dateRange])

  if (loading) return <LoadingState />
  if (!data) return <EmptyState />

  return (
    <>
      <SectionCard title="Allocation Summary by Department">
        {data.allocation_summary?.length > 0 ? (
          <DataTable
            headers={['Department', 'Active Assets', 'Total Records', 'Active', 'Returned', 'Overdue']}
            rows={data.allocation_summary.map(d => [
              d.department_name,
              d.active_allocated_assets,
              d.total_allocation_records,
              d.active_allocations,
              d.returned_allocations,
              <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold',
                d.overdue_count > 0 ? 'bg-red-100 text-red-700' : 'bg-neutral-100 text-neutral-500'
              )}>{d.overdue_count}</span>
            ])} />
        ) : <EmptyState message="No departments found." />}
      </SectionCard>

      <SectionCard title="Headcount & Asset-to-Member Ratio">
        {data.headcount_ratio?.length > 0 ? (
          <DataTable
            headers={['Department', 'Members', 'Active Assets', 'Ratio']}
            rows={data.headcount_ratio.map(d => [
              d.department_name,
              d.member_count,
              d.active_assets,
              <span className="font-mono text-primary-700 font-semibold">{d.asset_to_member_ratio}</span>
            ])} />
        ) : <EmptyState />}
      </SectionCard>
    </>
  )
}

// ─── Report 5: Booking Heatmap ──────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const HOURS = Array.from({ length: 13 }, (_, i) => i + 8) // 08:00 to 20:00

function BookingsSection({ dateRange }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data: d } = await api.get('/reports/bookings/heatmap', { params: dateRange })
        setData(d)
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    load()
  }, [dateRange])

  if (loading) return <LoadingState />
  if (!data) return <EmptyState />

  // Build heatmap grid
  const heatmapMap = {}
  let maxCount = 1;
  (data.heatmap || []).forEach(h => {
    const key = `${h.day_of_week}-${h.hour_of_day}`
    heatmapMap[key] = h.booking_count
    if (h.booking_count > maxCount) maxCount = h.booking_count
  })

  return (
    <>
      <SectionCard title="Peak Usage Heatmap (Day × Hour)">
        {data.heatmap?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-[10px] text-neutral-400 w-16"></th>
                  {HOURS.map(h => (
                    <th key={h} className="text-[10px] text-neutral-400 px-1 text-center">{String(h).padStart(2, '0')}:00</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map(day => (
                  <tr key={day}>
                    <td className="text-[11px] text-neutral-500 font-medium pr-2 text-right">{day.slice(0, 3)}</td>
                    {HOURS.map(h => {
                      const count = heatmapMap[`${day}-${h}`] || 0
                      const intensity = count / maxCount
                      return (
                        <td key={h} className="p-0.5">
                          <div
                            className="h-7 w-full rounded-sm transition-colors flex items-center justify-center text-[10px] font-semibold"
                            style={{
                              backgroundColor: count > 0 ? `rgba(37, 99, 235, ${Math.max(intensity, 0.15)})` : '#f5f5f5',
                              color: intensity > 0.5 ? 'white' : intensity > 0 ? '#1e40af' : '#d4d4d4'
                            }}
                            title={`${day} ${h}:00 — ${count} bookings`}
                          >
                            {count > 0 ? count : ''}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState message="No booking data for this period." />}
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Most-Booked Resources (Top 15)">
          <HorizontalBar items={data.most_booked || []} labelKey="asset_name" valueKey="total_bookings" />
        </SectionCard>

        <SectionCard title="Cancellation Rate">
          <div className="flex items-center gap-6 py-4">
            <div className="text-center">
              <p className="text-4xl font-bold text-neutral-900">{data.cancellation_rate?.cancellation_rate_pct || 0}%</p>
              <p className="text-xs text-neutral-500 mt-1">Cancellation Rate</p>
            </div>
            <div className="border-l border-neutral-200 pl-6 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="h-3 w-3 rounded-full bg-blue-500" />
                <span className="text-neutral-600">Total Bookings:</span>
                <span className="font-semibold">{data.cancellation_rate?.total_bookings || 0}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span className="text-neutral-600">Cancelled:</span>
                <span className="font-semibold">{data.cancellation_rate?.cancelled || 0}</span>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </>
  )
}

// ─── Report 6: Custom Export ────────────────────────────────────────────────

function ExportSection({ dateRange }) {
  const exportTypes = [
    { type: 'utilization', label: 'Utilization Report', desc: 'Per-asset allocation + booking counts', icon: TrendingUp },
    { type: 'maintenance', label: 'Maintenance Report', desc: 'Per-asset maintenance frequency, priority breakdown', icon: Wrench },
    { type: 'combined', label: 'Combined Operational Report', desc: 'All metrics per asset in a single file', icon: FileSpreadsheet },
  ]

  const handleExport = async (type) => {
    try {
      const params = new URLSearchParams({ type, ...dateRange })
      const response = await api.get(`/reports/export?${params.toString()}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}_report.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
      alert('Export failed. Please try again.')
    }
  }

  return (
    <SectionCard title="Export Reports">
      <div className="space-y-3">
        {exportTypes.map(exp => (
          <div key={exp.type} className="flex items-center justify-between bg-neutral-50 rounded-lg border border-neutral-200 p-4 hover:bg-neutral-100 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
                <exp.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900">{exp.label}</p>
                <p className="text-xs text-neutral-500">{exp.desc}</p>
              </div>
            </div>
            <Button size="sm" onClick={() => handleExport(exp.type)}>
              <Download className="h-3.5 w-3.5" /> Download CSV
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-700">
          <strong>Note:</strong> Exports use the global date range filter ({dateRange.start_date} → {dateRange.end_date}) for utilization and maintenance reports. The combined report uses lifetime data.
        </p>
      </div>
    </SectionCard>
  )
}

// ─── Shared Components ──────────────────────────────────────────────────────

function DataTable({ headers, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-neutral-100">
            {headers.map((h, i) => (
              <th key={i} className="text-table-header text-left px-3 py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-sm text-neutral-700">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
    </div>
  )
}
