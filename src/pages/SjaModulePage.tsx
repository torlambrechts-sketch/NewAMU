import { Link } from 'react-router-dom'

/** Placeholder until SJA list UI is implemented. */
export function SjaModulePage() {
  return (
    <div className="mx-auto max-w-[720px] px-4 py-16 md:px-8">
      <h1 className="text-2xl font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
        Sikker jobbanalyse
      </h1>
      <p className="mt-3 text-sm text-neutral-600">
        Oversikt over SJA-er kommer her. Åpne en analyse direkte fra lenken, eller legg til rute for opprettelse senere.
      </p>
      <Link
        to="/hse"
        className="mt-6 inline-block text-sm font-medium text-[#1a3d32] underline-offset-2 hover:underline"
      >
        ← Tilbake til HMS
      </Link>
    </div>
  )
}
