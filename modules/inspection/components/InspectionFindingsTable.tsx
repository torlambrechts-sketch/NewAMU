import { Edit2, Plus } from 'lucide-react'
import { riskLabel, riskScoreFromProbCons } from '../../../src/components/hse/RiskMatrix'
import { LayoutTable1PostingsShell } from '../../../src/components/layout/LayoutTable1PostingsShell'
import { Badge, type BadgeVariant } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import type { HmsCategory, InspectionChecklistItem, InspectionFindingRow, InspectionFindingSeverity, InspectionItemRow } from '../types'

/** Matches ROS Measures tab (`RosMeasuresTab`) table headers. */
const TH =
  'border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500'

const SEVERITY_LABEL: Record<InspectionFindingSeverity, string> = {
  low: 'Lav',
  medium: 'Middels',
  high: 'Høy',
  critical: 'Kritisk',
}

function riskScoreBadgeVariant(score: number): BadgeVariant {
  if (score <= 4) return 'success'
  if (score <= 9) return 'medium'
  if (score <= 14) return 'high'
  return 'critical'
}

function severityBadgeVariant(severity: InspectionFindingSeverity): BadgeVariant {
  switch (severity) {
    case 'low':
      return 'info'
    case 'medium':
      return 'medium'
    case 'high':
      return 'high'
    case 'critical':
      return 'critical'
    default:
      return 'neutral'
  }
}

function findingRowClass(severity: InspectionFindingSeverity): string {
  const base = 'border-b border-neutral-100 transition-colors hover:bg-neutral-50 last:border-b-0'
  switch (severity) {
    case 'critical':
      return `${base} border-l-4 border-l-red-500 bg-red-50/30`
    case 'high':
      return `${base} border-l-4 border-l-orange-400 bg-orange-50/20`
    case 'medium':
      return `${base} border-l-4 border-l-yellow-400`
    case 'low':
      return `${base} border-l-4 border-l-blue-300`
    default:
      return base
  }
}

const HMS_LABELS: Record<HmsCategory, string> = {
  fysisk: 'Fysisk arbeidsmiljø',
  ergonomi: 'Ergonomi og tilrettelegging',
  kjemikalier: 'Kjemikalier og farlige stoffer',
  psykososialt: 'Psykososialt arbeidsmiljø',
  brann: 'Brann og rømning',
  maskiner: 'Maskiner og teknisk utstyr',
  annet: 'Annet',
}

function checkpointQuestionTitle(
  finding: InspectionFindingRow,
  roundItems: InspectionItemRow[],
  checklistItems: InspectionChecklistItem[],
): string {
  if (!finding.item_id) return 'Generelt avvik'
  const row = roundItems.find((i) => i.id === finding.item_id)
  const key = row?.checklist_item_key
  if (!key) return 'Generelt avvik'
  const def = checklistItems.find((c) => c.key === key)
  return def?.label ?? row?.checklist_item_label ?? 'Generelt avvik'
}

function categoryLabelForFinding(
  finding: InspectionFindingRow,
  roundItems: InspectionItemRow[],
  checklistItems: InspectionChecklistItem[],
): string | null {
  if (!finding.item_id) return null
  const row = roundItems.find((i) => i.id === finding.item_id)
  const key = row?.checklist_item_key
  if (!key) return null
  const def = checklistItems.find((c) => c.key === key)
  const cat = def?.hmsCategory
  return cat ? HMS_LABELS[cat] : null
}

export type InspectionFindingsTableProps = {
  findings: InspectionFindingRow[]
  checklistItems: InspectionChecklistItem[]
  roundItems: InspectionItemRow[]
  readOnly: boolean
  linkingDeviationId: string | null
  onEditFinding: (finding: InspectionFindingRow) => void
  onOpenDeviation: (deviationId: string) => void
  onCreateDeviationFromFinding: (findingId: string) => void | Promise<void>
  onAddNew: () => void
}

export function InspectionFindingsTable({
  findings,
  checklistItems,
  roundItems,
  readOnly,
  linkingDeviationId,
  onEditFinding,
  onOpenDeviation,
  onCreateDeviationFromFinding,
  onAddNew,
}: InspectionFindingsTableProps) {
  const colCount = 3

  const headerActions = !readOnly ? (
    <Button type="button" variant="primary" icon={<Plus className="h-4 w-4" />} onClick={onAddNew}>
      Nytt avvik
    </Button>
  ) : null

  return (
    <LayoutTable1PostingsShell
      wrap={false}
      titleTypography="sans"
      title="Registrerte avvik"
      description="Avvik knyttet til denne inspeksjonsrunden."
      headerActions={headerActions}
      toolbar={<div className="min-w-0 flex-1" aria-hidden />}
    >
      <div className="overflow-x-auto w-full">
        <table className="w-full border-collapse text-left text-sm whitespace-nowrap">
          <thead>
            <tr>
              <th className={TH}>Funn / Beskrivelse</th>
              <th className={TH}>Klassifisering</th>
              <th className={`${TH} text-right`}>Handlinger</th>
            </tr>
          </thead>
          <tbody>
            {findings.map((f) => {
              const checkpointTitle = checkpointQuestionTitle(f, roundItems, checklistItems)
              const categoryLabel = categoryLabelForFinding(f, roundItems, checklistItems)
              const riskScore = f.risk_score ?? riskScoreFromProbCons(f.risk_probability, f.risk_consequence)
              const showLegacyLinkBanner = !f.deviation_id && riskScore != null && riskScore >= 10

              return (
                <tr key={f.id} className={findingRowClass(f.severity)}>
                  <td className="max-w-[min(28rem,40vw)] px-5 py-4 align-middle">
                    <p className="whitespace-normal font-medium text-sm text-neutral-900">{checkpointTitle}</p>
                    <p className="mt-0.5 whitespace-normal text-sm text-neutral-500">{f.description}</p>
                    {riskScore != null ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 whitespace-normal">
                        <span className="text-xs text-neutral-500">Risiko</span>
                        <Badge variant={riskScoreBadgeVariant(riskScore)}>
                          {riskScore} — {riskLabel(riskScore)}
                        </Badge>
                      </div>
                    ) : null}
                    {readOnly && f.deviation_id ? (
                      <div className="mt-2 whitespace-normal">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => onOpenDeviation(f.deviation_id!)}
                        >
                          Åpne avvik
                        </Button>
                      </div>
                    ) : null}
                    {showLegacyLinkBanner ? (
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 whitespace-normal rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                        <span>Risikoskår {riskScore} — koble til avvik</span>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={linkingDeviationId === f.id}
                          onClick={() => void onCreateDeviationFromFinding(f.id)}
                        >
                          {linkingDeviationId === f.id ? 'Oppretter…' : 'Opprett avvik'}
                        </Button>
                      </div>
                    ) : null}
                  </td>
                  <td className="px-5 py-4 align-middle">
                    <div className="flex flex-wrap items-center gap-2">
                      {categoryLabel ? <Badge variant="neutral">{categoryLabel}</Badge> : null}
                      <Badge variant={severityBadgeVariant(f.severity)}>{SEVERITY_LABEL[f.severity]}</Badge>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right align-middle">
                    {!readOnly ? (
                      <div className="inline-flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => onEditFinding(f)}
                          title="Rediger"
                          aria-label="Rediger avvik"
                        >
                          <Edit2 className="h-4 w-4 text-neutral-500" />
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              )
            })}
            {findings.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-5 py-12 text-center text-sm whitespace-normal text-neutral-400">
                  Ingen avvik registrert ennå.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </LayoutTable1PostingsShell>
  )
}
