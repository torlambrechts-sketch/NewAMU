// Studio Builder — core type surface.
//
// The studio sits on top of three established patterns:
//   - declaration-merging registry (mirrors workflowRegistry's WorkflowEventMap)
//   - per-scope catalog + kinds (mirrors dashboardRegistry's scope shape)
//   - WizardModal-driven Simple presets (reuses src/components/wizard)
//
// Each studio-aware module ships a scope file at
// `modules/<scope>/studio/<scope>StudioScope.ts` that side-effect-imports
// and calls registerStudioKind(...) for each kind it offers. The
// StudioKindMap interface below is the declaration-merging target — when
// a scope file augments StudioKindMap[scopeId][kindId], TypeScript narrows
// the kind's value shape across registry consumers automatically.
//
// See specs/studio-builder.md §4 for the architecture and §3 for the
// PropertyField union narrowness rule (branching logic + workflow
// conditions live in scope embedders, NOT in this union).

import type { ReactNode, ComponentType } from 'react'
import type { WizardDef } from '../../components/wizard/types'

// ────────────────────────────────────────────────────────────────────
// 1. PropertyField — leaf-property kinds for the Advanced inspector
// ────────────────────────────────────────────────────────────────────
// Kept deliberately narrow per spec §4. Survey branching, workflow
// conditions, course module sequencing — all live inside their respective
// scope embedders, not here. The inspector exposes leaf properties only.

export type PropertyFieldBase = {
  id: string
  label: string
  /** Tooltip / hint shown under the label. */
  hint?: string
  /** Visible only when this predicate returns true. */
  showWhen?: (values: Record<string, unknown>) => boolean
  /** Required for Advanced submit. */
  required?: boolean
}

export type PropertyField =
  | (PropertyFieldBase & { kind: 'text' | 'textarea' | 'number' | 'toggle' })
  | (PropertyFieldBase & { kind: 'select'; options: Array<{ value: string; label: string }> })
  | (PropertyFieldBase & {
      kind: 'radio-cards'
      options: Array<{ value: string; label: string; description: string }>
    })
  | (PropertyFieldBase & {
      kind: 'checkbox-group'
      options: Array<{ value: string; label: string }>
    })
  /** Picks one or more "AML § 4-3"-style refs from the pack's legal_references. */
  | (PropertyFieldBase & { kind: 'law-ref-picker'; pack?: string })
  /** Picks another preset to chain into. */
  | (PropertyFieldBase & { kind: 'preset-picker'; scopeId: string; kindId: string })
  /** Mounts an inline TipTap editor for rich text. */
  | (PropertyFieldBase & { kind: 'rich-text-embed' })
  /** Mounts a small dashboard_layouts widget — for layout-bearing kinds. */
  | (PropertyFieldBase & { kind: 'layout-embed' })

export type PropertySchema = {
  fields: PropertyField[]
}

// ────────────────────────────────────────────────────────────────────
// 2. SimplePreset — outcome-named Simple-mode wizard entry
// ────────────────────────────────────────────────────────────────────
// Each preset wraps a WizardDef so we reuse WizardModal as the runner.
// `accent` flips the wizard chrome; `previewCard` produces the home-page
// card (outcome-named, e.g. "Avvik → tildel verneombud"). At publish time
// the preset's output flows through the same kind mutator the Advanced
// mode uses, so Simple/Advanced are interchangeable views of one row.

export type SimplePreset = {
  /** Stable id, scope-local. */
  id: string
  /** Outcome-named title (e.g. "Avvik → tildel verneombud"). */
  title: string
  /** Two-line description shown on the home card. */
  description: string
  /** Lucide icon name shown on the card. */
  icon: string
  /** "Mest brukt" / "Anbefalt" / etc. — surfaces a badge on the card. */
  badge?: string
  /** The WizardModal definition that drives the flow. */
  wizard: Omit<WizardDef, 'id'>
}

// ────────────────────────────────────────────────────────────────────
// 3. Embedder contract — adapter between scope editors and the shell
// ────────────────────────────────────────────────────────────────────
// Each scope ships an embedder (~100–200 LoC adapter) that wraps its
// existing editor (TipTap, dnd-kit canvas, slide-panel form, etc.) and
// exposes a controlled interface to the shell. See spec §4 "Embedder
// adapter contract".

export type EmbedderConflictResolution = 'use_server' | 'use_client' | 'merge'

export type EmbedderProps<TRow = Record<string, unknown>> = {
  value: TRow
  onChange: (next: TRow) => void
  onDirty?: (isDirty: boolean) => void
  onConflict?: (
    server: TRow,
    client: TRow,
  ) => Promise<EmbedderConflictResolution>
  /** Studio shell mode — embedders may hide affordances in Simple. */
  mode: 'simple' | 'advanced'
  readonly?: boolean
  /** Compliance / survey / meeting lock states forwarded to the embedder. */
  lockState?: 'unlocked' | 'locked' | 'signed'
}

// ────────────────────────────────────────────────────────────────────
// 4. Kind mutator — the write path
// ────────────────────────────────────────────────────────────────────
// Each kind declares a mutator that turns the embedder's row into a DB
// write. The mutator is the single place that talks to Supabase for that
// kind; useStudioRevision wraps it to write a studio_revisions row.

export type KindMutatorContext = {
  organizationId: string
  userId: string
  /** When publishing from Simple, the preset that produced the row. */
  fromPresetId?: string
  /** Active pack context (for packAware kinds). */
  packSlug?: string
}

export type KindMutatorResult<TRow = Record<string, unknown>> = {
  row: TRow
  /** Where studio_revisions stamps the row (`row_table`). */
  rowTable: string
}

export type KindMutator<TInput = Record<string, unknown>, TRow = Record<string, unknown>> = (
  input: TInput,
  ctx: KindMutatorContext,
) => Promise<KindMutatorResult<TRow>>

// ────────────────────────────────────────────────────────────────────
// 5. StudioKindMap — declaration-merging target
// ────────────────────────────────────────────────────────────────────
// Empty by design. Each scope file augments this via TypeScript declaration
// merging. Example:
//
//   declare module 'src/lib/studio/studioTypes' {
//     interface StudioKindMap {
//       documents: {
//         policy: { title: string; body: string; lawRefs: string[] }
//         instruks: { ... }
//       }
//     }
//   }
//
// Consumers (registry lookups, type-safe mutators) narrow against this
// map at compile time. Adding a kind without augmenting the map → TS
// surfaces a type error at the registration call site.

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface StudioKindMap {}

export type AnyScopeId = keyof StudioKindMap
export type AnyKindId<S extends AnyScopeId> = keyof StudioKindMap[S]

// ────────────────────────────────────────────────────────────────────
// 6. StudioKindRegistration — per-kind registry contract
// ────────────────────────────────────────────────────────────────────
// The prebuild assertion (Task 0.7) verifies that EVERY registered kind
// has BOTH simplePresets.length >= 1 AND advancedSchema.fields.length >= 1.
// A kind that exists only in Advanced (no preset) is a bug — Simple users
// would have no path to instantiate it.

/**
 * Where this kind's law-references column lives. Picked per-kind because
 * the existing template tables disagree: compliance uses `law_refs text[]`,
 * documents use `legal_basis text[]`, registers use `regulation_ids text[]`,
 * learning uses `law_refs jsonb`.
 */
export type LawRefSlot = 'law_refs' | 'legal_basis' | 'regulation_ids' | 'law_refs_jsonb' | 'none'

export type StudioKindRegistration<TRow = Record<string, unknown>> = {
  scopeId: string
  kindId: string
  label: string
  /** Accent override; defaults to the scope's accent. */
  accent?: string
  /** Lucide icon name. */
  icon?: string
  /** ≥1 required — prebuild fails when empty. */
  simplePresets: SimplePreset[]
  /** ≥1 field required — prebuild fails when empty. */
  advancedSchema: PropertySchema
  /** Lazy-import the embedder so the studio shell doesn't pull in 7 editors at load. */
  embedder: () => Promise<{ default: ComponentType<EmbedderProps<TRow>> }>
  mutator: KindMutator<TRow, TRow>
  lawRefSlot: LawRefSlot
  /** Whether the kind writes pack-aware columns (`pack`, `compliance_pack`). */
  packAware: boolean
  /** Optional CSV exporter for the analyse page's "Export" button. */
  csvExporter?: (row: TRow) => Record<string, string>
}

// ────────────────────────────────────────────────────────────────────
// 7. StudioScope — per-scope catalog metadata
// ────────────────────────────────────────────────────────────────────

export type StudioScope = {
  scopeId: string
  /** Plural label for the home-page type card (e.g. "Arbeidsflyter"). */
  label: string
  /** Singular label for breadcrumbs and chrome (e.g. "Arbeidsflyt"). */
  singular: string
  /** Two-line description on the home-page type card. */
  description: string
  /** Per-scope accent (cf. dashboardRegistry accents). */
  accent: string
  /** Tint colour for the home-page card visual background. */
  tint: string
  /** Lucide icon name. */
  icon: string
  /** A representative sample title shown on the home card. */
  sample: string
  /** Sort order in the type picker — lower = earlier. */
  order: number
  /** Whether to highlight as "Anbefalt" on the home card. */
  recommended?: boolean
  /** Optional iconographic preview renderer for the home card. */
  preview?: () => ReactNode
}

/**
 * Telemetry events emitted by the studio shell. Defined here so consumers
 * can subscribe without depending on a runtime telemetry import.
 */
export type StudioTelemetryEvent =
  | { type: 'studio.scope_opened'; scopeId: string; mode: 'simple' | 'advanced' }
  | { type: 'studio.preset_started'; scopeId: string; presetId: string }
  | {
      type: 'studio.preset_completed'
      scopeId: string
      presetId: string
      durationMs: number
    }
  | {
      type: 'studio.open_in_advanced_clicked'
      scopeId: string
      kindId?: string
      fromPresetId?: string
    }
  | { type: 'studio.mode_promoted'; from: 'simple' | 'advanced'; to: 'simple' | 'advanced'; trigger: string }
  | { type: 'studio.conflict_resolved'; scopeId: string; resolution: EmbedderConflictResolution }
  | { type: 'studio.autosave_fired'; scopeId: string; rowTable: string }
