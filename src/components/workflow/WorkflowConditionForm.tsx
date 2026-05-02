import { useMemo, useState } from 'react'
import type { WorkflowCondition } from '../../types/workflow'
import { WHERE_FIELDS_BY_PATH, WORKFLOW_ARRAY_PATHS, type WhereFieldOption } from '../../data/workflowConditionFields'
import { StandardInput } from '../ui/Input'
import { SearchableSelect } from '../ui/SearchableSelect'
import { Button } from '../ui/Button'

const FIELD_LABEL = 'mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500'
const WF_LEAD = 'text-sm leading-relaxed text-neutral-600'

type Props = {
  value: WorkflowCondition
  onChange: (c: WorkflowCondition) => void
  /** Selected workflow source module (org payload key or wiki_published). */
  sourceModule: string
}

function mergeWhere(
  base: Record<string, unknown>,
  key: string,
  val: unknown,
): Record<string, unknown> {
  const next = { ...base }
  if (val === '' || val === undefined) {
    delete next[key]
  } else {
    next[key] = val
  }
  return next
}

function WhereValueInput({
  field,
  current,
  onChange,
}: {
  field: WhereFieldOption
  current: unknown
  onChange: (v: unknown) => void
}) {
  if (field.valueKind === 'bool') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4"
          checked={current === true}
          onChange={(e) => onChange(e.target.checked ? true : false)}
        />
        Ja
      </label>
    )
  }
  if (field.valueKind === 'enum' && field.options) {
    const enumOptions = [
      { value: '', label: '— Velg —' },
      ...field.options,
    ]
    return (
      <SearchableSelect
        value={typeof current === 'string' ? current : ''}
        options={enumOptions}
        onChange={(val) => onChange(val)}
      />
    )
  }
  return (
    <StandardInput
      value={current != null ? String(current) : ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Verdi"
    />
  )
}

export function WorkflowConditionForm({ value, onChange, sourceModule }: Props) {
  const pathOptions = useMemo(() => {
    if (sourceModule === 'wiki_published') return [] as { value: string; label: string }[]
    return WORKFLOW_ARRAY_PATHS[sourceModule] ?? []
  }, [sourceModule])

  const m = value.match

  if (m === 'always') {
    return (
      <p className={WF_LEAD}>
        Denne regelen kjører ved hver lagring i valgt kilde. Velg en annen inndata-mal eller bytt match-type over for å
        filtrere.
      </p>
    )
  }

  if (m === 'field_equals') {
    return (
      <div className="space-y-4 text-sm">
        <p className={WF_LEAD}>Brukes sjelden — sammenligner én verdi i data (punktum-notasjon).</p>
        <div>
          <label className={FIELD_LABEL} htmlFor="wf-fe-path">
            Feltsti
          </label>
          <StandardInput
            id="wf-fe-path"
            value={value.path}
            onChange={(e) => onChange({ ...value, path: e.target.value })}
            className="font-mono text-xs"
            placeholder="f.eks. tasks.0.status"
          />
        </div>
        <div>
          <label className={FIELD_LABEL} htmlFor="wf-fe-val">
            Verdi
          </label>
          <StandardInput
            id="wf-fe-val"
            value={value.value}
            onChange={(e) => onChange({ ...value, value: e.target.value })}
          />
        </div>
      </div>
    )
  }

  if (m === 'array_any') {
    return (
      <ArrayAnyEditor
        value={value}
        onChange={onChange}
        pathOptions={pathOptions}
      />
    )
  }

  if (m === 'and' || m === 'or' || m === 'xor') {
    return (
      <p className="text-sm text-neutral-700">
        Denne betingelsen er sammensatt ({m}). Rediger under fanen «Avansert» eller bygg flyten på nytt i lineær/XOR-modus.
      </p>
    )
  }

  return <p className="text-sm text-neutral-500">Ukjent betingelsestype.</p>
}

function ArrayAnyEditor({
  value,
  onChange,
  pathOptions,
}: {
  value: Extract<WorkflowCondition, { match: 'array_any' }>
  onChange: (c: WorkflowCondition) => void
  pathOptions: { value: string; label: string }[]
}) {
  const [customKey, setCustomKey] = useState('')
  const [customVal, setCustomVal] = useState('')
  const path = value.path
  const where = (value.where && typeof value.where === 'object' ? value.where : {}) as Record<string, unknown>
  const fieldDefs = path ? WHERE_FIELDS_BY_PATH[path] ?? [] : []

  function addCustomCriterion() {
    const k = customKey.trim()
    if (!k) return
    const v = customVal.trim()
    onChange({
      match: 'array_any',
      path,
      where: mergeWhere(where, k, v === '' ? true : v),
    })
    setCustomKey('')
    setCustomVal('')
  }

  const pathSelectOptions = [
    { value: '', label: '— Velg datatype —' },
    ...pathOptions,
  ]

  return (
    <div className="space-y-4 text-sm">
      <div>
        <label className={FIELD_LABEL} htmlFor="wf-array-path">
          Hvilken liste?
        </label>
        <SearchableSelect
          value={path}
          options={pathSelectOptions}
          onChange={(p) => onChange({ match: 'array_any', path: p, where: {} })}
        />
      </div>

      {path ? (
        <>
          <p className={WF_LEAD}>
            Regelen kjører når <strong className="font-semibold">minst ett element</strong> i listen oppfyller alle valgte
            kriterier. Tomt kriterie = «enhver ny eller oppdatert rad» i listen.
          </p>
          <div className="space-y-3 rounded-lg border border-neutral-200/90 bg-white p-4">
            <p className={FIELD_LABEL}>Kriterier</p>
            {fieldDefs.length === 0 ? (
              <p className="text-xs text-neutral-500">
                Ingen forhåndsdefinerte felter for denne listen — bruk egendefinert nedenfor, eller la stå tomt for «alle
                rader».
              </p>
            ) : (
              fieldDefs.map((f) => (
                <div key={f.key} className="grid gap-2 sm:grid-cols-[1fr_1.2fr] sm:items-end">
                  <span className={`${FIELD_LABEL} normal-case tracking-normal text-neutral-700`}>{f.label}</span>
                  <WhereValueInput
                    field={f}
                    current={where[f.key]}
                    onChange={(v) =>
                      onChange({
                        match: 'array_any',
                        path,
                        where: mergeWhere(where, f.key, v),
                      })
                    }
                  />
                </div>
              ))
            )}
            <div className="border-t border-neutral-200/80 pt-4">
              <p className={FIELD_LABEL}>Egendefinert felt</p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <StandardInput
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  placeholder="Feltnavn"
                  className="min-w-[8rem] flex-1 text-xs"
                />
                <StandardInput
                  value={customVal}
                  onChange={(e) => setCustomVal(e.target.value)}
                  placeholder="Verdi (valgfritt)"
                  className="min-w-[8rem] flex-1 text-xs"
                />
                <Button variant="primary" size="sm" onClick={addCustomCriterion}>
                  Legg til
                </Button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
