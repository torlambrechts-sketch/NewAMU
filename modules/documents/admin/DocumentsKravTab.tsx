// DocumentsKravTab — legal-requirement coverage for the documents module.
// Groups legalBasis / legalRefs from system templates so admins can see
// which legal bases are covered by the current document template set.

import { ShieldCheck } from 'lucide-react'
import { useMemo } from 'react'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { Badge } from '../../../src/components/ui/Badge'
import { useDocuments } from '../../../src/hooks/useDocuments'

const CATEGORY_LABEL: Record<string, string> = {
  hms_handbook: 'HMS-håndbok',
  policy: 'Policy',
  procedure: 'Prosedyre',
  guide: 'Veiledning',
  template_library: 'Malbibliotek',
}

export function DocumentsKravTab() {
  const docs = useDocuments()

  const refEntries = useMemo(() => {
    // Map legal ref → categories it appears in
    const refMap = new Map<string, Set<string>>()
    for (const t of docs.systemTemplatesCatalog) {
      for (const ref of t.legalBasis ?? []) {
        if (!refMap.has(ref)) refMap.set(ref, new Set())
        refMap.get(ref)!.add(t.category)
      }
    }
    return Array.from(refMap.entries())
      .map(([ref, cats]) => ({ ref, categories: Array.from(cats).sort() }))
      .sort((a, b) => a.ref.localeCompare(b.ref))
  }, [docs.systemTemplatesCatalog])

  const totalRefs = refEntries.length

  return (
    <div className="space-y-6">
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-5 w-5 text-[#0f766e]" aria-hidden />
          <h2 className="text-lg font-semibold text-neutral-900">Lovkrav</h2>
          {totalRefs > 0 && (
            <span className="ml-auto text-xs text-neutral-500">
              {totalRefs} lovhenvisning{totalRefs !== 1 ? 'er' : ''} totalt
            </span>
          )}
        </div>
        <p className="text-sm text-neutral-600 mb-5">
          Lovhenvisninger hentet fra systemmalenes <strong>legalBasis</strong>-felt.
          Viser hvilke kategorier som dekker hvert lovkrav.
        </p>

        {refEntries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 p-6 text-center text-sm text-neutral-500">
            Ingen systemmal har lovhenvisninger ennå.
          </p>
        ) : (
          <div className="space-y-2">
            {refEntries.map(({ ref, categories }) => (
              <div
                key={ref}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-neutral-200/80 bg-neutral-50/40 px-4 py-3"
              >
                <Badge variant="info">{ref}</Badge>
                <div className="flex flex-wrap gap-1">
                  {categories.map((cat) => (
                    <Badge key={cat} variant="neutral">
                      {CATEGORY_LABEL[cat] ?? cat}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </ModuleSectionCard>
    </div>
  )
}
