import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Loader2, Plus, Search, ShieldCheck } from 'lucide-react'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_ROW_GRID,
} from '../../components/layout/WorkplaceStandardFormPanel'
import { LayoutTable1PostingsShell } from '../../components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../components/layout/layoutTable1PostingsKit'
import { WORKPLACE_MODULE_CARD, WORKPLACE_MODULE_CARD_SHADOW } from '../../components/layout/workplaceModuleSurface'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { fetchAssignableUsers } from '../../hooks/useAssignableUsers'
import { Badge, type BadgeVariant } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ComplianceBanner } from '../../components/ui/ComplianceBanner'
import { StandardInput } from '../../components/ui/Input'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import { StandardTextarea } from '../../components/ui/Textarea'
import { Tabs, type TabItem } from '../../components/ui/Tabs'
import { WarningBox } from '../../components/ui/AlertBox'
import { fetchIkAnnualReviewYearStats, type IkAnnualReviewYearStats } from './annualReviewYearStats'
import {
  IkAnnualReviewEvaluationSchema,
  IkAnnualReviewNewGoalsSchema,
} from './schema'
import type { IkAnnualReviewRow, IkAnnualReviewStatus } from './types'
import { useIkAnnualReview } from './useIkAnnualReview'

type PanelTab = 'oversikt' | 'evaluering' | 'nye_mal' | 'signering'

const TAB_ITEMS: TabItem[] = [
  { id: 'oversikt', label: 'Oversikt' },
  { id: 'evaluering', label: 'Evaluering' },
  { id: 'nye_mal', label: 'Nye mål' },
  { id: 'signering', label: 'Signering' },
]

function statusBadgeVariant(status: IkAnnualReviewStatus): BadgeVariant {
  if (status === 'signed') return 'success'
  if (status === 'archived') return 'neutral'
  return 'warning'
}

function statusLabel(status: IkAnnualReviewStatus): string {
  if (status === 'signed') return 'Signert'
  if (status === 'archived') return 'Arkivert'
  return 'Kladd'
}

function EvalueringYearStats({
  organizationId,
  evalYear,
}: {
  organizationId: string
  evalYear: number
}) {
  const { supabase } = useOrgSetupContext()
  const [state, setState] = useState<{
    loading: boolean
    data: IkAnnualReviewYearStats | null
    error: string | null
  }>({ loading: true, data: null, error: null })

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    void (async () => {
      const res = await fetchIkAnnualReviewYearStats(supabase, organizationId, evalYear)
      if (cancelled) return
      if (res.error) {
        setState({ loading: false, data: null, error: res.error })
      } else {
        setState({ loading: false, data: res.data, error: null })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, organizationId, evalYear])

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50/80 px-4 py-3 text-sm text-neutral-700">
      <p className="font-semibold text-neutral-900">Datagrunnlag for {evalYear}</p>
      {state.loading ? (
        <p className="mt-2 flex items-center gap-2 text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Henter statistikk…
        </p>
      ) : state.error ? (
        <p className="mt-2 text-red-700">{state.error}</p>
      ) : state.data ? (
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            Avvik registrert i perioden: <strong>{state.data.deviationCount}</strong>
          </li>
          <li>
            Signerte inspeksjonsrunder (fullført i perioden):{' '}
            <strong>{state.data.signedInspectionRoundsCount}</strong>
          </li>
        </ul>
      ) : (
        <p className="mt-2 text-neutral-500">Ingen data.</p>
      )}
    </div>
  )
}

function IkAnnualReviewEditorPanel({
  review,
  ar,
  profileOptions,
}: {
  review: IkAnnualReviewRow
  ar: ReturnType<typeof useIkAnnualReview>
  profileOptions: { value: string; label: string }[]
}) {
  const [activeTab, setActiveTab] = useState<PanelTab>('oversikt')
  const [saving, setSaving] = useState(false)
  const [signing, setSigning] = useState<'manager' | 'deputy' | null>(null)
  const [actionTitle, setActionTitle] = useState('Tiltak etter årsgjennomgang')

  const evInit = IkAnnualReviewEvaluationSchema.parse(review.evaluation_json ?? {})
  const ngInit = IkAnnualReviewNewGoalsSchema.parse(review.new_goals_json ?? {})

  const [summary, setSummary] = useState(() => review.summary ?? '')
  const [goalsReview, setGoalsReview] = useState(() => evInit.goals_review)
  const [incidentsReview, setIncidentsReview] = useState(() => evInit.incidents_review)
  const [systemEffectiveness, setSystemEffectiveness] = useState(() => evInit.system_effectiveness)
  const [goalsText, setGoalsText] = useState(() => ngInit.goals_text)
  const [improvementNotes, setImprovementNotes] = useState(() => ngInit.improvement_notes)
  const [conductedBy, setConductedBy] = useState(() => review.conducted_by ?? '')

  const readOnly = review.status === 'signed' || review.status === 'archived'
  const evalYear = review.year - 1
  const { organization } = useOrgSetupContext()
  const orgId = organization?.id

  const persistForm = useCallback(async () => {
    setSaving(true)
    ar.setError(null)
    const ok = await ar.saveProgress({
      id: review.id,
      year: review.year,
      summary: summary.trim() || null,
      evaluation_json: {
        goals_review: goalsReview,
        incidents_review: incidentsReview,
        system_effectiveness: systemEffectiveness,
      },
      new_goals_json: {
        goals_text: goalsText,
        improvement_notes: improvementNotes,
      },
      conducted_by: conductedBy || null,
    })
    setSaving(false)
    return ok
  }, [
    ar,
    review.id,
    review.year,
    summary,
    goalsReview,
    incidentsReview,
    systemEffectiveness,
    goalsText,
    improvementNotes,
    conductedBy,
  ])

  const handleSign = useCallback(
    async (role: 'manager' | 'deputy') => {
      setSigning(role)
      await ar.signReview(review.id, role)
      setSigning(null)
    },
    [ar, review.id],
  )

  const handleCreateAction = useCallback(async () => {
    const title = actionTitle.trim() || `Tiltak etter årsgjennomgang ${review.year}`
    const id = await ar.createActionPlanDraft(review.id, review.year, title)
    if (id) ar.setError(null)
  }, [ar, review.id, review.year, actionTitle])

  const managerSigned = Boolean(review.manager_signed_at)
  const deputySigned = Boolean(review.deputy_signed_at)
  const requireMgr = ar.settings.require_manager_signature
  const requireDep = ar.settings.require_deputy_signature

  return (
    <div className="mt-8 space-y-6 border-t border-neutral-200 pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[#1a3d32]" aria-hidden />
          <span className="text-base font-semibold text-neutral-900">År {review.year}</span>
          <Badge variant={statusBadgeVariant(review.status)}>{statusLabel(review.status)}</Badge>
        </div>
        <Link
          to="/internkontroll/tiltaksplan"
          className="text-sm font-medium text-[#1a3d32] underline underline-offset-2"
        >
          Gå til tiltaksplan
        </Link>
      </div>

      <Tabs items={TAB_ITEMS} activeId={activeTab} onChange={(id) => setActiveTab(id as PanelTab)} />

      {activeTab === 'oversikt' ? (
        <div className="space-y-6">
          <ComplianceBanner title="IK-forskriften § 5.8 — Årlig gjennomgang">
            Arbeidsgiver skal minst én gang i året gjennomgå virksomhetens system for internkontroll for å sikre at det
            fungerer som forutsatt og etterlever kravene i regelverket.
          </ComplianceBanner>
          <div className={WPSTD_FORM_ROW_GRID}>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ik-ar-summary">
              Sammendrag
            </label>
            <StandardTextarea
              id="ik-ar-summary"
              rows={5}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              readOnly={readOnly || !ar.canManage}
              placeholder="Kort oppsummering av gjennomgangen…"
            />
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ik-ar-conducted">
              Ansvarlig for gjennomføring
            </label>
            <SearchableSelect
              value={conductedBy}
              options={profileOptions}
              onChange={(v) => setConductedBy(v)}
              disabled={readOnly || !ar.canManage}
            />
          </div>
          {ar.canManage && !readOnly ? (
            <Button type="button" variant="primary" disabled={saving} onClick={() => void persistForm()}>
              {saving ? 'Lagrer…' : 'Lagre oversikt'}
            </Button>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'evaluering' ? (
        <div className="space-y-6">
          <ComplianceBanner title="IK-forskriften § 5.8 — Årlig gjennomgang">
            Gjennomgangen skal vurdere om HMS-systemet virker etter hensikten, herunder resultater fra mål, avvik og
            andre kontroller.
          </ComplianceBanner>

          {orgId ? <EvalueringYearStats organizationId={orgId} evalYear={evalYear} /> : null}

          <div className={WPSTD_FORM_ROW_GRID}>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ik-ar-goals-rev">
              Mål og resultater ({evalYear})
            </label>
            <StandardTextarea
              id="ik-ar-goals-rev"
              rows={4}
              value={goalsReview}
              onChange={(e) => setGoalsReview(e.target.value)}
              readOnly={readOnly || !ar.canManage}
            />
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ik-ar-inc">
              Avvik og hendelser
            </label>
            <StandardTextarea
              id="ik-ar-inc"
              rows={4}
              value={incidentsReview}
              onChange={(e) => setIncidentsReview(e.target.value)}
              readOnly={readOnly || !ar.canManage}
            />
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ik-ar-sys">
              Virker systemet som tiltenkt?
            </label>
            <StandardTextarea
              id="ik-ar-sys"
              rows={4}
              value={systemEffectiveness}
              onChange={(e) => setSystemEffectiveness(e.target.value)}
              readOnly={readOnly || !ar.canManage}
            />
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white px-4 py-4">
            <p className="text-sm font-medium text-neutral-900">Oppfølging i handlingsplan</p>
            <p className="mt-1 text-xs text-neutral-500">
              Opprett tiltak når gjennomgangen avdekker behov som skal følges opp strukturert.
            </p>
            <div className="mt-4 max-w-md">
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ik-ar-action-title">
                Tittel på tiltak
              </label>
              <StandardInput
                id="ik-ar-action-title"
                value={actionTitle}
                onChange={(e) => setActionTitle(e.target.value)}
                readOnly={readOnly || !ar.canManage}
              />
            </div>
            <div className="mt-4">
              <Button
                type="button"
                variant="secondary"
                icon={<Plus className="h-4 w-4" aria-hidden />}
                disabled={readOnly || !ar.canManage}
                onClick={() => void handleCreateAction()}
              >
                Opprett tiltak i handlingsplan
              </Button>
            </div>
          </div>

          {ar.canManage && !readOnly ? (
            <Button type="button" variant="primary" disabled={saving} onClick={() => void persistForm()}>
              {saving ? 'Lagrer…' : 'Lagre evaluering'}
            </Button>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'nye_mal' ? (
        <div className="space-y-6">
          <ComplianceBanner title="IK-forskriften § 5.8 — Årlig gjennomgang">
            Del av den årlige gjennomgangen er å fastsette mål og retning for det videre HMS-arbeidet.
          </ComplianceBanner>
          <div className={WPSTD_FORM_ROW_GRID}>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ik-ar-ng-goals">
              Mål for neste periode
            </label>
            <StandardTextarea
              id="ik-ar-ng-goals"
              rows={5}
              value={goalsText}
              onChange={(e) => setGoalsText(e.target.value)}
              readOnly={readOnly || !ar.canManage}
            />
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ik-ar-ng-imp">
              Forbedringspunkter
            </label>
            <StandardTextarea
              id="ik-ar-ng-imp"
              rows={4}
              value={improvementNotes}
              onChange={(e) => setImprovementNotes(e.target.value)}
              readOnly={readOnly || !ar.canManage}
            />
          </div>
          {ar.canManage && !readOnly ? (
            <Button type="button" variant="primary" disabled={saving} onClick={() => void persistForm()}>
              {saving ? 'Lagrer…' : 'Lagre mål'}
            </Button>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'signering' ? (
        <div className="space-y-6">
          <ComplianceBanner title="IK-forskriften § 5.8 — Årlig gjennomgang">
            Signatur dokumenterer at gjennomgangen er gjennomført og godkjent av ledelsen og sikkerhetsrepresentanten i
            tråd med internkontrollkravene.
          </ComplianceBanner>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 p-4">
              <p className="text-sm font-semibold text-neutral-900">Leder</p>
              <p className="mt-1 text-xs text-neutral-500">
                {requireMgr ? 'Påkrevd i organisasjonens innstillinger.' : 'Ikke påkrevd i innstillinger.'}
              </p>
              <p className="mt-3 text-sm text-neutral-700">
                {managerSigned
                  ? `Signert ${new Date(review.manager_signed_at!).toLocaleString('no-NO')}`
                  : 'Ikke signert'}
              </p>
              {ar.canManage && !readOnly && requireMgr ? (
                <Button
                  type="button"
                  className="mt-4"
                  variant="primary"
                  disabled={managerSigned || signing !== null}
                  onClick={() => void handleSign('manager')}
                >
                  {signing === 'manager' ? 'Signerer…' : 'Signer som leder'}
                </Button>
              ) : null}
            </div>
            <div className="rounded-lg border border-neutral-200 p-4">
              <p className="text-sm font-semibold text-neutral-900">Sikkerhetsrepresentant (VO/HMS)</p>
              <p className="mt-1 text-xs text-neutral-500">
                {requireDep ? 'Påkrevd i organisasjonens innstillinger.' : 'Ikke påkrevd i innstillinger.'}
              </p>
              <p className="mt-3 text-sm text-neutral-700">
                {deputySigned
                  ? `Signert ${new Date(review.deputy_signed_at!).toLocaleString('no-NO')}`
                  : 'Ikke signert'}
              </p>
              {ar.canManage && !readOnly && requireDep ? (
                <Button
                  type="button"
                  className="mt-4"
                  variant="primary"
                  disabled={deputySigned || signing !== null}
                  onClick={() => void handleSign('deputy')}
                >
                  {signing === 'deputy' ? 'Signerer…' : 'Signer som sikkerhetsrepresentant'}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
            <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
            <p>
              Når alle påkrevde signaturer er registrert, settes status til «Signert» og posten låses for redigering.
              Arbeidsflytregler med hendelsen «ON_ANNUAL_REVIEW_SIGNED» kan trigges automatisk.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function IkAnnualReviewView() {
  const { supabase } = useOrgSetupContext()
  const ar = useIkAnnualReview()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newYearStr, setNewYearStr] = useState(String(new Date().getFullYear()))
  const [listSearch, setListSearch] = useState('')
  const [profileOptions, setProfileOptions] = useState<{ value: string; label: string }[]>([
    { value: '', label: '(Ikke valgt)' },
  ])

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    void (async () => {
      const users = await fetchAssignableUsers(supabase)
      if (cancelled) return
      setProfileOptions([{ value: '', label: '(Ikke valgt)' }, ...users.map((u) => ({ value: u.id, label: u.displayName }))])
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const effectiveSelectedId = useMemo(() => {
    if (ar.reviews.length === 0) return null
    if (selectedId && ar.reviews.some((r) => r.id === selectedId)) return selectedId
    return ar.reviews[0]!.id
  }, [ar.reviews, selectedId])

  const selected = useMemo(
    () => ar.reviews.find((r) => r.id === effectiveSelectedId) ?? null,
    [ar.reviews, effectiveSelectedId],
  )

  const selectOptions = useMemo(
    () =>
      ar.reviews.map((r) => ({
        value: r.id,
        label: `${r.year} — ${statusLabel(r.status)}`,
      })),
    [ar.reviews],
  )

  const filteredReviews = useMemo(() => {
    const q = listSearch.trim().toLowerCase()
    if (!q) return ar.reviews
    return ar.reviews.filter((r) => String(r.year).includes(q) || statusLabel(r.status).toLowerCase().includes(q))
  }, [ar.reviews, listSearch])

  const handleCreateYear = useCallback(async () => {
    const y = Number.parseInt(newYearStr, 10)
    if (!Number.isFinite(y) || y < 1990 || y > 2100) {
      ar.setError('Oppgi et gyldig årstall (1990–2100).')
      return
    }
    const row = await ar.createForYear(y)
    if (row) setSelectedId(row.id)
  }, [newYearStr, ar])

  return (
    <div className="flex flex-col space-y-6">
      {ar.error ? <WarningBox>{ar.error}</WarningBox> : null}

      <div className={WORKPLACE_MODULE_CARD} style={WORKPLACE_MODULE_CARD_SHADOW}>
        <div className="p-5 md:p-6">
          <div className="flex flex-col gap-4 border-b border-neutral-200 pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Årlig gjennomgang</h2>
              <p className="mt-1 max-w-2xl text-sm text-neutral-600">
                Dokumentasjon av årlig gjennomgang etter internkontrollforskriften § 5.8. Velg år, fyll ut fanene og signer.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[140px]">
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ik-ar-new-year">
                  Nytt år
                </label>
                <StandardInput
                  id="ik-ar-new-year"
                  type="number"
                  value={newYearStr}
                  onChange={(e) => setNewYearStr(e.target.value)}
                  disabled={!ar.canManage}
                />
              </div>
              <Button
                type="button"
                variant="primary"
                disabled={!ar.canManage || ar.loading}
                onClick={() => void handleCreateYear()}
              >
                Opprett for år
              </Button>
              <Button type="button" variant="secondary" disabled={ar.loading} onClick={() => void ar.refresh()}>
                Oppdater liste
              </Button>
            </div>
          </div>

          <div className="mt-6">
            <LayoutTable1PostingsShell
              wrap={false}
              title="Registrerte gjennomganger"
              description="Ett dokument per år. Signerte rader er låst for redigering."
              headerActions={
                ar.reviews.length > 0 ? (
                  <div className="min-w-[220px]">
                    <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ik-ar-pick">
                      Aktiv gjennomgang
                    </label>
                    <SearchableSelect
                      value={effectiveSelectedId ?? ''}
                      options={selectOptions}
                      onChange={(v) => setSelectedId(v || null)}
                    />
                  </div>
                ) : null
              }
              toolbar={
                <div className="flex w-full min-w-0 flex-1 items-center gap-2">
                  <Search className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                  <StandardInput
                    id="ik-ar-list-search"
                    type="search"
                    className="min-w-0 flex-1"
                    value={listSearch}
                    onChange={(e) => setListSearch(e.target.value)}
                    placeholder="Søk etter år eller status…"
                  />
                </div>
              }
            >
              <table className="w-full min-w-[640px] text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>År</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Oppdatert</th>
                    <th className={`${LAYOUT_TABLE1_POSTINGS_TH} text-right`}>Handling</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReviews.map((r) => (
                    <tr key={r.id} className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} transition-colors`}>
                      <td className="px-5 py-3 font-medium text-neutral-900">{r.year}</td>
                      <td className="px-5 py-3">
                        <Badge variant={statusBadgeVariant(r.status)}>{statusLabel(r.status)}</Badge>
                      </td>
                      <td className="px-5 py-3 text-neutral-600">
                        {new Date(r.updated_at).toLocaleString('no-NO', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedId(r.id)}>
                          Åpne
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredReviews.length === 0 && !ar.loading ? (
                <p className="px-5 py-8 text-center text-sm text-neutral-500">
                  {listSearch.trim() ? 'Ingen treff i søket.' : 'Ingen årsgjennomganger ennå.'}
                </p>
              ) : null}
              {ar.loading ? (
                <p className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-neutral-500">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Laster…
                </p>
              ) : null}
            </LayoutTable1PostingsShell>
          </div>

          {selected ? (
            <IkAnnualReviewEditorPanel
              key={`${selected.id}:${selected.updated_at}`}
              review={selected}
              ar={ar}
              profileOptions={profileOptions}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
