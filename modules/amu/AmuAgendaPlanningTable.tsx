import { FileText, Plus, Trash2 } from 'lucide-react'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import { WORKPLACE_MODULE_CARD, WORKPLACE_MODULE_CARD_SHADOW } from '../../src/components/layout/workplaceModuleSurface'
import { Button } from '../../src/components/ui/Button'
import type { AmuAgendaItem } from './types'

const COL_COUNT = 4

export type AmuAgendaPlanningTableProps = {
  agenda: AmuAgendaItem[]
  readOnly: boolean
  canManage: boolean
  sourceLabel: (item: AmuAgendaItem) => string
  onGenerateDefaultAgenda: () => void | Promise<void>
  onOpenNew: () => void
  onOpenEdit: (item: AmuAgendaItem) => void
  onDelete: (id: string) => void | Promise<void>
}

export function AmuAgendaPlanningTable({
  agenda,
  readOnly,
  canManage,
  sourceLabel,
  onGenerateDefaultAgenda,
  onOpenNew,
  onOpenEdit,
  onDelete,
}: AmuAgendaPlanningTableProps) {
  return (
    <div className={`${WORKPLACE_MODULE_CARD} p-0 overflow-hidden`} style={WORKPLACE_MODULE_CARD_SHADOW}>
      <LayoutTable1PostingsShell
        wrap={false}
        titleTypography="sans"
        title="Saksliste (agenda)"
        description="Standard saksliste kan genereres. Rediger i sidepanel for å følge selskapsmønsteret."
        headerActions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={readOnly || !canManage}
              onClick={() => void onGenerateDefaultAgenda()}
            >
              Generer standard saksliste
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onOpenNew}
              disabled={readOnly || !canManage}
            >
              <Plus className="h-4 w-4" />
              Legg til sak
            </Button>
          </div>
        }
        toolbar={<span className="sr-only">Saksliste</span>}
      >
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className="bg-neutral-50 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  #
                </th>
                <th className="bg-neutral-50 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Sak
                </th>
                <th className="bg-neutral-50 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Kilde
                </th>
                <th className="bg-neutral-50 px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Handlinger
                </th>
              </tr>
            </thead>
            <tbody>
              {agenda.length === 0 ? (
                <tr className="border-b border-neutral-100">
                  <td colSpan={COL_COUNT} className="px-5 py-0">
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <FileText className="h-12 w-12 text-neutral-300" aria-hidden />
                      <p className="mt-4 font-medium text-neutral-900">Ingen saker ennå</p>
                      <p className="mt-1 max-w-md text-sm text-neutral-500">
                        Generer forslag til saksliste for å komme raskt i gang med møtet, eller opprett punkter for hånd.
                      </p>
                      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                        <Button
                          type="button"
                          variant="primary"
                          disabled={readOnly || !canManage}
                          onClick={() => void onGenerateDefaultAgenda()}
                        >
                          Generer standard saksliste
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={readOnly || !canManage}
                          onClick={onOpenNew}
                        >
                          Legg til sak
                        </Button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                agenda.map((a) => (
                  <tr key={a.id} className="border-b border-neutral-100 transition-colors hover:bg-neutral-50">
                    <td className="whitespace-nowrap px-5 py-3 text-neutral-600">{a.order_index + 1}</td>
                    <td className="px-5 py-3 text-neutral-900">
                      <div className="font-medium">{a.title}</div>
                      {a.description ? (
                        <div className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{a.description}</div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-neutral-600">{sourceLabel(a)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenEdit(a)}
                          disabled={readOnly || !canManage}
                        >
                          Rediger sak
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => void onDelete(a.id)}
                          disabled={readOnly || !canManage}
                          icon={<Trash2 className="h-4 w-4" />}
                          aria-label="Slett"
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </LayoutTable1PostingsShell>
    </div>
  )
}
