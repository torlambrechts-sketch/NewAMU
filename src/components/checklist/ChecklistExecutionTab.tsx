import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { LayoutTable1PostingsShell } from '../layout/LayoutTable1PostingsShell'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { StandardInput } from '../ui/Input'
import { StandardTextarea } from '../ui/Textarea'
import type { ChecklistExecutionTabProps, ChecklistItem, ChecklistResponse } from './types'

/** Matches ROS / inspection module table headers (stacked-cell tables). */
const TH =
  'px-5 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider bg-neutral-50 border-b border-neutral-200'

const CHECKLIST_TR_BODY = 'border-b border-neutral-100 hover:bg-neutral-50/50 transition-colors'

type ChecklistItemExecutionRowProps = {
  item: ChecklistItem
  position: number
  response: ChecklistResponse | undefined
  readOnly: boolean
  onSaveResponse: ChecklistExecutionTabProps['onSaveResponse']
  onReportIssue?: (itemKey: string, itemLabel: string) => void
}

function ChecklistItemExecutionRow({
  item,
  position,
  response,
  readOnly,
  onSaveResponse,
  onReportIssue,
}: ChecklistItemExecutionRowProps) {
  const fieldType = item.fieldType ?? 'yes_no_na'
  const currentValue = response?.value ?? ''
  const hasExistingNotes = (response?.notes ?? '').trim().length > 0

  const [optimisticValue, setOptimisticValue] = useState<string | null>(null)
  const [notes, setNotes] = useState(response?.notes ?? '')
  const [showNotes, setShowNotes] = useState(hasExistingNotes)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  const displayedValue = optimisticValue ?? currentValue
  const isAnswered = displayedValue.length > 0

  useEffect(() => {
    setNotes(response?.notes ?? '')
  }, [response?.notes])
  useEffect(() => {
    if (hasExistingNotes) setShowNotes(true)
  }, [hasExistingNotes])
  useEffect(() => {
    if (!justSaved) return
    const id = window.setTimeout(() => setJustSaved(false), 1200)
    return () => window.clearTimeout(id)
  }, [justSaved])

  const save = useCallback(
    async (value: string, noteValue: string | null, isOptimistic = false) => {
      setSaving(true)
      try {
        await onSaveResponse(item.key, value, noteValue)
        if (isOptimistic) setOptimisticValue(null)
        setJustSaved(true)
      } catch {
        if (isOptimistic) setOptimisticValue(null)
      } finally {
        setSaving(false)
      }
    },
    [onSaveResponse, item.key],
  )

  const saveNotes = useCallback(async () => {
    if (notes === (response?.notes ?? '')) return
    await save(currentValue, notes.trim().length > 0 ? notes : null)
  }, [notes, response?.notes, currentValue, save])

  const statusBadge = () => {
    if (!isAnswered)
      return <Badge variant={item.required ? 'warning' : 'neutral'}>{item.required ? 'Mangler' : 'Valgfri'}</Badge>
    if (displayedValue === 'no') return <Badge variant="critical">Nei</Badge>
    if (displayedValue === 'yes') return <Badge variant="success">Ja</Badge>
    if (displayedValue === 'na') return <Badge variant="neutral">N/A</Badge>
    return <Badge variant="info">Besvart</Badge>
  }

  return (
    <tr
      className={`${CHECKLIST_TR_BODY} last:border-b-0 ${justSaved ? 'bg-green-50/40' : ''}`}
    >
      <td className="whitespace-nowrap px-5 py-4 align-middle text-sm font-bold text-neutral-400">{position + 1}</td>
      <td className="max-w-[min(22rem,40vw)] px-5 py-4 align-middle">
        <p className="text-sm font-medium text-neutral-900">{item.label}</p>
        {item.helpText ? <p className="mt-1 text-xs text-neutral-500">{item.helpText}</p> : null}
        {response?.notes ? <p className="mt-1 text-xs italic text-neutral-500">{response.notes}</p> : null}
      </td>
      <td className="px-5 py-4 align-middle whitespace-normal text-xs text-neutral-600">
        {item.categoryLabel ? <span className="font-medium text-neutral-800">{item.categoryLabel}</span> : '—'}
        {item.lawRef ? <span className="mt-0.5 block text-neutral-500">{item.lawRef}</span> : null}
      </td>
      <td className="px-5 py-4 align-middle">{statusBadge()}</td>
      <td className="min-w-[12rem] px-5 py-4 align-middle">
        {!readOnly && fieldType === 'yes_no_na' && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              {(['yes', 'no', 'na'] as const).map((v) => {
                const labels = { yes: 'Ja', no: 'Nei', na: 'N/A' } as const
                const active = displayedValue === v
                return (
                  <Button
                    key={v}
                    type="button"
                    size="sm"
                    variant={active ? 'primary' : 'secondary'}
                    onClick={() => {
                      const next = displayedValue === v ? '' : v
                      setOptimisticValue(next)
                      void save(next, notes.trim().length > 0 ? notes : null, true)
                    }}
                  >
                    {labels[v]}
                  </Button>
                )
              })}
            </div>
            {!showNotes && !hasExistingNotes ? (
              <Button type="button" variant="ghost" size="sm" className="h-auto justify-start p-0 text-xs" onClick={() => setShowNotes(true)}>
                + Legg til merknad
              </Button>
            ) : (
              <StandardTextarea
                rows={2}
                value={notes}
                autoFocus={!hasExistingNotes && showNotes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => void saveNotes()}
                placeholder="Merknad…"
                className="text-xs"
              />
            )}
            {saving && <span className="text-[10px] text-neutral-400">Lagrer…</span>}
          </div>
        )}
        {readOnly && fieldType === 'yes_no_na' && (
          <div>
            {displayedValue ? (
              <Badge
                variant={
                  displayedValue === 'yes' ? 'success' : displayedValue === 'no' ? 'critical' : 'neutral'
                }
              >
                {displayedValue === 'yes' ? 'Ja' : displayedValue === 'no' ? 'Nei' : 'N/A'}
              </Badge>
            ) : (
              <span className="text-xs italic text-neutral-400">Ikke besvart</span>
            )}
          </div>
        )}
        {fieldType === 'text' && (
          <StandardTextarea
            rows={2}
            value={displayedValue}
            readOnly={readOnly}
            onChange={(e) => {
              if (readOnly) return
              const next = e.target.value
              setOptimisticValue(next)
              void save(next, notes.trim().length > 0 ? notes : null, true)
            }}
            placeholder="Skriv svar…"
            className="text-sm"
          />
        )}
        {fieldType === 'number' && (
          <StandardInput
            type="number"
            value={displayedValue}
            readOnly={readOnly}
            onChange={(e) => {
              if (readOnly) return
              const next = e.target.value
              setOptimisticValue(next)
              void save(next, notes.trim().length > 0 ? notes : null, true)
            }}
          />
        )}
        {(fieldType === 'photo' || fieldType === 'signature') && (
          <p className="text-xs italic text-neutral-400">{fieldType === 'signature' ? 'Signatur' : 'Foto'} registreres ikke her.</p>
        )}
      </td>
      <td className="px-5 py-4 text-right align-middle">
        {!readOnly && displayedValue === 'no' && onReportIssue ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<AlertTriangle className="h-4 w-4" />}
            onClick={() => onReportIssue(item.key, item.label)}
          >
            Avvik
          </Button>
        ) : null}
      </td>
    </tr>
  )
}

export function ChecklistExecutionTab({
  items,
  responses,
  readOnly = false,
  onSaveResponse,
  activationBanner,
  onReportIssue,
  tableHeaderActions,
}: ChecklistExecutionTabProps) {
  const responseByKey = useMemo(() => {
    const map = new Map<string, ChecklistResponse>()
    for (const r of responses) map.set(r.key, r)
    return map
  }, [responses])

  const flatItems = useMemo(() => {
    const groups = new Map<string, { label: string; lawRef?: string; items: ChecklistItem[] }>()
    for (const item of items) {
      const key = item.category ?? '__default__'
      if (!groups.has(key)) {
        groups.set(key, {
          label: item.categoryLabel ?? (key === '__default__' ? 'Generelt' : key),
          lawRef: item.categoryLawRef,
          items: [],
        })
      }
      const g = groups.get(key)!
      if (!g.lawRef && item.categoryLawRef) g.lawRef = item.categoryLawRef
      g.items.push(item)
    }
    const out: { groupLabel: string; groupLaw?: string; item: ChecklistItem; globalIndex: number }[] = []
    let idx = 0
    for (const g of groups.values()) {
      for (const item of g.items) {
        out.push({ groupLabel: g.label, groupLaw: g.lawRef, item, globalIndex: idx })
        idx++
      }
    }
    return out
  }, [items])

  const answered = useMemo(
    () =>
      items.filter((item) => {
        const r = responseByKey.get(item.key)
        return r?.status === 'completed' || (r?.value ?? '').length > 0
      }).length,
    [items, responseByKey],
  )

  const total = items.length
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0

  return (
    <div className="flex flex-col space-y-4">
      {activationBanner}

      <LayoutTable1PostingsShell
        wrap={false}
        titleTypography="sans"
        title="Sjekkliste"
        description={`${answered} av ${total} punkter besvart (${pct}%).`}
        headerActions={tableHeaderActions}
        toolbar={
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-neutral-600">Fremdrift</span>
              <span className={`text-sm font-bold tabular-nums ${pct === 100 ? 'text-green-600' : 'text-[#1a3d32]'}`}>
                {pct}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : 'bg-[#1a3d32]'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        }
      >
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr>
              <th className={`${TH} w-10`}>#</th>
              <th className={TH}>Punkt</th>
              <th className={TH}>Kategori</th>
              <th className={TH}>Status</th>
              <th className={TH}>Svar</th>
              <th className={`${TH} w-32 text-right`}>Handlinger</th>
            </tr>
          </thead>
          <tbody>
            {flatItems.map(({ groupLabel, groupLaw, item, globalIndex }, rowIdx) => {
              const showGroupHeader = rowIdx === 0 || flatItems[rowIdx - 1]!.groupLabel !== groupLabel
              return (
                <Fragment key={item.key}>
                  {showGroupHeader ? (
                    <tr className="bg-[#f0ede8]">
                      <td colSpan={6} className="border-y border-neutral-200 px-5 py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1a3d32]">{groupLabel}</span>
                            {groupLaw ? (
                              <Badge variant="neutral" className="text-[10px]">
                                {groupLaw}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  <ChecklistItemExecutionRow
                    item={item}
                    position={globalIndex}
                    response={responseByKey.get(item.key)}
                    readOnly={readOnly}
                    onSaveResponse={onSaveResponse}
                    onReportIssue={onReportIssue}
                  />
                </Fragment>
              )
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm text-neutral-400">
                  Ingen sjekklistepunkter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </LayoutTable1PostingsShell>
    </div>
  )
}
