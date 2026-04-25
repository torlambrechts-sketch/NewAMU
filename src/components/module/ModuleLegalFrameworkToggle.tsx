import { useModuleLegalFramework } from './ModuleLegalFrameworkContext'

/**
 * Green helper control in {@link ModulePageShell} header: turn the legal-framework
 * mint bar back on after the user closed it with X.
 */
export function ModuleLegalFrameworkToggle() {
  const { bannerMounted, dismissed, setDismissed } = useModuleLegalFramework()
  if (!bannerMounted) return null

  const showBar = !dismissed

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-700/25 bg-emerald-50 px-2.5 py-1 shadow-sm">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-900">Regelverk</span>
      <button
        type="button"
        role="switch"
        aria-checked={showBar}
        aria-label={showBar ? 'Skjul regelverkspanel' : 'Vis regelverkspanel'}
        onClick={() => setDismissed(!dismissed)}
        className={[
          'relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/50',
          showBar ? 'bg-emerald-600' : 'bg-neutral-300',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 size-5 rounded-full bg-white shadow transition-all',
            showBar ? 'left-[calc(100%-1.375rem)]' : 'left-0.5',
          ].join(' ')}
          aria-hidden
        />
      </button>
    </div>
  )
}
