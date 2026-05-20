import { ChevronDown } from 'lucide-react'
import { twMerge } from 'tailwind-merge'

/**
 * Toolbar filter chip — `Label: value ▾`.
 *
 * Extracted from the inline `FilterChip` declared in the Rec01 prototype so
 * the Oversikt table, the Maler library and Søk all share one component.
 */
export function ModuleFilterChip({
  label,
  value,
  active = false,
  onClick,
  className,
}: {
  label: string
  value: string
  active?: boolean
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={twMerge(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-[#0f766e] bg-[#e6f2f0] text-[#0f766e]'
          : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
        className,
      )}
    >
      <span className="text-neutral-500">{label}:</span>
      <span>{value}</span>
      <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
    </button>
  )
}
