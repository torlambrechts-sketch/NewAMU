// Pure data registry mapping source_module → display metadata.
// Consumed by ChainPreview (and legacy panels) to colour-code module
// chips without coupling component logic to raw string comparisons.

export type WfModuleMeta = {
  label: string
  accent: string
  tint: string
  border: string
  /** lucide-react icon name (resolved dynamically by consumers). */
  icon: string
}

export const WF_MODULE_META: Record<string, WfModuleMeta> = {
  compliance_checklist: {
    label: 'Sjekklister',
    accent: '#1a3d32',
    tint: '#f0fdf4',
    border: '#bbf7d0',
    icon: 'ClipboardList',
  },
  survey: {
    label: 'Undersøkelser',
    accent: '#7c3aed',
    tint: '#f5f3ff',
    border: '#ddd6fe',
    icon: 'Megaphone',
  },
  documents: {
    label: 'Dokumenter',
    accent: '#0f766e',
    tint: '#ecfdf5',
    border: '#a7f3d0',
    icon: 'FileText',
  },
  meetings: {
    label: 'Møter',
    accent: '#4338ca',
    tint: '#eef2ff',
    border: '#c7d2fe',
    icon: 'CalendarDays',
  },
  tasks: {
    label: 'Oppgaver',
    accent: '#ea580c',
    tint: '#fff7ed',
    border: '#fed7aa',
    icon: 'CheckSquare',
  },
  learning: {
    label: 'E-læring',
    accent: '#0e7490',
    tint: '#ecfeff',
    border: '#a5f3fc',
    icon: 'GraduationCap',
  },
  registers: {
    label: 'Registre',
    accent: '#525252',
    tint: '#fafafa',
    border: '#e5e5e5',
    icon: 'Database',
  },
  wiki_published: {
    label: 'Wiki',
    accent: '#2563eb',
    tint: '#eff6ff',
    border: '#bfdbfe',
    icon: 'BookOpen',
  },
  gov: {
    label: 'Statlig rapportering',
    accent: '#991b1b',
    tint: '#fef2f2',
    border: '#fecaca',
    icon: 'ShieldCheck',
  },
}

export function getWfModuleMeta(sourceModule: string): WfModuleMeta {
  return (
    WF_MODULE_META[sourceModule] ?? {
      label: sourceModule,
      accent: '#525252',
      tint: '#fafafa',
      border: '#e5e5e5',
      icon: 'Workflow',
    }
  )
}
