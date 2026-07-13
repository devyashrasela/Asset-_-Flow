import { cva } from 'class-variance-authority'
import { AlertCircle, CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { cn } from '../../utils'

const alertVariants = cva(
  'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm',
  {
    variants: {
      variant: {
        error: 'bg-danger-50 border-danger-200 text-danger-700',
        success: 'bg-success-50 border-success-200 text-success-700',
        warning: 'bg-warning-50 border-warning-200 text-warning-700',
        info: 'bg-info-50 border-info-200 text-info-700',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  }
)

const iconMap = {
  error: AlertCircle,
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
}

export function Alert({ variant = 'info', className, children, ...props }) {
  const Icon = iconMap[variant]

  return (
    <div className={cn(alertVariants({ variant }), className)} role="alert" {...props}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

Alert.displayName = 'Alert'
