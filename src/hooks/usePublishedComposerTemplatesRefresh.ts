import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useRef } from 'react'

const POLL_MS = 120_000
const REALTIME_DEBOUNCE_MS = 400

type Options = {
  /** When false, no listeners run (e.g. no Supabase session). */
  enabled: boolean
}

/**
 * Keeps workplace layout state in sync with `platform_composer_templates`:
 * - Supabase Realtime on the table (requires migration adding table to publication)
 * - Refetch when the tab/window gains focus or becomes visible
 * - Periodic poll as fallback
 */
export function usePublishedComposerTemplatesRefresh(
  supabase: SupabaseClient | null | undefined,
  onRefresh: () => void | Promise<void>,
  options: Options,
) {
  const { enabled } = options
  const onRefreshRef = useRef(onRefresh)
  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])

  useEffect(() => {
    if (!enabled || !supabase) return

    const safeRefresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      void Promise.resolve(onRefreshRef.current())
    }

    const onFocus = () => {
      safeRefresh()
    }

    const onVis = () => {
      if (document.visibilityState === 'visible') safeRefresh()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)

    const pollId = window.setInterval(() => {
      safeRefresh()
    }, POLL_MS)

    let debounceId: ReturnType<typeof setTimeout> | null = null
    const channel = supabase
      .channel('platform_composer_templates_refresh')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'platform_composer_templates' },
        () => {
          if (debounceId != null) clearTimeout(debounceId)
          debounceId = setTimeout(() => {
            debounceId = null
            safeRefresh()
          }, REALTIME_DEBOUNCE_MS)
        },
      )
      .subscribe()

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
      window.clearInterval(pollId)
      if (debounceId != null) clearTimeout(debounceId)
      void supabase.removeChannel(channel)
    }
  }, [enabled, supabase])
}
