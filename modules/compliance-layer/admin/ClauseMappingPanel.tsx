// ClauseMappingPanel — pick clauses to link to a control.
//
// Grouped picker: clauses are listed per regulation_id with code + title.
// The hook handles same-org coherence (system clauses always allowed).
// Re-clicking an already-linked clause toggles it off. Uses design-system
// primitives per DESIGN_SYSTEM.md §3.

import { useMemo, useState } from 'react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { FormModal } from '../../../template'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { useControlClauses } from '../useControlClauses'
import { CONTROL_COVERAGE_LEVELS } from '../types'
import type { ControlCoverageLevel } from '../types'

type Props = {
  open: boolean
  controlId: string
  onClose: () => void
  onSaved?: () => void | Promise<void>
}

const COVERAGE_LABELS: Record<ControlCoverageLevel, string> = {
  primary: 'Primær',
  supporting: 'Støttende',
  partial: 'Delvis',
}

const COVERAGE_OPTIONS = CONTROL_COVERAGE_LEVELS.map((l) => ({
  value: l,
  label: COVERAGE_LABELS[l],
}))

export function ClauseMappingPanel({ open, controlId, onClose, onSaved }: Props) {
  const { supabase } = useOrgSetupContext()
  const {
    clausesByRegulation,
    junctionsByControlId,
    assignClause,
    unassignClause,
    setCoverageLevel,
  } = useControlClauses({ supabase })

  const [activeRegulation, setActiveRegulation] = useState<string>('aml')
  const [coverage, setCoverage] = useState<ControlCoverageLevel>('primary')
  const [search, setSearch] = useState('')

  const regulations = useMemo(
    () => Object.keys(clausesByRegulation).sort(),
    [clausesByRegulation],
  )

  // Derived during render — no useEffect needed (avoids setState-in-effect).
  const effectiveRegulation = useMemo(() => {
    if (!open) return activeRegulation
    if (regulations.length === 0) return activeRegulation
    if (regulations.includes(activeRegulation)) return activeRegulation
    return regulations[0]
  }, [open, regulations, activeRegulation])

  const linkedIds = useMemo(() => {
    const set = new Set<string>()
    for (const j of junctionsByControlId[controlId] ?? []) {
      set.add(j.clause_id)
    }
    return set
  }, [junctionsByControlId, controlId])

  const filteredClauses = useMemo(() => {
    const all = clausesByRegulation[effectiveRegulation] ?? []
    const q = search.trim().toLowerCase()
    if (q === '') return all
    return all.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
    )
  }, [clausesByRegulation, effectiveRegulation, search])

  return (
    <FormModal
      open={open}
      title="Lovkrav-kobling"
      description="Klikk en klausul for å koble den til kontrollen. Klikk igjen for å fjerne."
      actions={
        <Button
          variant="primary"
          size="sm"
          onClick={async () => {
            await onSaved?.()
            setSearch('')
            onClose()
          }}
        >
          Ferdig
        </Button>
      }
    >
      <div className="flex gap-2 overflow-x-auto border-b border-neutral-200 pb-2">
        {regulations.map((r) => (
          <Button
            key={r}
            type="button"
            size="sm"
            variant={effectiveRegulation === r ? 'primary' : 'secondary'}
            onClick={() => setActiveRegulation(r)}
            className="whitespace-nowrap rounded px-3 py-1 text-xs uppercase tracking-wide"
          >
            {r}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <StandardInput
            type="search"
            placeholder="Søk klausul…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-1 text-sm">
          <span className="text-neutral-700">Dekning:</span>
          <SearchableSelect
            value={coverage}
            options={COVERAGE_OPTIONS}
            onChange={(v) => setCoverage(v as ControlCoverageLevel)}
          />
        </label>
      </div>
      <ul className="max-h-96 space-y-1 overflow-y-auto pr-1 text-sm">
        {filteredClauses.length === 0 ? (
          <li className="rounded border border-dashed border-neutral-300 p-3 text-center text-neutral-500">
            Ingen klausuler matcher.
          </li>
        ) : null}
        {filteredClauses.map((c) => {
          const linked = linkedIds.has(c.id)
          return (
            <li
              key={c.id}
              className={`flex items-center justify-between gap-2 rounded border px-3 py-2 ${
                linked
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-neutral-200 bg-white hover:bg-neutral-50'
              }`}
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="flex-1 justify-start text-left"
                onClick={async () => {
                  if (linked) {
                    await unassignClause(controlId, c.id)
                  } else {
                    await assignClause({
                      control_id: controlId,
                      clause_id: c.id,
                      coverage_level: coverage,
                    })
                  }
                }}
              >
                <span className="font-mono text-xs text-neutral-700">
                  {c.code}
                </span>{' '}
                <span className="text-neutral-900">{c.title}</span>
              </Button>
              {linked ? (
                <SearchableSelect
                  value={
                    (junctionsByControlId[controlId] ?? []).find(
                      (j) => j.clause_id === c.id,
                    )?.coverage_level ?? 'primary'
                  }
                  options={COVERAGE_OPTIONS}
                  onChange={(v) =>
                    void setCoverageLevel(
                      controlId,
                      c.id,
                      v as ControlCoverageLevel,
                    )
                  }
                />
              ) : null}
            </li>
          )
        })}
      </ul>
    </FormModal>
  )
}
