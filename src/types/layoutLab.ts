/** Saved UI experiments for applying patterns across the app later. */
export const LAYOUT_LAB_VERSION = 1 as const

/** Organisation (and similar) right-hand sidebar panel — tuned separately from global cards. */
export type SidebarBox1Settings = {
  /** Main heading size */
  headingSize: 'sm' | 'md' | 'lg'
  /** Primary action button look */
  buttonStyle: 'solid' | 'outline' | 'soft'
  /** Inner padding */
  padding: 'comfortable' | 'compact'
  /** Panel background */
  surface: 'white' | 'cream' | 'muted'
  /** Panel elevation */
  shadow: 'none' | 'sm' | 'md'
}

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
  /** Reusable sidebar panel (e.g. Organisasjon → enheter / brukergrupper / innstillinger) */
  sidebar_box_1: SidebarBox1Settings
}

export const DEFAULT_SIDEBAR_BOX_1: SidebarBox1Settings = {
  headingSize: 'md',
  buttonStyle: 'solid',
  padding: 'comfortable',
  surface: 'white',
  shadow: 'sm',
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
  sidebar_box_1: DEFAULT_SIDEBAR_BOX_1,
}

export const LAYOUT_LAB_STORAGE_KEY = 'atics-layout-lab-payload-v1'

/** Dispatched when Layout-lab updates localStorage so other tabs/pages can sync. */
export const LAYOUT_LAB_CHANGED_EVENT = 'atics-layout-lab-changed'
