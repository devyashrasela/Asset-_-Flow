import {
  UserCheck,
  Calendar,
  Wrench,
  CheckCircle2,
  ArrowRightLeft,
  Package,
  ClipboardCheck,
  XCircle,
} from 'lucide-react'

const ACTION_ICONS = {
  ASSET_ALLOCATED: { icon: UserCheck, color: 'text-sky-600', bg: 'bg-sky-50' },
  ASSET_RETURNED: { icon: Package, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ASSET_REGISTERED: { icon: Package, color: 'text-primary-600', bg: 'bg-primary-50' },
  BOOKING_CREATED: { icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50' },
  BOOKING_CANCELLED: { icon: XCircle, color: 'text-neutral-500', bg: 'bg-neutral-100' },
  MAINTENANCE_REQUESTED: { icon: Wrench, color: 'text-orange-600', bg: 'bg-orange-50' },
  MAINTENANCE_APPROVED: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  TRANSFER_REQUESTED: { icon: ArrowRightLeft, color: 'text-amber-600', bg: 'bg-amber-50' },
  TRANSFER_APPROVED: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  AUDIT_CYCLE_CLOSED: { icon: ClipboardCheck, color: 'text-indigo-600', bg: 'bg-indigo-50' },
}

function formatRelativeTime(dateString) {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now - date
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  return `${diffDay}d ago`
}

/**
 * ActivityFeed — recent activity log entries.
 */
export function ActivityFeed({ items = [], showViewAll = false }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center">
        <p className="text-sm text-neutral-500">No recent activity</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
          📋 Recent Activity
        </h3>
        {showViewAll && (
          <a
            href="/activity-log"
            className="text-xs font-medium text-primary-600 hover:text-primary-700"
          >
            View Full Log →
          </a>
        )}
      </div>

      {/* List */}
      <div className="divide-y divide-neutral-100">
        {items.map((item) => {
          const meta = ACTION_ICONS[item.action_type] || ACTION_ICONS.ASSET_REGISTERED
          const Icon = meta.icon

          return (
            <div key={item.id} className="px-4 py-3 flex items-start gap-3">
              <div
                className={`flex items-center justify-center h-8 w-8 rounded-lg shrink-0 ${meta.bg}`}
              >
                <Icon className={`h-4 w-4 ${meta.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-neutral-700 truncate">{item.description}</p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {item.user_name} · {formatRelativeTime(item.created_at)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
