// Block model for the Studio register-type (catalogue) editor.
//
// Each RegisterFieldBlock maps to one field in
// register_types.metadata_schema.fields[].
// The block carries an ephemeral canvas `id` (never persisted) and a stable
// `key` that becomes the field key in the saved schema.

import { z } from 'zod'
import type { RegisterFieldKind } from '../../../src/types/registers'

// ─── Field kind schema ────────────────────────────────────────────────────────

export const RegisterFieldKindSchema = z.enum([
  'text',
  'number',
  'date',
  'boolean',
  'select',
  'select_multi',
  'doc_ref',
  'location_ref',
])

// ─── Select option schema ─────────────────────────────────────────────────────

export const SelectOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
})
export type SelectOption = z.infer<typeof SelectOptionSchema>

// ─── Block schema ─────────────────────────────────────────────────────────────

export const RegisterFieldBlockSchema = z.object({
  id: z.string(),           // canvas-only — stripped on save
  kind: z.literal('register_field'),
  key: z.string(),          // stable field key — maps to metadata_schema.fields[].key
  label: z.string().default(''),
  fieldKind: RegisterFieldKindSchema,
  required: z.boolean().default(false),
  hint: z.string().optional(),
  options: z.array(SelectOptionSchema).optional(), // only for select / select_multi
})
export type RegisterFieldBlock = z.infer<typeof RegisterFieldBlockSchema>

export type NewRegisterFieldBlock = Omit<RegisterFieldBlock, 'id'>

// ─── Palette ──────────────────────────────────────────────────────────────────

export type RegisterPaletteItem = {
  fieldKind: RegisterFieldKind
  label: string
  hint: string
}

export const REGISTER_FIELD_PALETTE: RegisterPaletteItem[] = [
  { fieldKind: 'text',          label: 'Tekst',           hint: 'Fritekstfelt' },
  { fieldKind: 'number',        label: 'Tall',            hint: 'Numerisk verdi' },
  { fieldKind: 'date',          label: 'Dato',            hint: 'Dato / tidspunkt' },
  { fieldKind: 'boolean',       label: 'Ja / Nei',        hint: 'Avkryssningsfelt' },
  { fieldKind: 'select',        label: 'Valg (ett)',      hint: 'Nedtrekksliste' },
  { fieldKind: 'select_multi',  label: 'Valg (flere)',    hint: 'Flervalg' },
  { fieldKind: 'doc_ref',       label: 'Dokumentreferanse', hint: 'Kobling til dokument' },
  { fieldKind: 'location_ref',  label: 'Stedreferanse',   hint: 'Kobling til sted' },
]
