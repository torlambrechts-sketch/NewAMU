/** In-page tab menu designer — aligns with app menu_1 (Organisasjon faner). */

export const UI_MENU_CORE_ID = 'ui_menu_core' as const

export type UiMenuCoreDesign = {
  componentId: typeof UI_MENU_CORE_ID
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
  /** Outer bar chrome */
  bar: {
    marginTop: string
    overflow: string
    borderRadius: string
    borderWidth: string
    borderStyle: string
    borderColor: string
    borderTopWidth: string
    borderBottomWidth: string
    boxShadow: string
    /** When flush: often no bottom border on bar */
    omitBottomBorder: boolean
  }
  colors: {
    barTone: 'accent' | 'slate'
    accent: string
    slate: string
  }
  /** Same semantics as Layout Lab menu_1 */
  tabLayout: 'rounded' | 'squared' | 'flush'
  tabRounding: 'none' | 'xl' | 'full'
  activeFill: 'cream' | 'white'
  activeTab: {
    backgroundColor: string
    color: string
    fontSize: string
    fontWeight: string
    padding: string
    minHeight: string
    borderRadius: string
    boxShadow: string
  }
  inactiveTab: {
    color: string
    hoverBackground: string
    fontSize: string
    fontWeight: string
    padding: string
    minHeight: string
    borderRadius: string
  }
  innerRow: {
    display: string
    flexWrap: string
    alignItems: string
    gap: string
    padding: string
    minHeight: string
  }
  animation: {
    transitionProperty: string
    transitionDuration: string
    transitionTimingFunction: string
  }
  interaction: {
    cursor: string
  }
  demo: {
    activeLabel: string
    inactiveLabel: string
  }
}

export const DEFAULT_UI_MENU_CORE: UiMenuCoreDesign = {
  componentId: UI_MENU_CORE_ID,
  version: '1.0.0',
  metadata: {
    name: 'menu-1',
    description: 'Horizontal tab strip with active/inactive states (rounded, squared, or flush).',
  },
  data: {
    provider: 'theme',
    documentPath: '',
    bindToStyle: true,
  },
  bar: {
    marginTop: '32px',
    overflow: 'hidden',
    borderRadius: '16px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(0,0,0,0.1)',
    borderTopWidth: '1px',
    borderBottomWidth: '1px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
    omitBottomBorder: false,
  },
  colors: {
    barTone: 'accent',
    accent: '#1a3d32',
    slate: '#1e293b',
  },
  tabLayout: 'rounded',
  tabRounding: 'xl',
  activeFill: 'cream',
  activeTab: {
    backgroundColor: '#f5f0e8',
    color: '#1a3d32',
    fontSize: '14px',
    fontWeight: '500',
    padding: '8px 20px',
    minHeight: '44px',
    borderRadius: '12px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  },
  inactiveTab: {
    color: 'rgba(255,255,255,0.95)',
    hoverBackground: 'rgba(255,255,255,0.1)',
    fontSize: '14px',
    fontWeight: '500',
    padding: '8px 20px',
    minHeight: '44px',
    borderRadius: '12px',
  },
  innerRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    gap: '0px',
    padding: '4px 8px',
    minHeight: '48px',
  },
  animation: {
    transitionProperty: 'background-color, color, box-shadow',
    transitionDuration: '200ms',
    transitionTimingFunction: 'ease-out',
  },
  interaction: {
    cursor: 'pointer',
  },
  demo: {
    activeLabel: 'Active',
    inactiveLabel: 'Archived',
  },
}

export function cloneUiMenuCore(overrides?: Partial<UiMenuCoreDesign>): UiMenuCoreDesign {
  const base = structuredClone(DEFAULT_UI_MENU_CORE)
  if (!overrides) return base
  return deepMergeMenu(base, overrides)
}

function isObj(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x)
}

function deepMergeMenu<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const out = { ...target } as Record<string, unknown>
  for (const k of Object.keys(source)) {
    const sv = (source as Record<string, unknown>)[k]
    const tv = out[k]
    if (sv === undefined) continue
    if (isObj(sv) && isObj(tv)) {
      out[k] = deepMergeMenu(tv as Record<string, unknown>, sv as Record<string, unknown>)
    } else {
      out[k] = sv
    }
  }
  return out as T
}
