// LearningModuleRail — left-rail flat ordered list of course modules,
// matching the Klarert dashboard kit's CourseEditor design
// (`ui_kits/elearning/editor/CourseEditor.jsx` ModuleRail).
//
// Differences vs. the design:
//   - We use the existing addModule/deleteModule/reorderModules hooks
//     from useLearning (not local React state with autosave).
//   - Sections (CourseSection) are not represented in the rail — the
//     design is flat. The Course type still has a `sections` field; it
//     stays editable elsewhere if needed.
//
// The right-pane editor is kept as the existing `ModuleEditor` sibling
// in LearningCourseBuilder; this rail just renders the list + handles
// selection / reorder / add / duplicate / delete.

import { useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Copy,
  Download,
  GitBranch,
  HelpCircle,
  Image as ImageIcon,
  Lightbulb,
  Layers as LayersIcon,
  MoreVertical,
  PlayCircle,
  Plus,
  Sparkles,
  Trash2,
  Wrench,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { CourseModule, ModuleKind } from '../../types/learning'

type KindMeta = { label: string; icon: ComponentType<{ className?: string }> }

const LEARNING_KIND_META: Record<ModuleKind, KindMeta> = {
  text: { label: 'Lese', icon: BookOpen },
  image: { label: 'Bilde', icon: ImageIcon },
  video: { label: 'Video', icon: PlayCircle },
  flashcard: { label: 'Flashkort', icon: Sparkles },
  quiz: { label: 'Quiz', icon: HelpCircle },
  checklist: { label: 'Sjekkliste', icon: CheckSquare },
  tips: { label: 'Tips', icon: Lightbulb },
  on_job: { label: 'I praksis', icon: Wrench },
  event: { label: 'Arrangement', icon: ClipboardList },
  scenario: { label: 'Scenario', icon: GitBranch },
  other: { label: 'Annet', icon: LayersIcon },
}

const KIND_LIST: ModuleKind[] = [
  'text',
  'image',
  'video',
  'flashcard',
  'quiz',
  'checklist',
  'tips',
  'on_job',
  'event',
  'scenario',
]

type Props = {
  modules: CourseModule[]
  activeId: string | null
  isLocked?: boolean
  onSelect: (id: string) => void
  onMove: (idx: number, dir: -1 | 1) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onAdd: (kind: ModuleKind) => void
  /** Optional — when provided the rail's "..." menu adds an
   *  "Eksporter JSON" item per module. Caller serialises the module
   *  + downloads the file. */
  onExport?: (id: string) => void
}

export function LearningModuleRail({
  modules,
  activeId,
  isLocked,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
  onAdd,
  onExport,
}: Props) {
  const totalMin = modules.reduce((s, m) => s + (m.durationMinutes || 0), 0)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            Moduler
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-neutral-600">
            {modules.length} moduler · ~{totalMin} min
          </p>
        </div>
      </div>

      <ol className="flex-1 space-y-1 overflow-y-auto p-2">
        {modules.length === 0 ? (
          <li className="px-3 py-6 text-center text-xs text-neutral-500">
            Ingen moduler ennå. Bruk «Ny modul» under.
          </li>
        ) : null}
        {modules.map((m, i) => {
          const meta = LEARNING_KIND_META[m.kind] ?? LEARNING_KIND_META.other
          const KindIcon = meta.icon
          const active = m.id === activeId
          return (
            <li key={m.id}>
              <div
                className={
                  'group relative flex items-center gap-2.5 rounded-md border px-2 py-2 transition-colors ' +
                  (active
                    ? 'border-[#1a3d32]/40 bg-[#e7efe9]'
                    : 'border-transparent hover:border-neutral-200 hover:bg-neutral-50')
                }
              >
                <button
                  type="button"
                  onClick={() => onSelect(m.id)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <span
                    className={
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ' +
                      (active
                        ? 'bg-[#1a3d32] text-white'
                        : 'border border-neutral-300 bg-white text-neutral-600')
                    }
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-neutral-900">
                        {m.title || (
                          <span className="italic text-neutral-400">Uten tittel</span>
                        )}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-neutral-500">
                      <KindIcon className="h-3 w-3" />
                      <span>{meta.label}</span>
                      <span className="text-neutral-300">·</span>
                      <span className="tabular-nums">{m.durationMinutes || 0} min</span>
                    </div>
                  </div>
                </button>
                {isLocked ? null : (
                  <div className="invisible flex items-center group-hover:visible">
                    <button
                      type="button"
                      onClick={() => onMove(i, -1)}
                      disabled={i === 0}
                      className="rounded p-1 text-neutral-400 hover:bg-white hover:text-neutral-700 disabled:opacity-30"
                      aria-label="Flytt opp"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(i, 1)}
                      disabled={i === modules.length - 1}
                      className="rounded p-1 text-neutral-400 hover:bg-white hover:text-neutral-700 disabled:opacity-30"
                      aria-label="Flytt ned"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <RailMenu
                      onDuplicate={() => onDuplicate(m.id)}
                      onDelete={() => onDelete(m.id)}
                      onExport={onExport ? () => onExport(m.id) : undefined}
                    />
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {isLocked ? null : (
        <div className="border-t border-neutral-100 p-3">
          <AddModuleMenu onAdd={onAdd} />
        </div>
      )}
    </div>
  )
}

function RailMenu({
  onDuplicate,
  onDelete,
  onExport,
}: {
  onDuplicate: () => void
  onDelete: () => void
  onExport?: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const fn = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', fn)
    return () => document.removeEventListener('pointerdown', fn)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded p-1 text-neutral-400 hover:bg-white hover:text-neutral-700"
        aria-label="Mer"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg">
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onDuplicate()
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50"
          >
            <Copy className="h-3 w-3" /> Dupliser
          </button>
          {onExport ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onExport()
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50"
            >
              <Download className="h-3 w-3" /> Eksporter JSON
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onDelete()
            }}
            className="flex w-full items-center gap-2 border-t border-neutral-100 px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-3 w-3" /> Slett
          </button>
        </div>
      ) : null}
    </div>
  )
}

function AddModuleMenu({ onAdd }: { onAdd: (kind: ModuleKind) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-neutral-300 bg-white px-3 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:border-[#1a3d32] hover:bg-[#e7efe9] hover:text-[#1a3d32]"
      >
        <Plus className="h-4 w-4" />
        Ny modul
      </button>
      {open ? (
        <div
          className="absolute bottom-full left-0 right-0 z-20 mb-2 grid grid-cols-2 gap-1 rounded-md border border-neutral-200 bg-white p-1.5 shadow-lg"
          onMouseLeave={() => setOpen(false)}
        >
          {KIND_LIST.map((k) => {
            const meta = LEARNING_KIND_META[k]
            const KindIcon = meta.icon
            return (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setOpen(false)
                  onAdd(k)
                }}
                className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-neutral-700 transition-colors hover:bg-[#e7efe9] hover:text-[#1a3d32]"
              >
                <KindIcon className="h-3.5 w-3.5" />
                <span className="font-medium">{meta.label}</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
