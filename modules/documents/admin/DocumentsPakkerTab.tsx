// DocumentsPakkerTab — placeholder until a document_packs table is provisioned.
// Documents group templates by `category` (hms_handbook, policy, procedure, …)
// rather than licensed packs. A dedicated pack layer is on the roadmap.

import { Layers } from 'lucide-react'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { InfoBox } from '../../../src/components/ui/AlertBox'
import { useDocuments } from '../../../src/hooks/useDocuments'

const CATEGORY_LABEL: Record<string, string> = {
  hms_handbook: 'HMS-håndbok',
  policy: 'Policy',
  procedure: 'Prosedyre',
  guide: 'Veiledning',
  template_library: 'Malbibliotek',
}

export function DocumentsPakkerTab() {
  const docs = useDocuments()

  // Derive unique categories from system templates
  const categories = Array.from(
    new Set(docs.systemTemplatesCatalog.map((t) => t.category)),
  ).sort()

  return (
    <div className="space-y-6">
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-5 w-5 text-[#0f766e]" aria-hidden />
          <h2 className="text-lg font-semibold text-neutral-900">Dokumentpakker</h2>
        </div>
        <p className="text-sm text-neutral-600">
          Dokumentmaler er i dag gruppert etter <strong>kategori</strong> (HMS-håndbok,
          Policy, Prosedyre, …). En dedikert pakkekonfigurasjon — med per-pakke
          KPI-merker og lovhenvisningsbanner — vil komme i en fremtidig utgivelse.
        </p>

        <div className="mt-5">
          <InfoBox>
            Aktuelle kategorier konfigureres direkte på malene. Bruk «Maler»-fanen
            for å aktivere/deaktivere og endre kategori på systemmalene, eller legg
            til egne maler.
          </InfoBox>
        </div>

        {categories.length > 0 && (
          <div className="mt-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Aktive kategorier ({categories.length})
            </p>
            <ul className="space-y-2">
              {categories.map((cat) => {
                const count = docs.systemTemplatesCatalog.filter(
                  (t) => t.category === cat,
                ).length
                return (
                  <li
                    key={cat}
                    className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200/80 bg-neutral-50/50 px-4 py-3"
                  >
                    <span className="text-sm font-medium text-neutral-900">
                      {CATEGORY_LABEL[cat] ?? cat}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {count} {count === 1 ? 'mal' : 'maler'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </ModuleSectionCard>
    </div>
  )
}
