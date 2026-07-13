import { useNavigate } from 'react-router-dom'
import { Plus, Calendar, Wrench, ClipboardCheck, UserPlus } from 'lucide-react'
import { Button } from '../common/Button'

const ACTIONS = {
  register_asset: {
    label: 'Register Asset',
    icon: Plus,
    path: '/assets',
  },
  book_resource: {
    label: 'Book Resource',
    icon: Calendar,
    path: '/bookings',
  },
  raise_maintenance: {
    label: 'Raise Maintenance',
    icon: Wrench,
    path: '/maintenance',
  },
  create_audit: {
    label: 'Create Audit',
    icon: ClipboardCheck,
    path: '/audit',
  },
  invite_member: {
    label: 'Invite Member',
    icon: UserPlus,
    path: '/organization-setup',
  },
}

/**
 * QuickActions — horizontal row of role-gated action buttons.
 */
export function QuickActions({ actions = [] }) {
  const navigate = useNavigate()

  if (actions.length === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {actions.map((key) => {
        const action = ACTIONS[key]
        if (!action) return null
        const Icon = action.icon

        return (
          <Button
            key={key}
            variant="secondary"
            size="sm"
            onClick={() => navigate(action.path)}
          >
            <Icon className="h-3.5 w-3.5" />
            {action.label}
          </Button>
        )
      })}
    </div>
  )
}
