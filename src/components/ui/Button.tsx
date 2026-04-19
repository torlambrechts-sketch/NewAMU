import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

const baseClassName =
  'inline-flex items-center justify-center gap-1.5 rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50'

const variantClassName: Record<'primary' | 'secondary' | 'danger' | 'ghost', string> = {
  primary: 'bg-[#1a3d32] text-white hover:bg-[#14312a]',
  secondary: 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'border border-transparent bg-transparent text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900',
}

const sizeClassName: Record<'default' | 'sm' | 'icon', string> = {
  default: 'px-4 py-2 text-sm',
  sm: 'px-3 py-1.5 text-xs',
  icon: 'p-1 text-neutral-500 hover:text-neutral-900',
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'default' | 'sm' | 'icon'
  icon?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'default',
  icon,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={twMerge(baseClassName, variantClassName[variant], sizeClassName[size], className)}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}
