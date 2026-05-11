// useDocumentPresence — page-level realtime presence for the document
// editor (avatar stack + currently-focused-block hint).
//
// Joins a Supabase Realtime channel scoped to a single page and tracks the
// current user as { userId, displayName, color }. Per-block soft locks
// shipped as part of the block editor were removed when that surface was
// retired — the TipTap workbench is one continuous editor, so a doc-level
// presence indicator covers the use case and the locks table is unused.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useOrgSetupContext } from './useOrgSetupContext'
import { presenceColorFor, type PresenceColor } from '../lib/presenceColor'

export type PresenceUser = {
  userId: string
  displayName: string
  color: PresenceColor
}

export function useDocumentPresence(pageId: string | undefined) {
  const { supabase, organization, user, profile } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const userId = user?.id ?? null
  const displayName = profile?.display_name?.trim() || user?.email || 'Bruker'

  const [presence, setPresence] = useState<PresenceUser[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!supabase || !orgId || !pageId || !userId) {
      queueMicrotask(() => setPresence([]))
      return
    }
    const channelName = `documents:page:${pageId}`
    const ch = supabase.channel(channelName, {
      config: { presence: { key: userId } },
    })

    const onSync = () => {
      const state = ch.presenceState<Record<string, unknown>>()
      const out: PresenceUser[] = []
      for (const key of Object.keys(state)) {
        const arr = state[key]
        const first = Array.isArray(arr) ? arr[0] : null
        if (!first || typeof first !== 'object') continue
        const u = first as Record<string, unknown>
        const uid = typeof u.userId === 'string' ? u.userId : key
        const dn = typeof u.displayName === 'string' ? u.displayName : uid.slice(0, 8)
        out.push({
          userId: uid,
          displayName: dn,
          color: presenceColorFor(uid),
        })
      }
      // Stable order: self first, then alphabetic.
      out.sort((a, b) => {
        if (a.userId === userId) return -1
        if (b.userId === userId) return 1
        return a.displayName.localeCompare(b.displayName, 'nb')
      })
      setPresence(out)
    }

    ch.on('presence', { event: 'sync' }, onSync).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ userId, displayName })
      }
    })

    channelRef.current = ch

    return () => {
      void supabase.removeChannel(ch)
      channelRef.current = null
    }
  }, [supabase, orgId, pageId, userId, displayName])

  return useMemo(() => ({ presence }), [presence])
}
