import React from 'react'
import { Edit2, Plus } from 'lucide-react'
import { LayoutTable1PostingsShell } from '@/components/layout/LayoutTable1PostingsShell'
import { LAYOUT_TABLE1_POSTINGS_TH } from '@/components/layout/layoutTable1PostingsKit'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

// Juster typene her hvis de heter noe annet i filen din
interface FindingRow {
  id: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  categoryLabel?: string
  checkpointLabel?: string
}

interface InspectionFindingsTableProps {
  findings: FindingRow[]
  onAddNew: () => void
  onEditFinding: (finding: FindingRow) => void
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
                // Dynamisk kantfarge basert på alvorlighetsgrad (Akkurat som ROS)
                let severityClass = 'border-l-4 border-l-transparent'
                let severityLabel = 'Lav'
                let badgeVariant: any = 'neutral'
                
                if (f.severity === 'critical') {
                  severityClass = 'border-l-4 border-l-red-500 bg-red-50/30 hover:bg-red-50/50'
                  severityLabel = 'Kritisk'
                  badgeVariant = 'critical'
                } else if (f.severity === 'high') {
                  severityClass = 'border-l-4 border-l-orange-400 bg-orange-50/20 hover:bg-orange-50/40'
                  severityLabel = 'Høy'
                  badgeVariant = 'high'
                } else if (f.severity === 'medium') {
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
                          {f.checkpointLabel || 'Generelt avvik'}
                        </span>
                        <span className="text-sm text-neutral-500 line-clamp-2">
                          {f.description}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2 items-center">
                        <Badge variant={badgeVariant}>{severityLabel}</Badge>
                        {f.categoryLabel && <Badge variant="neutral">{f.categoryLabel}</Badge>}
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
