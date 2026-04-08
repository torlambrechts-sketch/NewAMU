/** Stored in profiles.notification_preferences (jsonb). */
export type NotificationChannelPrefs = {
  inApp: boolean
  email: boolean
  webhook: boolean
}

export type NotificationCategoryKey = 'tasks_sign' | 'tasks_due' | 'whistle' | 'compliance'

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
