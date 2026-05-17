// Small inline chip showing a single legal reference (e.g. "AML §3-1 — Systematisk HMS-arbeid").
// Background tinted per legal family so readers can visually cluster references.

import type { LawRef, LawFamily } from '../content/features'

const FAMILY_STYLES: Record<LawFamily, { bg: string; text: string; border: string }> = {
  AML: { bg: '#1a3d32', text: '#ffffff', border: 'transparent' },
  'IK-f': { bg: 'rgba(45,212,191,0.15)', text: '#1a3d32', border: '#2dd4bf' },
  GDPR: { bg: '#0c1929', text: '#ffffff', border: 'transparent' },
  ISO: { bg: '#f5f0e8', text: '#1a3d32', border: '#c5d3c8' },
  Åpenhetsloven: { bg: 'rgba(212,168,75,0.18)', text: '#7a5510', border: '#d4a84b' },
  LDL: { bg: 'rgba(124,58,237,0.12)', text: '#5b21b6', border: '#a78bfa' },
}

type Props = {
  lawRef: LawRef
  size?: 'sm' | 'md'
}

export function LawRefChip({ lawRef, size = 'md' }: Props) {
  const style = FAMILY_STYLES[lawRef.family]
  const padding = size === 'sm' ? '0.25rem 0.55rem' : '0.4rem 0.75rem'
  const fontSize = size === 'sm' ? '0.7rem' : '0.78rem'
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full font-medium"
      style={{
        background: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
        padding,
        fontSize,
      }}
    >
      <span className="font-semibold">{lawRef.short}</span>
      <span className="opacity-70">— {lawRef.full}</span>
    </span>
  )
}
