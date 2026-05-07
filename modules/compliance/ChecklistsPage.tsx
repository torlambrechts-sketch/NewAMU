// ChecklistsPage — three-mode landing for compliance checklists.
//
//   hub        no params              — neutral landing, tile grid by pack
//                                       listing pinned (or system) templates
//   pack       ?pack=<slug>           — pack lens: KPI row, banner, all
//                                       executions for the pack
//   template   ?template=<slug>       — single-template focus: title and
//                                       CTA reflect the template; list shows
//                                       only executions of that template
//
// The URL is the source of truth for mode. URL-driven instead of
// useActivePack() so /compliance/checklists with no ?pack= renders the hub
// rather than silently defaulting to the first licensed pack.
//
// The pack switcher itself lives in the global top bar
// (ShellCompliancePackSwitcher) so it stays visible across compliance pages.

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BarChart3, ChevronRight, Plus, Settings } from 'lucide-react'
import { ModulePageShell } from '../../src/components/module/ModulePageShell'
import { ModuleLegalBanner } from '../../src/components/module/ModuleLegalBanner'
import { LayoutScoreStatRow } from '../../src/components/layout/LayoutScoreStatRow'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../src/components/layout/layoutTable1PostingsKit'
import { Button } from '../../src/components/ui/Button'
import { Badge } from '../../src/components/ui/Badge'
import { WarningBox } from '../../src/components/ui/AlertBox'
import { useLicensedPacks } from '../../src/context/packContextValue'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useChecklistModule } from './useChecklistModule'
import { ComplianceCreateForm } from './ComplianceCreateForm'
import { ChecklistsHubLanding } from './ChecklistsHubLanding'
import type { ComplianceExecutionRow, CompliancePackSlug } from './types'

const STATUS_LABEL: Record<ComplianceExecutionRow['status'], string> = {
  draft: 'Kladd',
  active: 'Aktiv',
  signed: 'Signert',
}

function statusBadgeVariant(
  status: ComplianceExecutionRow['status'],
): 'draft' | 'active' | 'signed' {
  if (status === 'signed') return 'signed'
  if (status === 'active') return 'active'
  return 'draft'
}

function formatDate(input: string | null) {
  if (!input) return '—'
  try {
    return new Date(input).toLocaleDateString('nb-NO', { dateStyle: 'short' })
  } catch {
    return input
  }
}

export function ChecklistsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const packSlugParam = searchParams.get('pack')
  const templateSlugParam = searchParams.get('template')

  const licensedPacks = useLicensedPacks()
  const { supabase } = useOrgSetupContext()
  const cl = useChecklistModule({ supabase })
  const { load, reloadAggregates } = cl
  const [createOpen, setCreateOpen] = useState(false)

  // Pack mode requires an explicit ?pack= so /compliance/checklists with no
  // params falls to the neutral hub instead of defaulting to packs[0].
  const activePack = useMemo(() => {
    if (!packSlugParam) return null
    return licensedPacks.find((p) => p.slug === (packSlugParam as CompliancePackSlug)) ?? null
  }, [licensedPacks, packSlugParam])

  // Template mode is anchored on the URL slug. We resolve against all loaded
  // templates so a deep-link like ?template=foo&pack=bar works on first
  // render even before the pack-filtered load finishes.
  const focusedTemplate = useMemo(() => {
    if (!templateSlugParam) return null
    if (activePack) {
      return (
        cl.templates.find(
          (t) => t.slug === templateSlugParam && t.pack === activePack.slug && t.is_active,
        ) ?? null
      )
    }
    return cl.templates.find((t) => t.slug === templateSlugParam && t.is_active) ?? null
  }, [cl.templates, activePack, templateSlugParam])

  const mode: 'template' | 'pack' | 'hub' = focusedTemplate
    ? 'template'
    : activePack
    ? 'pack'
    : 'hub'

  // Reload when mode/pack/template changes.
  //   hub      → load everything (no filter) so tiles see every pack.
  //   pack     → list + aggregates scoped to pack.
  //   template → list scoped to pack, but aggregates re-run with the
  //              template_id filter so the boxes below the heading
  //              reflect only this template's executions.
  // Depend on stable string ids — `focusedTemplate` is a memoised object
  // that gets a new identity on every templates reload, which would cause
  // the effect to re-fire after each `load()` and produce the bouncing
  // numbers (template-scoped → pack-scoped → template-scoped → …).
  const focusedTemplateId = focusedTemplate?.id ?? null
  const focusedTemplatePack = focusedTemplate?.pack ?? null
  const activePackSlug = activePack?.slug ?? null
  useEffect(() => {
    if (mode === 'hub') {
      void load()
    } else if (focusedTemplateId && focusedTemplatePack) {
      void (async () => {
        await load({ pack: focusedTemplatePack })
        await reloadAggregates(focusedTemplatePack, focusedTemplateId)
      })()
    } else if (activePackSlug) {
      void load({ pack: activePackSlug })
    }
  }, [load, reloadAggregates, mode, activePackSlug, focusedTemplateId, focusedTemplatePack])

  const visibleExecutions = useMemo(() => {
    if (mode === 'hub') return cl.executions
    if (focusedTemplate) {
      return cl.executions.filter(
        (e) => e.pack === focusedTemplate.pack && e.template_id === focusedTemplate.id,
      )
    }
    if (activePack) return cl.executions.filter((e) => e.pack === activePack.slug)
    return cl.executions
  }, [cl.executions, mode, activePack, focusedTemplate])

  // Templates passed to the create form: in template mode, just the focused
  // one (the slide panel preselects it); in pack mode, the pack's active
  // templates; never shown in hub mode.
  const formTemplates = useMemo(() => {
    if (focusedTemplate) return [focusedTemplate]
    if (activePack) {
      return cl.templates.filter((t) => t.pack === activePack.slug && t.is_active)
    }
    return []
  }, [cl.templates, activePack, focusedTemplate])

  if (mode === 'hub') {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'Sjekklister' }]}
        title="Sjekklister"
        description="Velg en mal eller pakke for å starte. Maler markert i menyen vises som faste valg."
        headerActions={
          <div className="flex items-center gap-2">
            <Link
              to="/compliance/checklists/analyse"
              aria-label="Analyse"
              className="inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <BarChart3 className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Analyse</span>
            </Link>
            <Link
              to="/compliance/checklists/admin"
              aria-label="Innstillinger"
              className="inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <Settings className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Innstillinger</span>
            </Link>
          </div>
        }
      >
        <div className="space-y-6">
          {cl.error ? <WarningBox>{cl.error}</WarningBox> : null}
          <ChecklistsHubLanding
            packs={licensedPacks}
            templates={cl.templates}
            loading={cl.loading}
            canManage={true}
            onOpenAdmin={() => navigate('/compliance/checklists/admin')}
          />
        </div>
      </ModulePageShell>
    )
  }

  // pack/template modes share most chrome — diverge only on copy + filtering.
  const pack = activePack!
  const pageTitle = focusedTemplate ? focusedTemplate.name : pack.pluralLabel
  const pageDescription = focusedTemplate
    ? (focusedTemplate.description ?? pack.description)
    : pack.description
  const ctaLabel = focusedTemplate
    ? `Ny ${focusedTemplate.name.toLowerCase()}`
    : pack.ctaLabel

  return (
    <ModulePageShell
      breadcrumb={
        focusedTemplate
          ? [
              { label: 'HMS' },
              { label: 'Sjekklister', to: '/compliance/checklists' },
              { label: pack.pluralLabel, to: `/compliance/checklists?pack=${pack.slug}` },
              { label: focusedTemplate.name },
            ]
          : [
              { label: 'HMS' },
              { label: 'Sjekklister', to: '/compliance/checklists' },
              { label: pack.pluralLabel },
            ]
      }
      title={pageTitle}
      description={pageDescription}
      headerActions={
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setCreateOpen(true)}
            disabled={formTemplates.length === 0}
          >
            {ctaLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {cl.error ? <WarningBox>{cl.error}</WarningBox> : null}

        {!focusedTemplate ? (
          <ModuleLegalBanner
            title={pack.shortName}
            intro={<p>{pack.description}</p>}
            references={pack.legalReferences.map((r) => ({
              code: r.code,
              text: r.text,
            }))}
          />
        ) : null}

        <LayoutScoreStatRow
          items={[
            {
              big: String(cl.aggregates.openCount),
              // Pack mode keeps the customer-tuned pack label (e.g.
              // "Åpne vernerunder"); template mode falls back to a
              // generic label so the box doesn't lie about which template
              // it represents — the sub line carries the template name.
              title: focusedTemplate ? 'Åpne kjøringer' : pack.kpiLabels.open,
              sub: focusedTemplate ? focusedTemplate.name : 'Under behandling',
            },
            {
              big: String(cl.aggregates.criticalFindings),
              title: focusedTemplate ? 'Kritiske funn' : pack.kpiLabels.critical,
              sub: 'Krever oppfølging',
            },
            {
              big: String(cl.aggregates.ytdCompleted),
              title: focusedTemplate ? 'Signert i år' : pack.kpiLabels.ytd,
              sub: focusedTemplate ? focusedTemplate.name : 'Signert i år',
            },
          ]}
        />

        <LayoutTable1PostingsShell
          wrap
          title={pageTitle}
          description={`Alle ${pageTitle.toLowerCase()} — sortert etter siste aktivitet.`}
          toolbar={null}
          footer={<span className="text-neutral-500">{visibleExecutions.length} poster</span>}
        >
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Planlagt</th>
                  <th className={`w-8 ${LAYOUT_TABLE1_POSTINGS_TH}`} />
                </tr>
              </thead>
              <tbody>
                {visibleExecutions.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="py-12 text-center">
                        <p className="text-sm text-neutral-500">
                          Ingen {pageTitle.toLowerCase()} ennå.
                        </p>
                        <div className="mt-3 inline-flex">
                          <Button
                            variant="primary"
                            icon={<Plus className="h-4 w-4" />}
                            onClick={() => setCreateOpen(true)}
                            disabled={formTemplates.length === 0}
                          >
                            {ctaLabel}
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  visibleExecutions.map((row) => (
                    <tr
                      key={row.id}
                      className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} cursor-pointer hover:bg-neutral-50`}
                      onClick={() => navigate(`/compliance/checklists/${row.id}`)}
                    >
                      <td className="px-5 py-3 font-medium text-neutral-900">{row.title}</td>
                      <td className="px-5 py-3">
                        <Badge variant={statusBadgeVariant(row.status)}>
                          {STATUS_LABEL[row.status]}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-neutral-600">
                        {formatDate(row.scheduled_for)}
                      </td>
                      <td className="w-8 px-3 py-3 text-neutral-300">
                        <ChevronRight className="h-4 w-4" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </LayoutTable1PostingsShell>
      </div>

      <ComplianceCreateForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        templates={formTemplates}
        assignableUsers={cl.assignableUsers}
        onCreate={async (payload) => {
          const id = await cl.createExecution(payload)
          if (id) {
            setCreateOpen(false)
            navigate(`/compliance/checklists/${id}`)
          }
        }}
      />
    </ModulePageShell>
  )
}
