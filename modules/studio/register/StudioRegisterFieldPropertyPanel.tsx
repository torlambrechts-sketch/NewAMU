// Right-hand property panel for the register-type field editor.
// Shown when a field card is selected.

import { X, Plus, Trash2 } from 'lucide-react'
import { StandardInput } from '../../../src/components/ui/Input'
import type { RegisterFieldBlock } from './registerFieldBlocks'
import { RegisterFieldKindSchema } from './registerFieldBlocks'

const KIND_LABELS: Record<RegisterFieldBlock['fieldKind'], string> = {
  text: 'Tekst',
  number: 'Tall',
  date: 'Dato',
  boolean: 'Ja / Nei',
  select: 'Valg (ett)',
  select_multi: 'Valg (flere)',
  doc_ref: 'Dokumentreferanse',
  location_ref: 'Stedreferanse',
}

type Props = {
  block: RegisterFieldBlock | null
  onUpdate: (id: string, patch: Partial<RegisterFieldBlock>) => void
  onDeselect: () => void
}

export function StudioRegisterFieldPropertyPanel({ block, onUpdate, onDeselect }: Props) {
  if (!block) {
    return (
      <aside className="flex w-64 shrink-0 flex-col items-center justify-center gap-2 border-l border-neutral-200 bg-neutral-50/50 p-6 text-center text-sm text-neutral-400">
        <p className="font-medium">Ingen valgt</p>
        <p>Klikk på et felt i listen for å redigere det.</p>
      </aside>
    )
  }

  const needsOptions = block.fieldKind === 'select' || block.fieldKind === 'select_multi'

  function addOption() {
    const current = block!.options ?? []
    onUpdate(block!.id, {
      options: [...current, { value: freshOptionValue(current.length), label: '' }],
    })
  }

  function updateOptionLabel(index: number, newLabel: string) {
    const current = block!.options ?? []
    const next = current.map((o, i) =>
      i === index
        ? { label: newLabel, value: slugify(newLabel) || o.value }
        : o,
    )
    onUpdate(block!.id, { options: next })
  }

  function removeOption(index: number) {
    const current = block!.options ?? []
    onUpdate(block!.id, { options: current.filter((_, i) => i !== index) })
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-5 overflow-y-auto border-l border-neutral-200 bg-white p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Feltegenskaper
        </span>
        <button
          type="button"
          onClick={onDeselect}
          className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          aria-label="Lukk panel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Label */}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-neutral-600">Feltnavn *</span>
        <StandardInput
          value={block.label}
          onChange={(e) => onUpdate(block.id, { label: e.target.value })}
          placeholder="F.eks. Leverandørnavn"
        />
      </label>

      {/* Field kind */}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-neutral-600">Felttype</span>
        <select
          value={block.fieldKind}
          onChange={(e) =>
            onUpdate(block.id, {
              fieldKind: e.target.value as RegisterFieldBlock['fieldKind'],
              // Reset options when switching away from select types
              options:
                e.target.value === 'select' || e.target.value === 'select_multi'
                  ? block.options ?? []
                  : undefined,
            })
          }
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[#1a3d32]/30"
        >
          {RegisterFieldKindSchema.options.map((kind) => (
            <option key={kind} value={kind}>
              {KIND_LABELS[kind as RegisterFieldBlock['fieldKind']] ?? kind}
            </option>
          ))}
        </select>
      </label>

      {/* Hint */}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-neutral-600">Hjelpetekst</span>
        <StandardInput
          value={block.hint ?? ''}
          onChange={(e) => onUpdate(block.id, { hint: e.target.value || undefined })}
          placeholder="Vises som hjelpetekst i skjemaet"
        />
      </label>

      {/* Required toggle */}
      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={block.required}
          onChange={(e) => onUpdate(block.id, { required: e.target.checked })}
          className="h-4 w-4 accent-[#1a3d32]"
        />
        <span className="text-neutral-700">Påkrevd felt</span>
      </label>

      {/* Options editor — only for select / select_multi */}
      {needsOptions && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-neutral-600">Valg</span>
          {(block.options ?? []).map((opt, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <StandardInput
                value={opt.label}
                onChange={(e) => updateOptionLabel(i, e.target.value)}
                placeholder={`Alternativ ${i + 1}`}
                className="flex-1 text-xs"
              />
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="shrink-0 text-neutral-300 hover:text-red-500"
                aria-label="Fjern alternativ"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="flex items-center gap-1.5 rounded border border-dashed border-neutral-300 px-2 py-1.5 text-xs text-neutral-500 hover:border-[#1a3d32] hover:text-[#1a3d32]"
          >
            <Plus className="h-3.5 w-3.5" />
            Legg til alternativ
          </button>
        </div>
      )}

      {/* Key — read-only advanced info */}
      <div className="mt-auto border-t border-neutral-100 pt-4">
        <span className="block text-xs font-medium text-neutral-400">Nøkkel</span>
        <span className="mt-0.5 block break-all font-mono text-[10px] text-neutral-400">
          {block.key}
        </span>
      </div>
    </aside>
  )
}

function freshOptionValue(index: number) {
  return `option_${index + 1}`
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 40)
}
