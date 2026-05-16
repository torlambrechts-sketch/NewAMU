// Maler — summary + lenke til malbibliotek.
//
// Shows the cross-module template count broken down by source
// (sjekklister / undersøkelser / dokumenter / læring / register) plus a
// CTA to /admin/templates (the full browser/filter view). Sits as a
// section in the Innstillinger scope so admins find templates from
// within the settings hub as well as from the sidebar entry.

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, LayoutTemplate, Loader2 } from 'lucide-react'
import { ModuleSectionCard } from '../../../module'
import { Button } from '../../../ui/Button'
import {
  ADMIN_TEMPLATE_SOURCE_LABELS,
  useAdminTemplates,
  type AdminTemplateSource,
} from '../../../../hooks/useAdminTemplates'

const SOURCE_KEYS: AdminTemplateSource[] = [
  'compliance',
  'survey',
  'documents',
  'learning',
  'registers',
]

export default function MalerSettingsPanel() {
  const { rows, loading } = useAdminTemplates()
  const counts = useMemo<Record<AdminTemplateSource, number>>(() => {
    const next: Record<AdminTemplateSource, number> = {
      compliance: 0,
      survey: 0,
      documents: 0,
      learning: 0,
      registers: 0,
    }
    for (const r of rows) next[r.source] += 1
    return next
  }, [rows])
  const total = rows.length

  return (
    <div className="space-y-4">
      <ModuleSectionCard className="p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
          <LayoutTemplate className="size-5 text-[#1a3d32]" />
          Malbibliotek
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Alle maler i organisasjonen — sjekklister, undersøkelser, dokumenter, kurs og register.
          Redigering skjer i hver modul; denne siden er et felles vindu inn til alle.
        </p>
        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-neutral-600">
            <Loader2 className="size-4 animate-spin" />
            Laster maler …
          </div>
        ) : (
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            {SOURCE_KEYS.map((source) => (
              <div key={source} className="rounded-md border border-neutral-200 p-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  {ADMIN_TEMPLATE_SOURCE_LABELS[source]}
                </dt>
                <dd className="mt-1 text-2xl font-semibold text-neutral-900">{counts[source]}</dd>
              </div>
            ))}
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Totalt</dt>
              <dd className="mt-1 text-2xl font-semibold text-[#1a3d32]">{total}</dd>
            </div>
          </dl>
        )}
        <div className="mt-5">
          <Link to="/admin/templates">
            <Button variant="primary" size="sm" icon={<ArrowRight className="size-3.5" />}>
              Åpne malbiblioteket
            </Button>
          </Link>
        </div>
      </ModuleSectionCard>
    </div>
  )
}
