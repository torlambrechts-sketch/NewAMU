import type { ReactNode } from 'react'
import { Fragment } from 'react'
import { Ghost, Pencil, Trash2 } from 'lucide-react'
import { LayoutTable1PostingsShell } from '../../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../../src/components/layout/layoutTable1PostingsKit'
import { Badge, type BadgeVariant } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import type { InspectionFindingRow, InspectionFindingSeverity } from '../types'

const SEVERITY_LABEL: Record<InspectionFindingSeverity, string> = {
  low: 'Lav',
  medium: 'Middels',
  high: 'Høy',
  critical: 'Kritisk',
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
  const base = `${LAYOUT_TABLE1_POSTINGS_BODY_ROW} border-l-4`
  switch (severity) {
    case 'critical':
      return `${base} border-l-red-500 bg-red-50/30 hover:bg-red-50/50`
    case 'high':
      return `${base} border-l-orange-400 bg-orange-50/20 hover:bg-orange-50/40`
    case 'medium':
      return `${base} border-l-yellow-400 hover:bg-yellow-50`
    case 'low':
    default:
      return `${base} border-l-blue-300 hover:bg-blue-50`
  }
}

export type InspectionFindingsTableProps = {
  findings: InspectionFindingRow[]
  /** Label for Kategori column (e.g. HMS category or "—"). */
  getCategoryLabel: (finding: InspectionFindingRow) => string
  readOnly: boolean
  onEditFinding: (finding: InspectionFindingRow) => void
  onDeleteFinding?: (findingId: string) => void
  onOpenDeviation?: (deviationId: string) => void
  /** High-risk legacy flow: show banner row + create button */
  showLegacyDeviationBanner?: (finding: InspectionFindingRow) => boolean
  onCreateDeviationFromFinding?: (findingId: string) => void | Promise<void>
  linkingDeviationId?: string | null
  /** Optional lines under the main description (e.g. risk badges, linked checklist). */
  extraDescription?: (finding: InspectionFindingRow) => ReactNode
}

export function InspectionFindingsTable({
  findings,
  getCategoryLabel,
  readOnly,
  onEditFinding,
  onDeleteFinding,
  onOpenDeviation,
  showLegacyDeviationBanner,
  onCreateDeviationFromFinding,
  linkingDeviationId,
  extraDescription,
}: InspectionFindingsTableProps) {
  const colCount = 4

  return (
    <LayoutTable1PostingsShell
      wrap={false}
      titleTypography="sans"
      title="Registrerte avvik"
      toolbar={<span className="text-sm text-neutral-500">Oversikt over avvik knyttet til runden</span>}
    >
      <table className="w-full min-w-0 border-collapse text-left text-sm">
        <thead>
          <tr className={`${LAYOUT_TABLE1_POSTINGS_HEADER_ROW} bg-neutral-50`}>
            <th className={LAYOUT_TABLE1_POSTINGS_TH}>Alvorlighetsgrad</th>
            <th className={LAYOUT_TABLE1_POSTINGS_TH}>Kategori</th>
            <th className={LAYOUT_TABLE1_POSTINGS_TH}>Beskrivelse</th>
            <th className={`${LAYOUT_TABLE1_POSTINGS_TH} w-48`}>Handlinger</th>
          </tr>
        </thead>
        <tbody>
          {findings.length === 0 ? (
            <tr className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
              <td className="px-5 py-12 text-center align-middle" colSpan={colCount}>
                <div className="flex flex-col items-center justify-center gap-2 text-neutral-500">
                  <Ghost className="h-10 w-10 text-neutral-300" aria-hidden />
                  <p className="text-sm font-medium text-neutral-600">Ingen avvik registrert</p>
                  <p className="max-w-sm text-xs text-neutral-500">Når avvik registreres, vises de her med alvorlighetsgrad.</p>
                </div>
              </td>
            </tr>
          ) : (
            findings.map((f) => {
              const showBanner = showLegacyDeviationBanner?.(f) ?? false
              return (
                <Fragment key={f.id}>
                  <tr className={severityRowClass(f.severity)}>
                    <td className="px-5 py-4 align-middle">
                      <Badge variant={severityBadgeVariant(f.severity)}>{SEVERITY_LABEL[f.severity]}</Badge>
                    </td>
                    <td className="px-5 py-4 align-middle text-neutral-700">{getCategoryLabel(f)}</td>
                    <td className="px-5 py-4 align-middle text-neutral-900">
                      <p className="text-sm">{f.description}</p>
                      {extraDescription ? <div className="mt-2">{extraDescription(f)}</div> : null}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {!readOnly && (
                          <>
                            {f.deviation_id && onOpenDeviation ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => onOpenDeviation(f.deviation_id!)}
                                className="border-neutral-200 font-medium text-[#1a3d32]"
                              >
                                Åpne avvik
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => onEditFinding(f)}
                              aria-label="Rediger avvik"
                              title="Rediger"
                              icon={<Pencil className="h-4 w-4" />}
                            />
                            {onDeleteFinding ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-neutral-400 hover:text-red-600"
                                onClick={() => onDeleteFinding(f.id)}
                                aria-label="Slett avvik"
                                title="Slett"
                                icon={<Trash2 className="h-4 w-4" />}
                              />
                            ) : null}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {showBanner && onCreateDeviationFromFinding ? (
                    <tr className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} bg-amber-50/50`}>
                      <td className="px-5 py-3 align-middle" colSpan={colCount}>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-amber-950">
                          <span>Koble høy risiko til avvik i systemet</span>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled={linkingDeviationId === f.id}
                            className="shrink-0 disabled:opacity-50"
                            onClick={() => void onCreateDeviationFromFinding(f.id)}
                          >
                            {linkingDeviationId === f.id ? 'Oppretter…' : 'Opprett avvik'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })
          )}
        </tbody>
      </table>
    </LayoutTable1PostingsShell>
  )
}
