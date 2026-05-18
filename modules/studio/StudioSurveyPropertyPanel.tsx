// Right panel — properties for the currently selected block.
//
// Simple mode: title + required toggle only.
// Advanced mode: adds law_ref, scale anchors, and options list editor.

import { Plus, Trash2, X } from 'lucide-react'
import { StandardInput } from '../../src/components/ui/Input'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { ToggleSwitch } from '../../src/components/ui/FormToggles'
import { Button } from '../../src/components/ui/Button'
import { WPSTD_FORM_FIELD_LABEL } from '../../src/components/layout/WorkplaceStandardFormPanel'
import type { StudioBlock, StudioBranchBlock, StudioQuestionBlock, StudioSectionBlock } from './types'

const QUESTION_TYPE_LABEL: Partial<Record<string, string>> = {
  single_select: 'Enkeltvalg',
  multi_select: 'Flervalg',
  multiple_choice: 'Flervalg (knapper)',
  likert_5: 'Skala 1–5',
  likert_7: 'Skala 1–7',
  scale_10: 'Skala 0–10',
  text: 'Fritekst',
  yes_no: 'Ja / Nei',
  matrix: 'Matrise',
  ranking: 'Rangering',
  voting: 'Votering',
  nps: 'NPS',
}

type Props = {
  block: StudioBlock | null
  advanced: boolean
  onUpdate: (id: string, patch: Partial<StudioBlock>) => void
  onDeselect: () => void
}

function SectionPanel({
  block,
  onUpdate,
}: {
  block: StudioSectionBlock
  onUpdate: (patch: Partial<StudioSectionBlock>) => void
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

function QuestionPanel({
  block,
  advanced,
  onUpdate,
}: {
  block: StudioQuestionBlock
  advanced: boolean
  onUpdate: (patch: Partial<StudioQuestionBlock>) => void
}) {
  const hasOptions =
    block.questionType === 'single_select' ||
    block.questionType === 'multi_select' ||
    block.questionType === 'multiple_choice' ||
    block.questionType === 'ranking'

  const hasAnchors =
    block.questionType === 'likert_5' ||
    block.questionType === 'likert_7' ||
    block.questionType === 'scale_10'

  function updateOption(index: number, value: string) {
    const opts = [...(block.options ?? [])]
    opts[index] = value
    onUpdate({ options: opts })
  }

  function addOption() {
    onUpdate({ options: [...(block.options ?? []), ''] })
  }

  function removeOption(index: number) {
    const opts = (block.options ?? []).filter((_, i) => i !== index)
    onUpdate({ options: opts })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={WPSTD_FORM_FIELD_LABEL}>TITTEL *</label>
        <StandardTextarea
          value={block.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          placeholder="Spørsmålstekst"
          rows={3}
        />
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

      {hasOptions && (
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL}>SVARALTERNATIVER</label>
          <div className="space-y-1.5">
            {(block.options ?? []).map((opt, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <StandardInput
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Alternativ ${i + 1}`}
                />
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  className="shrink-0 rounded p-1 text-neutral-300 hover:text-red-500"
                  aria-label="Fjern alternativ"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addOption}
              className="w-full justify-start gap-1.5 border border-dashed border-neutral-200 text-neutral-500"
            >
              <Plus className="h-3.5 w-3.5" />
              Legg til alternativ
            </Button>
          </div>
        </div>
      )}

      {hasAnchors && advanced && (
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL}>ENDEPUNKT-TEKST</label>
          <div className="flex gap-2">
            <StandardInput
              value={block.anchors?.low ?? ''}
              onChange={(e) =>
                onUpdate({ anchors: { low: e.target.value, high: block.anchors?.high ?? '' } })
              }
              placeholder="Helt uenig"
            />
            <StandardInput
              value={block.anchors?.high ?? ''}
              onChange={(e) =>
                onUpdate({ anchors: { low: block.anchors?.low ?? '', high: e.target.value } })
              }
              placeholder="Helt enig"
            />
          </div>
        </div>
      )}

      {advanced && (
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL}>LOVHENVISNING</label>
          <StandardInput
            value={block.law_ref ?? ''}
            onChange={(e) => onUpdate({ law_ref: e.target.value })}
            placeholder="f.eks. AML § 4-3"
          />
        </div>
      )}
    </div>
  )
}

function BranchPanel({
  block,
  onUpdate,
}: {
  block: StudioBranchBlock
  onUpdate: (patch: Partial<StudioBranchBlock>) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className={WPSTD_FORM_FIELD_LABEL}>ETIKETT</label>
        <StandardInput
          value={block.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="f.eks. Hvis svar < 3 →"
        />
      </div>
      <div>
        <label className={WPSTD_FORM_FIELD_LABEL}>BETINGELSE</label>
        <p className="text-xs text-neutral-400">
          Avansert betingelseseditor kommer i neste versjon.
        </p>
      </div>
    </div>
  )
}

export function StudioSurveyPropertyPanel({ block, advanced, onUpdate, onDeselect }: Props) {
  if (!block) {
    return (
      <aside className="flex h-full w-72 shrink-0 flex-col border-l border-neutral-200 bg-[#fafaf9] p-5">
        <p className="text-sm text-neutral-400">
          Velg en blokk i midten for å redigere egenskapene.
        </p>
      </aside>
    )
  }

  const blockTypeLabel =
    block.kind === 'section'
      ? 'Seksjon'
      : block.kind === 'branch'
        ? 'Forgrening'
        : (QUESTION_TYPE_LABEL[block.questionType] ?? block.questionType)

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-l border-neutral-200 bg-[#fafaf9]">
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">BLOKK</p>
          <p className="mt-0.5 text-sm font-semibold text-neutral-900">
            {block.kind === 'section'
              ? block.title || 'Seksjon'
              : block.kind === 'branch'
                ? block.label || 'Forgrening'
                : block.text || 'Spørsmål uten tekst'}
          </p>
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

      {/* Tabs — only "Egenskaper" is functional; "Stil" is a placeholder */}
      <div className="flex border-b border-neutral-200 px-4">
        <button
          type="button"
          className="border-b-2 border-[#1a3d32] py-2.5 pr-4 text-xs font-semibold text-[#1a3d32]"
        >
          Egenskaper
        </button>
        <button
          type="button"
          className="py-2.5 pr-4 text-xs text-neutral-400"
          disabled
        >
          Stil 🔒
        </button>
      </div>

      {/* Properties content */}
      <div className="flex-1 overflow-y-auto p-4">
        {block.kind === 'section' && (
          <SectionPanel
            block={block}
            onUpdate={(patch) => onUpdate(block.id, patch)}
          />
        )}
        {block.kind === 'question' && (
          <QuestionPanel
            block={block}
            advanced={advanced}
            onUpdate={(patch) => onUpdate(block.id, patch)}
          />
        )}
        {block.kind === 'branch' && (
          <BranchPanel
            block={block}
            onUpdate={(patch) => onUpdate(block.id, patch)}
          />
        )}
      </div>
    </aside>
  )
}
