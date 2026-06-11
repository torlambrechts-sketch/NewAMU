/** Stored in profiles.notification_preferences (jsonb). */
export type NotificationChannelPrefs = {
  inApp: boolean
  email: boolean
  webhook: boolean
}

export type NotificationCategoryKey =
  | 'tasks_sign'
  | 'tasks_due'
  | 'whistle'
  | 'compliance'
  | 'documents_mention'
  | 'documents_review'
  | 'documents_comment'
  | 'documents_moderation'

export type NotificationCategoryPrefs = Record<NotificationCategoryKey, boolean>

export type NotificationPreferences = {
  channels: NotificationChannelPrefs
  /** HTTPS endpoint for outbound POST payloads (integrate with Zapier, n8n, etc.). */
  webhookUrl?: string
  /** Optional header value; sent as X-Notification-Secret (server should validate). */
  webhookSecret?: string
  categories: NotificationCategoryPrefs
  /** Show a short toast banner when new matching notifications appear while using the app. */
  toastEnabled: boolean
  /** Cadence for the tasks-due digest email (read by the tasks-due-digest
   *  edge function). «Av» = uncheck the tasks_due category. */
  taskDigestFrequency: 'daily' | 'weekly'
  /** Include tasks approaching their due date (≤ 3 days), not just overdue. */
  taskDigestPreDue: boolean
}

export type AppNotification = {
  id: string
  category: NotificationCategoryKey
  title: string
  body: string
  createdAt: string
  href: string
  /** For grouping / future use */
  severity?: 'info' | 'warning'
}
