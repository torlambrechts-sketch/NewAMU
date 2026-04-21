import { Pencil } from 'lucide-react'
import { riskLabel, riskScoreFromProbCons } from '../../../src/components/hse/RiskMatrix'
import { Badge, type BadgeVariant } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import type { HmsCategory, InspectionChecklistItem, InspectionFindingRow, InspectionFindingSeverity, InspectionItemRow } from '../types'

const SEVERITY_LABEL: Record<InspectionFindingSeverity, string> = {
  low: 'Lav',
  medium: 'Middels',
  high: 'Høy',
  critical: 'Kritisk',
}

/** ROS-aligned table header cell (matches Phase 1 spec). */
const INSPECTION_TABLE_TH =
  'px-5 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider bg-neutral-50 border-b border-neutral-200'

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

function severityRowClass(severity: InspectionFindingSeverity): string {
  switch (severity) {
    case 'critical':
      return 'border-l-4 border-l-red-500 bg-red-50/30 hover:bg-red-50/50 border-b border-neutral-100'
    case 'high':
      return 'border-l-4 border-l-orange-400 bg-orange-50/20 hover:bg-orange-50/40 border-b border-neutral-100'
    case 'medium':
      return 'border-l-4 border-l-yellow-400 hover:bg-yellow-50 border-b border-neutral-100'
    case 'low':
      return 'border-l-4 border-l-blue-300 hover:bg-blue-50 border-b border-neutral-100'
    default:
      return 'border-b border-neutral-100 hover:bg-neutral-50/50'
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
  onEdit: (finding: InspectionFindingRow) => void
  onOpenDeviation: (deviationId: string) => void
  onCreateDeviationFromFinding: (findingId: string) => void | Promise<void>
}

export function InspectionFindingsTable({
  findings,
  checklistItems,
  roundItems,
  readOnly,
  linkingDeviationId,
  onEdit,
  onOpenDeviation,
  onCreateDeviationFromFinding,
}: InspectionFindingsTableProps) {
  const colCount = 3

  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr>
          <th className={INSPECTION_TABLE_TH}>Funn / Beskrivelse</th>
          <th className={INSPECTION_TABLE_TH}>Klassifisering</th>
          <th className={`${INSPECTION_TABLE_TH} text-right`}>Handlinger</th>
        </tr>
      </thead>
      <tbody>
        {findings.map((f) => {
          const checkpointTitle = checkpointQuestionTitle(f, roundItems, checklistItems)
          const categoryLabel = categoryLabelForFinding(f, roundItems, checklistItems)
          const riskScore = f.risk_score ?? riskScoreFromProbCons(f.risk_probability, f.risk_consequence)
          const showLegacyLinkBanner = !f.deviation_id && riskScore != null && riskScore >= 10

          return (
            <tr key={f.id} className={severityRowClass(f.severity)}>
                <td className="px-5 py-4 align-top">
                  <div className="flex flex-col space-y-1">
                    <span className="font-medium text-sm text-neutral-900">{checkpointTitle}</span>
                    <span className="text-sm text-neutral-500">{f.description}</span>
                    {riskScore != null ? (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-xs text-neutral-500">Risiko</span>
                        <Badge variant={riskScoreBadgeVariant(riskScore)}>
                          {riskScore} — {riskLabel(riskScore)}
                        </Badge>
                      </div>
                    ) : null}
                    {readOnly && f.deviation_id ? (
                      <div className="pt-2">
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
                    {showLegacyLinkBanner && (
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                        <span>Risikoskår {riskScore} — koble til avvik</span>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={linkingDeviationId === f.id}
                          onClick={async () => {
                            await onCreateDeviationFromFinding(f.id)
                          }}
                        >
                          {linkingDeviationId === f.id ? 'Oppretter…' : 'Opprett avvik'}
                        </Button>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4 align-middle">
                  <div className="flex flex-wrap items-center gap-2">
                    {categoryLabel ? <Badge variant="neutral">{categoryLabel}</Badge> : null}
                    <Badge variant={severityBadgeVariant(f.severity)}>{SEVERITY_LABEL[f.severity]}</Badge>
                  </div>
                </td>
                <td className="px-5 py-4 text-right align-middle">
                  <div className="flex justify-end">
                    {!readOnly ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(f)}
                        aria-label="Rediger avvik"
                        icon={<Pencil className="h-4 w-4" />}
                      />
                    ) : null}
                  </div>
                </td>
              </tr>
          )
        })}
        {findings.length === 0 ? (
          <tr>
            <td colSpan={colCount} className="px-5 py-10 text-center text-sm text-neutral-400">
              Ingen avvik registrert ennå.
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  )
}
