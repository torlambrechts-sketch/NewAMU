// DashboardChooser — title-line dropdown for switching, saving, renaming,
// and deleting named dashboards within a registered scope. Driven by the
// API additions on useDashboardLayout (3.2.3): `available`, `selectLayout`,
// `saveAs`, `renameActive`, `deleteActive`, `markActiveDefault`.
//
// The chooser deliberately stays presentation-only: it renders rows from
// `available`, calls back into the hook for mutations, and shows the
// active row's name as the trigger label. The component renders nothing
// when `available` is empty AND there's no row yet (i.e. the scope is
// brand new and the user hasn't saved anything) — otherwise the trigger
// would expose actions for a non-existent active row.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Lock, Pencil, Pin, Plus, Trash2, Users } from 'lucide-react'
import type { DashboardLayoutRow } from '../../../lib/dashboards/useDashboardLayout'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'

type SaveAsOptions = {
  name: string
  isPrivate?: boolean
  basedOnActive?: boolean
}

export interface DashboardChooserProps {
  available: DashboardLayoutRow[]
  activeRow: DashboardLayoutRow | null
  /** True when the active layout is the registry default (no saved row yet). */
  isDefault: boolean
  currentUserId: string | null
  onSelect: (rowId: string) => void
  onSaveAs: (opts: SaveAsOptions) => Promise<DashboardLayoutRow | null>
  onRename: (name: string) => Promise<boolean>
  onDelete: () => Promise<boolean>
  onMarkDefault: () => Promise<boolean>
  /** Optional — when omitted the chooser shows "Standard" for the default state. */
  defaultLabel?: string
}

export function DashboardChooser({
  available,
  activeRow,
  isDefault,
  currentUserId,
  onSelect,
  onSaveAs,
  onRename,
  onDelete,
  onMarkDefault,
  defaultLabel = 'Standard',
}: DashboardChooserProps) {
  const [open, setOpen] = useState(false)
  const [submode, setSubmode] = useState<null | 'saveAs' | 'rename'>(null)
  const [draftName, setDraftName] = useState('')
  const [draftPrivate, setDraftPrivate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Close on click-outside / Esc. pointerdown covers mouse + touch so
  // tap-outside on phones / iPads dismisses the chooser correctly.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: PointerEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSubmode(null)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setSubmode(null)
      }
    }
    document.addEventListener('pointerdown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const { sharedRows, privateRows } = useMemo(() => {
    const shared: DashboardLayoutRow[] = []
    const priv: DashboardLayoutRow[] = []
    for (const r of available) {
      if (r.owner_user_id == null) shared.push(r)
      else if (r.owner_user_id === currentUserId) priv.push(r)
    }
    return { sharedRows: shared, privateRows: priv }
  }, [available, currentUserId])

  const triggerLabel = activeRow ? activeRow.name : defaultLabel
  const activeIsPrivate = !!activeRow && activeRow.owner_user_id !== null
  const canRenameOrDelete = !!activeRow && (!activeIsPrivate || activeRow.owner_user_id === currentUserId)

  const beginSaveAs = (isPrivate: boolean) => {
    setSubmode('saveAs')
    setDraftPrivate(isPrivate)
    setDraftName(activeRow ? `Kopi av ${activeRow.name}` : 'Ny visning')
  }
  const beginRename = () => {
    if (!activeRow) return
    setSubmode('rename')
    setDraftName(activeRow.name)
  }

  const cancelSubmode = () => {
    setSubmode(null)
    setDraftName('')
    setDraftPrivate(false)
  }

  const submitSubmode = async () => {
    if (submitting) return
    const name = draftName.trim()
    if (!name) return
    setSubmitting(true)
    try {
      if (submode === 'saveAs') {
        const created = await onSaveAs({ name, isPrivate: draftPrivate, basedOnActive: true })
        if (created) {
          cancelSubmode()
          setOpen(false)
        }
      } else if (submode === 'rename') {
        const ok = await onRename(name)
        if (ok) {
          cancelSubmode()
          setOpen(false)
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDelete = async () => {
    if (!activeRow) return
    if (!window.confirm(`Slette visningen «${activeRow.name}»? Dette kan ikke angres.`)) return
    setSubmitting(true)
    try {
      const ok = await onDelete()
      if (ok) setOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  // Hide trigger entirely when there's nothing to choose AND the user
  // hasn't saved a custom view yet — keeps the chrome quiet for first-time
  // visitors of a scope that hasn't been customised.
  const hasAnyView = available.length > 0
  if (!hasAnyView && isDefault) return null

  return (
    // `font-sans` resets the font-family because this chooser is slotted
    // inline next to the page H1, which sets Libre Baskerville on its
    // children via inline style. Without this reset the dropdown reads
    // in serif while every other UI dropdown is Inter sans.
    <div ref={containerRef} className="relative inline-block font-sans">
      <Button
        variant="ghost"
        onClick={() => setOpen((o) => !o)}
        className={
          'inline-flex items-center gap-2 rounded-none border bg-white px-3 py-2.5 text-sm font-normal text-neutral-900 outline-none transition-colors hover:bg-white ' +
          (open
            ? 'border-[#1a3d32] ring-1 ring-[#1a3d32]/25'
            : 'border-neutral-300 hover:border-neutral-400')
        }
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="max-w-[220px] truncate">{triggerLabel}</span>
        {activeIsPrivate ? <Lock className="h-3.5 w-3.5 text-neutral-400" aria-hidden /> : null}
        {activeRow?.is_default ? <Pin className="h-3.5 w-3.5 text-neutral-400" aria-hidden /> : null}
        <ChevronDown
          className={
            'h-4 w-4 shrink-0 transition-transform ' +
            (open ? 'rotate-180 text-[#1a3d32]' : 'text-neutral-400')
          }
          aria-hidden
        />
      </Button>

      {open ? (
        <div
          role="listbox"
          aria-label="Velg visning"
          className="absolute left-0 z-30 mt-1 w-[300px] border border-neutral-300 bg-white shadow-lg"
        >
          {submode === null ? (
            <div className="py-1">
              {sharedRows.length > 0 ? (
                <RowGroup
                  label="Delte visninger"
                  icon={<Users className="h-3.5 w-3.5" aria-hidden />}
                  rows={sharedRows}
                  activeId={activeRow?.id ?? null}
                  onSelect={(id) => {
                    onSelect(id)
                    setOpen(false)
                  }}
                />
              ) : null}
              {privateRows.length > 0 ? (
                <RowGroup
                  label="Mine private visninger"
                  icon={<Lock className="h-3.5 w-3.5" aria-hidden />}
                  rows={privateRows}
                  activeId={activeRow?.id ?? null}
                  onSelect={(id) => {
                    onSelect(id)
                    setOpen(false)
                  }}
                />
              ) : null}
              {sharedRows.length === 0 && privateRows.length === 0 ? (
                <p className="px-3 py-2 text-xs text-neutral-500">
                  Ingen lagrede visninger ennå.
                </p>
              ) : null}

              <div className="border-t border-neutral-100" />

              <ActionRow
                icon={<Plus className="h-4 w-4" aria-hidden />}
                label="Lagre som ny delt visning"
                onClick={() => beginSaveAs(false)}
              />
              {currentUserId ? (
                <ActionRow
                  icon={<Lock className="h-4 w-4" aria-hidden />}
                  label="Lagre som privat kopi"
                  onClick={() => beginSaveAs(true)}
                />
              ) : null}
              {canRenameOrDelete ? (
                <ActionRow
                  icon={<Pencil className="h-4 w-4" aria-hidden />}
                  label="Gi nytt navn …"
                  onClick={() => beginRename()}
                />
              ) : null}
              {activeRow && !activeIsPrivate && !activeRow.is_default ? (
                <ActionRow
                  icon={<Pin className="h-4 w-4" aria-hidden />}
                  label="Sett som standard for organisasjonen"
                  onClick={() => {
                    void onMarkDefault()
                    setOpen(false)
                  }}
                />
              ) : null}
              {canRenameOrDelete && !activeRow?.is_default ? (
                <ActionRow
                  icon={<Trash2 className="h-4 w-4" aria-hidden />}
                  label="Slett denne visningen"
                  onClick={() => void confirmDelete()}
                  destructive
                />
              ) : null}
            </div>
          ) : (
            <div className="space-y-2 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {submode === 'saveAs'
                  ? draftPrivate
                    ? 'Lagre som privat kopi'
                    : 'Lagre som ny delt visning'
                  : 'Gi nytt navn'}
              </p>
              <StandardInput
                autoFocus
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void submitSubmode()
                  }
                }}
                className="block w-full border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]/25"
                placeholder="Navn på visningen"
              />
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelSubmode}
                  disabled={submitting}
                  className="rounded-md px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
                >
                  Avbryt
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void submitSubmode()}
                  disabled={submitting || draftName.trim().length === 0}
                  className="inline-flex items-center gap-1 rounded-md bg-[#1a3d32] px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  {submitting ? 'Lagrer …' : 'Lagre'}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function RowGroup({
  label,
  icon,
  rows,
  activeId,
  onSelect,
}: {
  label: string
  icon: React.ReactNode
  rows: DashboardLayoutRow[]
  activeId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <>
      <div className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
        <span aria-hidden className="text-neutral-400">
          {icon}
        </span>
        {label}
      </div>
      <ul role="group">
        {rows.map((r) => {
          const isActive = r.id === activeId
          return (
            <li key={r.id}>
              <Button
                variant="ghost"
                role="option"
                aria-selected={isActive}
                onClick={() => onSelect(r.id)}
                className={
                  'flex w-full items-center justify-between gap-2 rounded-none border-l-2 px-3 py-2.5 text-left text-sm font-normal transition-colors hover:bg-neutral-50 ' +
                  (isActive
                    ? 'border-[#1a3d32] bg-neutral-100 font-medium text-neutral-900'
                    : 'border-transparent text-neutral-800')
                }
              >
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                <span className="flex shrink-0 items-center gap-1 text-neutral-400">
                  {r.is_default ? <Pin className="h-3 w-3" aria-label="Standard" /> : null}
                  {isActive ? <Check className="h-3.5 w-3.5 text-[#1a3d32]" /> : null}
                </span>
              </Button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function ActionRow({
  icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  destructive?: boolean
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={
        'flex w-full items-center gap-2 rounded-none border-l-2 border-transparent px-3 py-2.5 text-left text-sm font-normal transition-colors hover:bg-neutral-50 ' +
        (destructive ? 'text-red-700 hover:bg-red-50' : 'text-neutral-700')
      }
    >
      <span className="text-neutral-500" aria-hidden>
        {icon}
      </span>
      {label}
    </Button>
  )
}
