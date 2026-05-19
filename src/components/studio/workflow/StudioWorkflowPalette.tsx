// Left block palette for the Klarert Studio workflow editor.
// Shows grouped step kinds the user can drag onto the canvas or click to append.
// Simple mode shows only 6 essentials; Advanced shows all groups.

import { GripVertical, Info } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import type { ComponentType } from 'react'
import { ALL_PALETTE_KINDS, SIMPLE_KINDS, STUDIO_BLOCK_META, type StudioBlockKind } from './studioBlockMeta'

type PaletteProps = {
  mode: 'simple' | 'advanced'
  onDragKind: (action: 'start' | 'end' | 'append', kind: StudioBlockKind | null) => void
}

function LucideIcon({ name, className }: { name: string; className?: string }) {
  const icons = LucideIcons as Record<string, ComponentType<LucideProps>>
  const Icon = icons[name]
  if (!Icon) return null
  return <Icon className={className} />
}

export function StudioWorkflowPalette({ mode, onDragKind }: PaletteProps) {
  const kindList = mode === 'simple' ? SIMPLE_KINDS : ALL_PALETTE_KINDS

  // Group by the `group` field, preserving order
  const groups: Record<string, StudioBlockKind[]> = {}
  for (const k of kindList) {
    const m = STUDIO_BLOCK_META[k]
    if (!m) continue
    if (!groups[m.group]) groups[m.group] = []
    groups[m.group].push(k)
  }

  return (
    <div className="studio-palette">
      <div className="px-4 py-3.5 border-b border-neutral-200/70">
        <p className="k-eyebrow">Blokker</p>
        <p className="mt-1 text-[11.5px] text-neutral-500">
          Dra inn på flyten, eller klikk for å legge til nederst.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {Object.entries(groups).map(([group, kinds]) => (
          <div key={group}>
            <p className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              {group}
            </p>
            <div className="space-y-1">
              {kinds.map((k) => {
                const m = STUDIO_BLOCK_META[k]
                return (
                  <div
                    key={k}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'copy'
                      e.dataTransfer.setData('application/x-klarert-kind', k)
                      onDragKind('start', k)
                    }}
                    onDragEnd={() => onDragKind('end', null)}
                    onClick={() => onDragKind('append', k)}
                    className="group flex items-center gap-2 rounded-md border border-neutral-200/70 bg-white px-2 py-1.5 text-[12px] text-neutral-700 hover:border-[#1a3d32]/40 hover:bg-[#e7efe9]/40 cursor-grab active:cursor-grabbing"
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
                      style={{ background: m.tint, color: m.accent, border: `1px solid ${m.border}` }}
                    >
                      <LucideIcon name={m.icon} className="h-3 w-3" />
                    </span>
                    <span className="font-medium text-neutral-900 truncate">{m.label}</span>
                    <GripVertical className="ml-auto h-3 w-3 text-neutral-300 group-hover:text-neutral-500" />
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {mode === 'simple' && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800 flex items-start gap-1.5">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            <span>
              Bytt til <b>Avansert</b> for å se Teams, SMS, webhooks og flere.
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
