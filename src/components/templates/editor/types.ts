// Shared editor types for the step-list template editor.
// Each template source ships a TemplateEditorAdapter that hydrates a draft,
// flattens it into EditorStep rows, renders per-step detail fields, and
// commits drafts (auto-save) or live versions (explicit Publiser).

import type { ComponentType, ReactNode } from 'react'

export type EditorMode = 'drawer' | 'fullscreen'

export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

export type EditorStepKind = 'trigger' | 'condition' | 'action' | 'logic' | 'item' | 'section'

export type EditorStepAccent = 'violet' | 'amber' | 'blue' | 'green' | 'rose' | 'slate' | 'teal'

export type EditorStep = {
  /** Stable per session. */
  uiKey: string
  kind: EditorStepKind
  title: string
  subtitle: string
  icon: ComponentType<{ className?: string }>
  accent: EditorStepAccent
  /** Locked rows can't be removed or moved (e.g. workflow trigger). */
  locked: boolean
  /** Marks the row as "fullført" for the progress chip. */
  completed: boolean
}

export type AdapterMeta = {
  title: string
  /** Optional subtitle shown under the breadcrumb in fullscreen mode. */
  subtitle?: string
  lawRefs: string[]
  /** Free-form version label (e.g. "v3 (kladd)" or "Publisert"). */
  versionLabel?: string
  /** When true, the shell renders the adapter's metadata-only view instead of the step list. */
  metadataOnly?: boolean
  /** Accent color for the header icon chip. */
  accent?: EditorStepAccent
  /** Icon for the header chip. */
  icon?: ComponentType<{ className?: string }>
}

export type AddStepOption = {
  id: string
  label: string
  /** Optional sub-label / hint shown under the option. */
  hint?: string
  icon?: ComponentType<{ className?: string }>
}

export type AdapterEscapeHatch = {
  /** Label for the redirect CTA — e.g. «Åpne i avansert visning». */
  label: string
  /** Reason shown above the CTA. */
  reason: string
  onOpen: () => void
}

/**
 * Per-source adapter. Lives outside the shell so the shell stays generic.
 * `TDraft` is the in-memory draft shape (typically the editable JSON column).
 */
export type TemplateEditorAdapter<TDraft> = {
  /** Used for telemetry + tagging UI elements. */
  source: string

  /** Hydrate the in-memory draft for the given row. Returns null if not found. */
  hydrate: (rowId: string) => Promise<{
    draft: TDraft
    canEdit: boolean
    meta: AdapterMeta
    /** When set, the shell renders an escape-hatch card instead of the step list. */
    escapeHatch?: AdapterEscapeHatch | null
  } | null>

  /** Build a flat list of step cards from the draft. Trigger / header rows come first. */
  buildSteps: (draft: TDraft) => EditorStep[]

  /** Right-pane detail editor for a step. */
  renderStepDetail: (
    step: EditorStep,
    draft: TDraft,
    patch: (next: TDraft) => void,
  ) => ReactNode

  /** Returns the menu options shown when the user clicks «Legg til steg». */
  addStepOptions: (draft: TDraft) => AddStepOption[]

  /** Add a step. Called when the user picks an option from the «Legg til» menu. */
  applyAddStep: (draft: TDraft, optionId: string) => TDraft

  /** Remove a step. Locked steps are filtered out by the shell before this is called. */
  applyRemoveStep: (draft: TDraft, step: EditorStep) => TDraft

  /** Returns a human error string if the draft is not committable, null if OK. */
  validate: (draft: TDraft) => string | null

  /** Persist the draft (auto-save). Should write to a draft column when available. */
  saveDraft: (rowId: string, draft: TDraft) => Promise<{ ok: boolean; error?: string }>

  /** Promote the current draft to the live row. Triggered by «Publiser». */
  publish: (rowId: string, draft: TDraft) => Promise<{ ok: boolean; error?: string }>

  /** Optional variable chips shown under the detail card in fullscreen mode. */
  variables?: (draft: TDraft) => string[]

  /** Optional read-only metadata view rendered when meta.metadataOnly is true. */
  renderMetadataOnly?: (
    draft: TDraft,
    patch: (next: TDraft) => void,
  ) => ReactNode
}
