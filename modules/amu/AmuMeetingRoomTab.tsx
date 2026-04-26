import { ListOrdered } from 'lucide-react'
import { ModuleRecordsTableShell } from '../../src/components/module/ModuleRecordsTableShell'
import { MODULE_TABLE_TH, MODULE_TABLE_TR_BODY } from '../../src/components/module/moduleTableKit'
import { Badge } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import type { AmuAgendaItem, AmuDecision, AmuMeeting } from './types'

const COL_COUNT = 4

export type AmuMeetingRoomTabProps = {
  agenda: AmuAgendaItem[]
  decisionByAgenda: Record<string, AmuDecision | null>
  meetingStatus: AmuMeeting['status']
  /** Vises under sakstekst når kilde er satt (samme logikk som planleggingstabellen). */
  sourceLabel?: (item: AmuAgendaItem) => string
  onOpenDecision: (item: AmuAgendaItem) => void
  onGoToPlanning: () => void
}

export function AmuMeetingRoomTab({
  agenda,
  decisionByAgenda,
  meetingStatus,
  sourceLabel,
  onOpenDecision,
  onGoToPlanning,
}: AmuMeetingRoomTabProps) {
  const headerActions =
    meetingStatus !== 'active' ? (
      <Badge variant="info">Sett møtestatus «Aktivt» for live modus (Planlegging-fanen)</Badge>
    ) : null

  return (
    <ModuleRecordsTableShell
      title="Aktivt møte — saksrunde"
      description="Gå gjennom sakene og registrer korte vedtak. Klikk «Registrer vedtak» for å åpne sidepanelet."
      headerActions={headerActions}
      toolbar={<div className="min-w-0 flex-1" aria-hidden />}
    >
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr>
            <th className={`w-16 ${MODULE_TABLE_TH}`}>#</th>
            <th className={MODULE_TABLE_TH}>Sak</th>
            <th className={`w-36 ${MODULE_TABLE_TH}`}>Vedtak</th>
            <th className={`w-44 ${MODULE_TABLE_TH} text-right`}>Handlinger</th>
          </tr>
        </thead>
        <tbody>
          {agenda.length === 0 ? (
            <tr>
              <td colSpan={COL_COUNT} className="px-5 py-0">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ListOrdered className="h-12 w-12 text-neutral-300" aria-hidden />
                  <p className="mt-4 font-medium text-neutral-900">Ingen saker i møterom</p>
                  <p className="mt-1 max-w-md text-sm text-neutral-500">
                    Legg inn saksliste under Planlegging, eller generer standard saksliste der.
                  </p>
                  <div className="mt-6">
                    <Button type="button" variant="primary" onClick={onGoToPlanning}>
                      Gå til planlegging
                    </Button>
                  </div>
                </div>
              </td>
            </tr>
          ) : (
            agenda.map((a) => {
              const has = decisionByAgenda[a.id]
              return (
                <tr key={a.id} className={MODULE_TABLE_TR_BODY}>
                  <td className="whitespace-nowrap px-5 py-4 align-middle text-neutral-500">
                    {a.order_index + 1}
                  </td>
                  <td className="px-5 py-4 align-middle">
                    <div className="font-medium text-neutral-900">{a.title}</div>
                    {a.description ? (
                      <div className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{a.description}</div>
                    ) : null}
                    {a.source_module && sourceLabel ? (
                      <div className="mt-1 text-xs text-neutral-600">
                        Kilde: {sourceLabel(a)}
                      </div>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 align-middle">
                    {has?.decision_text ? (
                      <Badge variant="success">Oppført</Badge>
                    ) : (
                      <Badge variant="neutral">Ikke ført</Badge>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-right align-middle">
                    <Button type="button" variant="ghost" size="sm" onClick={() => onOpenDecision(a)}>
                      Registrer vedtak
                    </Button>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </ModuleRecordsTableShell>
  )
}
