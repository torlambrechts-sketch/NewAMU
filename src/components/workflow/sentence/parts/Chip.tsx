// Shared chip primitive — the visual atom of the sentence builder.
//
// Renders a <button> that toggles between two visual modes: "placeholder"
// (dashed border, neutral text) when the slot is empty, and "filled"
// (accent background, white text) when a value is selected. Keyboard
// nav inherits from <button> automatically; the parent supplies an
// aria-label that includes the current value for screen-reader clarity.

import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

export interface ChipProps {
  label: ReactNode
  filled: boolean
  disabled?: boolean
  onClick?: () => void
  ariaLabel: string
  className?: string
  /** Optional leading icon (lucide). */
  icon?: ReactNode
  /** Optional accent override; defaults to brand green. */
  accent?: string
}

export function Chip({
  label,
  filled,
  disabled,
  onClick,
  ariaLabel,
  className,
  icon,
  accent = '#1a3d32',
}: ChipProps) {
  const style = filled
    ? { backgroundColor: accent, color: '#fff', borderColor: accent }
    : undefined
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={twMerge(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors',
        filled
          ? 'shadow-sm'
          : 'border-dashed border-neutral-400 bg-white text-neutral-600 hover:border-[#1a3d32] hover:text-[#1a3d32]',
        disabled && 'cursor-not-allowed opacity-60 hover:border-neutral-400 hover:text-neutral-600',
        className,
      )}
      style={style}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
