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
  tasks: [{ value: 'tasks', label: 'Oppgaver' }],
  wiki_published: [],
}

export const WHERE_FIELDS_BY_PATH: Record<string, WhereFieldOption[]> = {
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
}
