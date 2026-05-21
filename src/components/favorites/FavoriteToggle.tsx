// Reusable star button — drop onto any module's template card / row to let
// the user favourite it. Reads/writes the shared FavoritesProvider context.

import { useState } from 'react'
import { Star } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { Button } from '../ui/Button'
import type { TemplateKind } from '../../types/favorites'
import { useFavoritesOptional } from './favoritesContext'

type Props = {
  kind: TemplateKind
  templateRef: string
  /** Used in the accessible label, e.g. "Favorittmerk Vernerunde". */
  templateName?: string
  size?: 'sm' | 'md'
  className?: string
}

export function FavoriteToggle({ kind, templateRef, templateName, size = 'md', className }: Props) {
  const favorites = useFavoritesOptional()
  const [busy, setBusy] = useState(false)

  // Rendered outside the provider (or before it loads) — show nothing
  // rather than a dead button.
  if (!favorites) return null

  const active = favorites.isFavorite(kind, templateRef)
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  const label = `${active ? 'Fjern favoritt' : 'Favorittmerk'}${
    templateName ? ` ${templateName}` : ''
  }`

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    try {
      await favorites.toggle(kind, templateRef)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={busy}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={twMerge(
        'rounded-md hover:bg-amber-50 focus-visible:ring-2 focus-visible:ring-amber-400',
        active ? 'text-amber-500' : 'text-neutral-300 hover:text-amber-400',
        className,
      )}
    >
      <Star className={iconSize} aria-hidden fill={active ? 'currentColor' : 'none'} />
    </Button>
  )
}
