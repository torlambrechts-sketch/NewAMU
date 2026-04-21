import React from 'react'
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react'
import { LayoutTable1PostingsShell } from '@/components/layout/LayoutTable1PostingsShell'
import { LAYOUT_TABLE1_POSTINGS_TH, LAYOUT_TABLE1_POSTINGS_BODY_ROW } from '@/components/layout/layoutTable1PostingsKit'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { StandardInput } from '@/components/ui/Input'
import { StandardTextarea } from '@/components/ui/Textarea'
import { InspectionChecklistItem } from '../types'

interface InspectionChecklistTableProps {
  checklistItems: InspectionChecklistItem[]
  onUpdateItem: (itemKey: string, newValue: any) => void
  onRegisterFinding: (itemKey: string) => void
}

export function InspectionChecklistTable({
  checklistItems,
  onUpdateItem,
  onRegisterFinding
}: InspectionChecklistTableProps) {
  return (
    <LayoutTable1PostingsShell title="Sjekkliste" wrap={false}>
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead>
            <tr>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
              <th className={`${LAYOUT_TABLE1_POSTINGS_TH} w-full`}>Sjekkpunkt</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Kategori</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Svar</th>
              <th className={`${LAYOUT_TABLE1_POSTINGS_TH} text-right`}>Handlinger</th>
            </tr>
          </thead>
          <tbody>
            {checklistItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-neutral-500">
                  Ingen sjekkpunkter funnet.
                </td>
              </tr>
            ) : (
              checklistItems.map((item) => {
                const isAnswered = item.answer !== undefined && item.answer !== null && item.answer !== ''
                return (
                  <tr key={item.key} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                    <td className="px-5 py-4 text-center">
                      {isAnswered ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto" />
                      ) : (
                        <Circle className="w-5 h-5 text-neutral-300 mx-auto" />
                      )}
                    </td>
                    <td className="px-5 py-4 whitespace-normal">
                      <div className="font-medium text-sm text-neutral-900">{item.label}</div>
                      {item.helpText && <div className="text-xs text-neutral-500 mt-1">{item.helpText}</div>}
                    </td>
                    <td className="px-5 py-4">
                      {item.categoryLabel && <Badge variant="neutral">{item.categoryLabel}</Badge>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="w-40">
                        {item.fieldType === 'yes_no_na' ? (
                          <SearchableSelect
                            options={[
                              { value: 'yes', label: 'Ja' },
                              { value: 'no', label: 'Nei' },
                              { value: 'na', label: 'N/A' }
                            ]}
                            value={item.answer as string || ''}
                            onChange={(val) => onUpdateItem(item.key, val)}
                            placeholder="Velg..."
                          />
                        ) : item.fieldType === 'text' ? (
                          <StandardTextarea
                            value={item.answer as string || ''}
                            onChange={(e) => onUpdateItem(item.key, e.target.value)}
                            placeholder="Skriv svar..."
                            rows={1}
                          />
                        ) : item.fieldType === 'number' ? (
                          <StandardInput
                            type="number"
                            value={item.answer as number || ''}
                            onChange={(e) => onUpdateItem(item.key, parseFloat(e.target.value))}
                            placeholder="Tall..."
                          />
                        ) : (
                          <span className="text-xs text-neutral-400 italic">Krever signatur/bilde</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onRegisterFinding(item.key)} 
                        title="Registrer avvik"
                      >
                        <AlertCircle className="w-4 h-4 text-neutral-400 hover:text-red-600 transition-colors" />
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
