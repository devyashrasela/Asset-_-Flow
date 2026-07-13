import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '../../utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
  {
    variants: {
      variant: {
        primary:
          'bg-primary-600 text-white border border-primary-700 shadow-sm hover:bg-primary-700 focus:ring-primary-500',
        secondary:
          'bg-white text-neutral-700 border border-neutral-200 shadow-sm hover:bg-neutral-50 focus:ring-primary-500',
        ghost:
          'text-neutral-600 hover:bg-neutral-100 focus:ring-primary-500',
        danger:
          'bg-white text-danger-700 border border-danger-200 hover:bg-danger-50 focus:ring-danger-500',
        success:
          'bg-white text-success-700 border border-success-200 hover:bg-success-50 focus:ring-success-500',
        link:
          'text-primary-600 underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4 text-sm',
        lg: 'h-10 px-5 text-sm',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  children,
  disabled,
  ...props
}) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </Comp>
  )
}

Button.displayName = 'Button'
export { buttonVariants }
