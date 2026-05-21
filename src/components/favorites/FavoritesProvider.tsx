// Cross-module favourite-templates context.
//
// Loaded once per session near the top of the authenticated app so the
// star toggle on every module's template list is cheap, and "Mine
// favoritter" stays in sync the moment a star is clicked anywhere.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { TemplateFavorite, TemplateKind } from '../../types/favorites'
import { FavoritesContext, type FavoritesContextValue } from './favoritesContext'

type FavoriteRow = {
  id: string
  template_kind: TemplateKind
  template_ref: string
  position: number
  source: 'user' | 'role_default'
  title: string
  resolved: boolean
}

function mapRow(r: FavoriteRow): TemplateFavorite {
  return {
    id: r.id,
    templateKind: r.template_kind,
    templateRef: r.template_ref,
    position: r.position,
    source: r.source,
    title: r.title,
    resolved: r.resolved,
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { supabase, user, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const userId = user?.id ?? null

  const [favorites, setFavorites] = useState<TemplateFavorite[]>([])
  const [loading, setLoading] = useState(false)
  const everLoaded = useRef(false)

  const refresh = useCallback(async () => {
    if (!supabase || !userId || !orgId) {
      setFavorites([])
      return
    }
    if (!everLoaded.current) setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_my_template_favorites')
      if (error) {
        console.warn('get_my_template_favorites', error.message)
      } else {
        setFavorites(((data ?? []) as FavoriteRow[]).map(mapRow))
        everLoaded.current = true
      }
    } catch (e) {
      console.warn('get_my_template_favorites', e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [supabase, userId, orgId])

  useEffect(() => {
    everLoaded.current = false
    void refresh()
  }, [refresh])

  const isFavorite = useCallback(
    (kind: TemplateKind, templateRef: string) =>
      favorites.some((f) => f.templateKind === kind && f.templateRef === templateRef),
    [favorites],
  )

  const toggle = useCallback(
    async (kind: TemplateKind, templateRef: string) => {
      if (!supabase) return
      const existing = favorites.find(
        (f) => f.templateKind === kind && f.templateRef === templateRef,
      )
      if (existing) {
        setFavorites((prev) => prev.filter((f) => f.id !== existing.id))
        const { error } = await supabase
          .from('template_favorites')
          .delete()
          .eq('id', existing.id)
        if (error) {
          console.warn('template_favorites delete', error.message)
          await refresh()
        }
      } else {
        const nextPosition =
          favorites
            .filter((f) => f.templateKind === kind)
            .reduce((max, f) => Math.max(max, f.position), 0) + 1
        const { error } = await supabase.from('template_favorites').insert({
          template_kind: kind,
          template_ref: templateRef,
          position: nextPosition,
          source: 'user',
        })
        if (error) console.warn('template_favorites insert', error.message)
        await refresh()
      }
    },
    [supabase, favorites, refresh],
  )

  const reorder = useCallback(
    async (kind: TemplateKind, orderedIds: string[]) => {
      if (!supabase) return
      // Optimistic: re-stamp positions locally first.
      setFavorites((prev) =>
        prev.map((f) => {
          if (f.templateKind !== kind) return f
          const idx = orderedIds.indexOf(f.id)
          return idx === -1 ? f : { ...f, position: idx + 1 }
        }),
      )
      const results = await Promise.all(
        orderedIds.map((id, idx) =>
          supabase.from('template_favorites').update({ position: idx + 1 }).eq('id', id),
        ),
      )
      if (results.some((r) => r.error)) await refresh()
    },
    [supabase, refresh],
  )

  const applyRoleDefaults = useCallback(async (): Promise<number> => {
    if (!supabase) return 0
    const { data, error } = await supabase.rpc('apply_favorite_role_defaults')
    if (error) {
      console.warn('apply_favorite_role_defaults', error.message)
      return 0
    }
    await refresh()
    return typeof data === 'number' ? data : 0
  }, [supabase, refresh])

  const value = useMemo<FavoritesContextValue>(
    () => ({ loading, favorites, isFavorite, toggle, reorder, applyRoleDefaults, refresh }),
    [loading, favorites, isFavorite, toggle, reorder, applyRoleDefaults, refresh],
  )

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}
