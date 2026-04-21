import { useCallback, useId, useState } from 'react'
import { Plus, Trash2, Users } from 'lucide-react'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../src/components/layout/layoutTable1PostingsKit'
import { SlidePanel } from '../../src/components/layout/SlidePanel'
import { WORKPLACE_MODULE_CARD, WORKPLACE_MODULE_CARD_SHADOW } from '../../src/components/layout/workplaceModuleSurface'
import { Button } from '../../src/components/ui/Button'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import { YesNoToggle } from '../../src/components/ui/FormToggles'
import type { AmuParticipant, AmuParticipantRole } from './types'

const ROLE_OPTIONS: { value: AmuParticipantRole; label: string }[] = [
  { value: 'employer_rep', label: 'Arbeidsgivers representant' },
  { value: 'employee_rep', label: 'Arbeidstakerrepresentant' },
  { value: 'safety_deputy', label: 'Verneombud' },
  { value: 'bht', label: 'BHT' },
  { value: 'secretary', label: 'Referent' },
]

const COL_COUNT = 4

export type AmuParticipantsTableProps = {
  participants: AmuParticipant[]
  userLabel: (userId: string) => string
  participantSelectOptions: { value: string; label: string }[]
  readOnly: boolean
  canManage: boolean
  onUpdateRole: (userId: string, role: AmuParticipantRole) => Promise<void>
  onUpdatePresent: (userId: string, present: boolean) => Promise<void>
  onRemove: (userId: string) => Promise<void>
  onAdd: (userId: string, role: AmuParticipantRole) => Promise<boolean>
}

export function AmuParticipantsTable({
  participants,
  userLabel,
  participantSelectOptions,
  readOnly,
  canManage,
  onUpdateRole,
  onUpdatePresent,
  onRemove,
  onAdd,
}: AmuParticipantsTableProps) {
  const panelTitleId = useId()
  const [panelOpen, setPanelOpen] = useState(false)
  const [draftUserId, setDraftUserId] = useState('')
  const [draftRole, setDraftRole] = useState<AmuParticipantRole>('employer_rep')

  const openPanel = useCallback(() => {
    setDraftUserId('')
    setDraftRole('employer_rep')
    setPanelOpen(true)
  }, [])

  const closePanel = useCallback(() => {
    setPanelOpen(false)
  }, [])

  const savePanel = useCallback(async () => {
    if (!draftUserId) return
    const ok = await onAdd(draftUserId, draftRole)
    if (ok) {
      setDraftUserId('')
      closePanel()
    }
  }, [draftUserId, draftRole, onAdd, closePanel])

  return (
    <div className={`${WORKPLACE_MODULE_CARD} p-5 md:p-6`} style={WORKPLACE_MODULE_CARD_SHADOW}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-neutral-900">Deltakere</h3>
          <p className="mt-1 text-sm text-neutral-600">
            Legg til brukere fra virksomheten med roller i møtet.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={readOnly || !canManage}
          onClick={openPanel}
        >
          <Plus className="h-4 w-4" />
          Ny deltaker
        </Button>
      </div>

      <div className="mt-4 overflow-x-auto w-full">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Bruker</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Rolle</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Til stede</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH} />
            </tr>
          </thead>
          <tbody>
            {participants.length === 0 ? (
              <tr className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                <td colSpan={COL_COUNT} className="px-5 py-0">
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Users className="h-12 w-12 text-neutral-300" aria-hidden />
                    <p className="mt-4 font-medium text-neutral-900">Ingen deltakere registrert ennå</p>
                    <p className="mt-1 max-w-md text-sm text-neutral-500">
                      AMU-møtet bør ha tydelig sammensetning. Legg til representanter fra begge sider og eventuell
                      referent eller BHT.
                    </p>
                    <div className="mt-6">
                      <Button
                        type="button"
                        variant="primary"
                        disabled={readOnly || !canManage}
                        onClick={openPanel}
                      >
                        <Plus className="h-4 w-4" />
                        Ny deltaker
                      </Button>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              participants.map((p) => (
                <tr key={p.user_id} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                  <td className="px-5 py-3 font-medium text-neutral-900">{userLabel(p.user_id)}</td>
                  <td className="px-5 py-3">
                    <SearchableSelect
                      value={p.role}
                      options={ROLE_OPTIONS}
                      onChange={async (v) => {
                        await onUpdateRole(p.user_id, v as AmuParticipantRole)
                      }}
                      disabled={readOnly || !canManage}
                    />
                  </td>
                  <td className="px-5 py-3">
                    <YesNoToggle
                      value={p.present}
                      onChange={async (v) => {
                        await onUpdatePresent(p.user_id, v)
                      }}
                    />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={readOnly || !canManage}
                      icon={<Trash2 className="h-4 w-4" />}
                      aria-label="Fjern"
                      onClick={async () => {
                        await onRemove(p.user_id)
                      }}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <SlidePanel
        open={panelOpen}
        onClose={closePanel}
        titleId={panelTitleId}
        title="Ny deltaker"
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closePanel}>
              Avbryt
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={readOnly || !canManage || !draftUserId}
              onClick={() => void savePanel()}
            >
              Legg til
            </Button>
          </div>
        }
      >
        <div className={WPSTD_FORM_ROW_GRID}>
          <div className={WPSTD_FORM_FIELD_LABEL}>Bruker</div>
          <SearchableSelect
            value={draftUserId}
            options={[{ value: '', label: 'Velg bruker' }, ...participantSelectOptions]}
            onChange={setDraftUserId}
            disabled={readOnly || !canManage}
          />
        </div>
        <div className={WPSTD_FORM_ROW_GRID}>
          <div className={WPSTD_FORM_FIELD_LABEL}>Rolle i møtet</div>
          <SearchableSelect
            value={draftRole}
            options={ROLE_OPTIONS}
            onChange={(v) => setDraftRole(v as AmuParticipantRole)}
            disabled={readOnly || !canManage}
          />
        </div>
      </SlidePanel>
    </div>
  )
}
