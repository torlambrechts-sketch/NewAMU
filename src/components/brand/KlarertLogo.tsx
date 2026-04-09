import type { SVGProps } from 'react'

const NAVY = '#0c1929'
const TEAL = '#2dd4bf'

type MarkProps = {
  size?: number
  className?: string
  /** Dark bar (white K) vs light page (navy K). */
  variant: 'onLight' | 'onDark'
} & Omit<SVGProps<SVGSVGElement>, 'width' | 'height' | 'viewBox'>

/** Icon only — dynamic K + check (Forslag 1). */
function KlarertMark({ size = 28, className = '', variant, ...svgProps }: MarkProps) {
  const kColor = variant === 'onDark' ? '#fafafa' : NAVY
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 52"
      className={`shrink-0 ${className}`}
      aria-hidden
      {...svgProps}
    >
      {/* Blocky vertical stem */}
      <rect x="5" y="4" width="11" height="44" rx="2.2" fill={kColor} />
      {/* Lower-right leg of K */}
      <path
        d="M 14.5 31 L 42 49"
        stroke={kColor}
        strokeWidth="10.5"
        strokeLinecap="round"
      />
      {/* Teal check = upper diagonal of K */}
      <path
        d="M 13 29 L 24.5 41.5 L 44.5 9"
        fill="none"
        stroke={TEAL}
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type Props = {
  size?: number
  className?: string
  markOnly?: boolean
  variant?: 'onLight' | 'onDark'
} & Omit<SVGProps<SVGSVGElement>, 'width' | 'height' | 'viewBox'>

/**
 * Klarert.com — lockup matching Forslag 1 (sans wordmark + icon).
 */
export function KlarertLogo({
  size = 28,
  className = '',
  markOnly = false,
  variant = 'onLight',
  ...svgProps
}: Props) {
  if (markOnly) {
    return <KlarertMark size={size} className={className} variant={variant} {...svgProps} />
  }

  const isDark = variant === 'onDark'

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <KlarertMark size={size} variant={variant} {...svgProps} />
      <span
        className={`inline-flex items-baseline gap-0 text-xl font-bold tracking-tight md:text-2xl ${
          isDark ? 'text-white' : 'text-[#0c1929]'
        }`}
        style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
      >
        Klarert
        <span className={isDark ? 'text-white/85' : 'text-[#0c1929]/90'}>.com</span>
      </span>
    </span>
  )
}
