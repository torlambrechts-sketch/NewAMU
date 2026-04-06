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
  /** Primary tables */
  table_1: Table1Settings
  /** Main content card/column */
  mainbox_1: Mainbox1Settings
  /** In-page tab menu */
  menu_1: Menu1Settings
}

export const DEFAULT_SIDEBAR_BOX_1: SidebarBox1Settings = {
  headingSize: 'md',
  buttonStyle: 'solid',
  padding: 'comfortable',
  surface: 'white',
  shadow: 'sm',
}

/** Primary data tables (e.g. Organisasjon → Ansatte) */
export type Table1Settings = {
  surface: 'white' | 'cream' | 'muted'
  shadow: 'none' | 'sm' | 'md'
  /** Row pattern; inherit = use global Layout Lab «Tabellstil» */
  rowStyle: 'zebra' | 'ruled' | 'minimal' | 'inherit'
  headerStyle: 'subtle' | 'strong' | 'plain'
  cellDensity: 'comfortable' | 'compact'
}

/** Main content panels (e.g. Innstillinger — venstre boks) */
export type Mainbox1Settings = {
  surface: 'white' | 'cream' | 'muted'
  shadow: 'none' | 'sm' | 'md'
  padding: 'comfortable' | 'compact'
  border: 'neutral' | 'accent'
}

/** In-page tab strip (e.g. Organisasjon faner) */
export type Menu1Settings = {
  /** Bar background */
  barTone: 'accent' | 'slate'
  /** Active tab fill */
  activeFill: 'cream' | 'white'
  /** Tab chip shape */
  tabRounding: 'xl' | 'full'
}

export const DEFAULT_TABLE_1: Table1Settings = {
  surface: 'white',
  shadow: 'sm',
  rowStyle: 'inherit',
  headerStyle: 'subtle',
  cellDensity: 'comfortable',
}

export const DEFAULT_MAINBOX_1: Mainbox1Settings = {
  surface: 'white',
  shadow: 'sm',
  padding: 'comfortable',
  border: 'neutral',
}

export const DEFAULT_MENU_1: Menu1Settings = {
  barTone: 'accent',
  activeFill: 'cream',
  tabRounding: 'xl',
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
  table_1: DEFAULT_TABLE_1,
  mainbox_1: DEFAULT_MAINBOX_1,
  menu_1: DEFAULT_MENU_1,
}

export const LAYOUT_LAB_STORAGE_KEY = 'atics-layout-lab-payload-v1'

/** Dispatched when Layout-lab updates localStorage so other tabs/pages can sync. */
export const LAYOUT_LAB_CHANGED_EVENT = 'atics-layout-lab-changed'
