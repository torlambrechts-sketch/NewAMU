import type { HTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'

const baseClassName = 'rounded-full px-2.5 py-0.5 text-[11px] font-semibold border shadow-sm'

const variantClassName: Record<
  | 'draft'
  | 'neutral'
  | 'active'
  | 'info'
  | 'signed'
  | 'success'
  | 'warning'
  | 'medium'
  | 'high'
  | 'critical',
  string
> = {
  draft: 'border-neutral-200 bg-neutral-100 text-neutral-700',
  neutral: 'border-neutral-200 bg-neutral-100 text-neutral-700',
  active: 'border-blue-200 bg-blue-100 text-blue-800',
  info: 'border-blue-200 bg-blue-100 text-blue-800',
  signed: 'border-green-200 bg-green-100 text-green-800',
  success: 'border-green-200 bg-green-100 text-green-800',
  warning: 'border-yellow-200 bg-yellow-100 text-yellow-800',
  medium: 'border-yellow-200 bg-yellow-100 text-yellow-800',
  high: 'border-orange-200 bg-orange-100 text-orange-800',
  critical: 'border-red-200 bg-red-100 text-red-800',
}

export type BadgeVariant = keyof typeof variantClassName

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant: BadgeVariant
}

export function Badge({ variant, className, ...props }: BadgeProps) {
  return <span className={twMerge(baseClassName, variantClassName[variant], className)} {...props} />
}
