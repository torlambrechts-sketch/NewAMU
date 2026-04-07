/** Advanced box designer schema (platform admin) — refer to designs by `metadata.name` / stored `reference_key`. */

export const UI_BOX_CORE_ID = 'ui_box_core' as const

export type UiBoxCoreDesign = {
  componentId: typeof UI_BOX_CORE_ID
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
    height: string
    minHeight: string
    margin: string
    padding: string
    overflow: string
    zIndex: string
  }
  flexbox: {
    flexDirection: string
    justifyContent: string
    alignItems: string
    gap: string
    flexWrap: string
  }
  typography: {
    base: {
      fontFamily: string
      color: string
      textAlign: string
      fontSize: string
      lineHeight: string
    }
    heading: {
      enabled: boolean
      text: string
      tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'div'
      color: string
      fontSize: string
      fontWeight: string
      lineHeight: string
      letterSpacing: string
      textTransform: string
      marginBottom: string
    }
  }
  styling: {
    backgroundColor: string
    backgroundGradient: string
    backgroundImage: string
    backgroundSize: string
    backgroundPosition: string
    backgroundAttachment: string
    backgroundBlendMode: string
    opacity: number
  }
  advancedVisuals: {
    backdropFilter: string
    filter: string
    clipPath: string
    mixBlendMode: string
  }
  borders: {
    borderWidth: string
    borderStyle: string
    borderColor: string
    borderRadius: string
    boxShadow: string
  }
  transforms: {
    scale: number
    rotate: string
    translateX: string
    translateY: string
    skewX: string
    skewY: string
    transformOrigin: string
  }
  animation: {
    transitionProperty: string
    transitionDuration: string
    transitionTimingFunction: string
    transitionDelay: string
    entranceAnimation: string
  }
  interaction: {
    cursor: string
    hoverState: {
      backgroundColor: string
      scale: number
      boxShadow: string
      rotate: string
    }
    onClick: string
  }
}

export const DEFAULT_UI_BOX_CORE: UiBoxCoreDesign = {
  componentId: UI_BOX_CORE_ID,
  version: '1.2.0',
  metadata: {
    name: 'mainbox-1',
    description: 'A comprehensive layout container with advanced styling, interactions, and native typography controls.',
  },
  data: {
    provider: 'firebase',
    documentPath: '',
    bindToStyle: false,
  },
  layout: {
    display: 'flex',
    position: 'relative',
    width: '100%',
    height: 'auto',
    minHeight: '50px',
    margin: '0px',
    padding: '24px',
    overflow: 'visible',
    zIndex: 'auto',
  },
  flexbox: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    gap: '16px',
    flexWrap: 'nowrap',
  },
  typography: {
    base: {
      fontFamily: 'Inter, sans-serif',
      color: '#4a5568',
      textAlign: 'left',
      fontSize: '16px',
      lineHeight: '1.5',
    },
    heading: {
      enabled: true,
      text: 'Container Title',
      tag: 'h2',
      color: '#1a202c',
      fontSize: '24px',
      fontWeight: '700',
      lineHeight: '1.2',
      letterSpacing: '-0.02em',
      textTransform: 'none',
      marginBottom: '16px',
    },
  },
  styling: {
    backgroundColor: '#ffffff',
    backgroundGradient: '',
    backgroundImage: '',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'scroll',
    backgroundBlendMode: 'normal',
    opacity: 1,
  },
  advancedVisuals: {
    backdropFilter: 'none',
    filter: 'none',
    clipPath: 'none',
    mixBlendMode: 'normal',
  },
  borders: {
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  },
  transforms: {
    scale: 1,
    rotate: '0deg',
    translateX: '0px',
    translateY: '0px',
    skewX: '0deg',
    skewY: '0deg',
    transformOrigin: 'center center',
  },
  animation: {
    transitionProperty: 'all',
    transitionDuration: '300ms',
    transitionTimingFunction: 'ease-in-out',
    transitionDelay: '0ms',
    entranceAnimation: 'none',
  },
  interaction: {
    cursor: 'default',
    hoverState: {
      backgroundColor: '',
      scale: 1,
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      rotate: '0deg',
    },
    onClick: 'none',
  },
}

export function cloneUiBoxCore(overrides?: Partial<UiBoxCoreDesign>): UiBoxCoreDesign {
  const base = structuredClone(DEFAULT_UI_BOX_CORE)
  if (!overrides) return base
  return deepMergeUiBox(base, overrides)
}

function isObject(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x)
}

export function deepMergeUiBox<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const out = { ...target } as Record<string, unknown>
  for (const k of Object.keys(source)) {
    const sv = (source as Record<string, unknown>)[k]
    const tv = out[k]
    if (sv === undefined) continue
    if (isObject(sv) && isObject(tv)) {
      out[k] = deepMergeUiBox(tv as Record<string, unknown>, sv as Record<string, unknown>)
    } else {
      out[k] = sv
    }
  }
  return out as T
}
