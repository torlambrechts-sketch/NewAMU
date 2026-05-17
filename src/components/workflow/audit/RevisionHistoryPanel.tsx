// RevisionHistoryPanel — append-only audit log of rule mutations.
//
// Reads workflow_rule_revisions (trigger-fed from migration
// _20260905120300). Shows who changed what, when, and what changed.

import { useState } from 'react'
import { ClipboardList, User } from 'lucide-react'
import { useWorkflows } from '../../../hooks/useWorkflows'
import { useWorkflowRevisions } from '../../../hooks/useWorkflowRevisions'
import { SearchableSelect } from '../../ui/SearchableSelect'

export function RevisionHistoryPanel({ initialRuleId }: { initialRuleId?: string | null } = {}) {
  const { rules } = useWorkflows()
  const [selectedRuleId, setSelectedRuleId] = useState<string>(initialRuleId ?? '')
  const { revisions, loading, error } = useWorkflowRevisions(selectedRuleId || null)
  const rule = rules.find((r) => r.id === selectedRuleId)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <ClipboardList className="h-4 w-4 text-neutral-600" />
        <h2 className="text-sm font-semibold text-neutral-900">Endringslogg</h2>
        <span className="flex-1" />
        <div className="w-72">
          <SearchableSelect
            value={selectedRuleId}
            onChange={setSelectedRuleId}
            options={[
              { value: '', label: '— velg en regel —' },
              ...rules.map((r) => ({ value: r.id, label: r.name })),
            ]}
          />
        </div>
      </div>
      {!selectedRuleId ? (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
          Velg en regel for å se mutasjonslogg
        </p>
      ) : loading ? (
        <p className="text-sm text-neutral-500">Laster …</p>
      ) : error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : revisions.length === 0 ? (
        <p className="rounded-xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500">
          Ingen registrerte endringer på «{rule?.name}» enda. Hver gang regelen oppdateres legges det
          en rad her — trigger-fed, RLS-låst, ikke redigerbar.
        </p>
      ) : (
        <ol className="space-y-2">
          {revisions.map((rev) => (
            <li key={rev.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium uppercase text-neutral-700">
                  {rev.diff_summary ?? 'definition_changed'}
                </span>
                <span className="text-xs text-neutral-500">
                  {new Date(rev.changed_at).toLocaleString('nb-NO')}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                <span className="text-neutral-500">
                  <User className="mr-1 inline h-3 w-3" />
                  Endret av
                </span>
                <span>{rev.changed_by ?? '— systemtrigger —'}</span>
                <span className="text-neutral-500">Var aktiv?</span>
                <span>{rev.prev_is_active ? 'Ja' : 'Nei'}</span>
                <span className="text-neutral-500">Forrige navn</span>
                <span>{rev.prev_name}</span>
                {rev.prev_law_refs.length > 0 && (
                  <>
                    <span className="text-neutral-500">Forrige lov-referanser</span>
                    <span>{rev.prev_law_refs.join(' · ')}</span>
                  </>
                )}
              </div>
              {rev.change_reason && (
                <p className="mt-2 text-xs text-neutral-700">Begrunnelse: {rev.change_reason}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
