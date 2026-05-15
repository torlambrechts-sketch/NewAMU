import type {
  NotificationCategoryKey,
  NotificationPreferences,
} from '../types/notifications'

const DEFAULT_CATEGORIES: Record<NotificationCategoryKey, boolean> = {
  tasks_sign: true,
  tasks_due: true,
  whistle: true,
  compliance: true,
  documents_mention: true,
  documents_review: true,
  documents_comment: true,
  documents_moderation: true,
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  channels: {
    inApp: true,
    email: false,
    webhook: false,
  },
  categories: { ...DEFAULT_CATEGORIES },
  toastEnabled: true,
}

export function parseNotificationPreferences(raw: unknown): NotificationPreferences {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_NOTIFICATION_PREFS, categories: { ...DEFAULT_CATEGORIES } }
  const o = raw as Record<string, unknown>
  const ch = o.channels as Record<string, unknown> | undefined
  const cat = o.categories as Record<string, unknown> | undefined
  return {
    channels: {
      inApp: ch?.inApp !== false,
      email: ch?.email === true,
      webhook: ch?.webhook === true,
    },
    webhookUrl: typeof o.webhookUrl === 'string' ? o.webhookUrl.trim() || undefined : undefined,
    webhookSecret: typeof o.webhookSecret === 'string' ? o.webhookSecret : undefined,
    categories: {
      tasks_sign: cat?.tasks_sign !== false,
      tasks_due: cat?.tasks_due !== false,
      whistle: cat?.whistle !== false,
      compliance: cat?.compliance !== false,
      documents_mention: cat?.documents_mention !== false,
      documents_review: cat?.documents_review !== false,
      documents_comment: cat?.documents_comment !== false,
      documents_moderation: cat?.documents_moderation !== false,
    },
    toastEnabled: o.toastEnabled !== false,
  }
}

export function mergeNotificationPreferences(
  current: NotificationPreferences,
  patch: Partial<NotificationPreferences>,
): NotificationPreferences {
  return {
    channels: { ...current.channels, ...patch.channels },
    webhookUrl: patch.webhookUrl !== undefined ? patch.webhookUrl : current.webhookUrl,
    webhookSecret: patch.webhookSecret !== undefined ? patch.webhookSecret : current.webhookSecret,
    categories: { ...current.categories, ...patch.categories },
    toastEnabled: patch.toastEnabled !== undefined ? patch.toastEnabled : current.toastEnabled,
  }
}

const READ_KEY = 'atics-notification-read-ids'
const TOAST_DISMISSED_KEY = 'atics-notification-toast-dismissed-ids'

export function loadReadNotificationIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${READ_KEY}:${userId}`)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

export function saveReadNotificationIds(userId: string, ids: Set<string>) {
  try {
    localStorage.setItem(`${READ_KEY}:${userId}`, JSON.stringify([...ids]))
  } catch {
    /* ignore */
  }
}

export function loadToastDismissedIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${TOAST_DISMISSED_KEY}:${userId}`)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

export function saveToastDismissedIds(userId: string, ids: Set<string>) {
  try {
    localStorage.setItem(`${TOAST_DISMISSED_KEY}:${userId}`, JSON.stringify([...ids]))
  } catch {
    /* ignore */
  }
}
