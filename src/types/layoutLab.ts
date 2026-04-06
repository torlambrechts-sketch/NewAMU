/** Saved UI experiments for applying patterns across the app later. */
export const LAYOUT_LAB_VERSION = 1 as const

export type LayoutLabPayload = {
  version: typeof LAYOUT_LAB_VERSION
  /** Page max width token */
  pageWidth: 'narrow' | 'standard' | 'wide'
  density: 'comfortable' | 'compact'
  radius: 'sm' | 'md' | 'lg' | '2xl'
  surface: 'white' | 'cream' | 'muted'
  accent: string
  tableStyle: 'ruled' | 'zebra' | 'minimal'
  cardStyle: 'flat' | 'shadow' | 'borderAccent'
  kanbanStyle: 'rounded' | 'sharp' | 'dense'
}

export const DEFAULT_LAYOUT_LAB: LayoutLabPayload = {
  version: LAYOUT_LAB_VERSION,
  pageWidth: 'standard',
  density: 'comfortable',
  radius: '2xl',
  surface: 'cream',
  accent: '#1a3d32',
  tableStyle: 'zebra',
  cardStyle: 'shadow',
  kanbanStyle: 'rounded',
}

export const LAYOUT_LAB_STORAGE_KEY = 'atics-layout-lab-payload-v1'
