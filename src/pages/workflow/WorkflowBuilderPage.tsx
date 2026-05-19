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

import { useCallback, useMemo, useState } from 'react'
import {
  Activity,
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
import { useSearchParams } from 'react-router-dom'
import { ModulePageShell } from '../../components/module/ModulePageShell'
import { ModuleLegalBanner } from '../../components/module/ModuleLegalBanner'
import { LayoutScoreStatRow } from '../../components/layout/LayoutScoreStatRow'
import type { LayoutScoreStatItem } from '../../components/layout/platformLayoutKit'
import { Tabs } from '../../components/ui/Tabs'
import { Button } from '../../components/ui/Button'
import '../../lib/workflows/registerScopes'
import { RulesPanel } from '../../components/workflow/rules/RulesPanel'
import { NewRulePanel } from '../../components/workflow/rules/NewRulePanel'
import { SystemRulesPanel } from '../../components/workflow/system/SystemRulesPanel'
import { LibraryPanel } from '../../components/workflow/library/LibraryPanel'
import { RunHistoryPanel } from '../../components/workflow/runs/RunHistoryPanel'
import { DryRunPanel } from '../../components/workflow/dryRun/DryRunPanel'
import { RevisionHistoryPanel } from '../../components/workflow/audit/RevisionHistoryPanel'
import { ApprovalsPanel } from '../../components/workflow/approvals/ApprovalsPanel'
import { EvidenceExportPanel } from '../../components/workflow/evidence/EvidenceExportPanel'
import { CanvasPanel } from '../../components/workflow/canvas/CanvasPanel'
import { HealthPanel } from '../../components/workflow/health/HealthPanel'
import { WorkflowEditorShell } from '../../components/workflow/editor/WorkflowEditorShell'
import { useWorkflows } from '../../hooks/useWorkflows'
import { useWorkflowApprovals } from '../../hooks/useWorkflowApprovals'
import { useT } from '../../hooks/useT'

type Tab =
  | 'rules'
  | 'system'
  | 'library'
  | 'health'
  | 'canvas'
  | 'approvals'
  | 'runs'
  | 'dry-run'
  | 'evidence'
  | 'revisions'

// First element doubles as default landing tab when ?tab= is absent.
// Helsesjekk slots between `library` (default landing) and `rules` so
// users always have the operational view one click away from where they
// land. Library remains the default — Helsesjekk is opt-in via the tab.
const VALID_TABS: Tab[] = [
  'library',
  'health',
  'rules',
  'system',
  'canvas',
  'approvals',
  'runs',
  'dry-run',
  'evidence',
  'revisions',
]

export function WorkflowBuilderPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as Tab | null
  // Library is the default landing tab. We honor ?tab= when present and
  // valid; the empty-state nudge for orgs with no rules is handled below
  // via an effect that only fires while ?tab= is still absent.
  const tab: Tab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'library'
  const setTab = useCallback(
    (next: Tab) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          // Keep the canonical URL clean: omit the param when it matches
          // the default landing tab.
          if (next === 'library') params.delete('tab')
          else params.set('tab', next)
          return params
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )
  const focusedRuleId = searchParams.get('rule')
  // Combined updater so deep-link handlers don't race two setSearchParams
  // calls in the same handler (each navigate() reads from the same render
  // closure, so the second one would clobber the first).
  const focusRuleAndTab = useCallback(
    (ruleId: string | null, nextTab: Tab) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          if (ruleId) params.set('rule', ruleId)
          else params.delete('rule')
          if (nextTab === 'library') params.delete('tab')
          else params.set('tab', nextTab)
          return params
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )
  const [newRuleOpen, setNewRuleOpen] = useState(false)
  const [editor, setEditor] = useState<{ ruleId: string; mode: 'drawer' | 'fullscreen' } | null>(null)
  const openEditor = useCallback(
    (ruleId: string) => setEditor({ ruleId, mode: 'drawer' }),
    [],
  )
  const { rules, runs } = useWorkflows()
  const { approvals } = useWorkflowApprovals()
  const { t } = useT()

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
      {
        big: String(active),
        title: t('workflow.stats.activeRules'),
        sub: t('workflow.stats.activeRulesSub', { count: rules.length }),
      },
      {
        big: String(pendingApprovals),
        title: t('workflow.stats.pendingApprovals'),
        sub:
          pendingApprovals === 0
            ? t('workflow.stats.pendingApprovalsNone')
            : t('workflow.stats.pendingApprovalsSome'),
      },
      {
        big: String(govRules),
        title: t('workflow.stats.govSubmissions'),
        sub: t('workflow.stats.govSubmissionsSub'),
      },
      {
        big: String(last7d),
        title: t('workflow.stats.runs7d'),
        sub:
          runs.length === 0
            ? t('workflow.stats.runs7dNone')
            : t('workflow.stats.runs7dSome'),
      },
    ]
  }, [rules, runs, approvals, t])

  const tabItems = useMemo(
    () => [
      // Bibliotek is the default landing tab — listed first so the
      // visible Tabs ordering matches the URL-default behaviour.
      { id: 'library' as const, label: t('workflow.tabs.library'), icon: BookOpen },
      { id: 'health' as const, label: t('workflow.tabs.health'), icon: Activity },
      { id: 'rules' as const, label: t('workflow.tabs.rules'), icon: ListChecks, badgeCount: rules.length },
      { id: 'system' as const, label: t('workflow.tabs.system'), icon: Landmark },
      { id: 'canvas' as const, label: t('workflow.tabs.canvas'), icon: Workflow },
      {
        id: 'approvals' as const,
        label: t('workflow.tabs.approvals'),
        icon: CheckCheck,
        badgeCount: approvals.filter((a) => a.status === 'pending').length,
        badgeVariant: 'danger' as const,
      },
      { id: 'runs' as const, label: t('workflow.tabs.runs'), icon: ClipboardList },
      { id: 'dry-run' as const, label: t('workflow.tabs.dryRun'), icon: PlayCircle },
      { id: 'evidence' as const, label: t('workflow.tabs.evidence'), icon: ShieldCheck },
      { id: 'revisions' as const, label: t('workflow.tabs.revisions'), icon: ScrollText },
    ],
    [approvals, rules.length, t],
  )

  return (
    <ModulePageShell
      breadcrumb={[{ label: t('workflow.breadcrumbAdmin') }, { label: t('workflow.title') }]}
      title={t('workflow.title')}
      description={t('workflow.description')}
      tabs={<Tabs items={tabItems} activeId={tab} onChange={(id) => setTab(id as Tab)} overflow="scroll" />}
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setNewRuleOpen(true)}
          >
            {t('workflow.newRule')}
          </Button>
        </div>
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
            onEdit={openEditor}
            onViewRuns={(id) => focusRuleAndTab(id, 'runs')}
            onViewRevisions={(id) => focusRuleAndTab(id, 'revisions')}
          />
        )}
        {tab === 'system' && <SystemRulesPanel />}
        {tab === 'library' && (
          <LibraryPanel
            onInstalled={(ruleId) => focusRuleAndTab(ruleId, 'canvas')}
          />
        )}
        {tab === 'health' && <HealthPanel />}
        {tab === 'canvas' && <CanvasPanel initialRuleId={focusedRuleId} />}
        {tab === 'approvals' && <ApprovalsPanel />}
        {tab === 'runs' && <RunHistoryPanel ruleId={focusedRuleId ?? undefined} />}
        {tab === 'dry-run' && <DryRunPanel />}
        {tab === 'evidence' && <EvidenceExportPanel />}
        {tab === 'revisions' && <RevisionHistoryPanel initialRuleId={focusedRuleId} />}
      </div>
      <NewRulePanel
        open={newRuleOpen}
        onClose={() => setNewRuleOpen(false)}
        onCreated={(slugOrId) => {
          openEditor(slugOrId)
        }}
      />
      <WorkflowEditorShell
        open={!!editor}
        ruleId={editor?.ruleId ?? null}
        mode={editor?.mode ?? 'drawer'}
        onClose={() => setEditor(null)}
        onChangeMode={(next) => setEditor((prev) => (prev ? { ...prev, mode: next } : prev))}
        onOpenAdvanced={(id) => {
          setEditor(null)
          focusRuleAndTab(id, 'canvas')
        }}
      />
    </ModulePageShell>
  )
}

export default WorkflowBuilderPage
