import type { SVGProps } from 'react'

function KlarertMark({
  size = 28,
  className = '',
  ...svgProps
}: { size?: number; className?: string } & Omit<SVGProps<SVGSVGElement>, 'width' | 'height' | 'viewBox'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={`shrink-0 ${className}`}
      aria-hidden
      {...svgProps}
    >
      <rect width="32" height="32" rx="6" className="fill-[#1a3d32]" />
      <path
        d="M8.5 16.2l4.8 4.8L23.5 10"
        className="stroke-[#c9a227]"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

type Props = {
  size?: number
  className?: string
  markOnly?: boolean
} & Omit<SVGProps<SVGSVGElement>, 'width' | 'height' | 'viewBox'>

/**
 * Klarert wordmark + mark (or mark only for compact rail).
 */
export function KlarertLogo({ size = 28, className = '', markOnly = false, ...svgProps }: Props) {
  if (markOnly) {
    return <KlarertMark size={size} className={className} {...svgProps} />
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <KlarertMark size={size} {...svgProps} />
      <span
        className="font-serif text-xl tracking-wide text-[#c9a227] md:text-2xl"
        style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
      >
        Klarert
      </span>
    </span>
  )
}
