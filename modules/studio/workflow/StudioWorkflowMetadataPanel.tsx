// Right-hand metadata panel for the workflow template Studio editor.
// Handles law_refs, frameworks, pack, cadence_hint, and confidentiality_level.

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { StandardInput } from '../../../src/components/ui/Input'
import type { WorkflowConfidentialityLevel } from '../../../src/types/workflow'

const FRAMEWORK_OPTIONS = [
  { value: 'aml-amu',              label: 'AML / AMU' },
  { value: 'iso-45001',            label: 'ISO 45001' },
  { value: 'gdpr',                 label: 'GDPR' },
  { value: 'hovedavtalen',         label: 'Hovedavtalen' },
  { value: 'likestillingsloven',   label: 'Likestillingsloven' },
]

const PACK_OPTIONS = [
  { value: '', label: '— Ingen pakke —' },
  { value: 'aml-amu',   label: 'AML / AMU' },
  { value: 'iso-45001', label: 'ISO 45001' },
  { value: 'gdpr',      label: 'GDPR' },
]

const LAW_REF_SUGGESTIONS = [
  'AML § 3-1', 'AML § 4-1', 'AML § 4-3', 'AML § 5-2', 'AML § 2A-7 (5)',
  'IK-f § 5 nr. 7', 'GDPR Art. 33', 'GDPR Art. 35',
]

const CONFIDENTIALITY_OPTIONS: { value: WorkflowConfidentialityLevel; label: string; hint: string }[] = [
  { value: 'standard',     label: 'Standard',       hint: 'Synlig for alle i org' },
  { value: 'restricted',   label: 'Begrenset',      hint: 'HMS-leder og admin' },
  { value: 'confidential', label: 'Konfidensiell',  hint: 'Kun org-admin' },
]

type Props = {
  lawRefs: string[]
  frameworks: string[]
  pack: string | null
  cadenceHint: string
  confidentialityLevel: WorkflowConfidentialityLevel
  disabled?: boolean
  onLawRefs: (refs: string[]) => void
  onFrameworks: (fw: string[]) => void
  onPack: (p: string | null) => void
  onCadenceHint: (h: string) => void
  onConfidentialityLevel: (l: WorkflowConfidentialityLevel) => void
}

export function StudioWorkflowMetadataPanel({
  lawRefs,
  frameworks,
  pack,
  cadenceHint,
  confidentialityLevel,
  disabled = false,
  onLawRefs,
  onFrameworks,
  onPack,
  onCadenceHint,
  onConfidentialityLevel,
}: Props) {
  const [lawRefInput, setLawRefInput] = useState('')

  function addLawRef(ref: string) {
    const trimmed = ref.trim()
    if (!trimmed || lawRefs.includes(trimmed)) return
    onLawRefs([...lawRefs, trimmed])
    setLawRefInput('')
  }

  function removeLawRef(ref: string) {
    onLawRefs(lawRefs.filter((r) => r !== ref))
  }

  function toggleFramework(fw: string) {
    if (frameworks.includes(fw)) {
      onFrameworks(frameworks.filter((f) => f !== fw))
    } else {
      onFrameworks([...frameworks, fw])
    }
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-5 overflow-y-auto border-l border-neutral-200 bg-white p-4">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Malmetadata
        </span>
      </div>

      {/* Law refs */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-neutral-600">Lovhenvisninger</span>
        {lawRefs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {lawRefs.map((ref) => (
              <span
                key={ref}
                className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800"
              >
                {ref}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeLawRef(ref)}
                    className="text-emerald-500 hover:text-emerald-700"
                    aria-label={`Fjern ${ref}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
        {!disabled && (
          <div className="flex gap-1.5">
            <StandardInput
              value={lawRefInput}
              onChange={(e) => setLawRefInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLawRef(lawRefInput) } }}
              placeholder="F.eks. AML § 5-2"
              className="flex-1 text-xs"
              list="law-ref-suggestions"
            />
            <datalist id="law-ref-suggestions">
              {LAW_REF_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
            </datalist>
            <button
              type="button"
              onClick={() => addLawRef(lawRefInput)}
              className="shrink-0 rounded-lg border border-neutral-200 px-2 py-1 text-xs text-neutral-500 hover:border-[#1a3d32] hover:text-[#1a3d32]"
              aria-label="Legg til lovhenvisning"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Frameworks */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-neutral-600">Rammeverk</span>
        <div className="flex flex-col gap-1.5">
          {FRAMEWORK_OPTIONS.map((fw) => (
            <label key={fw.value} className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={frameworks.includes(fw.value)}
                onChange={() => !disabled && toggleFramework(fw.value)}
                disabled={disabled}
                className="h-3.5 w-3.5 accent-[#1a3d32]"
              />
              <span className="text-neutral-700">{fw.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Pack */}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-neutral-600">Pakke</span>
        <select
          value={pack ?? ''}
          disabled={disabled}
          onChange={(e) => onPack(e.target.value || null)}
          className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[#1a3d32]/30 disabled:bg-neutral-50"
        >
          {PACK_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </label>

      {/* Cadence hint */}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-neutral-600">Kadensantydning</span>
        <StandardInput
          value={cadenceHint}
          onChange={(e) => !disabled && onCadenceHint(e.target.value)}
          disabled={disabled}
          placeholder="arlig / kvartalsvis / ad_hoc"
          className="text-xs"
        />
      </label>

      {/* Confidentiality */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-neutral-600">Konfidensialitetsnivå</span>
        <div className="flex flex-col gap-2">
          {CONFIDENTIALITY_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-start gap-2 text-xs">
              <input
                type="radio"
                name="confidentiality"
                value={opt.value}
                checked={confidentialityLevel === opt.value}
                onChange={() => !disabled && onConfidentialityLevel(opt.value)}
                disabled={disabled}
                className="mt-0.5 h-3.5 w-3.5 accent-[#1a3d32]"
              />
              <span>
                <span className="font-medium text-neutral-700">{opt.label}</span>
                <span className="ml-1 text-neutral-400">— {opt.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
    </aside>
  )
}
