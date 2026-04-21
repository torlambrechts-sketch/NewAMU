import { FileText, Plus, Trash2 } from 'lucide-react'
import { ModuleRecordsTableShell } from '../../src/components/module/ModuleRecordsTableShell'
import { MODULE_TABLE_TH, MODULE_TABLE_TR_BODY } from '../../src/components/module/moduleTableKit'
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
  const headerActions = (
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
        icon={<Plus className="h-4 w-4" />}
        disabled={readOnly || !canManage}
        onClick={onOpenNew}
      >
        Legg til sak
      </Button>
    </div>
  )

  return (
    <ModuleRecordsTableShell
      title="Saksliste (agenda)"
      description="Standard saksliste kan genereres. Rediger i sidepanel for å følge selskapsmønsteret."
      headerActions={headerActions}
      toolbar={<div className="min-w-0 flex-1" aria-hidden />}
    >
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr>
            <th className={`w-12 ${MODULE_TABLE_TH}`}>#</th>
            <th className={MODULE_TABLE_TH}>Sak</th>
            <th className={MODULE_TABLE_TH}>Kilde</th>
            <th className={`${MODULE_TABLE_TH} text-right`}>Handlinger</th>
          </tr>
        </thead>
        <tbody>
          {agenda.length === 0 ? (
            <tr>
              <td colSpan={COL_COUNT} className="px-5 py-0">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-neutral-300" aria-hidden />
                  <p className="mt-4 font-medium text-neutral-900">Ingen saker ennå</p>
                  <p className="mt-1 max-w-md text-sm text-neutral-500">
                    Generer forslag til saksliste for å komme raskt i gang med møtet, eller opprett
                    punkter for hånd.
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
              <tr key={a.id} className={MODULE_TABLE_TR_BODY}>
                <td className="whitespace-nowrap px-5 py-4 align-middle text-neutral-600">
                  {a.order_index + 1}
                </td>
                <td className="px-5 py-4 align-middle text-neutral-900">
                  <div className="font-medium">{a.title}</div>
                  {a.description ? (
                    <div className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{a.description}</div>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-5 py-4 align-middle text-neutral-600">
                  {sourceLabel(a)}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-right align-middle">
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
    </ModuleRecordsTableShell>
  )
}
