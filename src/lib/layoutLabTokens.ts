import type { CSSProperties } from 'react'
import type { LayoutLabPayload } from '../types/layoutLab'
import { DEFAULT_LAYOUT_LAB } from '../types/layoutLab'

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
  return { ...DEFAULT_LAYOUT_LAB, ...partial, version: 1 }
}
