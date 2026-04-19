import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

const baseClassName =
  'inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

const variantClassName: Record<'primary' | 'secondary' | 'danger', string> = {
  primary: 'bg-[#1a3d32] text-white hover:bg-[#14312a]',
  secondary: 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger'
  icon?: ReactNode
}

export function Button({
  variant = 'primary',
  icon,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={twMerge(baseClassName, variantClassName[variant], className)} {...props}>
      {icon}
      {children}
    </button>
  )
}
