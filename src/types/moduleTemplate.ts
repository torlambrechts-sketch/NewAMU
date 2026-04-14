/**
 * ModuleTemplate — reusable, DB-backed configuration for any compliance/HSE module.
 *
 * Best-practice rules encoded here (reuse for SJA, Vernerunder, Hendelser, etc.):
 *
 * 1. SEPARATION OF CONCERNS
 *    Config (this type) lives in the DB; rendering logic lives in components.
 *    Never hardcode labels, columns or workflow steps in component JSX.
 *
 * 2. MODULE KEY
 *    Every template is keyed by a stable `moduleKey` string (e.g. "hse.inspections",
 *    "hse.sja", "hse.vernerunder"). This decouples the config from URL structure.
 *
 * 3. TABLE COLUMNS
 *    Each column has an `id` (maps to a data field), display `label`, `width` hint,
 *    `sortable` flag, and optional `format` (date, pill, badge, text). Columns are
 *    ordered — the order array controls rendering. Columns can be hidden per org.
 *
 * 4. INSPECTION / CASE TYPES
 *    A free-form list of types the org defines (e.g. "HMS-runde", "Kjøretøykontroll").
 *    Each type can carry its own checklist template ID for dynamic field injection.
 *
 * 5. STATUS WORKFLOW
 *    An ordered list of statuses. Each status has a color token, label and optional
 *    transitions (which statuses it can move to). This drives pills, filters and
 *    Kanban-style boards without hardcoded if/else chains.
 *
 * 6. WORKFLOW RULES (case → task / case → email)
 *    Each rule is: trigger condition → action. Conditions match on field values
 *    (e.g. severity === 'high', status === 'open'). Actions are typed: create_task,
 *    send_email, notify_role. Rules are evaluated server-side on save/update.
 *
 * 7. FIELD SCHEMA
 *    The ordered list of input fields shown in the "new record" form. Each field has
 *    a type, label, validation rules and visibility conditions. Same pattern as wizard
 *    steps — reuse WizardField where possible.
 *
 * 8. SETTINGS ARE VERSIONED
 *    `schemaVersion` lets migrations detect old configs. Bump when adding required fields.
 *
 * 9. DEFAULTS AND NULLABILITY
 *    Every setting has a safe default so the module renders correctly even before
 *    an admin configures it. Never crash on missing config.
 *
 * 10. PUBLISH GATE
 *    Config changes do not affect end-users until explicitly published (same pattern
 *    as page_layouts and platform_composer_templates).
 */

/* ── Column configuration ────────────────────────────────────────────────── */

export type ColumnFormat =
  | 'text'        // plain string
  | 'date'        // ISO → formatted date
  | 'datetime'    // ISO → formatted date+time
  | 'pill'        // status pill with color from StatusDef
  | 'badge'       // small numeric badge
  | 'user'        // user display name
  | 'boolean'     // yes/no
  | 'actions'     // row action menu (always last column)

export type TableColumn = {
  id: string            // maps to a data field key, e.g. "status", "conductedAt"
  label: string         // display label in column header
  format: ColumnFormat
  width?: 'xs' | 'sm' | 'md' | 'lg' | 'auto'
  sortable?: boolean
  filterable?: boolean
  hidden?: boolean      // soft-hide without removing from config
  /** For 'pill'/'badge': which statusDef key to look up color from */
  statusRef?: string
}

/* ── Status workflow ──────────────────────────────────────────────────────── */

export type StatusColor =
  | 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'teal'

export type StatusDef = {
  key: string             // machine key, e.g. "planned", "in_progress", "approved"
  label: string           // display label, e.g. "Planlagt"
  color: StatusColor
  /** Status keys this status can transition to (empty = terminal) */
  transitions?: string[]
  /** If true, this status closes/locks the record */
  isTerminal?: boolean
  /** Display order in filters and Kanban */
  sortOrder: number
}

/* ── Case types ───────────────────────────────────────────────────────────── */

export type CaseType = {
  id: string
  label: string
  description?: string
  /** Optional checklist template to auto-attach when this type is selected */
  checklistTemplateId?: string
  /** Default responsible role key */
  defaultResponsibleRole?: string
  color?: StatusColor
  active: boolean
}

/* ── Workflow rules ───────────────────────────────────────────────────────── */

export type WorkflowTrigger =
  | { type: 'on_create' }
  | { type: 'on_status_change'; toStatus: string }
  | { type: 'on_field_value'; field: string; operator: 'eq' | 'gte' | 'lte' | 'contains'; value: string | number }
  | { type: 'on_finding_added'; severity?: string }
  | { type: 'on_overdue'; daysOverdue: number }

export type WorkflowAction =
  | { type: 'create_task'; titleTemplate: string; assigneeRole: string; dueDays: number; priority: 'low' | 'medium' | 'high' }
  | { type: 'send_email'; toRole: string; subjectTemplate: string; bodyTemplate: string }
  | { type: 'notify_role'; role: string; messageTemplate: string }
  | { type: 'set_status'; status: string }
  | { type: 'set_field'; field: string; value: string }

export type WorkflowRule = {
  id: string
  name: string
  description?: string
  active: boolean
  trigger: WorkflowTrigger
  /** All conditions must match for the rule to fire */
  conditions?: Array<{
    field: string
    operator: 'eq' | 'neq' | 'gte' | 'lte' | 'contains' | 'in'
    value: string | number | string[]
  }>
  actions: WorkflowAction[]
  /** Rules with higher priority run first */
  priority: number
}

/* ── Form field schema ────────────────────────────────────────────────────── */

export type FieldType =
  | 'text' | 'textarea' | 'number' | 'date' | 'datetime-local'
  | 'select' | 'radio-cards' | 'checkbox' | 'checkbox-group'
  | 'user-picker' | 'org-unit-picker' | 'file-upload'
  | 'severity-picker' | 'divider' | 'info'

export type SelectOption = { value: string; label: string; description?: string }

export type FieldSchema = {
  id: string
  type: FieldType
  label: string
  placeholder?: string
  description?: string
  required?: boolean
  options?: SelectOption[]         // for select, radio-cards, checkbox-group
  validation?: {
    min?: number; max?: number
    minLength?: number; maxLength?: number
    pattern?: string; patternMessage?: string
  }
  /** Show field only when another field has a specific value */
  showWhen?: { field: string; value: string | string[] }
  sortOrder: number
  section?: string                 // groups fields under a named section header
}

/* ── Heading / metadata ───────────────────────────────────────────────────── */

export type ModuleHeading = {
  title: string
  description: string
  /** Breadcrumb items shown above the H1 */
  breadcrumb?: string[]
  /** Optional badge/tag next to the title */
  badge?: string
}

/* ── Schedule config ────────────────────────────────────────────────────── */

export type ScheduleFrequency =
  | 'daily' | 'weekly' | 'biweekly' | 'monthly'
  | 'quarterly' | 'semi-annual' | 'annual' | 'custom'

export type ScheduleRule = {
  id: string
  label: string
  frequency: ScheduleFrequency
  /** For 'custom': ISO 8601 repeat interval, e.g. "P14D" */
  customInterval?: string
  /** Day of week (0=Sun) for weekly rules */
  dayOfWeek?: number
  /** Day of month for monthly rules */
  dayOfMonth?: number
  /** Auto-assign inspection type when schedule triggers */
  caseTypeId?: string
  /** Auto-assign responsible role */
  defaultResponsibleRole?: string
  active: boolean
}

/* ── KPI / stats config ──────────────────────────────────────────────────── */

export type KpiDef = {
  id: string
  label: string
  /** How to compute the value: count of records matching a filter */
  filter?: { field: string; value: string }
  /** 'count' | 'percentage' | 'average' */
  aggregation: 'count' | 'percentage' | 'average'
  sub: string           // subtitle/description
  sortOrder: number
}

/* ── Access control ──────────────────────────────────────────────────────── */

export type RolePermission = {
  role: string          // e.g. "admin", "inspector", "viewer"
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canApprove: boolean
  canExport: boolean
  /** Status keys this role can set */
  allowedStatusTransitions?: string[]
}

/* ── Root module template ────────────────────────────────────────────────── */

export type ModuleTemplate = {
  /** DB uuid */
  id: string
  /** Stable key, e.g. "hse.inspections", "hse.sja", "hse.vernerunder" */
  moduleKey: string
  /** Human name shown in platform-admin */
  name: string
  /** Bump when adding new required fields */
  schemaVersion: number

  heading: ModuleHeading
  tableColumns: TableColumn[]
  /** Ordered list — drives status pills, filters and workflow transitions */
  statuses: StatusDef[]
  caseTypes: CaseType[]
  fieldSchema: FieldSchema[]
  workflowRules: WorkflowRule[]
  schedules: ScheduleRule[]
  kpis: KpiDef[]
  rolePermissions: RolePermission[]

  published: boolean
  createdBy?: string
  createdAt?: string
  updatedAt?: string
}

/** Supabase row shape (sections stored as JSONB) */
export type ModuleTemplateRow = {
  id: string
  module_key: string
  name: string
  schema_version: number
  config: Omit<ModuleTemplate, 'id' | 'moduleKey' | 'name' | 'schemaVersion' | 'published' | 'createdBy' | 'createdAt' | 'updatedAt'>
  published: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

/* ── Default factory — inspeksjonsrunder ─────────────────────────────────── */

export function defaultInspeksjonsrunderTemplate(): ModuleTemplate {
  return {
    id: 'local-inspeksjonsrunder',
    moduleKey: 'hse.inspections',
    name: 'Inspeksjonsrunder',
    schemaVersion: 1,

    heading: {
      title: 'Inspeksjonsrunder',
      description: 'Planlegg, gjennomfør og dokumenter systematiske inspeksjoner av utstyr, anlegg og arbeidsmiljø. Åpne en rad for redigering, signatur og låsing.',
      breadcrumb: ['Workspace', 'Samsvar', 'HSE / HMS'],
    },

    tableColumns: [
      { id: 'title',        label: 'Tittel',        format: 'text',    width: 'lg',  sortable: true,  sortOrder: 0 } as TableColumn & { sortOrder: number },
      { id: 'kind',         label: 'Type',          format: 'pill',    width: 'sm',  filterable: true, sortOrder: 1 } as TableColumn & { sortOrder: number },
      { id: 'conductedAt',  label: 'Gjennomført',   format: 'date',    width: 'md',  sortable: true,  sortOrder: 2 } as TableColumn & { sortOrder: number },
      { id: 'responsible',  label: 'Ansvarlig',     format: 'user',    width: 'md',  sortable: true,  sortOrder: 3 } as TableColumn & { sortOrder: number },
      { id: 'findings',     label: 'Avvik',         format: 'badge',   width: 'xs',  sortOrder: 4 } as TableColumn & { sortOrder: number },
      { id: 'status',       label: 'Status',        format: 'pill',    width: 'sm',  filterable: true, statusRef: 'status', sortOrder: 5 } as TableColumn & { sortOrder: number },
      { id: '_actions',     label: '',              format: 'actions', width: 'xs',  sortOrder: 6 } as TableColumn & { sortOrder: number },
    ] as TableColumn[],

    statuses: [
      { key: 'planned',     label: 'Planlagt',          color: 'blue',    transitions: ['in_progress', 'cancelled'], sortOrder: 0 },
      { key: 'in_progress', label: 'Pågår',             color: 'amber',   transitions: ['pending_approval', 'closed'], sortOrder: 1 },
      { key: 'pending_approval', label: 'Til godkjenning', color: 'purple', transitions: ['approved', 'in_progress'], sortOrder: 2 },
      { key: 'approved',    label: 'Godkjent',          color: 'green',   transitions: [], isTerminal: true, sortOrder: 3 },
      { key: 'closed',      label: 'Lukket',            color: 'teal',    transitions: [], isTerminal: true, sortOrder: 4 },
      { key: 'cancelled',   label: 'Avbrutt',           color: 'neutral', transitions: [], isTerminal: true, sortOrder: 5 },
    ],

    caseTypes: [
      { id: 'hms_round',      label: 'HMS-runde',           color: 'green',   active: true },
      { id: 'equipment',      label: 'Utstyrssjekk',        color: 'blue',    active: true },
      { id: 'vehicle',        label: 'Kjøretøykontroll',    color: 'amber',   active: true },
      { id: 'fire_safety',    label: 'Brannsikkerhet',      color: 'red',     active: true },
      { id: 'electrical',     label: 'El-kontroll',         color: 'purple',  active: true },
      { id: 'hygiene',        label: 'Renhold/hygiene',     color: 'teal',    active: true },
      { id: 'external_audit', label: 'Ekstern revisjon',    color: 'neutral', active: true },
      { id: 'custom',         label: 'Egendefinert',        color: 'neutral', active: true },
    ],

    fieldSchema: [
      { id: 'title',        type: 'text',         label: 'Tittel',         required: true,  sortOrder: 0 },
      { id: 'kind',         type: 'select',       label: 'Inspeksjonstype', required: true, sortOrder: 1,
        options: [] },  // populated from caseTypes at runtime
      { id: 'conductedAt',  type: 'datetime-local', label: 'Gjennomføringstidspunkt', required: true, sortOrder: 2 },
      { id: 'subjectKind',  type: 'radio-cards',  label: 'Hva inspiseres?', required: true, sortOrder: 3,
        options: [
          { value: 'org_unit',      label: 'Organisasjonsenhet', description: 'Avdeling eller team' },
          { value: 'equipment_or_area', label: 'Utstyr / rom',   description: 'Maskin, kjøretøy, rom' },
          { value: 'free_text',     label: 'Fritekst',           description: 'Beskriv fritt' },
        ] },
      { id: 'subjectLabel', type: 'text',         label: 'Betegnelse / lokasjon', required: false, sortOrder: 4,
        showWhen: { field: 'subjectKind', value: ['equipment_or_area', 'free_text'] } },
      { id: 'responsible',  type: 'user-picker',  label: 'Ansvarlig',      required: true,  sortOrder: 5 },
      { id: 'scope',        type: 'textarea',     label: 'Omfang',         required: false, sortOrder: 6 },
      { id: 'findings',     type: 'textarea',     label: 'Funn (sammendrag)', required: false, sortOrder: 7 },
    ],

    workflowRules: [
      {
        id: 'wr-finding-to-task',
        name: 'Avvik → oppgave',
        description: 'Opprett en oppgave for ansvarlig når et kritisk avvik registreres.',
        active: true,
        priority: 10,
        trigger: { type: 'on_finding_added', severity: 'critical' },
        actions: [{
          type: 'create_task',
          titleTemplate: 'Utbedre avvik: {{inspection.title}}',
          assigneeRole: 'responsible',
          dueDays: 7,
          priority: 'high',
        }],
      },
      {
        id: 'wr-approval-email',
        name: 'Godkjenning → e-post',
        description: 'Send e-post til HMS-leder når inspeksjon er klar for godkjenning.',
        active: true,
        priority: 20,
        trigger: { type: 'on_status_change', toStatus: 'pending_approval' },
        actions: [{
          type: 'send_email',
          toRole: 'hse_manager',
          subjectTemplate: 'Inspeksjon klar for godkjenning: {{inspection.title}}',
          bodyTemplate: 'Inspeksjonen "{{inspection.title}}" gjennomført {{inspection.conductedAt}} er sendt til godkjenning av {{user.name}}.',
        }],
      },
      {
        id: 'wr-overdue-notify',
        name: 'Forfalt → varsel',
        description: 'Varsle ansvarlig når planlagt inspeksjon er forfalt med 3 dager.',
        active: true,
        priority: 30,
        trigger: { type: 'on_overdue', daysOverdue: 3 },
        actions: [{
          type: 'notify_role',
          role: 'responsible',
          messageTemplate: 'Inspeksjonen "{{inspection.title}}" er {{daysOverdue}} dager forfalt.',
        }],
      },
    ],

    schedules: [
      { id: 'sched-monthly', label: 'Månedlig HMS-runde', frequency: 'monthly', dayOfMonth: 1, caseTypeId: 'hms_round', active: true },
      { id: 'sched-annual',  label: 'Årlig ekstern revisjon', frequency: 'annual', dayOfMonth: 15, caseTypeId: 'external_audit', active: false },
    ],

    kpis: [
      { id: 'kpi-total',    label: 'Totalt',   aggregation: 'count', sub: 'I registeret', sortOrder: 0 },
      { id: 'kpi-open',     label: 'Åpne',     aggregation: 'count', sub: 'Pågår',        filter: { field: 'status', value: 'in_progress' }, sortOrder: 1 },
      { id: 'kpi-approved', label: 'Godkjent', aggregation: 'count', sub: 'Arkiv',        filter: { field: 'status', value: 'approved' }, sortOrder: 2 },
      { id: 'kpi-overdue',  label: 'Forfalte', aggregation: 'count', sub: 'Krever handling', sortOrder: 3 },
    ],

    rolePermissions: [
      { role: 'admin',     canCreate: true,  canEdit: true,  canDelete: true,  canApprove: true,  canExport: true },
      { role: 'inspector', canCreate: true,  canEdit: true,  canDelete: false, canApprove: false, canExport: false,
        allowedStatusTransitions: ['planned', 'in_progress', 'pending_approval'] },
      { role: 'viewer',    canCreate: false, canEdit: false, canDelete: false, canApprove: false, canExport: true },
    ],

    published: false,
  }
}
