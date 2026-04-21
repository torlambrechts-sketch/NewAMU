import { ListOrdered } from 'lucide-react'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import { WORKPLACE_MODULE_CARD, WORKPLACE_MODULE_CARD_SHADOW } from '../../src/components/layout/workplaceModuleSurface'
import { Badge } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import type { AmuAgendaItem, AmuDecision, AmuMeeting } from './types'

const COL_COUNT = 4

export type AmuMeetingRoomTabProps = {
  agenda: AmuAgendaItem[]
  decisionByAgenda: Record<string, AmuDecision | null>
  meetingStatus: AmuMeeting['status']
  onOpenDecision: (item: AmuAgendaItem) => void
  onGoToPlanning: () => void
}

export function AmuMeetingRoomTab({
  agenda,
  decisionByAgenda,
  meetingStatus,
  onOpenDecision,
  onGoToPlanning,
}: AmuMeetingRoomTabProps) {
  return (
    <div className={`${WORKPLACE_MODULE_CARD} p-0 overflow-hidden`} style={WORKPLACE_MODULE_CARD_SHADOW}>
      <LayoutTable1PostingsShell
        wrap={false}
        titleTypography="sans"
        title="Aktivt møte — saksrunde"
        description="Gå gjennom saksene og registrer korte vedtak. Klikk «Registrer vedtak» for å åpne sidepanelet."
        headerActions={
          meetingStatus !== 'active' ? (
            <Badge variant="info">Bruk møtestatus «Aktivt» for live modus (Planlegging-fanen)</Badge>
          ) : null
        }
        toolbar={<span className="sr-only">Møterom</span>}
      >
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className="w-20 bg-neutral-50 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  #
                </th>
                <th className="bg-neutral-50 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Sak
                </th>
                <th className="w-36 bg-neutral-50 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Vedtak
                </th>
                <th className="w-44 bg-neutral-50 px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Handlinger
                </th>
              </tr>
            </thead>
            <tbody>
              {agenda.length === 0 ? (
                <tr className="border-b border-neutral-100">
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
                    <tr key={a.id} className="border-b border-neutral-100 transition-colors hover:bg-neutral-50">
                      <td className="whitespace-nowrap px-5 py-3 text-neutral-500">{a.order_index + 1}</td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-neutral-900">{a.title}</div>
                        {a.description ? (
                          <div className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{a.description}</div>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        {has?.decision_text ? (
                          <Badge variant="success">Oppført</Badge>
                        ) : (
                          <Badge variant="neutral">Ikke ført</Badge>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
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
        </div>
      </LayoutTable1PostingsShell>
    </div>
  )
}
