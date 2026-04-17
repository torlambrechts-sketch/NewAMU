import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Heading, Image as ImageIcon, LayoutTemplate, Minus, Scale, Sparkles, Type, Zap } from 'lucide-react'
import type { Block, ModuleBlock } from '../../types/documents'

export type PaletteEntry = {
  id: string
  group: string
  kind: Block['kind']
  label: string
  description: string
  Icon: typeof Type
  moduleName?: ModuleBlock['moduleName']
}

const ENTRIES: PaletteEntry[] = [
  { id: 'text', group: 'Innhold', kind: 'text', label: 'Tekstavsnitt', description: 'Rik tekst med Quill', Icon: Type },
  { id: 'heading', group: 'Innhold', kind: 'heading', label: 'Overskrift', description: 'H1–H3', Icon: Heading },
  { id: 'divider', group: 'Innhold', kind: 'divider', label: 'Skillelinje', description: 'Horisontal linje', Icon: Minus },
  { id: 'alert', group: 'Bokser', kind: 'alert', label: 'Varselboks', description: 'Info, advarsel, fare, tips', Icon: LayoutTemplate },
  { id: 'law_ref', group: 'Juridisk', kind: 'law_ref', label: 'Lovhenvisning', description: 'Hjemmel med beskrivelse', Icon: Scale },
  { id: 'image', group: 'Innhold', kind: 'image', label: 'Bilde', description: 'Opplasting til dokumentlager', Icon: ImageIcon },
  {
    id: 'module_org',
    group: 'Live',
    kind: 'module',
    label: 'Organisasjonskart',
    description: 'AMU / verneombud',
    Icon: Sparkles,
    moduleName: 'live_org_chart',
  },
  {
    id: 'module_risk',
    group: 'Live',
    kind: 'module',
    label: 'Risikooversikt',
    description: 'ROS fra internkontroll',
    Icon: Zap,
    moduleName: 'live_risk_feed',
  },
  {
    id: 'module_action',
    group: 'Live',
    kind: 'module',
    label: 'Handlingsknapp',
    description: 'Lenke til rute i appen',
    Icon: Zap,
    moduleName: 'action_button',
  },
  {
    id: 'module_ack',
    group: 'Live',
    kind: 'module',
    label: 'Signaturfelt',
    description: 'Lest og forstått (krever innstilling på siden)',
    Icon: Sparkles,
    moduleName: 'acknowledgement_footer',
  },
]

function score(q: string, label: string, desc: string, group: string): number {
  const s = q.trim().toLowerCase()
  if (!s) return 1
  let n = 0
  if (label.toLowerCase().includes(s)) n += 10
  if (desc.toLowerCase().includes(s)) n += 5
  if (group.toLowerCase().includes(s)) n += 2
  for (const ch of s) {
    if (label.toLowerCase().includes(ch)) n += 0.1
  }
  return n
}

type Props = {
  open: boolean
  onClose: () => void
  onPick: (entry: PaletteEntry) => void
}

export function WikiEditorCommandPalette({ open, onClose, onPick }: Props) {
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    if (!open) return
    queueMicrotask(() => inputRef.current?.focus())
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const filtered = useMemo(() => {
    const list = ENTRIES.map((e) => ({ e, sc: score(q, e.label, e.description, e.group) }))
      .filter((x) => x.sc > 0)
      .sort((a, b) => b.sc - a.sc)
    return list.map((x) => x.e)
  }, [q])

  const grouped = useMemo(() => {
    const m = new Map<string, PaletteEntry[]>()
    for (const e of filtered) {
      const arr = m.get(e.group) ?? []
      arr.push(e)
      m.set(e.group, arr)
    }
    return [...m.entries()]
  }, [filtered])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Legg til blokk"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-lg rounded-none border border-neutral-200 bg-white shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="border-b border-neutral-100 px-3 py-2">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søk etter blokktype…"
            className="w-full rounded-none border-0 bg-transparent px-2 py-2 text-sm outline-none ring-0 placeholder:text-neutral-400"
          />
        </div>
        <div className="max-h-[min(60vh,420px)] overflow-y-auto py-2">
          {grouped.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-neutral-500">Ingen treff</p>
          ) : (
            grouped.map(([group, items]) => (
              <div key={group}>
                <p className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">{group}</p>
                <ul>
                  {items.map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onPick(e)
                          onClose()
                        }}
                        className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-neutral-50"
                      >
                        <e.Icon className="mt-0.5 size-4 shrink-0 text-[#1a3d32]" aria-hidden />
                        <span>
                          <span className="block text-sm font-medium text-neutral-900">{e.label}</span>
                          <span className="mt-0.5 block text-xs text-neutral-500">{e.description}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
        <p className="border-t border-neutral-100 px-4 py-2 text-[11px] text-neutral-400">Esc lukker · Enter velger første treff (klikk rad)</p>
      </div>
    </div>
  )
}
