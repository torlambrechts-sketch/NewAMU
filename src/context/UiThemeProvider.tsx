import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getSupabaseBrowserClient } from '../lib/supabaseClient'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import { layoutNavFromAccent, layoutSurfaceHex, mergeLayoutPayload } from '../lib/layoutLabTokens'
import {
  DEFAULT_LAYOUT_LAB,
  LAYOUT_LAB_CHANGED_EVENT,
  LAYOUT_LAB_STORAGE_KEY,
  type LayoutLabPayload,
} from '../types/layoutLab'
import { UiThemeContext } from './uiThemeContext'

function parsePayload(raw: unknown): LayoutLabPayload {
  if (!raw || typeof raw !== 'object') return DEFAULT_LAYOUT_LAB
  return mergeLayoutPayload(raw as Partial<LayoutLabPayload>)
}

function readLocalPayload(): LayoutLabPayload {
  try {
    const raw = localStorage.getItem(LAYOUT_LAB_STORAGE_KEY)
    if (raw) return parsePayload(JSON.parse(raw))
  } catch {
    /* ignore */
  }
  return DEFAULT_LAYOUT_LAB
}

function applyCssVariables(payload: LayoutLabPayload) {
  const root = document.documentElement
  const accent = payload.accent || DEFAULT_LAYOUT_LAB.accent
  const nav = layoutNavFromAccent(accent)
  root.style.setProperty('--ui-accent', accent)
  root.style.setProperty('--ui-surface', layoutSurfaceHex(payload.surface))
  root.style.setProperty('--ui-nav-rail', nav.rail)
  root.style.setProperty('--ui-nav-rail-mid', nav.railMid)
  root.style.setProperty('--ui-nav-sub', nav.subBar)
}

export function UiThemeProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseBrowserClient()
  const [payload, setPayload] = useState<LayoutLabPayload>(readLocalPayload)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!supabase)
  const [error, setError] = useState<string | null>(null)

  const fetchTheme = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      return
    }
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('platform_ui_theme')
        .select('payload, updated_at')
        .eq('id', 'default')
        .maybeSingle()
      if (e) throw e
      if (data?.payload) {
        const next = parsePayload(data.payload)
        setPayload(next)
        setUpdatedAt((data.updated_at as string) ?? null)
        try {
          localStorage.setItem(LAYOUT_LAB_STORAGE_KEY, JSON.stringify(next))
        } catch {
          /* ignore */
        }
        try {
          window.dispatchEvent(new Event(LAYOUT_LAB_CHANGED_EVENT))
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    applyCssVariables(payload)
  }, [payload])

  useEffect(() => {
    void fetchTheme()
  }, [fetchTheme])

  useEffect(() => {
    if (!supabase) return
    const ch = supabase
      .channel('platform_ui_theme_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'platform_ui_theme' },
        () => {
          void fetchTheme()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [supabase, fetchTheme])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LAYOUT_LAB_STORAGE_KEY && e.newValue) {
        try {
          setPayload(parsePayload(JSON.parse(e.newValue)))
        } catch {
          /* ignore */
        }
      }
    }
    const onLocal = () => {
      setPayload(readLocalPayload())
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(LAYOUT_LAB_CHANGED_EVENT, onLocal)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(LAYOUT_LAB_CHANGED_EVENT, onLocal)
    }
  }, [])

  const value = useMemo(
    () => ({
      payload,
      updatedAt,
      loading,
      error,
      refresh: fetchTheme,
    }),
    [payload, updatedAt, loading, error, fetchTheme],
  )

  return <UiThemeContext.Provider value={value}>{children}</UiThemeContext.Provider>
}
