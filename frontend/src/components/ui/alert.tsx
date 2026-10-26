import * as React from 'react'
import { cn } from '@/lib/utils'

const VARIANTS = {
  error: 'bg-red-50 border-red-200 text-red-600',
  warning: 'bg-amber-50 border-amber-200 text-amber-700',
  info: 'bg-blue-50 border-blue-200 text-blue-700',
} as const

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  variant: keyof typeof VARIANTS
  title?: React.ReactNode
  action?: React.ReactNode
}

// Same shape as the LoginPage error box.
export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ variant, title, action, children, className, ...props }, ref) => (
    <div
      ref={ref}
      role={variant === 'info' ? 'status' : 'alert'}
      className={cn('rounded-md border p-3 text-sm', VARIANTS[variant], className)}
      {...props}
    >
      {title && <p className="font-medium">{title}</p>}
      {children && <div className={title ? 'mt-1' : undefined}>{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
)
Alert.displayName = 'Alert'
