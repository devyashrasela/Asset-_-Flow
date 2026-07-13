import { forwardRef } from 'react'
import { cn } from '../../utils'

const Input = forwardRef(({ className, type = 'text', error, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border bg-white px-3 py-1.5 text-sm text-neutral-900 transition-colors',
        'placeholder:text-neutral-400',
        'focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        error
          ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500'
          : 'border-neutral-300',
        className
      )}
      ref={ref}
      {...props}
    />
  )
})

Input.displayName = 'Input'
export { Input }
