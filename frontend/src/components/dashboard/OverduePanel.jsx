import { AlertTriangle, CheckCircle2 } from 'lucide-react'

/**
 * OverduePanel — red-highlighted panel for overdue asset returns.
 * Shows top items, "View All" link, or green empty state.
 */
export function OverduePanel({ items = [], overdueCount = 0 }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden flex flex-col h-full min-h-[300px]">
        <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-neutral-500" />
            <h3 className="text-sm font-semibold text-neutral-700">Overdue Returns</h3>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3" />
          <p className="text-sm font-semibold text-neutral-800">All assets returned on time</p>
          <p className="text-xs text-neutral-500 mt-1">No outstanding overdue check-outs.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between bg-danger-50">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-danger-600" />
          <h3 className="text-sm font-semibold text-danger-700">Overdue Returns</h3>
          <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-danger-600 text-white text-xs font-semibold px-1.5">
            {overdueCount}
          </span>
        </div>
        <a
          href="/allocations?filter=overdue"
          className="text-xs font-medium text-danger-600 hover:text-danger-700"
        >
          View All →
        </a>
      </div>

      {/* List */}
      <div className="divide-y divide-neutral-100">
        {items.map((item) => (
          <div
            key={item.allocation_id}
            className="px-4 py-3 flex items-center justify-between border-l-3 border-l-danger-500"
          >
            <div className="flex items-center gap-3 min-w-0">
              <AlertTriangle className="h-4 w-4 text-danger-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">
                  <span className="text-neutral-400 font-mono text-xs mr-1.5">{item.asset_tag}</span>
                  {item.asset_name}
                </p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {item.holder_name && <>{item.holder_name} · </>}
                  <span className="text-danger-600 font-medium">
                    Due {item.expected_return_date}
                  </span>
                </p>
              </div>
            </div>
            <span className="inline-flex items-center rounded-full bg-danger-50 border border-danger-200 text-danger-700 text-xs font-medium px-2 py-0.5 shrink-0 ml-3">
              {item.days_overdue}d overdue
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
