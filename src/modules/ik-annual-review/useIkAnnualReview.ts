import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { fetchOrgModulePayload, type OrgModulePayloadKey } from '../../lib/orgModulePayload'
import { getSupabaseErrorMessage } from '../../lib/supabaseError'
import {
  AnnualReviewSchema,
  IkAnnualReviewEvaluationSchema,
  IkAnnualReviewModuleSettingsSchema,
  IkAnnualReviewNewGoalsSchema,
  type IkAnnualReviewModuleSettings,
} from './schema'
import type { IkAnnualReviewRow, IkAnnualReviewStatus } from './types'

const SETTINGS_MODULE_KEY = 'internkontroll_settings' satisfies OrgModulePayloadKey

type SettingsPayload = {
  annual_review?: IkAnnualReviewModuleSettings
}

function defaultEvaluation() {
  return IkAnnualReviewEvaluationSchema.parse({})
}

function defaultNewGoals() {
  return IkAnnualReviewNewGoalsSchema.parse({})
}

function parseJsonField<T>(raw: unknown, schema: { parse: (v: unknown) => T }): T {
  if (raw == null || typeof raw !== 'object') return schema.parse({})
  return schema.parse(raw)
}

function isLockedStatus(status: IkAnnualReviewStatus) {
  return status === 'signed' || status === 'archived'
}

export function useIkAnnualReview() {
  const { supabase, organization, can, isAdmin, profile } = useOrgSetupContext()
  const orgId = organization?.id
  const userId = profile?.id ?? null
  const canManage = isAdmin || can('internkontroll.manage') || can('ik.manage')

  const [reviews, setReviews] = useState<IkAnnualReviewRow[]>([])
  const [settings, setSettings] = useState(() => IkAnnualReviewModuleSettingsSchema.parse({}))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    if (!supabase || !orgId) return
    try {
      const payload = await fetchOrgModulePayload<SettingsPayload>(supabase, orgId, SETTINGS_MODULE_KEY)
      const ar = payload?.annual_review
      setSettings(IkAnnualReviewModuleSettingsSchema.parse(ar ?? {}))
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    }
  }, [supabase, orgId])

  const refresh = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      await loadSettings()
      const { data, error: qErr } = await supabase
        .from('ik_annual_reviews')
        .select('*')
        .eq('organization_id', orgId)
        .order('year', { ascending: false })
      if (qErr) throw qErr
      setReviews((data ?? []) as IkAnnualReviewRow[])
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId, loadSettings])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createForYear = useCallback(
    async (year: number) => {
      if (!supabase || !orgId) {
        setError('Organisasjon er ikke valgt.')
        return null
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å opprette årsgjennomgang.')
        return null
      }
      setError(null)
      try {
        const exists = reviews.some((r) => r.year === year)
        if (exists) {
          setError(`Det finnes allerede en gjennomgang for ${year}.`)
          return null
        }
        const payload = {
          organization_id: orgId,
          year,
          status: 'draft' as const,
          summary: null as string | null,
          evaluation_json: defaultEvaluation(),
          new_goals_json: defaultNewGoals(),
          conducted_by: userId,
        }
        const { data, error: insErr } = await supabase.from('ik_annual_reviews').insert(payload).select('*').single()
        if (insErr) throw insErr
        const row = data as IkAnnualReviewRow
        setReviews((prev) => [row, ...prev.filter((r) => r.id !== row.id)])
        return row
      } catch (err) {
        const msg = getSupabaseErrorMessage(err)
        setError(msg)
        return null
      }
    },
    [supabase, orgId, canManage, reviews, userId],
  )

  const saveProgress = useCallback(
    async (input: {
      id: string
      year: number
      summary: string | null
      evaluation_json: Record<string, unknown>
      new_goals_json: Record<string, unknown>
      conducted_by: string | null
    }) => {
      if (!supabase || !orgId) {
        setError('Organisasjon er ikke valgt.')
        return false
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å lagre.')
        return false
      }
      const current = reviews.find((r) => r.id === input.id)
      if (!current) {
        setError('Fant ikke gjennomgangen.')
        return false
      }
      if (isLockedStatus(current.status)) {
        setError('Gjennomgangen er låst og kan ikke endres.')
        return false
      }
      setError(null)
      try {
        const evaluation = parseJsonField(input.evaluation_json, IkAnnualReviewEvaluationSchema)
        const newGoals = parseJsonField(input.new_goals_json, IkAnnualReviewNewGoalsSchema)
        AnnualReviewSchema.parse({
          year: input.year,
          summary: input.summary,
          evaluation,
          newGoals,
          conducted_by: input.conducted_by,
        })
        const { data: updatedRow, error: upErr } = await supabase
          .from('ik_annual_reviews')
          .update({
            year: input.year,
            summary: input.summary,
            evaluation_json: evaluation,
            new_goals_json: newGoals,
            conducted_by: input.conducted_by,
          })
          .eq('id', input.id)
          .eq('organization_id', orgId)
          .select('*')
          .single()
        if (upErr) throw upErr
        const next = (updatedRow ?? null) as IkAnnualReviewRow | null
        setReviews((prev) =>
          prev.map((r) =>
            r.id === input.id
              ? next ?? {
                  ...r,
                  year: input.year,
                  summary: input.summary,
                  evaluation_json: evaluation as Record<string, unknown>,
                  new_goals_json: newGoals as Record<string, unknown>,
                  conducted_by: input.conducted_by,
                  updated_at: new Date().toISOString(),
                }
              : r,
          ),
        )
        return true
      } catch (err) {
        const msg = getSupabaseErrorMessage(err)
        setError(msg)
        return false
      }
    },
    [supabase, orgId, canManage, reviews],
  )

  const signReview = useCallback(
    async (reviewId: string, role: 'manager' | 'deputy') => {
      if (!supabase || !orgId || !userId) {
        setError(!userId ? 'Du må være innlogget for å signere.' : 'Organisasjon er ikke valgt.')
        return false
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å signere.')
        return false
      }
      const current = reviews.find((r) => r.id === reviewId)
      if (!current) {
        setError('Fant ikke gjennomgangen.')
        return false
      }
      if (isLockedStatus(current.status)) {
        setError('Gjennomgangen er allerede signert eller arkivert.')
        return false
      }
      setError(null)
      try {
        const nowIso = new Date().toISOString()
        const requireMgr = settings.require_manager_signature
        const requireDep = settings.require_deputy_signature

        let managerSignedAt = current.manager_signed_at
        let managerSignedBy = current.manager_signed_by
        let deputySignedAt = current.deputy_signed_at
        let deputySignedBy = current.deputy_signed_by
        let nextStatus: IkAnnualReviewStatus = 'draft'

        if (role === 'manager') {
          managerSignedAt = nowIso
          managerSignedBy = userId
        } else {
          deputySignedAt = nowIso
          deputySignedBy = userId
        }

        const mgrDone = !requireMgr || managerSignedAt != null
        const depDone = !requireDep || deputySignedAt != null
        if (mgrDone && depDone) {
          nextStatus = 'signed'
        }

        const { data: signedRow, error: upErr } = await supabase
          .from('ik_annual_reviews')
          .update({
            manager_signed_at: managerSignedAt,
            manager_signed_by: managerSignedBy,
            deputy_signed_at: deputySignedAt,
            deputy_signed_by: deputySignedBy,
            status: nextStatus,
          })
          .eq('id', reviewId)
          .eq('organization_id', orgId)
          .select('*')
          .single()
        if (upErr) throw upErr
        const next = (signedRow ?? null) as IkAnnualReviewRow | null

        setReviews((prev) =>
          prev.map((r) =>
            r.id === reviewId
              ? next ?? {
                  ...r,
                  manager_signed_at: managerSignedAt,
                  manager_signed_by: managerSignedBy,
                  deputy_signed_at: deputySignedAt,
                  deputy_signed_by: deputySignedBy,
                  status: nextStatus,
                  updated_at: new Date().toISOString(),
                }
              : r,
          ),
        )
        return true
      } catch (err) {
        const msg = getSupabaseErrorMessage(err)
        setError(msg)
        return false
      }
    },
    [supabase, orgId, userId, canManage, reviews, settings],
  )

  const createActionPlanDraft = useCallback(
    async (reviewId: string, year: number, title: string) => {
      if (!supabase || !orgId) {
        setError('Organisasjon er ikke valgt.')
        return null
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å opprette tiltak.')
        return null
      }
      setError(null)
      try {
        const { data, error: insErr } = await supabase
          .from('ik_action_plans')
          .insert({
            organization_id: orgId,
            title,
            description: `Tiltak etter årlig gjennomgang ${year} (IK-forskriften § 5.8).`,
            source: 'annual_review',
            source_id: reviewId,
            priority: 'medium',
            status: 'open',
          })
          .select('id')
          .single()
        if (insErr) throw insErr
        return data?.id as string
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, orgId, canManage],
  )

  return useMemo(
    () => ({
      reviews,
      settings,
      loading,
      error,
      setError,
      canManage,
      userId,
      refresh,
      createForYear,
      saveProgress,
      signReview,
      createActionPlanDraft,
    }),
    [
      reviews,
      settings,
      loading,
      error,
      canManage,
      userId,
      refresh,
      createForYear,
      saveProgress,
      signReview,
      createActionPlanDraft,
    ],
  )
}
