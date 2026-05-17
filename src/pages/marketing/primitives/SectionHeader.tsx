// Eyebrow + h2 (serif) + lede triplet, repeated 15+ times across the marketing surface.
// Variants for light cream sections and dark forest sections.

const FOREST = '#1a3d32'
const TEAL = '#2dd4bf'

type Props = {
  eyebrow?: string
  title: string
  lede?: string
  tone?: 'light' | 'dark'
  align?: 'center' | 'left'
}

export function SectionHeader({ eyebrow, title, lede, tone = 'light', align = 'center' }: Props) {
  const isDark = tone === 'dark'
  const titleColor = isDark ? '#ffffff' : FOREST
  const ledeColor = isDark ? 'rgba(255,255,255,0.65)' : '#525252'
  const eyebrowColor = TEAL
  const alignment = align === 'center' ? 'mx-auto text-center max-w-2xl' : 'max-w-3xl'

  return (
    <div className={alignment}>
      {eyebrow && (
        <p
          className="mb-3 text-xs font-bold uppercase tracking-[0.22em]"
          style={{ color: eyebrowColor }}
        >
          {eyebrow}
        </p>
      )}
      <h2
        className="text-3xl font-bold tracking-tight md:text-4xl lg:text-[2.6rem] lg:leading-[1.15]"
        style={{ fontFamily: "'Libre Baskerville', Georgia, serif", color: titleColor }}
      >
        {title}
      </h2>
      {lede && (
        <p className="mt-4 text-base leading-relaxed md:text-lg" style={{ color: ledeColor }}>
          {lede}
        </p>
      )}
    </div>
  )
}
