import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppNotification, NotificationPreferences } from '../types/notifications'
import {
  loadReadNotificationIds,
  parseNotificationPreferences,
  saveReadNotificationIds,
} from '../lib/notificationPreferences'
import { useOrgSetupContext } from './useOrgSetupContext'
import { useWhistleblowing } from './useWhistleblowing'

type DocumentsNotificationFeed = {
  mentions: {
    id: string
    pageId: string | null
    actorName: string
    snippet: string
    context: 'editor' | 'comment'
    createdAt: string
  }[]
  reviews: {
    id: string
    pageId: string
    pageVersion: number
    requesterId: string
    createdAt: string
  }[]
}

const EMPTY_DOC_FEED: DocumentsNotificationFeed = { mentions: [], reviews: [] }

function normEmail(s: string | null | undefined) {
  const t = s?.trim().toLowerCase()
  return t || undefined
}


export function useNotifications() {
  const { user, profile, permissionKeys, isAdmin, supabase, organization } = useOrgSetupContext()
  const wb = useWhistleblowing()
  const userId = user?.id ?? null
  const userEmail = normEmail(profile?.email ?? user?.email ?? undefined)
  const orgId = organization?.id ?? null
  const [docFeed, setDocFeed] = useState<DocumentsNotificationFeed>(EMPTY_DOC_FEED)

  useEffect(() => {
    if (!supabase || !orgId || !userId) {
      queueMicrotask(() => setDocFeed(EMPTY_DOC_FEED))
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const [mentionsRes, reviewsRes] = await Promise.all([
          supabase
            .from('wiki_mention_notifications')
            .select('id, page_id, actor_name, snippet, context, created_at, read_at')
            .eq('organization_id', orgId)
            .eq('recipient_user_id', userId)
            .is('read_at', null)
            .order('created_at', { ascending: false })
            .limit(20),
          supabase
            .from('wiki_review_requests')
            .select('id, page_id, page_version, requester_id, status, created_at')
            .eq('organization_id', orgId)
            .eq('reviewer_id', userId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(20),
        ])
        if (cancelled) return
        setDocFeed({
          mentions: (mentionsRes.data ?? []).map((m: Record<string, unknown>) => ({
            id: String(m.id),
            pageId: typeof m.page_id === 'string' ? m.page_id : null,
            actorName: typeof m.actor_name === 'string' ? m.actor_name : 'Kollega',
            snippet: typeof m.snippet === 'string' ? m.snippet : '',
            context: m.context === 'editor' ? 'editor' : 'comment',
            createdAt: typeof m.created_at === 'string' ? m.created_at : new Date().toISOString(),
          })),
          reviews: (reviewsRes.data ?? []).map((r: Record<string, unknown>) => ({
            id: String(r.id),
            pageId: typeof r.page_id === 'string' ? r.page_id : '',
            pageVersion: typeof r.page_version === 'number' ? r.page_version : 1,
            requesterId: typeof r.requester_id === 'string' ? r.requester_id : '',
            createdAt: typeof r.created_at === 'string' ? r.created_at : new Date().toISOString(),
          })),
        })
      } catch {
        if (!cancelled) setDocFeed(EMPTY_DOC_FEED)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, orgId, userId])

  const prefs: NotificationPreferences = useMemo(
    () => parseNotificationPreferences(profile?.notification_preferences),
    [profile?.notification_preferences],
  )

  const [readIds, setReadIds] = useState<Set<string>>(() =>
    userId ? loadReadNotificationIds(userId) : new Set(),
  )
  const prevUnreadRef = useRef<number>(0)
  const toastHydratedRef = useRef(false)
  const [toast, setToast] = useState<AppNotification | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    toastHydratedRef.current = false
    prevUnreadRef.current = 0
    queueMicrotask(() => {
      if (!userId) {
        setReadIds(new Set())
        return
      }
      setReadIds(loadReadNotificationIds(userId))
    })
  }, [userId])

  const canWhistle = isAdmin || permissionKeys.has('whistleblowing.committee')

  const generated = useMemo((): AppNotification[] => {
    const out: AppNotification[] = []
    if (!userEmail || !prefs.channels.inApp) return out

    if (prefs.categories.whistle && canWhistle) {
      for (const c of wb.cases) {
        if (c.status === 'received' || c.status === 'triage') {
          out.push({
            id: `whistle-${c.id}`,
            category: 'whistle',
            title: 'Varslingssak trenger oppfølging',
            body: c.title ?? 'Uten tittel',
            createdAt: c.received_at ?? new Date().toISOString(),
            href: `/tasks/management?tab=varsling`,
            severity: 'warning',
          })
        }
      }
    }

    if (prefs.categories.documents_mention) {
      for (const m of docFeed.mentions) {
        out.push({
          id: `doc-mention-${m.id}`,
          category: 'documents_mention',
          title: `${m.actorName} nevnte deg`,
          body: m.snippet.length > 140 ? `${m.snippet.slice(0, 140)}…` : m.snippet || 'Du ble nevnt i et dokument.',
          createdAt: m.createdAt,
          href: m.pageId ? `/documents/page/${m.pageId}?tab=diskusjon` : '/documents',
          severity: 'info',
        })
      }
    }

    if (prefs.categories.documents_review) {
      for (const r of docFeed.reviews) {
        out.push({
          id: `doc-review-${r.id}`,
          category: 'documents_review',
          title: 'Dokument venter på godkjenning',
          body: `v${r.pageVersion} er sendt til deg for gjennomgang.`,
          createdAt: r.createdAt,
          href: `/documents/page/${r.pageId}?tab=diskusjon`,
          severity: 'warning',
        })
      }
    }

    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [userEmail, prefs, canWhistle, wb.cases, docFeed])

  const deduped = useMemo(() => {
    const seen = new Set<string>()
    const list: AppNotification[] = []
    for (const n of generated) {
      if (seen.has(n.id)) continue
      seen.add(n.id)
      list.push(n)
    }
    return list
  }, [generated])

  const unreadList = useMemo(
    () => deduped.filter((n) => !readIds.has(n.id)),
    [deduped, readIds],
  )

  const unreadCount = unreadList.length

  useEffect(() => {
    if (!prefs.toastEnabled || !prefs.channels.inApp) {
      prevUnreadRef.current = unreadCount
      return
    }
    if (!toastHydratedRef.current) {
      toastHydratedRef.current = true
      prevUnreadRef.current = unreadCount
      return
    }
    if (unreadCount > prevUnreadRef.current && unreadList.length > 0) {
      const newest = unreadList[0]
      queueMicrotask(() => {
        setToast(newest)
        if (toastTimer.current) clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => setToast(null), 7000)
      })
    }
    prevUnreadRef.current = unreadCount
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [unreadCount, unreadList, prefs.toastEnabled, prefs.channels.inApp])

  const markRead = useCallback(
    (id: string) => {
      if (!userId) return
      setReadIds((prev) => {
        const next = new Set(prev)
        next.add(id)
        saveReadNotificationIds(userId, next)
        return next
      })
    },
    [userId],
  )

  const markAllRead = useCallback(() => {
    if (!userId) return
    const next = new Set(readIds)
    for (const n of deduped) next.add(n.id)
    saveReadNotificationIds(userId, next)
    setReadIds(next)
  }, [userId, readIds, deduped])

  const dismissToast = useCallback(() => {
    setToast(null)
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  return {
    prefs,
    items: deduped,
    unreadList,
    unreadCount,
    readIds,
    markRead,
    markAllRead,
    toast,
    dismissToast,
  }
}
