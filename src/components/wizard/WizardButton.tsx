import { useState } from 'react'
import { Wand2 } from 'lucide-react'
import { WizardModal } from './WizardModal'
import type { WizardDef } from './types'

/**
 * A trigger button that opens a WizardModal inline (portal-free, fixed overlay).
 * Drop next to any section header.
 */
export function WizardButton({
  def,
  label = 'Veiviser',
  size = 'sm',
  variant = 'outline',
}: {
  def: WizardDef
  label?: string
  size?: 'xs' | 'sm'
  variant?: 'outline' | 'solid' | 'ghost'
}) {
  const [open, setOpen] = useState(false)

  const sizeClass = size === 'xs'
    ? 'gap-1 px-2.5 py-1 text-xs'
    : 'gap-1.5 px-3 py-1.5 text-sm'

  const variantClass =
    variant === 'solid'
      ? 'bg-[#1a3d32] text-white hover:bg-[#142e26]'
      : variant === 'ghost'
        ? 'text-[#1a3d32] hover:bg-[#1a3d32]/8'
        : 'border border-[#1a3d32]/25 bg-white text-[#1a3d32] hover:bg-[#1a3d32]/5'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center rounded-full font-medium transition-colors ${sizeClass} ${variantClass}`}
      >
        <Wand2 className={size === 'xs' ? 'size-3' : 'size-3.5'} />
        {label}
      </button>

      {open && (
        <WizardModal
          def={def}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
