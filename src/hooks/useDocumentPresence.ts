// useDocumentPresence — lightweight realtime presence + per-block soft locks
// for the wiki editor.
//
// Joins a Supabase Realtime channel scoped to a single page and tracks the
// current user as { userId, displayName, focusedBlockIndex, color }. Listens
// to presence sync events for the avatar stack, and to postgres_changes on
// wiki_page_block_locks for the lock indicators.
//
// Locks are written to the database (RLS-enforced) so two clients can never
// believe they each hold the same block at the same time. Each lock has a
// 5-minute server-side expiry; a heartbeat extends it every 60 seconds while
// the user is editing.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useOrgSetupContext } from './useOrgSetupContext'
import { presenceColorFor, type PresenceColor } from '../lib/presenceColor'

export type PresenceUser = {
  userId: string
  displayName: string
  focusedBlockIndex: number | null
  color: PresenceColor
}

export type BlockLock = {
  blockIndex: number
  holderUserId: string
  holderName: string
  expiresAt: string
}

type LockRow = {
  page_id: string
  block_index: number
  holder_user_id: string
  holder_name: string
  expires_at: string
}

const HEARTBEAT_MS = 60_000
const LOCK_REFRESH_MS = 30_000

export function useDocumentPresence(pageId: string | undefined) {
  const { supabase, organization, user, profile } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const userId = user?.id ?? null
  const displayName = profile?.display_name?.trim() || user?.email || 'Bruker'

  const [presence, setPresence] = useState<PresenceUser[]>([])
  const [locks, setLocks] = useState<BlockLock[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)
  const focusRef = useRef<number | null>(null)
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const heldBlockRef = useRef<number | null>(null)

  // ── Locks ────────────────────────────────────────────────────────────────
  const refreshLocks = useCallback(async () => {
    if (!supabase || !orgId || !pageId) return
    const { data, error } = await supabase
      .from('wiki_page_block_locks')
      .select('page_id, block_index, holder_user_id, holder_name, expires_at')
      .eq('organization_id', orgId)
      .eq('page_id', pageId)
      .gt('expires_at', new Date().toISOString())
    if (error) {
      if (!String(error.message).toLowerCase().includes('does not exist')) {
        console.warn('wiki_page_block_locks:', error.message)
      }
      return
    }
    setLocks(
      (data ?? []).map((r: LockRow) => ({
        blockIndex: r.block_index,
        holderUserId: r.holder_user_id,
        holderName: r.holder_name,
        expiresAt: r.expires_at,
      })),
    )
  }, [supabase, orgId, pageId])

  // ── Channel: presence + postgres_changes on locks ────────────────────────
  useEffect(() => {
    if (!supabase || !orgId || !pageId || !userId) {
      queueMicrotask(() => {
        setPresence([])
        setLocks([])
      })
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
        const focused = typeof u.focusedBlockIndex === 'number' ? u.focusedBlockIndex : null
        out.push({
          userId: uid,
          displayName: dn,
          focusedBlockIndex: focused,
          color: presenceColorFor(uid),
        })
      }
      // Stable order: own user first, then alphabetic by displayName.
      out.sort((a, b) => {
        if (a.userId === userId) return -1
        if (b.userId === userId) return 1
        return a.displayName.localeCompare(b.displayName, 'nb')
      })
      setPresence(out)
    }

    ch.on('presence', { event: 'sync' }, onSync)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wiki_page_block_locks', filter: `page_id=eq.${pageId}` },
        () => {
          void refreshLocks()
        },
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await ch.track({
            userId,
            displayName,
            focusedBlockIndex: focusRef.current,
          })
        }
      })

    channelRef.current = ch
    queueMicrotask(() => {
      void refreshLocks()
    })

    const lockTimer = setInterval(() => void refreshLocks(), LOCK_REFRESH_MS)

    return () => {
      clearInterval(lockTimer)
      const held = heldBlockRef.current
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current)
      heartbeatTimerRef.current = null
      heldBlockRef.current = null
      if (held != null && supabase && orgId && pageId && userId) {
        void supabase
          .from('wiki_page_block_locks')
          .delete()
          .eq('organization_id', orgId)
          .eq('page_id', pageId)
          .eq('block_index', held)
          .eq('holder_user_id', userId)
      }
      void supabase.removeChannel(ch)
      channelRef.current = null
    }
  }, [supabase, orgId, pageId, userId, displayName, refreshLocks])

  // ── Public API ───────────────────────────────────────────────────────────

  const heldBy = useCallback(
    (idx: number): BlockLock | null => {
      return locks.find((l) => l.blockIndex === idx) ?? null
    },
    [locks],
  )

  const isHeldByMe = useCallback(
    (idx: number): boolean => {
      const lock = heldBy(idx)
      return Boolean(lock && lock.holderUserId === userId)
    },
    [heldBy, userId],
  )

  const setFocusedBlock = useCallback(
    (idx: number | null) => {
      focusRef.current = idx
      const ch = channelRef.current
      if (!ch || !userId) return
      void ch.track({ userId, displayName, focusedBlockIndex: idx })
    },
    [userId, displayName],
  )

  const acquireBlockLock = useCallback(
    async (idx: number): Promise<boolean> => {
      if (!supabase || !orgId || !pageId || !userId) return false
      // Clean any expired lock on this slot first.
      const nowIso = new Date().toISOString()
      await supabase
        .from('wiki_page_block_locks')
        .delete()
        .eq('organization_id', orgId)
        .eq('page_id', pageId)
        .eq('block_index', idx)
        .lt('expires_at', nowIso)

      // Attempt insert. Unique constraint on (page_id, block_index) catches
      // races between two clients.
      const { error: insertErr } = await supabase.from('wiki_page_block_locks').insert({
        organization_id: orgId,
        page_id: pageId,
        block_index: idx,
        holder_user_id: userId,
        holder_name: displayName,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      if (insertErr) {
        if (insertErr.code === '23505') {
          // Already held by someone else.
          await refreshLocks()
          return false
        }
        if (!String(insertErr.message).toLowerCase().includes('does not exist')) {
          console.warn('acquireBlockLock:', insertErr.message)
        }
        return false
      }
      heldBlockRef.current = idx
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current)
      heartbeatTimerRef.current = setInterval(() => {
        if (!supabase || !orgId || !pageId || !userId) return
        void supabase
          .from('wiki_page_block_locks')
          .update({ expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() })
          .eq('organization_id', orgId)
          .eq('page_id', pageId)
          .eq('block_index', idx)
          .eq('holder_user_id', userId)
      }, HEARTBEAT_MS)
      await refreshLocks()
      return true
    },
    [supabase, orgId, pageId, userId, displayName, refreshLocks],
  )

  const releaseBlockLock = useCallback(
    async (idx: number) => {
      if (!supabase || !orgId || !pageId || !userId) return
      if (heartbeatTimerRef.current && heldBlockRef.current === idx) {
        clearInterval(heartbeatTimerRef.current)
        heartbeatTimerRef.current = null
        heldBlockRef.current = null
      }
      await supabase
        .from('wiki_page_block_locks')
        .delete()
        .eq('organization_id', orgId)
        .eq('page_id', pageId)
        .eq('block_index', idx)
        .eq('holder_user_id', userId)
      await refreshLocks()
    },
    [supabase, orgId, pageId, userId, refreshLocks],
  )

  const overrideLock = useCallback(
    async (idx: number, opts?: { writeAuditEntry?: () => Promise<void> }) => {
      if (!supabase || !orgId || !pageId) return
      await supabase
        .from('wiki_page_block_locks')
        .delete()
        .eq('organization_id', orgId)
        .eq('page_id', pageId)
        .eq('block_index', idx)
      if (opts?.writeAuditEntry) {
        try {
          await opts.writeAuditEntry()
        } catch (err) {
          console.warn('overrideLock audit:', err)
        }
      }
      await refreshLocks()
    },
    [supabase, orgId, pageId, refreshLocks],
  )

  return useMemo(
    () => ({
      presence,
      locks,
      heldBy,
      isHeldByMe,
      setFocusedBlock,
      acquireBlockLock,
      releaseBlockLock,
      overrideLock,
    }),
    [presence, locks, heldBy, isHeldByMe, setFocusedBlock, acquireBlockLock, releaseBlockLock, overrideLock],
  )
}
