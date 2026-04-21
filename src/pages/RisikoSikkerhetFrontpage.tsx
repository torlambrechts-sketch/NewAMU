import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ClipboardCheck,
  ClipboardList,
  ShieldAlert,
} from 'lucide-react'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { useRos } from '../../modules/ros/useRos'
import { useInspectionModule } from '../../modules/inspection/useInspectionModule'
import { useVernerunde } from '../../modules/vernerunder/useVernerunde'
import { useSja } from '../../modules/sja/useSja'
import { LayoutScoreStatRow } from '../components/layout/LayoutScoreStatRow'
import { InfoBox } from '../components/ui/AlertBox'
import {
  ModuleFrontpageShell,
  ModuleShortcutGrid,
  type ModuleShortcutItem,
} from '../components/module'
import {
  INSIGHT_CARD,
  INSIGHT_CARD_TOP_RULE,
  ModuleDonutCard,
  type InsightSeg,
} from '../components/insights/ModuleInsightCharts'

const SEVERITY_COLORS = {
  critical: '#dc2626',
  high: '#f97316',
  medium: '#eab308',
  low: '#2563eb',
  neutral: '#94a3b8',
} as const

const STATUS_COLORS = {
  draft: '#94a3b8',
  active: '#2563eb',
  signed: '#16a34a',
  completed: '#0f766e',
  approved: '#16a34a',
  in_progress: '#ca8a04',
  open: '#f97316',
  cancelled: '#475569',
} as const

/**
 * Frontpage / dashboard for the **Risiko & Sikkerhet** nav group.
 *
 * Composition:
 *   1. ModuleFrontpageShell   — page chrome, breadcrumb, title, tabs slot
 *   2. ModuleLegalBanner      — IK-forskriften § 5 nr. 6 + AML § 3-1
 *   3. LayoutScoreStatRow     — 4 top-level KPI tiles (åpne saker, kritiske, osv.)
 *   4. Donut/list chart grid  — same visual grammar as klarert.com layout rapportering
 *   5. ModuleShortcutGrid     — navigation cards to SJA, ROS, Vernerunder, Inspeksjon
 *   6. InfoBox guidance       — "slik bruker du dette"
 *
 * Data sources (all domain hooks already in the repo):
 *   - useRos         → ROS-analyser + critical hazards
 *   - useInspectionModule → Inspeksjonsrunder + findings per round
 *   - useVernerunde  → Vernerunder
 *   - useSja         → SJA
 */
export function RisikoSikkerhetFrontpage() {
  const { supabase } = useOrgSetupContext()
  const ros = useRos({ supabase })
  const inspection = useInspectionModule({ supabase })
  const vernerunde = useVernerunde()
  const sja = useSja({ supabase })

  // Trigger initial load once for inspection (the other hooks auto-load).
  useEffect(() => {
    void inspection.load()
  }, [inspection])

  // ── Top KPI strip ──────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const openRos = ros.analyses.filter((a) => a.status === 'draft' || a.status === 'in_review').length
    const openInspections = inspection.rounds.filter((r) => r.status !== 'signed').length
    const openVernerunder = vernerunde.vernerunder.filter((v) => v.status !== 'signed').length
    const openSja = sja.analyses.filter((a) => a.status !== 'completed' && a.status !== 'archived').length

    // Critical findings aggregate from inspection + ROS.
    let criticalFindings = 0
    for (const round of inspection.rounds) {
      const findings = inspection.findingsByRoundId[round.id] ?? []
      criticalFindings += findings.filter((f) => f.severity === 'critical').length
    }
    const criticalHazards = ros.criticalHazardCount ?? 0

    const total = openRos + openInspections + openVernerunder + openSja
    return {
      open: total,
      criticalFindings,
      criticalHazards,
      signedThisYear:
        ros.analyses.filter((a) => a.status === 'approved').length +
        inspection.rounds.filter((r) => r.status === 'signed').length +
        vernerunde.vernerunder.filter((v) => v.status === 'signed').length,
    }
  }, [
    ros.analyses,
    ros.criticalHazardCount,
    inspection.rounds,
    inspection.findingsByRoundId,
    vernerunde.vernerunder,
    sja.analyses,
  ])

  // ── Donut: aktiviteter per modul ──────────────────────────────────────────
  const modulesMix: InsightSeg[] = useMemo(() => {
    return [
      { label: 'SJA', value: sja.analyses.length, color: '#1a3d32' },
      { label: 'ROS-analyser', value: ros.analyses.length, color: '#2563eb' },
      { label: 'Vernerunder', value: vernerunde.vernerunder.length, color: '#ca8a04' },
      { label: 'Inspeksjonsrunder', value: inspection.rounds.length, color: '#7c3aed' },
    ]
  }, [sja.analyses.length, ros.analyses.length, vernerunde.vernerunder.length, inspection.rounds.length])
  const modulesTotal = modulesMix.reduce((a, s) => a + s.value, 0)

  // ── Donut: status for inspeksjonsrunder ────────────────────────────────────
  const inspectionStatus: InsightSeg[] = useMemo(() => {
    let draft = 0
    let active = 0
    let signed = 0
    for (const r of inspection.rounds) {
      if (r.status === 'draft') draft++
      else if (r.status === 'active') active++
      else if (r.status === 'signed') signed++
    }
    return [
      { label: 'Kladd', value: draft, color: STATUS_COLORS.draft },
      { label: 'Aktiv', value: active, color: STATUS_COLORS.active },
      { label: 'Signert', value: signed, color: STATUS_COLORS.signed },
    ].filter((s) => s.value > 0)
  }, [inspection.rounds])
  const inspectionTotal = inspectionStatus.reduce((a, s) => a + s.value, 0)

  // ── Donut: risikoer per alvorlighetsgrad (inspeksjonsfunn) ─────────────────
  const findingSeverity: InsightSeg[] = useMemo(() => {
    let critical = 0
    let high = 0
    let medium = 0
    let low = 0
    for (const round of inspection.rounds) {
      const findings = inspection.findingsByRoundId[round.id] ?? []
      for (const f of findings) {
        if (f.severity === 'critical') critical++
        else if (f.severity === 'high') high++
        else if (f.severity === 'medium') medium++
        else if (f.severity === 'low') low++
      }
    }
    return [
      { label: 'Kritisk', value: critical, color: SEVERITY_COLORS.critical },
      { label: 'Høy', value: high, color: SEVERITY_COLORS.high },
      { label: 'Middels', value: medium, color: SEVERITY_COLORS.medium },
      { label: 'Lav', value: low, color: SEVERITY_COLORS.low },
    ].filter((s) => s.value > 0)
  }, [inspection.rounds, inspection.findingsByRoundId])
  const findingTotal = findingSeverity.reduce((a, s) => a + s.value, 0)

  // ── Donut: ROS-analyser per status ─────────────────────────────────────────
  const rosStatus: InsightSeg[] = useMemo(() => {
    let draft = 0
    let inReview = 0
    let approved = 0
    let archived = 0
    for (const a of ros.analyses) {
      if (a.status === 'draft') draft++
      else if (a.status === 'in_review') inReview++
      else if (a.status === 'approved') approved++
      else if (a.status === 'archived') archived++
    }
    return [
      { label: 'Kladd', value: draft, color: STATUS_COLORS.draft },
      { label: 'Til gjennomgang', value: inReview, color: STATUS_COLORS.in_progress },
      { label: 'Godkjent', value: approved, color: STATUS_COLORS.approved },
      { label: 'Arkivert', value: archived, color: STATUS_COLORS.cancelled },
    ].filter((s) => s.value > 0)
  }, [ros.analyses])
  const rosTotal = rosStatus.reduce((a, s) => a + s.value, 0)

  // ── Shortcut cards ─────────────────────────────────────────────────────────
  const shortcuts: ModuleShortcutItem[] = [
    {
      to: '/sja',
      label: 'Sikker jobbanalyse (SJA)',
      description: 'Risikovurdering av spesifikke arbeidsoperasjoner før oppstart.',
      icon: ShieldAlert,
      badge: sja.analyses.length > 0 ? `${sja.analyses.length} analyser` : undefined,
    },
    {
      to: '/ros',
      label: 'ROS-analyser',
      description: 'Systematisk risikovurdering på tvers av AML, BVL, ETL, FL og PKL.',
      icon: ShieldAlert,
      badge: ros.analyses.length > 0 ? `${ros.analyses.length} analyser` : undefined,
    },
    {
      to: '/vernerunder',
      label: 'Vernerunder',
      description: 'Planlegg og signer vernerunder etter Internkontrollforskriften § 5.',
      icon: ClipboardCheck,
      badge: vernerunde.vernerunder.length > 0 ? `${vernerunde.vernerunder.length} runder` : undefined,
    },
    {
      to: '/inspection-module',
      label: 'Inspeksjonsrunder',
      description: 'Strukturerte sjekkliste-runder med avvikshåndtering og dobbel signering.',
      icon: ClipboardList,
      badge: inspection.rounds.length > 0 ? `${inspection.rounds.length} runder` : undefined,
    },
  ]

  return (
    <ModuleFrontpageShell
      breadcrumb={[{ label: 'HMS' }, { label: 'Risiko & Sikkerhet' }]}
      title="Risiko & Sikkerhet"
      description="Systematisk risikostyring — fra kartlegging (ROS), via jobbanalyse (SJA), til vernerunder og inspeksjonsrunder med signert dokumentasjon."
      legal={{
        eyebrow: 'Lovgrunnlag',
        title: 'Risiko & Sikkerhet',
        intro: (
          <>
            Alle modulene i denne gruppen dekker virksomhetens plikt til å kartlegge farer, vurdere risiko og
            utarbeide tiltak. Dokumentasjon er krav etter Internkontrollforskriften og arbeidsmiljøloven.
          </>
        ),
        references: [
          {
            code: 'IK-forskriften § 5 nr. 6',
            text: (
              <>
                Virksomheten skal kartlegge farer og problemer og på denne bakgrunn vurdere risiko, samt
                utarbeide tilhørende planer og tiltak for å redusere risikoforholdene.
              </>
            ),
          },
          {
            code: 'AML § 3-1 andre ledd',
            text: (
              <>
                Systematisk HMS-arbeid skal sikre at farer identifiseres og at tiltak iverksettes. Kravene gjelder
                AML, Brann- og eksplosjonsvernloven, El-tilsynsloven, Forurensningsloven og Produktkontrolloven.
              </>
            ),
          },
          {
            code: 'AML § 3-2',
            text: (
              <>
                Særlig risikofylte arbeidsoperasjoner skal ha skriftlig vurdering (SJA) før de iverksettes.
              </>
            ),
          },
        ],
      }}
      overview={
        <LayoutScoreStatRow
          items={[
            { big: String(kpi.open), title: 'Åpne saker', sub: 'SJA + ROS + Vernerunder + Inspeksjoner' },
            { big: String(kpi.criticalHazards), title: 'Kritiske farekilder', sub: 'Residual risiko ≥ 15 i ROS' },
            { big: String(kpi.criticalFindings), title: 'Kritiske avvik', sub: 'Fra pågående inspeksjonsrunder' },
            { big: String(kpi.signedThisYear), title: 'Signert i år', sub: 'Ferdigstilt dokumentasjon' },
          ]}
        />
      }
      dashboardTitle="Status og nøkkeltall"
      dashboardDescription="Samme diagramspråk som på plattform-admin/layout rapportering. Klikk deg videre til en modul for detaljer."
      dashboard={
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ModuleDonutCard
            title="Aktiviteter per modul"
            subtitle="Hvor mange saker er registrert i hver av modulene i denne gruppen."
            segments={modulesMix}
            total={modulesTotal}
            emptyHint="Ingen registrerte aktiviteter ennå."
          />
          <ModuleDonutCard
            title="Inspeksjonsrunder — status"
            subtitle="Fordeling av alle inspeksjonsrunder etter status."
            segments={inspectionStatus}
            total={inspectionTotal}
            emptyHint="Ingen inspeksjonsrunder registrert."
          />
          <ModuleDonutCard
            title="Avvik — alvorlighetsgrad"
            subtitle="Fordeling av inspeksjonsfunn etter alvorlighetsgrad."
            segments={findingSeverity}
            total={findingTotal}
            emptyHint="Ingen registrerte avvik."
          />
          <ModuleDonutCard
            title="ROS-analyser — status"
            subtitle="Fordeling av ROS-analyser etter status i livsløpet."
            segments={rosStatus}
            total={rosTotal}
            emptyHint="Ingen ROS-analyser registrert."
          />
          <div className={`${INSIGHT_CARD} lg:col-span-2`}>
            <div className={INSIGHT_CARD_TOP_RULE} />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Se mer i full rapportering
                </p>
                <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                  Åpne full rapporteringsmodul for å bygge egne dashboard med flere diagram og tabeller.
                </p>
              </div>
              <Link
                to="/reports"
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50"
              >
                Åpne rapporter <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      }
      shortcutsTitle="Moduler i gruppen"
      shortcutsDescription="Direktesnarveier til hver modul i Risiko & Sikkerhet."
      shortcuts={<ModuleShortcutGrid items={shortcuts} columns={4} />}
      guidanceTitle="Slik bruker du Risiko & Sikkerhet"
      guidance={
        <div className="space-y-4">
          <InfoBox>
            <p className="font-semibold">Anbefalt arbeidsflyt</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
              <li>
                Start med <strong>ROS-analyse</strong> for aktiviteter og områder — dokumenter farekilder, risikoskår og
                tiltak.
              </li>
              <li>
                Kjør <strong>SJA</strong> før enkeltoperasjoner som er særlig risikofylte (AML § 3-2).
              </li>
              <li>
                Gjennomfør <strong>vernerunder</strong> og <strong>inspeksjonsrunder</strong> jevnlig — avvik overføres
                automatisk til avviksmodulen og handlingsplanen.
              </li>
              <li>
                Signert dokumentasjon arkiveres etter Internkontrollforskriften. Oppbevaringsplikt minimum 10 år.
              </li>
            </ol>
          </InfoBox>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className={INSIGHT_CARD}>
              <div className={INSIGHT_CARD_TOP_RULE} />
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Når skal du bruke hva?
              </p>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="font-semibold text-neutral-900">SJA</dt>
                  <dd className="text-neutral-600">
                    Én konkret arbeidsoperasjon, ofte kortvarig. Fokus på «hva skal vi gjøre nå?».
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-neutral-900">ROS-analyse</dt>
                  <dd className="text-neutral-600">Systemisk risikovurdering av prosesser, avdelinger eller områder.</dd>
                </div>
                <div>
                  <dt className="font-semibold text-neutral-900">Vernerunde</dt>
                  <dd className="text-neutral-600">
                    Periodisk runde med verneombud — forskriftsbasert protokoll og dobbel signatur.
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-neutral-900">Inspeksjonsrunde</dt>
                  <dd className="text-neutral-600">
                    Strukturerte sjekkliste-runder for å avdekke avvik og registrere tiltak.
                  </dd>
                </div>
              </dl>
            </div>
            <div className={INSIGHT_CARD}>
              <div className={INSIGHT_CARD_TOP_RULE} />
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Koblinger til andre moduler
              </p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-700">
                <li>
                  <strong>Avvik</strong> fra inspeksjonsrunder kan løftes direkte til{' '}
                  <Link to="/avvik" className="text-[#1a3d32] underline">
                    avviksmodulen
                  </Link>{' '}
                  for videre oppfølging.
                </li>
                <li>
                  <strong>Tiltak</strong> fra ROS-analyser og SJA overføres til{' '}
                  <Link to="/tiltak" className="text-[#1a3d32] underline">
                    Tiltaksplan
                  </Link>
                  .
                </li>
                <li>
                  Signerte dokumenter arkiveres og vises i{' '}
                  <Link to="/documents" className="text-[#1a3d32] underline">
                    Dokumentasjon
                  </Link>
                  .
                </li>
              </ul>
            </div>
          </div>
        </div>
      }
    />
  )
}
