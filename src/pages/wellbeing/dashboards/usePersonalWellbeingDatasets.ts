// usePersonalWellbeingDatasets — det Min trivsel-siden viser av
// utfalls-data per bruker.
//
// Bygger på data som allerede er lastet i sammenhengen:
//   - learning.progress + learning.courses + learning.certificates
//     (filtreres på user.id; certs har ingen userId-felt så vi viser
//     bare brukerens egne, dvs. som returneres fra useLearning)
//   - wellbeing focus_areas + strategy (vises som «hva vi jobber mot»)
//
// Pluss én lett supabase-spørring mot `survey_invitations` for å
// finne ubesvarte invitasjoner. Den tabellen finnes allerede og
// brukes av SurveyPendingInvitesBanner — vi gjenbruker mønsteret.
//
// Privacy by design: vi rapporterer aldri individuelle psyko-svar.
// Trivsel-aksen for personlig bruk handler om deltakelse + tilgang,
// ikke om hva personen svarte.

import { useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import type { Certificate, Course, CourseProgress } from '../../../types/learning'
import type { WellbeingFocusAreaRow } from '../hooks/useWellbeingStrategy'
import {
  WELLBEING_AXIS_LABELS,
  type WellbeingAxisKey,
} from './useWorkerWellbeingDatasets'

type PendingSurveyRow = {
  survey_id: string
  title: string
  pack: string
  closes_at: string | null
}

export type UsePersonalWellbeingDatasetsArgs = {
  courses: Course[]
  progress: CourseProgress[]
  certificates: Certificate[]
  focusAreas: WellbeingFocusAreaRow[]
}

const DAY = 1000 * 60 * 60 * 24
const EXPIRING_HORIZON_DAYS = 90

function deriveCertExpiry(cert: Certificate, course: Course | undefined): Date | null {
  // Læringssystemet lagrer ikke utløp på sertifikatet selv — det leves
  // i kurset (Course.recertificationMonths). Mangler felt: null (ingen
  // resertifisering nødvendig).
  if (!course?.recertificationMonths || course.recertificationMonths <= 0) return null
  const issued = new Date(cert.issuedAt)
  const expires = new Date(issued)
  expires.setMonth(expires.getMonth() + course.recertificationMonths)
  return expires
}

export function usePersonalWellbeingDatasets({
  courses,
  progress,
  certificates,
  focusAreas,
}: UsePersonalWellbeingDatasetsArgs): Record<string, unknown> {
  const { supabase, user, organization } = useOrgSetupContext()
  const [pendingSurveys, setPendingSurveys] = useState<PendingSurveyRow[]>([])
  // Pure-safe «nå» — settes ved første mount, holder seg stabil for
  // alle re-renders. Sertifikat-utløp regnes mot dette ankeret.
  const [nowMs] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false
    if (!supabase || !user?.id || !organization?.id) return
    void (async () => {
      const inv = await supabase
        .from('survey_invitations')
        .select('survey_id')
        .eq('organization_id', organization.id)
        .eq('profile_id', user.id)
        .eq('status', 'pending')
      if (cancelled || inv.error) return
      const ids = [...new Set(((inv.data ?? []) as { survey_id: string }[]).map((r) => r.survey_id))]
      if (ids.length === 0) {
        setPendingSurveys([])
        return
      }
      const surv = await supabase
        .from('surveys')
        .select('id, title, pack, status, closes_at')
        .eq('organization_id', organization.id)
        .eq('status', 'active')
        .in('id', ids)
      if (cancelled || surv.error) return
      const rows = ((surv.data ?? []) as Array<{
        id: string
        title: string
        pack: string
        closes_at: string | null
      }>).map((r) => ({
        survey_id: r.id,
        title: r.title,
        pack: r.pack,
        closes_at: r.closes_at,
      }))
      setPendingSurveys(rows)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, user?.id, organization?.id])

  return useMemo(() => {
    const myUserId = user?.id ?? null
    const courseById = new Map(courses.map((c) => [c.id, c]))

    // Filter progress to "mine" only. When loaded org-wide (admin
    // context), useLearning returns everyone's rows; userId is set on
    // each. In local/demo mode, userId is undefined — there's only
    // one logical learner so we treat all progress as the current
    // user's.
    const myProgress = progress.filter((p) => !p.userId || p.userId === myUserId)
    const myCertificates = certificates // useLearning's snapshot for the active user

    const yearStart = new Date()
    yearStart.setMonth(0, 1)
    yearStart.setHours(0, 0, 0, 0)

    let completedYtd = 0
    let inProgressCount = 0
    const openRows: Array<{ title: string; progress: string; modulesLeft: number; action: string }> = []

    for (const p of myProgress) {
      const c = courseById.get(p.courseId)
      if (!c) continue
      if (p.completedAt) {
        if (new Date(p.completedAt) >= yearStart) completedYtd += 1
        continue
      }
      // Kurs påbegynt — tell og ta med i tabell
      inProgressCount += 1
      const totalModules = c.modules?.length ?? 0
      const doneModules = Object.values(p.moduleProgress ?? {}).filter(
        (m) => (m as { completed?: boolean }).completed,
      ).length
      const modulesLeft = Math.max(0, totalModules - doneModules)
      const pct = totalModules > 0 ? Math.round((doneModules / totalModules) * 100) : 0
      openRows.push({
        title: c.title,
        progress: `${pct}%`,
        modulesLeft,
        action: `/learning/play/${c.id}`,
      })
    }

    // Også kurs som er tildelt (publisert) men ennå ikke påbegynt: vi
    // har ikke en eksplisitt assignment-tabell her, så vi nøyer oss med
    // pågående i v2.
    const openCourses = inProgressCount

    const expiringRows: Array<{
      title: string
      issuedAt: string
      expiresAt: string
      daysLeft: number
    }> = []
    let expiringSoon = 0
    for (const cert of myCertificates) {
      const course = courseById.get(cert.courseId)
      const expires = deriveCertExpiry(cert, course)
      if (!expires) continue
      const daysLeft = Math.floor((expires.getTime() - nowMs) / DAY)
      if (daysLeft < 0) continue
      if (daysLeft <= EXPIRING_HORIZON_DAYS) {
        expiringSoon += 1
        expiringRows.push({
          title: cert.courseTitle,
          issuedAt: new Date(cert.issuedAt).toLocaleDateString('nb-NO'),
          expiresAt: expires.toLocaleDateString('nb-NO'),
          daysLeft,
        })
      }
    }

    const pendingSurveyRows = pendingSurveys.map((s) => ({
      title: s.title,
      pack: s.pack,
      closesAt: s.closes_at ? new Date(s.closes_at).toLocaleDateString('nb-NO') : '—',
      action: `/survey-respond/${s.survey_id}`,
    }))

    const focusRows = focusAreas.map((f) => ({
      axis: WELLBEING_AXIS_LABELS[f.axis_key as WellbeingAxisKey] ?? f.axis_key,
      title: f.title,
      target: f.target_metric ?? '—',
    }))

    // Aktivitet per akse — enkle tall som forteller hvor brukerens
    // egne handlinger er forventet, ikke score-formler.
    const axisDistribution: Record<string, number> = {
      [WELLBEING_AXIS_LABELS.trygghet]: 0, // v2 har ikke personlig avvik-data
      [WELLBEING_AXIS_LABELS.trivsel]: pendingSurveys.length,
      [WELLBEING_AXIS_LABELS.medvirkning]: pendingSurveys.length, // svar = stemme
      [WELLBEING_AXIS_LABELS.mestring]: openCourses + expiringSoon,
    }

    return {
      pwb_kpi_summary: {
        pendingSurveys: pendingSurveys.length,
        openCourses,
        completedYtd,
        expiringSoon,
      },
      pwb_axis_axis_distribution: axisDistribution,
      pwb_pending_surveys: pendingSurveyRows,
      pwb_open_courses: openRows,
      pwb_expiring_certificates: expiringRows,
      pwb_my_focus_areas: focusRows,
    } as Record<string, unknown>
  }, [user?.id, courses, progress, certificates, pendingSurveys, focusAreas, nowMs])
}
