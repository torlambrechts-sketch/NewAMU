/** Button control designer — primary actions, outline, hover/active/focus. */

export const UI_BUTTON_CORE_ID = 'ui_button_core' as const

export type UiButtonCoreDesign = {
  componentId: typeof UI_BUTTON_CORE_ID
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
  layout: {
    display: string
    position: string
    width: string
    minWidth: string
    height: string
    minHeight: string
    padding: string
    margin: string
    borderRadius: string
    gap: string
    alignItems: string
    justifyContent: string
  }
  typography: {
    fontFamily: string
    fontSize: string
    fontWeight: string
    lineHeight: string
    letterSpacing: string
    textTransform: string
    color: string
    textAlign: string
  }
  defaultState: {
    backgroundColor: string
    backgroundGradient: string
    borderWidth: string
    borderStyle: string
    borderColor: string
    boxShadow: string
    opacity: number
  }
  hoverState: {
    backgroundColor: string
    color: string
    borderColor: string
    boxShadow: string
    scale: number
    rotate: string
  }
  activeState: {
    backgroundColor: string
    color: string
    scale: number
    boxShadow: string
  }
  focusState: {
    outline: string
    outlineOffset: string
    boxShadow: string
  }
  disabledState: {
    opacity: number
    cursor: string
    backgroundColor: string
    color: string
  }
  advancedVisuals: {
    backdropFilter: string
    filter: string
  }
  animation: {
    transitionProperty: string
    transitionDuration: string
    transitionTimingFunction: string
    transitionDelay: string
  }
  interaction: {
    cursor: string
    userSelect: string
    pointerEvents: string
  }
  demo: {
    label: string
    showDisabledPreview: boolean
  }
}

export const DEFAULT_UI_BUTTON_CORE: UiButtonCoreDesign = {
  componentId: UI_BUTTON_CORE_ID,
  version: '1.0.0',
  metadata: {
    name: 'button-primary',
    description: 'Primary call-to-action button with hover, active, and focus rings.',
  },
  data: {
    provider: 'theme',
    documentPath: '',
    bindToStyle: false,
  },
  layout: {
    display: 'inline-flex',
    position: 'relative',
    width: 'auto',
    minWidth: '120px',
    height: 'auto',
    minHeight: '44px',
    padding: '10px 20px',
    margin: '0px',
    borderRadius: '12px',
    gap: '8px',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '14px',
    fontWeight: '600',
    lineHeight: '1.25',
    letterSpacing: '0.01em',
    textTransform: 'none',
    color: '#ffffff',
    textAlign: 'center',
  },
  defaultState: {
    backgroundColor: '#1a3d32',
    backgroundGradient: '',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#142e26',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
    opacity: 1,
  },
  hoverState: {
    backgroundColor: '#234d3f',
    color: '#ffffff',
    borderColor: '#142e26',
    boxShadow: '0 4px 12px rgba(26, 61, 50, 0.25)',
    scale: 1,
    rotate: '0deg',
  },
  activeState: {
    backgroundColor: '#142e26',
    color: '#ffffff',
    scale: 0.98,
    boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
  },
  focusState: {
    outline: '2px solid #3b82f6',
    outlineOffset: '2px',
    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.35)',
  },
  disabledState: {
    opacity: 0.5,
    cursor: 'not-allowed',
    backgroundColor: '#94a3b8',
    color: '#f1f5f9',
  },
  advancedVisuals: {
    backdropFilter: 'none',
    filter: 'none',
  },
  animation: {
    transitionProperty: 'background-color, color, border-color, box-shadow, transform',
    transitionDuration: '200ms',
    transitionTimingFunction: 'ease-out',
    transitionDelay: '0ms',
  },
  interaction: {
    cursor: 'pointer',
    userSelect: 'none',
    pointerEvents: 'auto',
  },
  demo: {
    label: 'Lagre endringer',
    showDisabledPreview: true,
  },
}

export function cloneUiButtonCore(overrides?: Partial<UiButtonCoreDesign>): UiButtonCoreDesign {
  const base = structuredClone(DEFAULT_UI_BUTTON_CORE)
  if (!overrides) return base
  return deepMergeBtn(base, overrides)
}

function isObj(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x)
}

function deepMergeBtn<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const out = { ...target } as Record<string, unknown>
  for (const k of Object.keys(source)) {
    const sv = (source as Record<string, unknown>)[k]
    const tv = out[k]
    if (sv === undefined) continue
    if (isObj(sv) && isObj(tv)) {
      out[k] = deepMergeBtn(tv as Record<string, unknown>, sv as Record<string, unknown>)
    } else {
      out[k] = sv
    }
  }
  return out as T
}
