import { Edit2, Plus } from 'lucide-react'
import { LayoutTable1PostingsShell } from '../../../src/components/layout/LayoutTable1PostingsShell'
import { LAYOUT_TABLE1_POSTINGS_TH } from '../../../src/components/layout/layoutTable1PostingsKit'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { InspectionFindingRow } from '../types'

interface InspectionFindingsTableProps {
  findings: InspectionFindingRow[]
  onAddNew: () => void
  onEditFinding: (finding: InspectionFindingRow) => void
}

export function InspectionFindingsTable({
  findings,
  onAddNew,
  onEditFinding
}: InspectionFindingsTableProps) {
  return (
    <LayoutTable1PostingsShell 
      title="Registrerte avvik" 
      wrap={false}
      headerActions={
        <Button onClick={onAddNew} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Nytt avvik
        </Button>
      }
    >
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead>
            <tr>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Funn / Beskrivelse</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Klassifisering</th>
              <th className={`${LAYOUT_TABLE1_POSTINGS_TH} text-right`}>Handlinger</th>
            </tr>
          </thead>
          <tbody>
            {findings.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-12 text-center text-neutral-500">
                  Ingen avvik registrert.
                </td>
              </tr>
            ) : (
              findings.map((f) => {
                // Type-casting for utvidede felter (forhindrer TS-feil hvis parent sender inn ekstra data)
                const extendedF = f as any
                const checkpointLabel = extendedF.checkpointLabel || extendedF.checklist_item_label || 'Generelt avvik'
                const categoryLabel = extendedF.categoryLabel
                const severity = f.severity || 'low'
                const description = extendedF.description || f.description || ''

                let severityClass = 'border-l-4 border-l-transparent'
                let severityLabel = 'Lav'
                let badgeVariant: 'neutral' | 'info' | 'success' | 'warning' | 'high' | 'critical' = 'neutral'
                
                if (severity === 'critical') {
                  severityClass = 'border-l-4 border-l-red-500 bg-red-50/30 hover:bg-red-50/50'
                  severityLabel = 'Kritisk'
                  badgeVariant = 'critical'
                } else if (severity === 'high') {
                  severityClass = 'border-l-4 border-l-orange-400 bg-orange-50/20 hover:bg-orange-50/40'
                  severityLabel = 'Høy'
                  badgeVariant = 'high'
                } else if (severity === 'medium') {
                  severityClass = 'border-l-4 border-l-yellow-400 hover:bg-yellow-50'
                  severityLabel = 'Middels'
                  badgeVariant = 'warning'
                } else {
                  severityClass = 'border-l-4 border-l-blue-300 hover:bg-blue-50'
                  severityLabel = 'Lav'
                  badgeVariant = 'info'
                }

                return (
                  <tr key={f.id} className={`border-b border-neutral-100 transition-colors ${severityClass}`}>
                    <td className="px-5 py-4 whitespace-normal min-w-[300px]">
                      <div className="flex flex-col space-y-1">
                        <span className="font-medium text-sm text-neutral-900">
                          {checkpointLabel}
                        </span>
                        <span className="text-sm text-neutral-500 line-clamp-2">
                          {description}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2 items-center">
                        <Badge variant={badgeVariant}>{severityLabel}</Badge>
                        {categoryLabel && <Badge variant="neutral">{categoryLabel}</Badge>}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onEditFinding(f)} 
                        title="Rediger avvik"
                      >
                        <Edit2 className="w-4 h-4 text-neutral-500 hover:text-neutral-900" />
                      </Button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </LayoutTable1PostingsShell>
  )
}
