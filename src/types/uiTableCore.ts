/** Advanced data-table designer — platform admin; refer by reference_key. */

import { deepMergeUiBox } from './uiBoxCore'

export const UI_TABLE_CORE_ID = 'ui_table_core' as const

export type UiTableCoreDesign = {
  componentId: typeof UI_TABLE_CORE_ID
  version: string
  metadata: {
    name: string
    description: string
  }
  data: {
    provider: string
    documentPath: string
    bindToStyle: boolean
  }
  /** Outer shell (card around the table) */
  shell: {
    width: string
    maxWidth: string
    margin: string
    padding: string
    backgroundColor: string
    backgroundGradient: string
    overflow: string
  }
  table: {
    width: string
    borderCollapse: 'collapse' | 'separate'
    tableLayout: 'auto' | 'fixed'
    borderSpacing: string
  }
  caption: {
    enabled: boolean
    text: string
    color: string
    fontSize: string
    fontWeight: string
    padding: string
    captionSide: 'top' | 'bottom'
  }
  thead: {
    backgroundColor: string
    position: string
    zIndex: string
  }
  th: {
    padding: string
    fontSize: string
    fontWeight: string
    lineHeight: string
    letterSpacing: string
    textTransform: string
    color: string
    textAlign: string
    borderBottomWidth: string
    borderBottomStyle: string
    borderBottomColor: string
    whiteSpace: string
  }
  tbody: {
    zebra: boolean
    oddRowBackground: string
    evenRowBackground: string
    rowHoverBackground: string
    rowTransition: string
  }
  td: {
    padding: string
    fontSize: string
    lineHeight: string
    color: string
    borderBottomWidth: string
    borderBottomStyle: string
    borderBottomColor: string
    verticalAlign: string
  }
  borders: {
    wrapperBorderWidth: string
    wrapperBorderStyle: string
    wrapperBorderColor: string
    wrapperBorderRadius: string
    wrapperBoxShadow: string
    cellSeparator: boolean
    cellSeparatorColor: string
  }
  advancedVisuals: {
    backdropFilter: string
    filter: string
  }
  animation: {
    transitionProperty: string
    transitionDuration: string
    transitionTimingFunction: string
  }
  interaction: {
    rowCursor: string
    headerCursor: string
  }
}

export const DEFAULT_UI_TABLE_CORE: UiTableCoreDesign = {
  componentId: UI_TABLE_CORE_ID,
  version: '1.0.0',
  metadata: {
    name: 'table-1',
    description: 'Data table shell with header, zebra rows, and cell typography.',
  },
  data: {
    provider: 'supabase',
    documentPath: '',
    bindToStyle: false,
  },
  shell: {
    width: '100%',
    maxWidth: '100%',
    margin: '0px',
    padding: '0px',
    backgroundColor: '#ffffff',
    backgroundGradient: '',
    overflow: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'auto',
    borderSpacing: '0px',
  },
  caption: {
    enabled: false,
    text: 'Table caption',
    color: '#64748b',
    fontSize: '13px',
    fontWeight: '500',
    padding: '8px 12px',
    captionSide: 'top',
  },
  thead: {
    backgroundColor: '#f8fafc',
    position: 'static',
    zIndex: 'auto',
  },
  th: {
    padding: '12px 16px',
    fontSize: '12px',
    fontWeight: '600',
    lineHeight: '1.25',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: '#475569',
    textAlign: 'left',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#e2e8f0',
    whiteSpace: 'nowrap',
  },
  tbody: {
    zebra: true,
    oddRowBackground: '#ffffff',
    evenRowBackground: '#f8fafc',
    rowHoverBackground: '#f1f5f9',
    rowTransition: 'background-color 150ms ease',
  },
  td: {
    padding: '12px 16px',
    fontSize: '14px',
    lineHeight: '1.5',
    color: '#334155',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#f1f5f9',
    verticalAlign: 'middle',
  },
  borders: {
    wrapperBorderWidth: '1px',
    wrapperBorderStyle: 'solid',
    wrapperBorderColor: '#e2e8f0',
    wrapperBorderRadius: '12px',
    wrapperBoxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    cellSeparator: false,
    cellSeparatorColor: '#f1f5f9',
  },
  advancedVisuals: {
    backdropFilter: 'none',
    filter: 'none',
  },
  animation: {
    transitionProperty: 'background-color, box-shadow',
    transitionDuration: '200ms',
    transitionTimingFunction: 'ease-out',
  },
  interaction: {
    rowCursor: 'default',
    headerCursor: 'default',
  },
}

export function cloneUiTableCore(overrides?: Partial<UiTableCoreDesign>): UiTableCoreDesign {
  const base = structuredClone(DEFAULT_UI_TABLE_CORE)
  if (!overrides) return base
  return deepMergeUiBox(base as unknown as Record<string, unknown>, overrides as Record<string, unknown>) as UiTableCoreDesign
}
