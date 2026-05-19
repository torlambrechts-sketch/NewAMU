// Right panel — properties for the selected checklist block.
//
// Simple mode: prompt, item type, required toggle, severity.
// Advanced mode: adds law_ref / iso_clause, help text, and read-only key.
// iso_clause field is only shown when the template pack is an ISO pack.

import { X } from 'lucide-react'
import { StandardInput } from '../../../src/components/ui/Input'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { ToggleSwitch } from '../../../src/components/ui/FormToggles'
import { WPSTD_FORM_FIELD_LABEL } from '../../../src/components/layout/WorkplaceStandardFormPanel'
import type {
  ChecklistStudioBlock,
  ChecklistItemBlock,
  ChecklistItemType,
  ChecklistSeverity,
} from './checklistBlocks'
import type { CompliancePackSlug } from '../../compliance/types'

const ITEM_TYPE_OPTIONS: { value: ChecklistItemType; label: string }[] = [
  { value: 'yes_no_na', label: 'Ja / Nei / N/A' },
  { value: 'text', label: 'Fritekst' },
  { value: 'number', label: 'Tall' },
  { value: 'photo', label: 'Foto' },
  { value: 'signature', label: 'Signatur' },
  { value: 'date', label: 'Dato' },
]

const SEVERITY_OPTIONS: { value: ChecklistSeverity; label: string }[] = [
  { value: 'low', label: 'Lav' },
  { value: 'medium', label: 'Middels' },
  { value: 'high', label: 'Høy' },
  { value: 'critical', label: 'Kritisk' },
]

const ISO_PACKS: CompliancePackSlug[] = ['iso-45001', 'iso-9001', 'iso-14001', 'iso-27001']

type Props = {
  block: ChecklistStudioBlock | null
  advanced: boolean
  pack: CompliancePackSlug
  onUpdate: (id: string, patch: Partial<ChecklistStudioBlock>) => void
  onDeselect: () => void
}

function SectionPanel({
  block,
  onUpdate,
}: {
  block: Extract<ChecklistStudioBlock, { kind: 'section' }>
  onUpdate: (patch: Partial<Extract<ChecklistStudioBlock, { kind: 'section' }>>) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className={WPSTD_FORM_FIELD_LABEL}>TITTEL *</label>
        <StandardInput
          value={block.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Seksjonstekst"
        />
      </div>
      <div>
        <label className={WPSTD_FORM_FIELD_LABEL}>BESKRIVELSE</label>
        <StandardTextarea
          value={block.description ?? ''}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Valgfri beskrivelse"
          rows={3}
        />
      </div>
    </div>
  )
}

function ChecklistItemPanel({
  block,
  advanced,
  pack,
  onUpdate,
}: {
  block: ChecklistItemBlock
  advanced: boolean
  pack: CompliancePackSlug
  onUpdate: (patch: Partial<ChecklistItemBlock>) => void
}) {
  const isIsoPack = ISO_PACKS.includes(pack)

  return (
    <div className="space-y-4">
      <div>
        <label className={WPSTD_FORM_FIELD_LABEL}>SJEKKPUNKT *</label>
        <StandardTextarea
          value={block.prompt}
          onChange={(e) => onUpdate({ prompt: e.target.value })}
          placeholder="Beskriv hva som skal kontrolleres"
          rows={3}
        />
      </div>

      <div>
        <label className={WPSTD_FORM_FIELD_LABEL}>TYPE</label>
        <select
          value={block.itemType}
          onChange={(e) => onUpdate({ itemType: e.target.value as ChecklistItemType })}
          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#1a3d32]/30"
        >
          {ITEM_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={WPSTD_FORM_FIELD_LABEL}>ALVORLIGHETSGRAD</label>
        <select
          value={block.severity_default ?? ''}
          onChange={(e) =>
            onUpdate({
              severity_default: (e.target.value as ChecklistSeverity) || undefined,
            })
          }
          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#1a3d32]/30"
        >
          <option value="">Ikke satt</option>
          {SEVERITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={WPSTD_FORM_FIELD_LABEL}>OBLIGATORISK</label>
        <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
          <span className="text-sm text-neutral-700">Påkrev svar</span>
          <ToggleSwitch
            checked={block.required}
            onChange={(v) => onUpdate({ required: v })}
            label="Påkrev svar"
          />
        </div>
      </div>

      <div>
        <label className={WPSTD_FORM_FIELD_LABEL}>LOVHENVISNING</label>
        <StandardInput
          value={block.law_ref ?? ''}
          onChange={(e) => onUpdate({ law_ref: e.target.value || undefined })}
          placeholder="f.eks. AML § 4-1, § 4-4"
        />
      </div>

      {isIsoPack && (
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL}>ISO-KLAUSUL</label>
          <StandardInput
            value={block.iso_clause ?? ''}
            onChange={(e) => onUpdate({ iso_clause: e.target.value || undefined })}
            placeholder="f.eks. 9.2"
          />
        </div>
      )}

      {advanced && (
        <>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>HJELPETEKST</label>
            <StandardTextarea
              value={block.help ?? ''}
              onChange={(e) => onUpdate({ help: e.target.value || undefined })}
              placeholder="Veiledning for inspektøren"
              rows={3}
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>NØKKEL (kun lese)</label>
            <StandardInput value={block.key} readOnly className="cursor-default opacity-60" />
            <p className="mt-1 text-[11px] text-neutral-400">
              Stabil identifikator — endres ikke etter opprettelse.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

export function StudioChecklistPropertyPanel({ block, advanced, pack, onUpdate, onDeselect }: Props) {
  if (!block) {
    return (
      <aside className="flex h-full w-72 shrink-0 flex-col border-l border-neutral-200 bg-[#fafaf9] p-5">
        <p className="text-sm text-neutral-400">
          Velg et sjekkpunkt i midten for å redigere egenskapene.
        </p>
      </aside>
    )
  }

  const blockTitle =
    block.kind === 'section'
      ? block.title || 'Seksjon'
      : block.prompt || 'Sjekkpunkt uten tekst'

  const blockTypeLabel = block.kind === 'section' ? 'Seksjon' : 'Sjekkpunkt'

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-l border-neutral-200 bg-[#fafaf9]">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">BLOKK</p>
          <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-neutral-900">{blockTitle}</p>
          <p className="text-xs text-neutral-400">{blockTypeLabel}</p>
        </div>
        <button
          type="button"
          onClick={onDeselect}
          className="rounded p-1 text-neutral-300 hover:text-neutral-600"
          aria-label="Lukk egenskaper"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex border-b border-neutral-200 px-4">
        <button
          type="button"
          className="border-b-2 border-[#1a3d32] py-2.5 pr-4 text-xs font-semibold text-[#1a3d32]"
        >
          Egenskaper
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {block.kind === 'section' && (
          <SectionPanel
            block={block}
            onUpdate={(patch) => onUpdate(block.id, patch)}
          />
        )}
        {block.kind === 'checklist_item' && (
          <ChecklistItemPanel
            block={block}
            advanced={advanced}
            pack={pack}
            onUpdate={(patch) => onUpdate(block.id, patch)}
          />
        )}
      </div>
    </aside>
  )
}
