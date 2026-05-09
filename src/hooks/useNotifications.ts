import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppNotification, NotificationPreferences } from '../types/notifications'
import {
  loadReadNotificationIds,
  parseNotificationPreferences,
  saveReadNotificationIds,
} from '../lib/notificationPreferences'
import { useOrgSetupContext } from './useOrgSetupContext'
import { useWhistleblowing } from './useWhistleblowing'

function normEmail(s: string | null | undefined) {
  const t = s?.trim().toLowerCase()
  return t || undefined
}

function daysUntilDue(due: string): number | null {
  if (!due || due === '—') return null
  const t = new Date(due + 'T12:00:00').getTime()
  if (Number.isNaN(t)) return null
  return Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000))
}

export function useNotifications() {
  const { user, profile, permissionKeys, isAdmin } = useOrgSetupContext()
  const wb = useWhistleblowing()
  const userId = user?.id ?? null
  const userEmail = normEmail(profile?.email ?? user?.email ?? undefined)

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

    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [userEmail, prefs, canWhistle, wb.cases])

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
