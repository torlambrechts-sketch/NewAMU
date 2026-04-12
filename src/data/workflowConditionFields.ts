/**
 * Friendly field options for workflow `array_any` conditions (matches JSON keys on list items).
 */

export type WhereFieldOption = {
  key: string
  label: string
  /** 'enum' = pick from options; 'bool' = checkbox; 'text' = free text */
  valueKind: 'enum' | 'bool' | 'text'
  options?: { value: string; label: string }[]
}

/** Known JSON array paths under org module payloads (workflow source). */
export const WORKFLOW_ARRAY_PATHS: Record<string, { value: string; label: string }[]> = {
  hse: [
    { value: 'incidents', label: 'Hendelser' },
    { value: 'sjaAnalyses', label: 'SJA' },
    { value: 'safetyRounds', label: 'Vernerunder' },
    { value: 'inspections', label: 'Inspeksjoner' },
    { value: 'trainingRecords', label: 'Opplæring' },
    { value: 'sickLeaveCases', label: 'Sykefravær' },
  ],
  internal_control: [
    { value: 'rosAssessments', label: 'ROS-vurderinger' },
    { value: 'annualReviews', label: 'Årsgjennomgang' },
  ],
  org_health: [
    { value: 'surveys', label: 'Undersøkelser' },
    { value: 'navSickLeaveReports', label: 'NAV / sykefraværsrapporter' },
    { value: 'laborMetrics', label: 'Arbeidsmiljø-indikatorer' },
  ],
  tasks: [{ value: 'tasks', label: 'Oppgaver' }],
  workplace_reporting: [
    { value: 'cases', label: 'Arbeidsplass-saker' },
    { value: 'anonymousAmlReports', label: 'Anonyme AML-rapporter' },
  ],
  wiki_published: [],
}

export const WHERE_FIELDS_BY_PATH: Record<string, WhereFieldOption[]> = {
  incidents: [
    {
      key: 'severity',
      label: 'Alvorlighetsgrad',
      valueKind: 'enum',
      options: [
        { value: 'critical', label: 'Kritisk' },
        { value: 'high', label: 'Høy' },
        { value: 'medium', label: 'Middels' },
        { value: 'low', label: 'Lav' },
      ],
    },
    {
      key: 'status',
      label: 'Status',
      valueKind: 'enum',
      options: [
        { value: 'reported', label: 'Rapportert' },
        { value: 'investigating', label: 'Under utredning' },
        { value: 'action_pending', label: 'Venter tiltak' },
        { value: 'closed', label: 'Lukket' },
      ],
    },
    {
      key: 'kind',
      label: 'Type hendelse',
      valueKind: 'enum',
      options: [
        { value: 'incident', label: 'Ulykke / skade' },
        { value: 'near_miss', label: 'Nestenulykke' },
        { value: 'dangerous_cond', label: 'Farlige forhold' },
        { value: 'violence', label: 'Vold' },
        { value: 'threat', label: 'Trussel' },
        { value: 'deviation', label: 'Avvik' },
      ],
    },
  ],
  sjaAnalyses: [
    {
      key: 'status',
      label: 'SJA-status',
      valueKind: 'enum',
      options: [
        { value: 'draft', label: 'Utkast' },
        { value: 'awaiting_participants', label: 'Venter deltakere' },
        { value: 'approved', label: 'Godkjent' },
        { value: 'closed', label: 'Lukket' },
      ],
    },
  ],
  safetyRounds: [
    {
      key: 'status',
      label: 'Status vernerunde',
      valueKind: 'enum',
      options: [
        { value: 'in_progress', label: 'Pågår' },
        { value: 'pending_verneombud', label: 'Venter verneombud' },
        { value: 'approved', label: 'Godkjent' },
      ],
    },
  ],
  inspections: [
    {
      key: 'status',
      label: 'Inspeksjonsstatus',
      valueKind: 'enum',
      options: [
        { value: 'open', label: 'Åpen' },
        { value: 'closed', label: 'Lukket' },
      ],
    },
  ],
  tasks: [
    {
      key: 'status',
      label: 'Oppgavestatus',
      valueKind: 'enum',
      options: [
        { value: 'todo', label: 'Å gjøre' },
        { value: 'in_progress', label: 'Pågår' },
        { value: 'done', label: 'Ferdig' },
      ],
    },
  ],
  rosAssessments: [
    {
      key: 'locked',
      label: 'Låst (signert)',
      valueKind: 'bool',
    },
  ],
  annualReviews: [
    {
      key: 'status',
      label: 'Status årsgjennomgang',
      valueKind: 'enum',
      options: [
        { value: 'draft', label: 'Utkast' },
        { value: 'pending_safety_rep', label: 'Venter verneombud' },
        { value: 'locked', label: 'Låst' },
      ],
    },
  ],
  surveys: [
    {
      key: 'status',
      label: 'Undersøkelsesstatus',
      valueKind: 'enum',
      options: [
        { value: 'draft', label: 'Utkast' },
        { value: 'open', label: 'Åpen' },
        { value: 'closed', label: 'Lukket' },
      ],
    },
  ],
  anonymousAmlReports: [
    {
      key: 'kind',
      label: 'Kategori (AML)',
      valueKind: 'enum',
      options: [
        { value: 'work_environment', label: 'Arbeidsmiljø' },
        { value: 'harassment_discrimination', label: 'Trakassering / diskriminering' },
        { value: 'violence_threat', label: 'Vold / trussel' },
        { value: 'psychosocial', label: 'Psykososialt' },
        { value: 'whistleblowing', label: 'Varsling' },
        { value: 'other', label: 'Annet' },
      ],
    },
    {
      key: 'urgency',
      label: 'Haster',
      valueKind: 'enum',
      options: [
        { value: 'low', label: 'Lav' },
        { value: 'medium', label: 'Middels' },
        { value: 'high', label: 'Høy' },
      ],
    },
  ],
  cases: [
    {
      key: 'category',
      label: 'Sakstype',
      valueKind: 'enum',
      options: [
        { value: 'work_environment', label: 'Arbeidsmiljø' },
        { value: 'coworkers', label: 'Medarbeidere' },
        { value: 'health_safety', label: 'Helse og sikkerhet' },
        { value: 'management', label: 'Ledelse' },
        { value: 'ethics', label: 'Etikk' },
        { value: 'policy_violation', label: 'Policybrudd' },
        { value: 'other', label: 'Annet' },
      ],
    },
    {
      key: 'status',
      label: 'Saksstatus',
      valueKind: 'enum',
      options: [
        { value: 'received', label: 'Mottatt' },
        { value: 'triage', label: 'Triage' },
        { value: 'in_progress', label: 'Under arbeid' },
        { value: 'closed', label: 'Avsluttet' },
      ],
    },
    {
      key: 'confidential',
      label: 'Konfidensiell',
      valueKind: 'bool',
    },
  ],
}
