import type { CSSProperties } from 'react'
import type { LayoutLabPayload, SidebarBox1Settings } from '../types/layoutLab'
import { DEFAULT_LAYOUT_LAB, DEFAULT_SIDEBAR_BOX_1 } from '../types/layoutLab'

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
  return { ...DEFAULT_LAYOUT_LAB, ...partial, sidebar_box_1: sb, version: 1 }
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
