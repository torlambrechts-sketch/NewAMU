/**
 * Generic wizard system — step-based modal for data entry.
 *
 * A wizard definition is a list of WizardStep objects.
 * Each step owns its fields and an optional validator.
 * The WizardModal renders one step at a time with a progress bar,
 * back/next navigation, and a final submit action.
 *
 * Async step actions (`onAdvance`) and `module_picker` fields support
 * cross-module orchestration (Compliance Studio).
 */

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime-local'
  | 'select'
  | 'radio-cards'   // visual card-based radio selection
  | 'checkbox'
  | 'checkbox-group'
  | 'info'          // read-only informational block
  | 'severity'      // 4-level severity picker (low/medium/high/critical)
  | 'module_picker' // multi-select grouped by module axis (Compliance Studio)

export type SelectOption = {
  value: string
  label: string
  description?: string
  /** Lucide icon name (string ref) — rendered as emoji fallback here */
  icon?: string
  /** Visuell gruppering (eks. "Kurs", "Dokument"). Brukes av module_picker. */
  group?: string
  /** Status-pille som vises ved siden av tittel i module_picker. */
  badge?: string
}

export type WizardField = {
  id: string
  label: string
  kind: FieldKind
  placeholder?: string
  required?: boolean
  /** For select / radio-cards / checkbox-group / module_picker */
  options?: SelectOption[]
  /** Info/hint shown below the field */
  hint?: string
  /** Static body for 'info' kind */
  infoBody?: string
  /** Minimum value for number/date */
  min?: string | number
  /** Maximum value */
  max?: string | number
  /** Show this field only when condition is true */
  showWhen?: (values: Record<string, string | boolean>) => boolean
  /** Tom-tilstand-tekst når module_picker ikke har noen kandidater. */
  emptyHint?: string
}

export type WizardStepAdvanceResult = { ok: true } | { ok: false; error: string }

export type WizardStep = {
  id: string
  title: string
  subtitle?: string
  /** Optional icon emoji shown in step header */
  icon?: string
  fields: WizardField[]
  /** Return error string or null */
  validate?: (values: Record<string, string | boolean>) => string | null
  /**
   * Async side-effect kjørt etter validering, før neste steg blir aktivt.
   * Brukes til å kalle provisjonerings-RPC midt i en wizard. Bruker ser
   * loading-state. Returner { ok: false, error } for å blokkere fremgang.
   */
  onAdvance?: (
    values: Record<string, string | boolean>,
  ) => Promise<WizardStepAdvanceResult>
  /** Tekst som vises under loading mens onAdvance kjører. */
  advancingLabel?: string
}

export type WizardDef = {
  id: string
  title: string
  description?: string
  /** Accent colour (tailwind class prefix, e.g. 'red', 'emerald', 'sky') */
  colour?: 'red' | 'amber' | 'emerald' | 'sky' | 'purple' | 'neutral'
  steps: WizardStep[]
  /** Called on final submit with all collected values */
  onSubmit: (values: Record<string, string | boolean>) => void
}

