// Shared load/save state for the three documents settings tabs that
// edit slices of the same `org_module_payloads.documents_settings` JSON
// blob (Generelt / Revisjon / Kvitteringer). Mirrors the inline
// useState + useEffect + useCallback trio that lives in
// `DocumentsModuleAdminPage.tsx:46-94`. Extracted so each scope tab can
// own its own lifecycle when rendered standalone inside the unified
// settings shell.

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { fetchOrgModulePayload, upsertOrgModulePayload } from '../../../lib/orgModulePayload'
import { getSupabaseErrorMessage } from '../../../lib/supabaseError'
import {
  parseDocumentsModuleSettings,
  type DocumentsModuleSettings,
} from '../../../../modules/documents/documentsModuleSettingsSchema'

const SETTINGS_KEY = 'documents_settings' as const

export type UseDocumentsModuleSettings = {
  settings: DocumentsModuleSettings
  setSettings: React.Dispatch<React.SetStateAction<DocumentsModuleSettings>>
  loading: boolean
  saving: boolean
  error: string | null
  canManage: boolean
  save: () => Promise<void>
}

export function useDocumentsModuleSettings(): UseDocumentsModuleSettings {
  const { supabase, can, isAdmin, organization } = useOrgSetupContext()
  const orgId = organization?.id
  const canManage = isAdmin || can('documents.manage')

  const [settings, setSettings] = useState<DocumentsModuleSettings>(() =>
    parseDocumentsModuleSettings({}),
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!canManage || !supabase || !orgId) {
      setLoading(false)
      return () => {
        cancelled = true
      }
    }
    setError(null)
    fetchOrgModulePayload<Record<string, unknown>>(supabase, orgId, SETTINGS_KEY)
      .then((raw) => {
        if (cancelled) return
        setSettings(parseDocumentsModuleSettings(raw))
      })
      .catch((e) => {
        if (cancelled) return
        setError(getSupabaseErrorMessage(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, orgId, canManage])

  const save = useCallback(async () => {
    if (!supabase || !orgId) return
    setSaving(true)
    setError(null)
    try {
      await upsertOrgModulePayload(supabase, orgId, SETTINGS_KEY, {
        require_legal_ref_on_publish: settings.require_legal_ref_on_publish,
        show_revision_badge: settings.show_revision_badge,
        auto_create_annual_review: settings.auto_create_annual_review,
        default_language: settings.default_language,
        default_revision_interval_months: settings.default_revision_interval_months,
        revision_warning_days: settings.revision_warning_days,
        notify_owner_on_revision_due: settings.notify_owner_on_revision_due,
        notify_admins_on_revision_due: settings.notify_admins_on_revision_due,
        default_ack_audience: settings.default_ack_audience,
        ack_reminder_days: settings.ack_reminder_days,
        ack_max_reminders: settings.ack_max_reminders,
        ack_grace_period_days: settings.ack_grace_period_days,
      })
    } catch (e) {
      setError(getSupabaseErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }, [supabase, orgId, settings])

  return { settings, setSettings, loading, saving, error, canManage, save }
}
