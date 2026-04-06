import type { CSSProperties } from 'react'
import type { LayoutLabPayload, Mainbox1Settings, SidebarBox1Settings, Table1Settings } from '../types/layoutLab'
import {
  DEFAULT_LAYOUT_LAB,
  DEFAULT_MAINBOX_1,
  DEFAULT_MENU_1,
  DEFAULT_SIDEBAR_BOX_1,
  DEFAULT_TABLE_1,
  DEFAULT_TABLE_1_TOOLBAR,
} from '../types/layoutLab'

/** Shared Tailwind token helpers — used by Layout-lab and Platform UI Advanced. */
export function layoutRadiusClass(r: LayoutLabPayload['radius']): string {
  switch (r) {
    case 'sm':
      return 'rounded-sm'
    case 'md':
      return 'rounded-md'
    case 'lg':
      return 'rounded-lg'
    default:
      return 'rounded-2xl'
  }
}

export function layoutSurfaceClass(s: LayoutLabPayload['surface']): string {
  switch (s) {
    case 'white':
      return 'bg-white'
    case 'muted':
      return 'bg-neutral-100'
    default:
      return 'bg-[#f5f0e8]'
  }
}

/** Hex page background for inline styles / CSS variables */
export function layoutSurfaceHex(s: LayoutLabPayload['surface']): string {
  switch (s) {
    case 'white':
      return '#ffffff'
    case 'muted':
      return '#f5f5f4'
    default:
      return '#f5f0e8'
  }
}

function parseHexRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace('#', '')
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('')
  }
  const n = parseInt(h, 16)
  if (Number.isNaN(n) || h.length !== 6) return [26, 61, 50]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (x: number) => Math.max(0, Math.min(255, Math.round(x)))
  return `#${[r, g, b].map((x) => clamp(x).toString(16).padStart(2, '0')).join('')}`
}

/** Mix two hex colors (t=0 → a, t=1 → b) */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHexRgb(a)
  const [br, bg, bb] = parseHexRgb(b)
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t)
}

/** Navigation chrome derived from primary accent (forest green family) */
export function layoutNavFromAccent(accent: string): { rail: string; railMid: string; subBar: string } {
  const black = '#000000'
  return {
    rail: accent,
    railMid: mixHex(accent, black, 0.12),
    subBar: mixHex(accent, black, 0.22),
  }
}

export function layoutPageMaxClass(w: LayoutLabPayload['pageWidth']): string {
  switch (w) {
    case 'narrow':
      return 'max-w-3xl'
    case 'wide':
      return 'max-w-[1400px]'
    default:
      return 'max-w-5xl'
  }
}

export function layoutDensityPadding(d: LayoutLabPayload['density']): string {
  return d === 'compact' ? 'px-2 py-1.5' : 'px-4 py-3'
}

export function layoutTableRowClass(payload: LayoutLabPayload, rowIndex: number): string {
  if (payload.tableStyle === 'zebra') return rowIndex % 2 === 0 ? 'bg-white/80' : 'bg-neutral-100/50'
  if (payload.tableStyle === 'ruled') return 'border-b border-neutral-200'
  return ''
}

/** Card shell: radius + optional shadow / accent border */
export function layoutCardClass(payload: LayoutLabPayload): string {
  const r = layoutRadiusClass(payload.radius)
  const base = `${r} border bg-white`
  if (payload.cardStyle === 'flat') return `${base} border-neutral-200/90`
  if (payload.cardStyle === 'borderAccent') return `${base} border-2`
  return `${base} border-neutral-200/90 shadow-sm`
}

export function layoutCardStyleObject(payload: LayoutLabPayload): CSSProperties | undefined {
  if (payload.cardStyle !== 'borderAccent') return undefined
  return { borderColor: payload.accent }
}

export function mergeLayoutPayload(partial: Partial<LayoutLabPayload>): LayoutLabPayload {
  const sb = partial.sidebar_box_1
    ? { ...DEFAULT_SIDEBAR_BOX_1, ...partial.sidebar_box_1 }
    : DEFAULT_SIDEBAR_BOX_1
  const t1 = partial.table_1
    ? {
        ...DEFAULT_TABLE_1,
        ...partial.table_1,
        toolbar: { ...DEFAULT_TABLE_1_TOOLBAR, ...partial.table_1.toolbar },
      }
    : DEFAULT_TABLE_1
  const m1 = partial.mainbox_1 ? { ...DEFAULT_MAINBOX_1, ...partial.mainbox_1 } : DEFAULT_MAINBOX_1
  const mu = partial.menu_1 ? { ...DEFAULT_MENU_1, ...partial.menu_1 } : DEFAULT_MENU_1
  return { ...DEFAULT_LAYOUT_LAB, ...partial, sidebar_box_1: sb, table_1: t1, mainbox_1: m1, menu_1: mu, version: 1 }
}

function sidebarBox1SurfaceClass(s: SidebarBox1Settings['surface']): string {
  switch (s) {
    case 'muted':
      return 'bg-neutral-100'
    case 'cream':
      return 'bg-[#faf8f4]'
    default:
      return 'bg-white'
  }
}

function sidebarBox1ShadowClass(s: SidebarBox1Settings['shadow']): string {
  switch (s) {
    case 'none':
      return 'shadow-none'
    case 'md':
      return 'shadow-md'
    default:
      return 'shadow-sm'
  }
}

function sidebarBox1PaddingClass(p: SidebarBox1Settings['padding']): string {
  return p === 'compact' ? 'p-4' : 'p-6'
}

function sidebarBox1HeadingClass(size: SidebarBox1Settings['headingSize']): string {
  switch (size) {
    case 'sm':
      return 'text-sm font-semibold text-neutral-900'
    case 'lg':
      return 'text-lg font-semibold text-neutral-900'
    default:
      return 'text-base font-semibold text-neutral-900'
  }
}

/** Shell classes for sidebar_box_1 (border uses global radius from payload) */
export function sidebarBox1ShellClass(payload: LayoutLabPayload): string {
  const s = payload.sidebar_box_1 ?? DEFAULT_SIDEBAR_BOX_1
  const r = layoutRadiusClass(payload.radius)
  const surf = sidebarBox1SurfaceClass(s.surface)
  const sh = sidebarBox1ShadowClass(s.shadow)
  return `h-fit border border-neutral-200/90 ${r} ${surf} ${sh}`
}

export function sidebarBox1Padding(payload: LayoutLabPayload): string {
  return sidebarBox1PaddingClass(payload.sidebar_box_1?.padding ?? DEFAULT_SIDEBAR_BOX_1.padding)
}

export function sidebarBox1HeadingClassFromPayload(payload: LayoutLabPayload): string {
  return sidebarBox1HeadingClass(payload.sidebar_box_1?.headingSize ?? DEFAULT_SIDEBAR_BOX_1.headingSize)
}

/** Primary CTA inside sidebar_box_1 */
export function sidebarBox1ButtonClass(payload: LayoutLabPayload): string {
  const style = payload.sidebar_box_1?.buttonStyle ?? DEFAULT_SIDEBAR_BOX_1.buttonStyle
  const base =
    'flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-medium transition-colors'
  if (style === 'outline') {
    return `${base} border-2 bg-transparent hover:bg-neutral-50`
  }
  if (style === 'soft') {
    return `${base} text-neutral-900 hover:opacity-90`
  }
  return `${base} text-white shadow-sm hover:opacity-95`
}

export function sidebarBox1ButtonStyleObject(payload: LayoutLabPayload): CSSProperties | undefined {
  const style = payload.sidebar_box_1?.buttonStyle ?? DEFAULT_SIDEBAR_BOX_1.buttonStyle
  const accent = payload.accent || DEFAULT_LAYOUT_LAB.accent
  if (style === 'solid') {
    return { backgroundColor: accent }
  }
  if (style === 'soft') {
    return { backgroundColor: `${accent}18`, color: accent }
  }
  if (style === 'outline') {
    return { borderColor: accent, color: accent }
  }
  return undefined
}

// ─── table_1 ─────────────────────────────────────────────────────────────────

function table1SurfaceClass(s: Table1Settings['surface']): string {
  switch (s) {
    case 'cream':
      return 'bg-[#faf8f4]'
    case 'muted':
      return 'bg-neutral-50'
    default:
      return 'bg-white'
  }
}

function table1ShadowClass(s: Table1Settings['shadow']): string {
  switch (s) {
    case 'none':
      return 'shadow-none'
    case 'md':
      return 'shadow-md'
    default:
      return 'shadow-sm'
  }
}

export function table1ShellClass(payload: LayoutLabPayload): string {
  const t = payload.table_1 ?? DEFAULT_TABLE_1
  const r = layoutRadiusClass(payload.radius)
  const surf = table1SurfaceClass(t.surface)
  const sh = table1ShadowClass(t.shadow)
  return `overflow-hidden border border-neutral-200/90 ${r} ${surf} ${sh}`
}

export function table1HeaderRowClass(payload: LayoutLabPayload): string {
  const h = payload.table_1?.headerStyle ?? DEFAULT_TABLE_1.headerStyle
  if (h === 'strong') return 'border-b border-neutral-200 bg-neutral-100 text-neutral-800'
  if (h === 'plain') return 'border-b border-neutral-200 text-neutral-600'
  return 'border-b border-neutral-200 bg-neutral-50/80 text-neutral-600'
}

export function table1CellPadding(payload: LayoutLabPayload): string {
  const d = payload.table_1?.cellDensity ?? DEFAULT_TABLE_1.cellDensity
  return d === 'compact' ? 'px-3 py-2' : 'px-4 py-4'
}

/** Effective row background for tbody rows (index 0-based) */
export function table1BodyRowClass(payload: LayoutLabPayload, rowIndex: number): string {
  const row = payload.table_1?.rowStyle ?? DEFAULT_TABLE_1.rowStyle
  const effective =
    row === 'inherit' ? payload.tableStyle : row === 'zebra' ? 'zebra' : row === 'ruled' ? 'ruled' : 'minimal'
  if (effective === 'zebra') return rowIndex % 2 === 0 ? 'bg-white/90' : 'bg-neutral-100/40'
  if (effective === 'ruled') return 'border-b border-neutral-100'
  return 'border-b border-transparent'
}

// ─── mainbox_1 ───────────────────────────────────────────────────────────────

function mainbox1SurfaceClass(s: Mainbox1Settings['surface']): string {
  switch (s) {
    case 'cream':
      return 'bg-[#faf8f4]'
    case 'muted':
      return 'bg-neutral-50'
    default:
      return 'bg-white'
  }
}

function mainbox1ShadowClass(s: Mainbox1Settings['shadow']): string {
  switch (s) {
    case 'none':
      return 'shadow-none'
    case 'md':
      return 'shadow-md'
    default:
      return 'shadow-sm'
  }
}

export function mainbox1ShellClass(payload: LayoutLabPayload): string {
  const m = payload.mainbox_1 ?? DEFAULT_MAINBOX_1
  const r = layoutRadiusClass(payload.radius)
  const surf = mainbox1SurfaceClass(m.surface)
  const sh = mainbox1ShadowClass(m.shadow)
  const border =
    m.border === 'accent'
      ? 'border-2'
      : 'border border-neutral-200/90'
  return `${r} ${surf} ${sh} ${border}`
}

export function mainbox1ShellStyleObject(payload: LayoutLabPayload): CSSProperties | undefined {
  const m = payload.mainbox_1 ?? DEFAULT_MAINBOX_1
  if (m.border !== 'accent') return undefined
  return { borderColor: payload.accent || DEFAULT_LAYOUT_LAB.accent }
}

export function mainbox1PaddingClass(payload: LayoutLabPayload): string {
  const p = payload.mainbox_1?.padding ?? DEFAULT_MAINBOX_1.padding
  return p === 'compact' ? 'p-4' : 'p-6'
}

// ─── menu_1 (Organisasjon tabs) ──────────────────────────────────────────────

/** Ytre ramme rundt fanemenyen */
export function menu1BarOuterClass(payload: LayoutLabPayload): string {
  const m = payload.menu_1 ?? DEFAULT_MENU_1
  if (m.tabLayout === 'flush') {
    return 'mt-8 overflow-hidden border border-black/10 shadow-sm rounded-none'
  }
  return 'mt-8 overflow-hidden rounded-2xl border border-black/10 shadow-sm'
}

export function menu1BarStyleObject(payload: LayoutLabPayload): CSSProperties {
  const m = payload.menu_1 ?? DEFAULT_MENU_1
  const accent = payload.accent || DEFAULT_LAYOUT_LAB.accent
  const base: CSSProperties =
    m.barTone === 'slate'
      ? { backgroundColor: '#1e293b', borderColor: 'rgba(0,0,0,0.1)' }
      : { backgroundColor: accent, borderColor: 'rgba(0,0,0,0.1)' }
  if (m.tabLayout === 'flush') {
    return { ...base, borderTop: '1px solid rgba(0,0,0,0.25)' }
  }
  return base
}

/** Rad inni menybar — padding fjernes i «all the way down» så faner fyller kanten */
export function menu1InnerRowClass(payload: LayoutLabPayload): string {
  const m = payload.menu_1 ?? DEFAULT_MENU_1
  if (m.tabLayout === 'flush') {
    return 'flex min-h-[3rem] w-full flex-1 flex-wrap items-stretch gap-0'
  }
  return 'flex min-h-[3rem] flex-wrap items-stretch gap-0 px-1 py-1 sm:px-2'
}

export function menu1ActiveTabClass(payload: LayoutLabPayload): string {
  const m = payload.menu_1 ?? DEFAULT_MENU_1
  const fill = m.activeFill === 'white' ? 'bg-white' : 'bg-[#f5f0e8]'
  if (m.tabLayout === 'flush') {
    return `inline-flex min-h-[3rem] min-w-0 flex-1 items-center justify-center gap-2 border-0 px-3 py-2 text-sm font-medium transition-colors ${fill} rounded-none shadow-none`
  }
  if (m.tabLayout === 'squared') {
    return `inline-flex min-h-[2.75rem] flex-1 items-center justify-center gap-2 rounded-none px-3 py-2 text-sm font-medium transition-colors sm:flex-none sm:px-5 ${fill} shadow-sm`
  }
  const r =
    m.tabRounding === 'full' ? 'rounded-full' : m.tabRounding === 'none' ? 'rounded-none' : 'rounded-xl'
  return `inline-flex min-h-[2.75rem] flex-1 items-center justify-center gap-2 ${r} px-3 py-2 text-sm font-medium transition-colors sm:flex-none sm:px-5 ${fill} shadow-sm`
}

export function menu1ActiveTabTextStyle(payload: LayoutLabPayload): CSSProperties {
  return { color: payload.accent || DEFAULT_LAYOUT_LAB.accent }
}

export function menu1InactiveTabClass(payload: LayoutLabPayload): string {
  const m = payload.menu_1 ?? DEFAULT_MENU_1
  if (m.tabLayout === 'flush') {
    return `inline-flex min-h-[3rem] min-w-0 flex-1 items-center justify-center gap-2 rounded-none border-0 px-3 py-2 text-sm font-medium text-white/95 transition-colors hover:bg-white/10`
  }
  if (m.tabLayout === 'squared') {
    return `inline-flex min-h-[2.75rem] flex-1 items-center justify-center gap-2 rounded-none px-3 py-2 text-sm font-medium text-white/95 transition-colors hover:bg-white/10 sm:flex-none sm:px-5`
  }
  const r =
    m.tabRounding === 'full' ? 'rounded-full' : m.tabRounding === 'none' ? 'rounded-none' : 'rounded-xl'
  return `inline-flex min-h-[2.75rem] flex-1 items-center justify-center gap-2 ${r} px-3 py-2 text-sm font-medium text-white/95 transition-colors hover:bg-white/10 sm:flex-none sm:px-5`
}

// ─── mainbox_1 heading ───────────────────────────────────────────────────────

export function mainbox1HeadingClass(payload: LayoutLabPayload): string {
  const m = payload.mainbox_1 ?? DEFAULT_MAINBOX_1
  const base = 'text-lg font-semibold'
  if (m.headingColor === 'accent') return `${base}`
  if (m.headingColor === 'neutral') return `${base} text-neutral-600`
  return `${base} text-neutral-900`
}

export function mainbox1HeadingStyleObject(payload: LayoutLabPayload): CSSProperties | undefined {
  const m = payload.mainbox_1 ?? DEFAULT_MAINBOX_1
  if (m.headingColor !== 'accent') return undefined
  return { color: payload.accent || DEFAULT_LAYOUT_LAB.accent }
}
