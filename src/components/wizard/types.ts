/**
 * Generic wizard system — step-based modal for data entry.
 *
 * A wizard definition is a list of WizardStep objects.
 * Each step owns its fields and an optional validator.
 * The WizardModal renders one step at a time with a progress bar,
 * back/next navigation, and a final submit action.
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

export type SelectOption = {
  value: string
  label: string
  description?: string
  /** Lucide icon name (string ref) — rendered as emoji fallback here */
  icon?: string
}

export type WizardField = {
  id: string
  label: string
  kind: FieldKind
  placeholder?: string
  required?: boolean
  /** For select / radio-cards / checkbox-group */
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
}

export type WizardStep = {
  id: string
  title: string
  subtitle?: string
  /** Optional icon emoji shown in step header */
  icon?: string
  fields: WizardField[]
  /** Return error string or null */
  validate?: (values: Record<string, string | boolean>) => string | null
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
