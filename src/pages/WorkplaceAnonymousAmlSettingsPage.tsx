import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkplaceReportingCases } from '../hooks/useWorkplaceReportingCases'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { useWorkplaceReportingHubMenuItems } from '../components/workplace/WorkplaceReportingHubMenu'
import { WorkplaceStandardListLayout } from '../components/layout/WorkplaceStandardListLayout'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_INPUT_ON_WHITE,
  WPSTD_FORM_INSET,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_ROW_GRID,
} from '../components/layout/WorkplaceStandardFormPanel'
import { DEFAULT_ANONYMOUS_AML_PAGE } from '../types/workplaceReportingCase'

const PAGE_WRAP = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'

export function WorkplaceAnonymousAmlSettingsPage() {
  const { organization } = useOrgSetupContext()
  const hubItems = useWorkplaceReportingHubMenuItems()
  const wr = useWorkplaceReportingCases()
  const [savedFlash, setSavedFlash] = useState(false)

  const p = wr.anonymousAmlPage

  const publicUrl = useMemo(() => {
    if (!organization?.whistle_public_slug || typeof window === 'undefined') return null
    return `${window.location.origin}/anonym-aml/${organization.whistle_public_slug}`
  }, [organization?.whistle_public_slug])

  const resetDefaults = useCallback(() => {
    wr.updateAnonymousAmlPageSettings({ ...DEFAULT_ANONYMOUS_AML_PAGE })
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 2000)
  }, [wr])

  return (
    <div className={`${PAGE_WRAP} font-[Inter,system-ui,sans-serif] text-[#171717]`}>
      <WorkplaceStandardListLayout
        breadcrumb={[
          { label: 'Workspace', to: '/' },
          { label: 'Arbeidsplassrapportering', to: '/workplace-reporting' },
          { label: 'Anonym rapportering', to: '/workplace-reporting/anonymous-aml' },
          { label: 'Innstillinger' },
        ]}
        title="Innstillinger — anonym rapportering"
        description="Tekst som vises på den eksterne siden (uten innlogging). Endringer lagres automatisk. Organisasjonsnøkkel er den samme som for offentlig varsling."
        hubAriaLabel="Arbeidsplassrapportering"
        hubItems={hubItems}
      >
        <div className="space-y-8">
          {savedFlash ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              Oppdatert.
            </p>
          ) : null}

          <div className={WPSTD_FORM_ROW_GRID}>
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Ekstern lenke</p>
              <p className={WPSTD_FORM_LEAD}>
                Siden er tilgjengelig for alle med lenken. Den bruker samme slug som{' '}
                <code className="rounded bg-neutral-100 px-1 text-xs">/varsle/…</code> (whistle_public_slug).
              </p>
            </div>
            <div className={WPSTD_FORM_INSET}>
              {publicUrl ? (
                <a href={publicUrl} className="break-all text-sm font-medium text-[#1a3d32] underline" target="_blank" rel="noreferrer">
                  {publicUrl}
                </a>
              ) : (
                <p className="text-sm text-amber-900">
                  Ingen offentlig slug er satt ennå — konfigurer varslingslenke for organisasjonen først.
                </p>
              )}
            </div>
          </div>

          <div className={WPSTD_FORM_ROW_GRID}>
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Sideinnhold</p>
              <p className={WPSTD_FORM_LEAD}>Overskrift, ingress og bunntekst på den eksterne siden.</p>
            </div>
            <div className={WPSTD_FORM_INSET} style={{ borderStyle: 'solid' }}>
              <label className={WPSTD_FORM_FIELD_LABEL}>Sidetittel</label>
              <input
                value={p.pageTitle}
                onChange={(e) => wr.updateAnonymousAmlPageSettings({ pageTitle: e.target.value })}
                onBlur={() => {
                  if (!p.pageTitle.trim()) {
                    wr.updateAnonymousAmlPageSettings({ pageTitle: DEFAULT_ANONYMOUS_AML_PAGE.pageTitle })
                  }
                }}
                className={WPSTD_FORM_INPUT_ON_WHITE}
              />
              <label className={`${WPSTD_FORM_FIELD_LABEL} mt-4 block`}>Ingress</label>
              <textarea
                value={p.leadParagraph}
                onChange={(e) => wr.updateAnonymousAmlPageSettings({ leadParagraph: e.target.value })}
                rows={3}
                className={WPSTD_FORM_INPUT_ON_WHITE}
              />
              <label className={`${WPSTD_FORM_FIELD_LABEL} mt-4 block`}>Bunntekst (valgfritt)</label>
              <textarea
                value={p.footerNote}
                onChange={(e) => wr.updateAnonymousAmlPageSettings({ footerNote: e.target.value })}
                rows={2}
                className={WPSTD_FORM_INPUT_ON_WHITE}
              />
              <div className="mt-6">
                <button
                  type="button"
                  onClick={resetDefaults}
                  className="rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800"
                >
                  Tilbakestill tekst til standard
                </button>
              </div>
            </div>
          </div>

          <p className="text-sm text-neutral-600">
            <Link to="/workplace-reporting/anonymous-aml" className="font-medium text-[#1a3d32] underline">
              ← Tilbake til listen
            </Link>
          </p>
        </div>
      </WorkplaceStandardListLayout>
    </div>
  )
}
