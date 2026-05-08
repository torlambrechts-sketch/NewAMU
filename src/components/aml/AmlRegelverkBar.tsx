// AmlRegelverkBar — bottom strip with quick-jump to AML chapters.
// Design source: ui_kits/aml-compliance/AmlPieces2.jsx RegelverkBar.

import { Scale } from 'lucide-react'
import { ModuleSectionCard } from '../module/ModuleSectionCard'

const SERIF = "'Libre Baskerville', Georgia, serif"

export type AmlChapter = { ch: string; title: string; modules: number }

const DEFAULT_CHAPTERS: AmlChapter[] = [
  { ch: 'Kap. 1', title: 'Innledende bestemmelser', modules: 0 },
  { ch: 'Kap. 2', title: 'Arbeidsgivers og arbeidstakers plikter', modules: 4 },
  { ch: 'Kap. 3', title: 'Krav til arbeidsmiljø', modules: 9 },
  { ch: 'Kap. 4', title: 'Krav til psykososialt og fysisk', modules: 6 },
  { ch: 'Kap. 5', title: 'Registrerings- og meldepl.', modules: 2 },
  { ch: 'Kap. 6', title: 'Verneombud', modules: 3 },
  { ch: 'Kap. 7', title: 'Arbeidsmiljøutvalg', modules: 4 },
  { ch: 'Kap. 10', title: 'Arbeidstid', modules: 3 },
]

export function AmlRegelverkBar({
  chapters = DEFAULT_CHAPTERS,
}: {
  chapters?: AmlChapter[]
}) {
  return (
    <ModuleSectionCard className="!p-0">
      <div className="border-b border-neutral-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-[#1a3d32]" aria-hidden />
          <h2
            className="text-base font-semibold tracking-tight text-neutral-900"
            style={{ fontFamily: SERIF }}
          >
            Lovverk — kapitler i AML
          </h2>
        </div>
        <p className="mt-1 text-xs text-neutral-600">
          Klikk på et kapittel for å se modulene som dekker det.
        </p>
      </div>
      <ul className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {chapters.map((c) => (
          <li key={c.ch}>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="group flex items-center justify-between gap-3 rounded-lg border border-neutral-200/80 bg-white px-3 py-2.5 transition-colors hover:border-[#1a3d32] hover:bg-[#1a3d32]/[0.02]"
            >
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-semibold text-neutral-500">{c.ch}</p>
                <p className="mt-0.5 truncate text-sm text-neutral-900">{c.title}</p>
              </div>
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
                {c.modules}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </ModuleSectionCard>
  )
}
