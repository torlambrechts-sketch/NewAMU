import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import { useComplianceDocs } from '../../hooks/useDocuments'
import type { LegalCoverageRow } from '../../hooks/useDocuments'
import { coverageStatusForRef } from '../../lib/wikiCompliance'
import type { WikiPage } from '../../types/documents'

type Props = {
  orgEmployeeCount: number
}

function applicableItems(items: LegalCoverageRow[], employeeCount: number): LegalCoverageRow[] {
  return items.filter((it) => it.mandatoryForAll && it.minEmployees <= employeeCount)
}

function uncoveredMandatory(
  items: LegalCoverageRow[],
  pages: WikiPage[],
  employeeCount: number,
): { item: LegalCoverageRow; status: 'missing' | 'stale' }[] {
  const list = applicableItems(items, employeeCount)
  const out: { item: LegalCoverageRow; status: 'missing' | 'stale' }[] = []
  for (const item of list) {
    const st = coverageStatusForRef(item.ref, pages)
    if (st === 'missing') out.push({ item, status: 'missing' })
    else if (st === 'stale') out.push({ item, status: 'stale' })
  }
  return out
}

export function MandatoryDocsAlert({ orgEmployeeCount }: Props) {
  const docs = useComplianceDocs()
  const [expanded, setExpanded] = useState(false)

  const rows = useMemo(
    () => uncoveredMandatory(docs.legalCoverage, docs.pages, orgEmployeeCount),
    [docs.legalCoverage, docs.pages, orgEmployeeCount],
  )

  if (rows.length === 0) return null

  return (
    <div className="mb-6 rounded-none border border-red-300 bg-red-50 text-red-950 shadow-sm">
      <div className="flex flex-wrap items-start gap-3 px-4 py-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-700" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {rows.length} lovpålagte dokumenter mangler eller er utdaterte.
          </p>
          <p className="mt-1 text-sm text-red-900/90">
            Virksomheter risikerer pålegg fra Arbeidstilsynet eller Datatilsynet.
          </p>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-red-900 underline underline-offset-2 hover:no-underline"
          >
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            Vis detaljer
          </button>
        </div>
      </div>
      {expanded ? (
        <ul className="border-t border-red-200/80 bg-white/60 px-4 py-3 text-sm">
          {rows.map(({ item, status }) => (
            <li key={item.id} className="border-b border-red-100 py-2 last:border-0">
              <span className="font-mono text-xs font-semibold text-red-900">{item.ref}</span>
              <span className="ml-2 text-xs text-red-800">
                ({status === 'missing' ? 'Mangler publisert dekning' : 'Revisjon forfalt'})
              </span>
              {item.legalConsequence ? (
                <p className="mt-1 text-xs text-neutral-800">{item.legalConsequence}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
