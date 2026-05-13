// WorkflowBuilderPage — Automatisering hub, layout mirroring
// /meetings (MeetingsHubView):
//   * ModuleLegalBanner with AML + IK-f references
//   * LayoutScoreStatRow KPI strip across the top
//   * Tabs primitive (canonical Tabs component)
//   * ModulePageShell with breadcrumb / title / description / tabs / headerActions
//
// Tabs host the substrate panels (Library / Canvas / Approvals / Runs /
// Dry-run / Evidence / Revisions). Each panel is unchanged from the
// previous commit — only the shell + nav was reworked to match the
// MeetingsHubPage / MeetingsHubView pattern so the chrome stays
// consistent across modules.

import { useMemo, useState } from 'react'
import {
  BookOpen,
  CheckCheck,
  ClipboardList,
  Landmark,
  ListChecks,
  PlayCircle,
  Plus,
  ScrollText,
  ShieldCheck,
  Workflow,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ModulePageShell } from '../../components/module/ModulePageShell'
import { ModuleLegalBanner } from '../../components/module/ModuleLegalBanner'
import { LayoutScoreStatRow } from '../../components/layout/LayoutScoreStatRow'
import type { LayoutScoreStatItem } from '../../components/layout/platformLayoutKit'
import { Tabs } from '../../components/ui/Tabs'
import { Button } from '../../components/ui/Button'
import '../../lib/workflows/registerScopes'
import { RulesPanel } from '../../components/workflow/rules/RulesPanel'
import { SystemRulesPanel } from '../../components/workflow/system/SystemRulesPanel'
import { LibraryPanel } from '../../components/workflow/library/LibraryPanel'
import { RunHistoryPanel } from '../../components/workflow/runs/RunHistoryPanel'
import { DryRunPanel } from '../../components/workflow/dryRun/DryRunPanel'
import { RevisionHistoryPanel } from '../../components/workflow/audit/RevisionHistoryPanel'
import { ApprovalsPanel } from '../../components/workflow/approvals/ApprovalsPanel'
import { EvidenceExportPanel } from '../../components/workflow/evidence/EvidenceExportPanel'
import { CanvasPanel } from '../../components/workflow/canvas/CanvasPanel'
import { useWorkflows } from '../../hooks/useWorkflows'
import { useWorkflowApprovals } from '../../hooks/useWorkflowApprovals'

type Tab = 'rules' | 'system' | 'library' | 'canvas' | 'approvals' | 'runs' | 'dry-run' | 'evidence' | 'revisions'

export function WorkflowBuilderPage() {
  const [tab, setTab] = useState<Tab>('rules')
  const [focusedRuleId, setFocusedRuleId] = useState<string | null>(null)
  const navigate = useNavigate()
  const { rules, runs } = useWorkflows()
  const { approvals } = useWorkflowApprovals()

  const stats = useMemo<LayoutScoreStatItem[]>(() => {
    const active = rules.filter((r) => r.is_active).length
    const pendingApprovals = approvals.filter((a) => a.status === 'pending').length
    const govRules = rules.filter((r) => {
      const json = JSON.stringify(r.actions_json ?? {})
      return /(rapporter_alvorlig_skade_arbeidstilsynet|meld_personvernbrudd_datatilsynet|altinn_send_melding|nav_sykefravar_oppfolging|varsel_ldo_export)/.test(
        json,
      )
    }).length
    const last7d = runs.filter(
      (r) => new Date(r.created_at).getTime() > Date.now() - 7 * 86400_000,
    ).length
    return [
      { big: String(active), title: 'Aktive regler', sub: `${rules.length} totalt i organisasjonen` },
      { big: String(pendingApprovals), title: 'Venter på godkjenning', sub: pendingApprovals === 0 ? 'Ingen utestående' : 'Krever beslutning' },
      { big: String(govRules), title: 'Statlige meldinger', sub: 'Regler som rapporterer til myndighet' },
      { big: String(last7d), title: 'Kjøringer siste 7 dager', sub: runs.length === 0 ? 'Ingen kjøringer ennå' : 'Tellig av workflow_runs' },
    ]
  }, [rules, runs, approvals])

  const tabItems = useMemo(
    () => [
      { id: 'rules' as const, label: 'Mine arbeidsflyter', icon: ListChecks, badgeCount: rules.length },
      { id: 'system' as const, label: 'System', icon: Landmark },
      { id: 'library' as const, label: 'Mal-bibliotek', icon: BookOpen },
      { id: 'canvas' as const, label: 'Bygg', icon: Workflow },
      {
        id: 'approvals' as const,
        label: 'Godkjenninger',
        icon: CheckCheck,
        badgeCount: approvals.filter((a) => a.status === 'pending').length,
        badgeVariant: 'danger' as const,
      },
      { id: 'runs' as const, label: 'Kjøringer', icon: ClipboardList },
      { id: 'dry-run' as const, label: 'Dry-run', icon: PlayCircle },
      { id: 'evidence' as const, label: 'Bevispakke', icon: ShieldCheck },
      { id: 'revisions' as const, label: 'Endringslogg', icon: ScrollText },
    ],
    [approvals, rules.length],
  )

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'Admin' }, { label: 'Automatisering' }]}
      title="Automatisering"
      description="Forhåndsdefinert mal-bibliotek, visuell flyt-bygger, godkjenningsinnboks, kjøringshistorikk, dry-run og bevispakke for tilsyn — drevet av den nye arbeidsflyt-substraten."
      tabs={<Tabs items={tabItems} activeId={tab} onChange={(id) => setTab(id as Tab)} overflow="scroll" />}
      headerActions={
        <Button
          type="button"
          variant="secondary"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => navigate('/workflow/klassisk')}
        >
          Klassisk visning
        </Button>
      }
    >
      <div className="space-y-5">
        <ModuleLegalBanner
          eyebrow="Regelverk"
          title="Automatiserte rutiner som dokumenterer compliance"
          intro="Reglene som kjører her implementerer plikter etter arbeidsmiljøloven, internkontrollforskriften og personvernforordningen. Hver kjøring lagres med sjekksum og kan eksporteres som signert bevispakke."
          references={[
            {
              code: 'AML § 3-1',
              text: 'Systematisk HMS-arbeid skal være dokumentert. Hver utløste regel logges automatisk med innhold, tidspunkt og signatur-hash.',
            },
            {
              code: 'AML § 5-2',
              text: 'Alvorlig personskade skal meldes Arbeidstilsynet innen 24 timer. Regler i «gov»-scopet kjører meldingen via Maskinporten med dobbel godkjenning før innsending.',
            },
            {
              code: 'IK-f § 5 nr. 7 og 8',
              text: 'Overvåking av tiltak og årlig gjennomgang. workflow_runs + workflow_run_evidence er Merkle-kjedet og uforanderlig etter 30 dager.',
            },
            {
              code: 'GDPR Art. 33',
              text: 'Personvernbrudd skal meldes Datatilsynet innen 72 timer fra det blir kjent. 72-timersløpet starter ved «aware_at» og påminnelse genereres ved T-24t, T-4t, T-1t.',
            },
          ]}
        />

        <LayoutScoreStatRow items={stats} columns={4} />

        {tab === 'rules' && (
          <RulesPanel
            onEdit={(id) => {
              setFocusedRuleId(id)
              setTab('canvas')
            }}
            onViewRuns={(id) => {
              setFocusedRuleId(id)
              setTab('runs')
            }}
            onViewRevisions={(id) => {
              setFocusedRuleId(id)
              setTab('revisions')
            }}
          />
        )}
        {tab === 'system' && <SystemRulesPanel />}
        {tab === 'library' && (
          <LibraryPanel
            onInstalled={(ruleId) => {
              setFocusedRuleId(ruleId)
              setTab('canvas')
            }}
          />
        )}
        {tab === 'canvas' && <CanvasPanel initialRuleId={focusedRuleId} />}
        {tab === 'approvals' && <ApprovalsPanel />}
        {tab === 'runs' && <RunHistoryPanel ruleId={focusedRuleId ?? undefined} />}
        {tab === 'dry-run' && <DryRunPanel />}
        {tab === 'evidence' && <EvidenceExportPanel />}
        {tab === 'revisions' && <RevisionHistoryPanel initialRuleId={focusedRuleId} />}
      </div>
    </ModulePageShell>
  )
}

export default WorkflowBuilderPage
