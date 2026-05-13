/**
 * Vekst — varm-illustrasjon for Arbeidsmiljøstrategi-hoveddet.
 * Motiv: et tre med fire grener (de fire utfallsaksene) og to figurer
 * som vanner det. Strok-stil og fargevalg speiler
 * `OrganisationHeaderIllustration` slik at illustrasjonene leser som
 * søsken i samme grafiske familie.
 */
export function VekstIllustration({ className = '' }: { className?: string }) {
  const ink = '#1a3d32'
  const warm = '#d97706'
  return (
    <svg
      className={className}
      viewBox="0 0 320 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Soft sunrise circle behind the scene */}
      <circle cx="220" cy="92" r="38" fill={warm} opacity="0.14" />
      <circle cx="220" cy="92" r="22" fill={warm} opacity="0.22" />

      {/* Horizon line */}
      <path d="M0 198 L320 198" stroke={ink} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />

      {/* Tree trunk */}
      <path d="M160 198 C160 178 158 168 158 156 C158 144 162 134 162 124" stroke={ink} strokeWidth="3" strokeLinecap="round" />

      {/* Tree branches — four directions, one per axis */}
      <path d="M160 152 C144 144 132 138 118 140" stroke={ink} strokeWidth="2.25" strokeLinecap="round" />
      <path d="M160 134 C146 124 134 116 124 108" stroke={ink} strokeWidth="2.25" strokeLinecap="round" />
      <path d="M161 128 C176 118 188 108 198 100" stroke={ink} strokeWidth="2.25" strokeLinecap="round" />
      <path d="M162 144 C176 138 188 134 200 134" stroke={ink} strokeWidth="2.25" strokeLinecap="round" />

      {/* Leaf clusters — small organic shapes */}
      <path d="M118 140 c-6 -2 -10 -8 -8 -14 c5 1 11 6 8 14z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M124 108 c-4 -6 -3 -13 3 -16 c4 5 5 13 -3 16z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M198 100 c5 -6 12 -7 17 -2 c-2 6 -10 10 -17 2z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M200 134 c7 -3 14 0 16 6 c-5 4 -13 4 -16 -6z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />

      {/* Crown — sparse leaves at the top */}
      <circle cx="158" cy="108" r="6" stroke={ink} strokeWidth="1.75" />
      <circle cx="148" cy="98" r="5" stroke={ink} strokeWidth="1.75" />
      <circle cx="168" cy="96" r="5" stroke={ink} strokeWidth="1.75" />

      {/* Two figures supporting the tree — left + right */}
      {/* Left figure */}
      <circle cx="88" cy="172" r="6" stroke={ink} strokeWidth="2" />
      <path d="M88 178 L88 196" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <path d="M88 186 C96 184 104 178 112 174" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <path d="M88 196 L80 210 M88 196 L96 210" stroke={ink} strokeWidth="2" strokeLinecap="round" />

      {/* Right figure */}
      <circle cx="232" cy="172" r="6" stroke={ink} strokeWidth="2" />
      <path d="M232 178 L232 196" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <path d="M232 186 C224 184 216 178 208 174" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <path d="M232 196 L224 210 M232 196 L240 210" stroke={ink} strokeWidth="2" strokeLinecap="round" />

      {/* Ground hatching */}
      <path d="M40 208 L52 208 M64 210 L78 210 M100 208 L116 208 M204 210 L220 210 M244 208 L260 208" stroke={ink} strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />

      {/* A tiny watering droplet between left figure and trunk */}
      <path d="M124 184 c0 -4 4 -8 6 -8 c2 0 6 4 6 8 c0 4 -3 7 -6 7 c-3 0 -6 -3 -6 -7z" fill={warm} opacity="0.6" />
    </svg>
  )
}
