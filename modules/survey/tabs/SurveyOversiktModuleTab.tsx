import { useNavigate } from 'react-router-dom'
import { CheckCircle, AlertTriangle, Clock, Plus } from 'lucide-react'
import { LayoutScoreStatRow } from '../../../src/components/layout/LayoutScoreStatRow'
import { ModuleSectionCard } from '../../../src/components/module'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { ComplianceBanner } from '../../../src/components/ui/ComplianceBanner'
import type { SurveyRow } from '../types'
import { surveyStatusBadgeVariant, surveyStatusLabel } from '../surveyLabels'

type Props = {
  surveys: SurveyRow[]
  loading: boolean
  onNewSurvey: () => void
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function SurveyOversiktModuleTab({ surveys, loading, onNewSurvey }: Props) {
  const navigate = useNavigate()

  const active = surveys.filter((s) => s.status === 'active')
  const drafts = surveys.filter((s) => s.status === 'draft')
  const closedNoAmu = surveys.filter((s) => s.status === 'closed' && s.amu_review_required)
  const external = surveys.filter((s) => s.survey_type === 'external')

  const kpiItems = [
    {
      big: String(active.length),
      title: 'Aktive kampanjer',
      sub: `${external.filter((s) => s.status === 'active').length} leverandør · ${active.filter((s) => s.survey_type !== 'external').length} ansatte`,
    },
    {
      big: String(drafts.length),
      title: 'Under utarbeidelse',
      sub: 'Kladder som ikke er publisert',
    },
    {
      big: String(closedNoAmu.length),
      title: 'Venter AMU-behandling',
      sub: 'Lukkede undersøkelser som krever AMU',
    },
    {
      big: String(surveys.length),
      title: 'Totalt registrert',
      sub: 'Alle undersøkelser i organisasjonen',
    },
  ]

  return (
    <div className="space-y-6">
      <ComplianceBanner title="AML § 3-1 (2)c · § 4-3 · § 7-2 (2)e — Kartlegging og medvirkning">
        Systematisk kartlegging av psykososialt arbeidsmiljø er påkrevd. Resultater presenteres for AMU og
        vernombud, og følges opp med handlingsplan (IK-forskriften § 5).
      </ComplianceBanner>

      <LayoutScoreStatRow items={kpiItems} columns={4} />

      {active.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-neutral-800">Pågående undersøkelser</h2>
          {active.map((s) => (
            <ModuleSectionCard key={s.id} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-neutral-900">{s.title}</span>
                    <Badge variant={surveyStatusBadgeVariant(s.status)}>{surveyStatusLabel(s.status)}</Badge>
                    {s.is_anonymous && <Badge variant="info">Anonym</Badge>}
                  </div>
                  {s.description && (
                    <p className="mt-1 max-w-2xl truncate text-sm text-neutral-500">{s.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-neutral-500">
                    {s.start_date && (
                      <span>Periode: {formatDate(s.start_date)} – {formatDate(s.end_date)}</span>
                    )}
                    <span>Oppdatert: {formatDate(s.updated_at)}</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/survey/${s.id}`)}
                >
                  Åpne
                </Button>
              </div>
            </ModuleSectionCard>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <ModuleSectionCard className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-neutral-800">Lovkrav — status</h3>
          <div className="space-y-3">
            <ComplianceRow
              ok={surveys.some((s) => s.status === 'active' || s.status === 'closed')}
              title="Systematisk kartlegging"
              desc="§ 3-1 (2)c — risiko og arbeidsmiljø skal kartlegges"
            />
            <ComplianceRow
              ok={surveys.some((s) => s.survey_type === 'internal' && (s.status === 'active' || s.status === 'closed'))}
              title="Psykososialt arbeidsmiljø"
              desc="§ 4-3 — krav vurderes via godkjent kartleggingsverktøy"
            />
            <ComplianceRow
              ok={surveys.some((s) => s.is_anonymous)}
              title="Anonymitet (5+ regelen)"
              desc="Resultater for grupper under 5 skjules automatisk"
            />
            <ComplianceRow
              ok={closedNoAmu.length === 0}
              title="AMU-behandling"
              desc="§ 7-2 (2)e — resultater behandles av AMU"
              warn={closedNoAmu.length > 0}
              warnText={`${closedNoAmu.length} undersøkelse(r) mangler AMU-behandling`}
            />
            <ComplianceRow
              ok={surveys.some((s) => s.survey_type === 'external')}
              title="Leverandør-dokumentasjon"
              desc="HMS-egenerklæring fra leverandører (Åpenhetsloven § 4)"
            />
          </div>
        </ModuleSectionCard>

        <ModuleSectionCard className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-neutral-800">Hurtigvalg</h3>
          <div className="space-y-2">
            <QuickAction
              label="Start ny undersøkelse"
              desc="Velg fra mal eller bygg fra bunnen"
              onClick={onNewSurvey}
            />
            <QuickAction
              label="Inviter leverandør til egenerklæring"
              desc="Send sikker lenke — ingen Klarert-konto kreves"
              onClick={() => onNewSurvey()}
            />
            {!loading && drafts.length > 0 && (
              <QuickAction
                label={`Fullfør ${drafts.length} kladd`}
                desc="Kladder som venter på publisering"
                onClick={() => navigate(`/survey/${drafts[0].id}`)}
              />
            )}
          </div>
        </ModuleSectionCard>
      </div>

      {surveys.length > 0 && (
        <ModuleSectionCard className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-neutral-800">Nylig oppdaterte</h3>
          <div className="divide-y divide-neutral-100">
            {surveys.slice(0, 5).map((s) => (
              <div
                key={s.id}
                className="flex cursor-pointer items-center gap-3 py-2.5 hover:bg-neutral-50/60"
                onClick={() => navigate(`/survey/${s.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/survey/${s.id}`)}
              >
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-neutral-900">{s.title}</span>
                  <span className="ml-2 text-xs text-neutral-400">{formatDate(s.updated_at)}</span>
                </div>
                <Badge variant={surveyStatusBadgeVariant(s.status)}>{surveyStatusLabel(s.status)}</Badge>
              </div>
            ))}
          </div>
        </ModuleSectionCard>
      )}
    </div>
  )
}

function ComplianceRow({
  ok,
  title,
  desc,
  warn = false,
  warnText,
}: {
  ok: boolean
  title: string
  desc: string
  warn?: boolean
  warnText?: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 shrink-0">
        {warn ? (
          <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
        ) : ok ? (
          <CheckCircle className="h-4 w-4 text-emerald-600" aria-hidden />
        ) : (
          <Clock className="h-4 w-4 text-neutral-400" aria-hidden />
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-neutral-800">{title}</p>
        <p className="text-xs text-neutral-500">{warnText ?? desc}</p>
      </div>
    </div>
  )
}

function QuickAction({ label, desc, onClick }: { label: string; desc: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className="h-auto w-full justify-start rounded-lg border border-neutral-200 bg-white p-3 text-left hover:border-[#1a3d32]/40 hover:bg-[#e7efe9]/40"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#e7efe9] text-[#1a3d32]">
          <Plus className="h-3.5 w-3.5" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-medium text-neutral-900">{label}</p>
          <p className="text-xs font-normal text-neutral-500">{desc}</p>
        </div>
      </div>
    </Button>
  )
}
