import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Package,
  UserCheck,
  Wrench,
  Calendar,
  ArrowRightLeft,
  Undo2,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { StatCard } from '../components/dashboard/StatCard'
import { OverduePanel } from '../components/dashboard/OverduePanel'
import { ActivityFeed } from '../components/dashboard/ActivityFeed'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts'

export function Dashboard() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const currentRole = useAuthStore((s) => s.currentRole)
  const activeOrgId = useAuthStore((s) => s.activeOrgId)
  const workspaces = useAuthStore((s) => s.workspaces)

  const activeOrg = workspaces.find((w) => w.org_id === activeOrgId)

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchDashboard = async () => {
    setLoading(true)
    try {
      // GET /api/dashboard → real Dashboard payload from backend
      const { data: resData } = await api.get('/dashboard')

      setData({
        kpis: resData.kpis || {},
        overdue_returns: resData.overdue_returns || [],
        overdue_count: resData.overdue_count || 0,
        recent_activity: resData.recent_activity || [],
        quick_actions: resData.quick_actions || [],
        category_distribution: resData.category_distribution || [],
        allocations_over_time: resData.allocations_over_time || [],
      })
    } catch (err) {
      console.error('Dashboard fetch failed:', err)
      // Show empty state on error
      setData({
        kpis: {},
        overdue_returns: [],
        overdue_count: 0,
        recent_activity: [],
        quick_actions: [],
        category_distribution: [],
        allocations_over_time: []
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [currentRole, activeOrgId])

  // Tab focus re-fetch
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboard()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [currentRole, activeOrgId])

  const isAdmin = currentRole === 'Admin' || currentRole === 'Asset Manager'
  const isDeptHead = currentRole === 'Department Head'
  const isEmployee = currentRole === 'Employee'

  // Build KPI cards based on role
  const buildKpiCards = () => {
    if (!data?.kpis) return []

    const kpis = data.kpis
    const cards = []
    const totalFleet = (kpis.assets_available || 0) + (kpis.assets_allocated || 0)

    if (isAdmin) {
      cards.push(
        { 
          label: 'Available', 
          value: kpis.assets_available, 
          icon: Package, 
          color: 'green', 
          path: '/assets?status=Available',
          substat: totalFleet > 0 ? `${Math.round((kpis.assets_available / totalFleet) * 100)}% of fleet` : '0% of fleet'
        },
        { 
          label: 'Allocated', 
          value: kpis.assets_allocated, 
          icon: UserCheck, 
          color: 'blue', 
          path: '/allocations',
          substat: `${data.overdue_count || 0} overdue`
        },
        { 
          label: 'Maint. Today', 
          value: kpis.maintenance_today, 
          icon: Wrench, 
          color: 'orange', 
          path: '/maintenance',
          substat: 'Active tickets'
        },
        { 
          label: 'Active Bookings', 
          value: kpis.active_bookings, 
          icon: Calendar, 
          color: 'purple', 
          path: '/bookings',
          substat: 'Scheduled'
        }
      )
    }

    if (isDeptHead) {
      cards.push(
        { 
          label: 'Allocated', 
          value: kpis.assets_allocated, 
          icon: UserCheck, 
          color: 'blue', 
          path: '/allocations',
          substat: `${data.overdue_count || 0} overdue`
        },
        { 
          label: 'Maint. Today', 
          value: kpis.maintenance_today, 
          icon: Wrench, 
          color: 'orange', 
          path: '/maintenance',
          substat: 'Active tickets'
        },
        { 
          label: 'Active Bookings', 
          value: kpis.active_bookings, 
          icon: Calendar, 
          color: 'purple', 
          path: '/bookings',
          substat: 'Scheduled'
        },
        { 
          label: 'Pending Transfers', 
          value: kpis.pending_transfers, 
          icon: ArrowRightLeft, 
          color: 'yellow', 
          path: '/allocations/transfers',
          substat: 'Awaiting action'
        }
      )
    }

    if (isEmployee) {
      cards.push(
        { 
          label: 'My Assets', 
          value: kpis.my_assets, 
          icon: UserCheck, 
          color: 'blue', 
          path: '/allocations/my',
          substat: `${data.overdue_count || 0} overdue`
        },
        { 
          label: 'Maint. Today', 
          value: kpis.maintenance_today, 
          icon: Wrench, 
          color: 'orange', 
          path: '/maintenance',
          substat: 'Active tickets'
        },
        { 
          label: 'My Bookings', 
          value: kpis.my_active_bookings, 
          icon: Calendar, 
          color: 'purple', 
          path: '/bookings/my',
          substat: 'Scheduled'
        },
        { 
          label: 'Available Fleet', 
          value: kpis.assets_available || 0, 
          icon: Package, 
          color: 'green', 
          path: '/assets',
          substat: 'Available to request'
        }
      )
    }

    return cards
  }

  const kpiCards = buildKpiCards()
  const showActivityViewAll = isAdmin || isDeptHead

  if (loading && !data) {
    return (
      <>
        <Header breadcrumbs={[activeOrg?.org_name || 'Workspace', 'Dashboard']} />
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-[88px] rounded-lg border border-neutral-200 bg-white animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-48 rounded-lg border border-neutral-200 bg-white animate-pulse" />
            <div className="h-48 rounded-lg border border-neutral-200 bg-white animate-pulse" />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Header
        breadcrumbs={[activeOrg?.org_name || 'Workspace', 'Dashboard']}
        onRefresh={fetchDashboard}
      />

      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-page-title text-neutral-900">
              Welcome back, {user?.name?.split(' ')[0]}
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Here&apos;s what&apos;s happening in{' '}
              <span className="font-medium text-neutral-700">{activeOrg?.org_name}</span> today.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((card) => (
            <StatCard
              key={card.label}
              label={card.label}
              value={card.value}
              icon={card.icon}
              color={card.color}
              onClick={() => navigate(card.path)}
              substat={card.substat}
            />
          ))}
        </div>

        {isAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Allocation Trend */}
            <div className="bg-white border border-neutral-200 rounded-lg p-5 flex flex-col h-[320px]">
              <h3 className="text-sm font-semibold text-neutral-800 mb-4">Allocation Trends (Last 30 Days)</h3>
              <div className="flex-1 w-full min-h-0">
                {data?.allocations_over_time?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.allocations_over_time} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tickLine={false} tick={{ fontSize: 10, fill: '#888888' }} />
                      <YAxis tickLine={false} tick={{ fontSize: 10, fill: '#888888' }} />
                      <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '6px', borderColor: '#e5e5e5' }} />
                      <Area type="monotone" dataKey="count" stroke="#2563eb" fillOpacity={1} fill="url(#colorCount)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-neutral-400">No allocation history available.</div>
                )}
              </div>
            </div>

            {/* Chart 2: Category Distribution */}
            <div className="bg-white border border-neutral-200 rounded-lg p-5 flex flex-col h-[320px]">
              <h3 className="text-sm font-semibold text-neutral-800 mb-4">Asset Categories Breakdown</h3>
              <div className="flex-1 w-full min-h-0">
                {data?.category_distribution?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.category_distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" tickLine={false} tick={{ fontSize: 10, fill: '#888888' }} />
                      <YAxis tickLine={false} tick={{ fontSize: 10, fill: '#888888' }} />
                      <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '6px', borderColor: '#e5e5e5' }} />
                      <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-neutral-400">No category breakdown available.</div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <OverduePanel
            items={data?.overdue_returns || []}
            overdueCount={data?.overdue_count || 0}
          />
          <ActivityFeed
            items={data?.recent_activity || []}
            showViewAll={showActivityViewAll}
          />
        </div>
      </div>
    </>
  )
}
