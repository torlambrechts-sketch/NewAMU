// Block model for the Studio checklist editor.
//
// ChecklistItemBlock maps to compliance_checklist_templates.definition.items[].
// StudioSectionBlock is imported from the shared studio types (same primitive
// used by the survey editor).

import { z } from 'zod'
import { StudioSectionBlockSchema, type StudioSectionBlock } from '../types'

// ─── Item types ───────────────────────────────────────────────────────────────

export const ChecklistItemTypeSchema = z.enum([
  'yes_no_na',
  'text',
  'number',
  'photo',
  'signature',
  'date',
])
export type ChecklistItemType = z.infer<typeof ChecklistItemTypeSchema>

export const ChecklistSeveritySchema = z.enum(['low', 'medium', 'high', 'critical'])
export type ChecklistSeverity = z.infer<typeof ChecklistSeveritySchema>

// ─── Block schemas ────────────────────────────────────────────────────────────

export const ChecklistItemBlockSchema = z.object({
  id: z.string(),
  kind: z.literal('checklist_item'),
  // Stable slug used as definition.items[].key — never changes after creation
  key: z.string(),
  prompt: z.string().default(''),
  itemType: ChecklistItemTypeSchema,
  required: z.boolean().default(true),
  severity_default: ChecklistSeveritySchema.optional(),
  law_ref: z.string().optional(),
  iso_clause: z.string().optional(),
  help: z.string().optional(),
  // Preserved round-trip; not editable in the Studio UI (managed via compliance admin).
  requirement_slugs: z.array(z.string()).optional(),
})
export type ChecklistItemBlock = z.infer<typeof ChecklistItemBlockSchema>

export const ChecklistStudioBlockSchema = z.discriminatedUnion('kind', [
  StudioSectionBlockSchema,
  ChecklistItemBlockSchema,
])
export type ChecklistStudioBlock = z.infer<typeof ChecklistStudioBlockSchema>
export type ChecklistStudioBlockKind = ChecklistStudioBlock['kind']

// Distributive Omit — preserves the discriminated union when stripping 'id'.
export type NewChecklistStudioBlock = ChecklistStudioBlock extends infer T
  ? T extends ChecklistStudioBlock
    ? Omit<T, 'id'>
    : never
  : never

// ─── Palette ──────────────────────────────────────────────────────────────────

export type ChecklistPaletteItem = {
  kind: ChecklistStudioBlockKind
  itemType?: ChecklistItemType
  label: string
  hint: string
  advancedOnly?: boolean
}

export const CHECKLIST_PALETTE: ChecklistPaletteItem[] = [
  { kind: 'section', label: 'Seksjon', hint: 'Gruppering / kapittel' },
  { kind: 'checklist_item', itemType: 'yes_no_na', label: 'Ja / Nei / N/A', hint: 'Standard sjekkpunkt' },
  { kind: 'checklist_item', itemType: 'text', label: 'Fritekst', hint: 'Skriftlig svar' },
  { kind: 'checklist_item', itemType: 'number', label: 'Tall', hint: 'Numerisk verdi' },
  { kind: 'checklist_item', itemType: 'photo', label: 'Foto', hint: 'Bildebevis', advancedOnly: true },
  { kind: 'checklist_item', itemType: 'signature', label: 'Signatur', hint: 'Håndskrift', advancedOnly: true },
  { kind: 'checklist_item', itemType: 'date', label: 'Dato', hint: 'Tidspunkt', advancedOnly: true },
]

// ─── Re-export shared section type for consumers ──────────────────────────────

export type { StudioSectionBlock }
