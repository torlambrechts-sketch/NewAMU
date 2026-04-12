import { Check, GripVertical, ListOrdered, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { WORKPLACE_LAYOUT_BOX_CARD, WORKPLACE_LAYOUT_BOX_SHADOW } from './workplaceLayoutKit'

const MIME_AGENDA_ROW = 'application/x-klarert-agenda-row'

export type AgendaListItem = {
  id: string
  title: string
  subtitle?: string
}

/** Preset row for agenda builder — pass as `templates` so users can insert copies. */
export type AgendaItemTemplate = {
  id: string
  /** Shown in the template picker */
  label: string
  title: string
  subtitle?: string
}

export type WorkplaceEditableNoticeListProps = {
  title: string
  badge?: string | number
  items: AgendaListItem[]
  onChange: (next: AgendaListItem[]) => void
  /** Optional presets (e.g. standard agenda sections). */
  templates?: AgendaItemTemplate[]
  addFromTemplateLabel?: string
  addEmptyLabel?: string
  emptyHint?: string
  readOnly?: boolean
  className?: string
  /** Optional icon in each row (defaults to ordered-list). */
  rowIcon?: ReactNode
}

function newItemId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `agenda-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function reorder<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = [...list]
  const [removed] = next.splice(from, 1)
  next.splice(to, 0, removed)
  return next
}

/**
 * Notification-style white card with a sortable, editable list — intended for agenda builders.
 * Supports add (empty or from template), inline edit, delete, and drag-and-drop reorder.
 */
export function WorkplaceEditableNoticeList({
  title,
  badge,
  items,
  onChange,
  templates = [],
  addFromTemplateLabel = 'Legg til fra mal',
  addEmptyLabel = 'Tomt punkt',
  emptyHint = 'Ingen punkter ennå. Legg til fra mal eller et tomt punkt.',
  readOnly = false,
  className = '',
  rowIcon,
}: WorkplaceEditableNoticeListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftSubtitle, setDraftSubtitle] = useState('')
  const [templatePick, setTemplatePick] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const templateById = useMemo(() => Object.fromEntries(templates.map((t) => [t.id, t])), [templates])

  const beginEdit = useCallback((it: AgendaListItem) => {
    setEditingId(it.id)
    setDraftTitle(it.title)
    setDraftSubtitle(it.subtitle ?? '')
  }, [])

  const commitEdit = useCallback(() => {
    if (!editingId) return
    const titleTrim = draftTitle.trim()
    if (!titleTrim) {
      setEditingId(null)
      return
    }
    onChange(items.map((it) => (it.id === editingId ? { ...it, title: titleTrim, subtitle: draftSubtitle.trim() || undefined } : it)))
    setEditingId(null)
  }, [draftSubtitle, draftTitle, editingId, items, onChange])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
  }, [])

  const remove = useCallback(
    (id: string) => {
      onChange(items.filter((it) => it.id !== id))
      if (editingId === id) setEditingId(null)
    },
    [editingId, items, onChange],
  )

  const addEmpty = useCallback(() => {
    const row: AgendaListItem = { id: newItemId(), title: 'Nytt punkt', subtitle: undefined }
    onChange([...items, row])
    queueMicrotask(() => beginEdit(row))
  }, [beginEdit, items, onChange])

  const addFromTemplate = useCallback(() => {
    const tpl = templatePick ? templateById[templatePick] : undefined
    if (!tpl) return
    const row: AgendaListItem = {
      id: newItemId(),
      title: tpl.title,
      subtitle: tpl.subtitle,
    }
    onChange([...items, row])
    setTemplatePick('')
  }, [items, onChange, templateById, templatePick])

  const defaultIcon = (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
      <ListOrdered className="size-4 shrink-0" aria-hidden />
    </div>
  )

  return (
    <div className={`${WORKPLACE_LAYOUT_BOX_CARD} ${className}`} style={WORKPLACE_LAYOUT_BOX_SHADOW}>
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{title}</p>
        {badge != null && badge !== '' ? (
          <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-bold text-neutral-800">{badge}</span>
        ) : null}
      </div>

      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 bg-neutral-50/60 px-4 py-2.5">
          {templates.length > 0 ? (
            <>
              <label className="sr-only" htmlFor="agenda-template-pick">
                Mal
              </label>
              <select
                id="agenda-template-pick"
                value={templatePick}
                onChange={(e) => setTemplatePick(e.target.value)}
                className="min-w-[140px] max-w-full flex-1 rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-800 outline-none focus:ring-2 focus:ring-[#1a3d32]/25"
              >
                <option value="">Velg mal…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!templatePick}
                onClick={addFromTemplate}
                className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-800 shadow-sm hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="size-3.5" aria-hidden />
                {addFromTemplateLabel}
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={addEmpty}
            className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-800 shadow-sm hover:bg-neutral-50"
          >
            <Plus className="size-3.5" aria-hidden />
            {addEmptyLabel}
          </button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-neutral-500">{emptyHint}</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {items.map((it, index) => {
            const editing = editingId === it.id
            const showDrop = overIndex === index && dragId && dragId !== it.id

            return (
              <li
                key={it.id}
                className={`flex gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 ${showDrop ? 'bg-amber-50/80 ring-1 ring-inset ring-amber-200/80' : ''}`}
                onDragOver={
                  readOnly
                    ? undefined
                    : (e) => {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        setOverIndex(index)
                      }
                }
                onDragLeave={
                  readOnly
                    ? undefined
                    : () => {
                        setOverIndex((cur) => (cur === index ? null : cur))
                      }
                }
                onDrop={
                  readOnly
                    ? undefined
                    : (e) => {
                        e.preventDefault()
                        const raw = e.dataTransfer.getData(MIME_AGENDA_ROW)
                        setOverIndex(null)
                        setDragId(null)
                        if (!raw) return
                        const from = items.findIndex((x) => x.id === raw)
                        if (from < 0 || from === index) return
                        onChange(reorder(items, from, index))
                      }
                }
              >
                {!readOnly ? (
                  <button
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(MIME_AGENDA_ROW, it.id)
                      e.dataTransfer.effectAllowed = 'move'
                      setDragId(it.id)
                    }}
                    onDragEnd={() => {
                      setDragId(null)
                      setOverIndex(null)
                    }}
                    className="mt-1 flex shrink-0 cursor-grab touch-none text-neutral-400 hover:text-neutral-600 active:cursor-grabbing"
                    aria-label="Dra for å sortere"
                  >
                    <GripVertical className="size-4" aria-hidden />
                  </button>
                ) : null}
                {rowIcon ?? defaultIcon}
                <div className="min-w-0 flex-1">
                  {editing && !readOnly ? (
                    <div className="space-y-2">
                      <input
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            commitEdit()
                          }
                          if (e.key === 'Escape') cancelEdit()
                        }}
                        className="w-full rounded-md border border-neutral-200 px-2 py-1.5 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-[#1a3d32]/25"
                        autoFocus
                        aria-label="Tittel"
                      />
                      <input
                        value={draftSubtitle}
                        onChange={(e) => setDraftSubtitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') cancelEdit()
                        }}
                        placeholder="Undertittel (valgfritt)"
                        className="w-full rounded-md border border-neutral-200 px-2 py-1.5 text-xs text-neutral-800 outline-none focus:ring-2 focus:ring-[#1a3d32]/25"
                        aria-label="Undertittel"
                      />
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-neutral-800">{it.title}</p>
                      {it.subtitle ? <p className="mt-1 text-xs text-neutral-400">{it.subtitle}</p> : null}
                    </>
                  )}
                </div>
                {!readOnly ? (
                  <div className="flex shrink-0 items-start gap-0.5 pt-0.5">
                    {editing ? (
                      <button
                        type="button"
                        onClick={commitEdit}
                        className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50"
                        aria-label="Lagre"
                      >
                        <Check className="size-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => beginEdit(it)}
                        className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                        aria-label="Rediger"
                      >
                        <Pencil className="size-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(it.id)}
                      className="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Slett"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
      {!readOnly && items.length > 0 ? (
        <div
          className={`min-h-[2.5rem] border-t border-dashed border-neutral-200/90 px-4 py-2 text-center text-[11px] text-neutral-400 ${
            overIndex === items.length ? 'bg-amber-50/80 ring-1 ring-inset ring-amber-200/80' : ''
          }`}
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            setOverIndex(items.length)
          }}
          onDragLeave={() => {
            setOverIndex((cur) => (cur === items.length ? null : cur))
          }}
          onDrop={(e) => {
            e.preventDefault()
            const raw = e.dataTransfer.getData(MIME_AGENDA_ROW)
            setOverIndex(null)
            setDragId(null)
            if (!raw) return
            const from = items.findIndex((x) => x.id === raw)
            if (from < 0) return
            onChange(reorder(items, from, items.length - 1))
          }}
        >
          Slipp her for å legge sist i listen
        </div>
      ) : null}
    </div>
  )
}
