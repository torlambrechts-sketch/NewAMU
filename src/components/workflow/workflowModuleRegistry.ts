// Pure data registry mapping source_module → display metadata.
// Consumed by WorkflowPage, WorkflowEditorV2, and ChainPreview to colour-code
// module chips without coupling component logic to raw string comparisons.

export type WfModuleMeta = {
  label: string
  accent: string
  tint: string
  border: string
  /** lucide-react icon name (resolved dynamically by consumers). */
  icon: string
}

export const WF_MODULE_META: Record<string, WfModuleMeta> = {
  hse: {
    label: 'Avvik / HMS',
    accent: '#dc2626',
    tint: '#fef2f2',
    border: '#fecaca',
    icon: 'HardHat',
  },
  inspection: {
    label: 'Vernerunder',
    accent: '#2f7757',
    tint: '#f0fdf4',
    border: '#bbf7d0',
    icon: 'ClipboardCheck',
  },
  internal_control: {
    label: 'ROS-analyser',
    accent: '#c98a2b',
    tint: '#fefce8',
    border: '#fde68a',
    icon: 'ShieldAlert',
  },
  org_health: {
    label: 'Undersøkelser / IA',
    accent: '#be185d',
    tint: '#fdf2f8',
    border: '#fbcfe8',
    icon: 'HeartPulse',
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
  amu: {
    label: 'AMU',
    accent: '#7c3aed',
    tint: '#f5f3ff',
    border: '#ddd6fe',
    icon: 'Users',
  },
  workplace_reporting: {
    label: 'Arbeidsplassrapportering',
    accent: '#1a3d32',
    tint: '#f0fdf4',
    border: '#bbf7d0',
    icon: 'FileWarning',
  },
  wiki_published: {
    label: 'Wiki',
    accent: '#2563eb',
    tint: '#eff6ff',
    border: '#bfdbfe',
    icon: 'BookOpen',
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
