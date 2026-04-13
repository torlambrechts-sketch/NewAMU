import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { usePublishedComposerTemplatesRefresh } from '../hooks/usePublishedComposerTemplatesRefresh'
import { fetchPublishedComposerTemplates } from '../lib/platformComposerTemplatesApi'
import {
  WorkplacePublishedComposerContext,
  type LoadState,
  type WorkplacePublishedComposerContextValue,
} from './workplacePublishedComposerContextValue'

/**
 * One subscription for the whole workplace: published `platform_composer_templates` rows
 * (Realtime + focus + visibility + poll). Includes both stack and grid kinds.
 */
export function WorkplacePublishedComposerProvider({ children }: { children: ReactNode }) {
  const { supabase, supabaseConfigured, user } = useOrgSetupContext()
  const enabled = Boolean(supabaseConfigured && user && supabase)

  const [publishedComposerTemplates, setPublishedComposerTemplates] =
    useState<WorkplacePublishedComposerContextValue['publishedComposerTemplates']>(null)
  const [loadState, setLoadState] = useState<LoadState>('idle')

  const refreshPublishedTemplates = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await fetchPublishedComposerTemplates(supabase)
    if (error) {
      setPublishedComposerTemplates([])
      setLoadState('error')
      return
    }
    setPublishedComposerTemplates(data)
    setLoadState('ready')
  }, [supabase])

  const refreshRef = useRef(refreshPublishedTemplates)
  useEffect(() => {
    refreshRef.current = refreshPublishedTemplates
  }, [refreshPublishedTemplates])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      if (!enabled || !supabase) {
        setPublishedComposerTemplates(null)
        setLoadState('idle')
        return
      }
      setLoadState('loading')
      void (async () => {
        const { data, error } = await fetchPublishedComposerTemplates(supabase)
        if (cancelled) return
        if (error) {
          setPublishedComposerTemplates([])
          setLoadState('error')
          return
        }
        setPublishedComposerTemplates(data)
        setLoadState('ready')
      })()
    })
    return () => {
      cancelled = true
    }
  }, [enabled, supabase])

  usePublishedComposerTemplatesRefresh(
    supabase,
    () => {
      void refreshRef.current()
    },
    { enabled },
  )

  const value = useMemo<WorkplacePublishedComposerContextValue>(
    () => ({
      publishedComposerTemplates,
      publishedStackTemplates:
        publishedComposerTemplates === null
          ? null
          : publishedComposerTemplates.filter((r) => r.kind === 'stack'),
      loadState,
      refreshPublishedTemplates,
    }),
    [publishedComposerTemplates, loadState, refreshPublishedTemplates],
  )

  return (
    <WorkplacePublishedComposerContext.Provider value={value}>{children}</WorkplacePublishedComposerContext.Provider>
  )
}
