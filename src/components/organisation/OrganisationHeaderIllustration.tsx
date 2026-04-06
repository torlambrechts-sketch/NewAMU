/**
 * Decorative line illustration — hand signing on clipboard (matches org page accent).
 */
export function OrganisationHeaderIllustration({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M52 28h96c4 0 8 3 8 8v112c0 4-4 8-8 8H52c-4 0-8-4-8-8V36c0-5 4-8 8-8z"
        stroke="#1a3d32"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M76 20h48c3 0 6 2 6 5v12H70V25c0-3 3-5 6-5z"
        stroke="#1a3d32"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle cx="100" cy="26" r="4" fill="#1a3d32" />
      <path d="M64 52h72M64 68h56M64 84h64" stroke="#1a3d32" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M72 118c8-4 18-6 28-8 12-2 24 0 36 4"
        stroke="#1a3d32"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M118 132c18-8 32-22 42-38 6-10 12-4 8 4-12 24-32 44-58 56-6 3-12 1-14-6-2-8 8-14 22-16z"
        stroke="#1a3d32"
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M152 86l14-6 8 18-12 8-10-20z"
        stroke="#1a3d32"
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}
