import { cn } from '../../utils'

/**
 * StatCard — KPI metric card for the dashboard.
 * Color variants match the spec: green, blue, orange, purple, yellow.
 */

const COLOR_MAP = {
  green: {
    bg: 'bg-emerald-50',
    icon: 'text-emerald-600',
    border: 'border-emerald-200',
    value: 'text-emerald-700',
  },
  blue: {
    bg: 'bg-sky-50',
    icon: 'text-sky-600',
    border: 'border-sky-200',
    value: 'text-sky-700',
  },
  orange: {
    bg: 'bg-orange-50',
    icon: 'text-orange-600',
    border: 'border-orange-200',
    value: 'text-orange-700',
  },
  purple: {
    bg: 'bg-purple-50',
    icon: 'text-purple-600',
    border: 'border-purple-200',
    value: 'text-purple-700',
  },
  yellow: {
    bg: 'bg-amber-50',
    icon: 'text-amber-600',
    border: 'border-amber-200',
    value: 'text-amber-700',
  },
}

export function StatCard({ label, value, icon: Icon, color = 'blue', onClick, substat }) {
  const palette = COLOR_MAP[color] || COLOR_MAP.blue

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-4 rounded-lg border bg-white p-4 text-left transition-all duration-150 w-full',
        'hover:shadow-md hover:border-neutral-300 cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center h-10 w-10 rounded-lg shrink-0',
          palette.bg,
          palette.border,
          'border'
        )}
      >
        <Icon className={cn('h-5 w-5', palette.icon)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider truncate">
          {label}
        </p>
        <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
          <p className={cn('text-2xl font-semibold tracking-tight', palette.value)}>
            {value}
          </p>
          {substat && (
            <p className="text-xs text-neutral-400 font-normal truncate">
              {substat}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}
