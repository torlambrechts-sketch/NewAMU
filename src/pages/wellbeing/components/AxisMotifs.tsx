/**
 * AxisMotifs — fire små illustrasjoner, én per utfallsakse. Speiler
 * stroke-stilen til VekstIllustration og OrganisationHeader-
 * Illustration: forest-grønn ink (#1a3d32), 2px-strok-er, runde
 * hjørner, varm amber (#d97706) som aksent-felt.
 *
 * Brukt i LayoutVekst — der hver akse trenger sitt eget visuelle
 * fotavtrykk for at varianten skal lese som «illustrert» og ikke
 * bare «sans-serif med pene typografi».
 */

const INK = '#1a3d32'
const WARM = '#d97706'

type MotifProps = { className?: string }

/** Trygghet — skjold med hjerte. Vern + omsorg. */
export function MotifTrygghet({ className = '' }: MotifProps) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M32 8 L52 16 V32 C52 44 42 54 32 58 C22 54 12 44 12 32 V16 L32 8 Z"
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Soft warm fill inside */}
      <path
        d="M32 13 L47 19 V32 C47 41 39 49 32 52 C25 49 17 41 17 32 V19 L32 13 Z"
        fill={WARM}
        opacity="0.12"
      />
      {/* Heart in the center */}
      <path
        d="M32 40 C28 36 22 34 22 28 C22 25 25 23 28 24 C30 24 32 26 32 28 C32 26 34 24 36 24 C39 23 42 25 42 28 C42 34 36 36 32 40 Z"
        stroke={INK}
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

/** Trivsel — varm sol med stråler. Velvære og kjenne seg sett. */
export function MotifTrivsel({ className = '' }: MotifProps) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* Outer rays */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const r1 = 22
        const r2 = 28
        const rad = (deg * Math.PI) / 180
        const x1 = 32 + Math.cos(rad) * r1
        const y1 = 32 + Math.sin(rad) * r1
        const x2 = 32 + Math.cos(rad) * r2
        const y2 = 32 + Math.sin(rad) * r2
        return (
          <line
            key={deg}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={INK}
            strokeWidth="2.25"
            strokeLinecap="round"
          />
        )
      })}
      {/* Sun disc */}
      <circle cx="32" cy="32" r="14" fill={WARM} opacity="0.22" />
      <circle cx="32" cy="32" r="14" stroke={INK} strokeWidth="2.5" fill="none" />
      {/* Soft smile */}
      <path
        d="M26 32 C28 36 36 36 38 32"
        stroke={INK}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="27.5" cy="29" r="1.25" fill={INK} />
      <circle cx="36.5" cy="29" r="1.25" fill={INK} />
    </svg>
  )
}

/** Medvirkning — to figurer i samtale med en taleboble mellom seg. */
export function MotifMedvirkning({ className = '' }: MotifProps) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* Left figure */}
      <circle cx="14" cy="22" r="5" stroke={INK} strokeWidth="2.25" fill="none" />
      <path
        d="M14 27 L14 44 M14 32 L8 38 M14 32 L20 38 M14 44 L9 54 M14 44 L19 54"
        stroke={INK}
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      {/* Right figure */}
      <circle cx="50" cy="22" r="5" stroke={INK} strokeWidth="2.25" fill="none" />
      <path
        d="M50 27 L50 44 M50 32 L44 38 M50 32 L56 38 M50 44 L45 54 M50 44 L55 54"
        stroke={INK}
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      {/* Speech bubble in the middle */}
      <path
        d="M22 18 H42 C44 18 46 20 46 22 V28 C46 30 44 32 42 32 H32 L28 36 V32 H22 C20 32 18 30 18 28 V22 C18 20 20 18 22 18 Z"
        fill={WARM}
        opacity="0.18"
        stroke={INK}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="26" cy="25" r="1.2" fill={INK} />
      <circle cx="32" cy="25" r="1.2" fill={INK} />
      <circle cx="38" cy="25" r="1.2" fill={INK} />
    </svg>
  )
}

/** Mestring & Utvikling — voksende plante med blader og bok i bakgrunnen. */
export function MotifMestring({ className = '' }: MotifProps) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* Pot */}
      <path
        d="M20 48 L24 58 H40 L44 48 Z"
        stroke={INK}
        strokeWidth="2.25"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M18 48 H46" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      {/* Soil hatch */}
      <path d="M22 50 L26 50 M30 50 L36 50 M40 50 L42 50" stroke={INK} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      {/* Stem */}
      <path d="M32 48 C32 38 32 26 32 16" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      {/* Left leaf */}
      <path
        d="M32 36 C24 34 18 28 18 22 C24 22 30 26 32 32 Z"
        stroke={INK}
        strokeWidth="2"
        strokeLinejoin="round"
        fill={WARM}
        fillOpacity="0.15"
      />
      {/* Right leaf */}
      <path
        d="M32 26 C40 24 46 18 46 12 C40 12 34 16 32 22 Z"
        stroke={INK}
        strokeWidth="2"
        strokeLinejoin="round"
        fill={WARM}
        fillOpacity="0.15"
      />
      {/* Top sprout */}
      <path
        d="M32 16 C30 13 28 12 26 13 C28 16 30 17 32 16 Z M32 16 C34 13 36 12 38 13 C36 16 34 17 32 16 Z"
        stroke={INK}
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

