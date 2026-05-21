// Context object + hooks for the favourite-templates feature.
// Kept separate from FavoritesProvider.tsx so that file only exports a
// component (react-refresh constraint).

import { createContext, useContext } from 'react'
import type { TemplateFavorite, TemplateKind } from '../../types/favorites'

export type FavoritesContextValue = {
  loading: boolean
  favorites: TemplateFavorite[]
  isFavorite: (kind: TemplateKind, templateRef: string) => boolean
  /** Star / unstar a template. Optimistic; reverts on failure. */
  toggle: (kind: TemplateKind, templateRef: string) => Promise<void>
  /** Persist a new ordering for one module's favourites. */
  reorder: (kind: TemplateKind, orderedIds: string[]) => Promise<void>
  /** Re-apply the role-based starter list (additive). Returns rows added. */
  applyRoleDefaults: () => Promise<number>
  refresh: () => Promise<void>
}

export const FavoritesContext = createContext<FavoritesContextValue | null>(null)

/** Access the favourites context. Returns null when used outside the provider. */
export function useFavoritesOptional(): FavoritesContextValue | null {
  return useContext(FavoritesContext)
}

/** Access the favourites context — throws when used outside the provider. */
export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites must be used within a FavoritesProvider')
  return ctx
}
