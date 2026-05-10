import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PlatformGridComposer } from './PlatformGridComposer'
import {
  LAYOUT_COMPOSER_BLOCKS,
  PlatformLayoutComposerDemo,
  type PlatformLayoutPreviewSurface,
} from './PlatformLayoutComposerPage'
import {
  PlatformDashboardLayoutDemo,
  PlatformSplit7030LayoutDemo,
  PlatformStandardListLayoutDemo,
  type LayoutKitPreviewSurface,
} from './platformLayoutKitDemos'

function SurfaceToggle({
  value,
  onChange,
}: {
  value: PlatformLayoutPreviewSurface
  onChange: (v: PlatformLayoutPreviewSurface) => void
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-slate-900/50 p-1"
      role="group"
      aria-label="Forhåndsvisning bakgrunn"
    >
      {(
        [
          { id: 'cream' as const, label: 'Krem arbeidsflate' },
          { id: 'white' as const, label: 'Helhvit' },
        ] as const
      ).map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          aria-pressed={value === opt.id}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            value === opt.id
              ? 'bg-amber-500/90 text-slate-950'
              : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function hubToKitSurface(surface: PlatformLayoutPreviewSurface): LayoutKitPreviewSurface {
  return surface
}

/**
 * Single platform-admin entry for workplace layout demos: composer blocks, standard list shell, dashboard, 7/3 split.
 */
export function PlatformLayoutHubPage() {
  const [surface, setSurface] = useState<PlatformLayoutPreviewSurface>('cream')
  const kitSurface = hubToKitSurface(surface)

  return (
    <div className="space-y-8 text-neutral-100">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-2xl font-semibold text-white">Layout (arbeidsflate)</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Samlet forhåndsvisning av gjenbrukbare arbeidsflate-mønstre. Samme visuelle språk som under{' '}
            <Link to="/platform-admin/layout-reference" className="text-amber-400/90 hover:underline">
              Layout-referanse
            </Link>
            . Se også{' '}
            <Link to="/platform-admin/layout-elements" className="text-amber-400/90 hover:underline">
              Layout-elementer (katalog)
            </Link>{' '}
            for alle {LAYOUT_COMPOSER_BLOCKS.length} blokkene én per kort. Velg krem (workplace) eller helhvit bakgrunn for alle demoer under.
          </p>
        </div>
        <SurfaceToggle value={surface} onChange={setSurface} />
      </div>

      <section id="composer" className="scroll-mt-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Layout-komponenter — komponer</h2>
          <p className="mt-1 max-w-3xl text-sm text-neutral-500">
            Kombiner atomære blokker og hele sider fra{' '}
            <Link to="/platform-admin/layout-reference" className="text-amber-400/90 hover:underline">
              layout-referanse
            </Link>{' '}
            (prefiks «Ref. —»), pluss overskrift, stat-rad, informasjon/advarsel (varsel-liste), tabeller, scorecard, verktøylinje, list 2, ROS-risikomatrise og ROS-tabell, boksrutenett og rapportering. Dra for å
            endre rekkefølge; lagre som <strong className="text-neutral-300">lokalt</strong> eller i <strong className="text-neutral-300">database</strong>{' '}
            (plattformadmin). Publiserte stack-maler kan brukes i arbeidsflaten (f.eks. Internkontroll → Oversikt ved navnematch).
          </p>
        </div>
        <PlatformLayoutComposerDemo previewSurface={surface} embedInDarkChrome={false} />

        <div className="mt-10 space-y-3 border-t border-white/10 pt-8">
          <h3 className="text-base font-semibold text-white">Rutenett — rader og kolonner</h3>
          <p className="max-w-3xl text-sm text-neutral-500">
            Bygg egne rader med valgfritt antall kolonner og <code className="rounded bg-white/10 px-1 text-xs">fr</code>-bredde (f.eks. 7 og 3 som{' '}
            <code className="rounded bg-white/10 px-1 text-xs">WorkplaceSplit7030Layout</code>). Dra blokker fra paletten inn i celler, eller dra
            celle-håndtaket for å bytte innhold. Rutenettet og lagrede oppsett lagres i{' '}
            <code className="rounded bg-white/10 px-1 text-xs">localStorage</code> (CRUD: lagre som nytt, oppdater, last inn, slett).
          </p>
          <PlatformGridComposer previewSurface={surface} />
        </div>
      </section>

      <section id="standard" className="scroll-mt-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Standard layout — liste / boks / tabell</h2>
          <p className="mt-1 max-w-3xl text-sm text-neutral-500">
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-amber-200/90">WorkplaceStandardListLayout</code> og{' '}
            <code className="rounded bg-white/10 px-1 py-0.5 text-xs">WorkplaceListToolbar</code> i{' '}
            <code className="rounded bg-white/10 px-1 text-xs">components/layout/WorkplaceStandardListLayout.tsx</code>.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4 md:p-6">
          <PlatformStandardListLayoutDemo surface={kitSurface} />
        </div>
      </section>

      <section id="dashboard" className="scroll-mt-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Standard layout — dashbord</h2>
          <p className="mt-1 max-w-3xl text-sm text-neutral-500">
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-amber-200/90">WorkplaceDashboardShell</code> med valgfri hub og KPI-rad. Body bruker ofte{' '}
            <code className="rounded bg-white/10 px-1 text-xs">WorkplaceSplit7030Layout</code>.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4 md:p-6">
          <PlatformDashboardLayoutDemo surface={kitSurface} />
        </div>
      </section>

      <section id="split" className="scroll-mt-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Standard layout — split 7/3</h2>
          <p className="mt-1 max-w-3xl text-sm text-neutral-500">
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-amber-200/90">WorkplaceSplit7030Layout</code> i{' '}
            <code className="rounded bg-white/10 px-1 text-xs">components/layout/WorkplaceSplit7030Layout.tsx</code> — valgfri{' '}
            <code className="rounded bg-white/10 px-1 text-xs">cardWrap</code>.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4 md:p-6">
          <PlatformSplit7030LayoutDemo surface={kitSurface} />
        </div>
      </section>
    </div>
  )
}
