import { Link } from 'react-router-dom'
import { WorkplacePageHeading1 } from '../../components/layout/WorkplacePageHeading1'
import { WorkplaceSplit7030Layout } from '../../components/layout/WorkplaceSplit7030Layout'

/**
 * Platform-admin reference for {@link WorkplaceSplit7030Layout} (7fr / 3fr grid on large screens).
 */
export function PlatformSplit7030KitPage() {
  return (
    <div className="space-y-6 text-neutral-100">
      <div>
        <h1 className="text-2xl font-semibold text-white">Standard layout — split 7/3</h1>
        <p className="mt-2 max-w-3xl text-sm text-neutral-400">
          Komponenten{' '}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-amber-200/90">WorkplaceSplit7030Layout</code> i{' '}
          <code className="rounded bg-white/10 px-1 text-xs">components/layout/WorkplaceSplit7030Layout.tsx</code> gir to
          kolonner (~2/3 og ~1/3) med valgfri hvit kort-innpakning per kolonne (<code className="rounded bg-white/10 px-1 text-xs">cardWrap</code>
          , standard <code className="rounded bg-white/10 px-1 text-xs">true</code>).
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Sett <code className="rounded bg-white/10 px-1 text-xs">cardWrap=&#123;false&#125;</code> hvis du allerede ligger i et
          stort hvitt panel. Se også{' '}
          <Link to="/platform-admin/layout-dashboard" className="text-amber-400/90 hover:underline">
            Dashbord-layout
          </Link>
          .
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4 md:p-6">
        <div className="rounded-xl border border-white/10 bg-[#F9F7F2] p-4 text-neutral-900 shadow-lg md:p-6">
          <WorkplacePageHeading1
            breadcrumb={[
              { label: 'Plattformadmin', to: '/platform-admin' },
              { label: 'Layout-kit' },
              { label: 'Split 7/3' },
            ]}
            title="Side med 7/3-split (demo)"
            description="Under: to kolonner som stables på mobil. Samme rutenett som velkomst-dashbord og layout-reference Dashboard 70/30."
          />

          <div className="mt-8">
            <WorkplaceSplit7030Layout
              main={
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">Hovedinnhold</h2>
                  <p className="mt-2 text-sm text-neutral-600">
                    <code className="rounded bg-neutral-100 px-1 text-xs">main</code> prop — typisk diagrammer, tabeller eller
                    lang tekst.
                  </p>
                </div>
              }
              aside={
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">Sidemarg</h2>
                  <p className="mt-2 text-sm text-neutral-600">
                    <code className="rounded bg-neutral-100 px-1 text-xs">aside</code> prop — typisk oppsummering, lenker eller
                    kompakt liste.
                  </p>
                </div>
              }
            />
          </div>

          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Uten kort-innpakning (cardWrap=false)</p>
            <div className="mt-3">
              <WorkplaceSplit7030Layout
                cardWrap={false}
                main={<div className="rounded-lg border border-neutral-200/80 bg-white p-4 text-sm shadow-sm">Egendefinert venstre panel</div>}
                aside={<div className="rounded-lg border border-neutral-200/80 bg-white p-4 text-sm shadow-sm">Egendefinert høyre panel</div>}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
