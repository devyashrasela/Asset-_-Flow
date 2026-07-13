import { cn } from '../../utils'

export function Label({ className, required, children, ...props }) {
  return (
    <label
      className={cn(
        'text-sm font-medium text-neutral-700',
        required && "form-label-required",
        className
      )}
      {...props}
    >
      {children}
    </label>
  )
}

Label.displayName = 'Label'
