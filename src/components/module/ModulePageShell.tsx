import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { WorkplacePageHeading1 } from '../layout/WorkplacePageHeading1'
import type { WorkplaceBreadcrumbItem } from '../layout/WorkplacePageHeading1'
import { PageContainer, type PageWidth } from '../layout/PageContainer'
import { Button } from '../ui/Button'
import { ModuleLegalFrameworkToggle } from './ModuleLegalFrameworkToggle'
import { useModuleLegalFramework } from './ModuleLegalFrameworkContext'

/**
 * Standard module page chrome.
 *
 * Replaces the manually duplicated blocks found across every HSE module page:
 *
 * ```tsx
 * <div className="min-h-screen bg-[#F9F7F2]">
 *   <header className="bg-[#F9F7F2]">
 *     <div className="mx-auto max-w-[1400px] px-4 pb-4 pt-4 md:px-8">
 *       <WorkplacePageHeading1 ... />
 *     </div>
 *   </header>
 *   <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-8">
 *     {children}
 *   </div>
 * </div>
 * ```
 *
 * Use this component for every module list, detail and admin view so the page shell,
 * max-width, vertical rhythm and heading typography stay in lockstep.
 */
export interface ModulePageShellProps {
  breadcrumb: WorkplaceBreadcrumbItem[]
  title: ReactNode
  description?: ReactNode
  headerActions?: ReactNode
  /** Tab navigation rendered as the secondary row inside the heading. */
  tabs?: ReactNode
  children: ReactNode
  /** Rendered instead of `children` when true. Used for initial data-load state. */
  loading?: boolean
  loadingLabel?: string
  /** Rendered instead of `children` when set. Used for 404-style states. */
  notFound?: {
    title: string
    backHref?: string
    backLabel?: string
    onBack?: () => void
  }
  /**
   * Content-width preset. Defaults to `'default'` (1400px ceiling — the
   * historical width). Dashboards and Kanban boards should pass
   * `'wide'`; reading-heavy single-column pages should pass `'comfort'`.
   * See `src/components/layout/PageContainer.tsx` for the full table.
   */
  width?: PageWidth
}

const OUTER = 'min-h-screen bg-[#F9F7F2]'
const HEADER_BAND = 'bg-[#F9F7F2]'

export function ModulePageShell({
  breadcrumb,
  title,
  description,
  headerActions,
  tabs,
  children,
  loading = false,
  loadingLabel = 'Laster…',
  notFound,
  width = 'default',
}: ModulePageShellProps) {
  const { bannerMounted } = useModuleLegalFramework()

  const mergedHeaderActions = useMemo(() => {
    if (!bannerMounted && headerActions == null) return undefined
    return (
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 lg:justify-end">
        <ModuleLegalFrameworkToggle />
        {headerActions}
      </div>
    )
  }, [bannerMounted, headerActions])

  const header = (
    <header className={HEADER_BAND}>
      <PageContainer width={width} py="pb-4 pt-4">
        <WorkplacePageHeading1
          breadcrumb={breadcrumb}
          title={title}
          description={description}
          headerActions={mergedHeaderActions}
          menu={tabs}
        />
      </PageContainer>
    </header>
  )

  if (loading) {
    return (
      <div className={OUTER}>
        {header}
        <PageContainer width={width} py="py-6" className="space-y-6">
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#1a3d32]" aria-hidden />
            <p className="text-sm text-neutral-600">{loadingLabel}</p>
          </div>
        </PageContainer>
      </div>
    )
  }

  if (notFound) {
    const handleBack = notFound.onBack
      ? notFound.onBack
      : notFound.backHref
        ? () => {
            window.location.href = notFound.backHref as string
          }
        : null
    return (
      <div className={OUTER}>
        {header}
        <PageContainer width={width} py="py-6" className="space-y-6">
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
            <p className="text-lg font-semibold text-neutral-900">{notFound.title}</p>
            {handleBack ? (
              <Button
                type="button"
                variant="secondary"
                onClick={handleBack}
                className="font-medium text-neutral-800"
              >
                {notFound.backLabel ?? '← Tilbake'}
              </Button>
            ) : null}
          </div>
        </PageContainer>
      </div>
    )
  }

  return (
    <div className={OUTER}>
      {header}
      <PageContainer width={width} py="py-6" className="space-y-6">
        {children}
      </PageContainer>
    </div>
  )
}

/**
 * Minimal standalone loader + not-found helpers for pages that already render {@link ModulePageShell}
 * but need to short-circuit before the full header is available (e.g. missing route param).
 */
export function ModulePageEmpty({
  title,
  description,
  backLabel,
  onBack,
}: {
  title: string
  description?: string
  backLabel?: string
  onBack?: () => void
}) {
  return (
    <div className={OUTER}>
      <PageContainer py="py-6" className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
        <p className="text-lg font-semibold text-neutral-900">{title}</p>
        {description ? <p className="text-sm text-neutral-600">{description}</p> : null}
        {onBack ? (
          <Button type="button" variant="secondary" onClick={onBack} className="font-medium text-neutral-800">
            {backLabel ?? '← Tilbake'}
          </Button>
        ) : null}
      </PageContainer>
    </div>
  )
}
