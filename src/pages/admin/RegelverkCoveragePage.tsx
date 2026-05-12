// RegelverkCoveragePage — viser alle krav fra valgt regelverk og hvordan
// systemet dekker dem. Brukes av compliance officer for å verifisere
// dekning per § og se hvilke moduler som er ansvarlige.

import { useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, ScrollText, XCircle } from 'lucide-react'
import { ModuleSectionCard } from '../../components/module'
import { SearchableSelect, type SelectOption } from '../../components/ui/SearchableSelect'
import { REGELVERK, REQUIREMENTS, type Requirement } from '../../data/regelverkRequirements'
import { useRegelverkCoverage, type CoverageEntry } from '../../hooks/useRegelverkCoverage'

const KIND_LABEL: Record<CoverageEntry['kind'], string> = {
  course_system: 'Kurs (system)',
  course_org: 'Kurs (org)',
  document: 'Dokument',
  survey: 'Undersøkelse',
  checklist_template: 'Compliance-mal',
  checklist_item: 'Compliance-item',
  ros: 'ROS',
  task: 'Avvik',
  meeting_template: 'Møte-mal',
}

const KIND_COLOR: Record<CoverageEntry['kind'], string> = {
  course_system: 'bg-cyan-100 text-cyan-900',
  course_org: 'bg-cyan-50 text-cyan-800',
  document: 'bg-emerald-100 text-emerald-900',
  survey: 'bg-purple-100 text-purple-900',
  checklist_template: 'bg-emerald-100 text-emerald-900',
  checklist_item: 'bg-emerald-50 text-emerald-700',
  ros: 'bg-amber-100 text-amber-900',
  task: 'bg-orange-100 text-orange-900',
  meeting_template: 'bg-indigo-100 text-indigo-900',
}

function obligationLabel(o: Requirement['obligation']): string {
  return o === 'mandatory' ? 'Pliktig' : o === 'recommended' ? 'Anbefalt' : 'Betinget'
}

function obligationColor(o: Requirement['obligation']): string {
  return o === 'mandatory'
    ? 'bg-red-100 text-red-900'
    : o === 'recommended'
      ? 'bg-amber-100 text-amber-900'
      : 'bg-neutral-100 text-neutral-700'
}

export function RegelverkCoveragePage() {
  const [selectedRegelverk, setSelectedRegelverk] = useState<string>('aml')
  const [expandedRefs, setExpandedRefs] = useState<Set<string>>(new Set())
  const { coverage, loading } = useRegelverkCoverage()

  const regelverk = REGELVERK.find((r) => r.id === selectedRegelverk)
  const requirements = useMemo(
    () => REQUIREMENTS.filter((r) => r.regelverkId === selectedRegelverk),
    [selectedRegelverk],
  )

  // Beregn dekning per krav
  const requirementsWithCoverage = useMemo(() => {
    return requirements.map((req) => {
      const exact = coverage.get(req.lawRef) ?? []
      // Også sjekk alternate refs
      const alternates: CoverageEntry[] = []
      for (const alt of req.alternateRefs ?? []) {
        const found = coverage.get(alt) ?? []
        alternates.push(...found)
      }
      // Også check law_domains for ROS (eks: 'AML' matcher alle AML-krav)
      const domain = req.regelverkId === 'aml' ? 'AML' : req.regelverkId.toUpperCase()
      const domainMatches = (coverage.get(domain) ?? []).filter((c) => c.kind === 'ros')
      const all = [...exact, ...alternates, ...domainMatches]
      const dedup = new Map<string, CoverageEntry>()
      for (const e of all) {
        dedup.set(`${e.kind}:${e.id}`, e)
      }
      const entries = [...dedup.values()]
      return { ...req, coverage: entries, isCovered: entries.length > 0 }
    })
  }, [requirements, coverage])

  // Aggreger per kategori for gruppert visning
  const groupedByCategory = useMemo(() => {
    const m = new Map<string, typeof requirementsWithCoverage>()
    for (const r of requirementsWithCoverage) {
      if (!m.has(r.category)) m.set(r.category, [])
      m.get(r.category)!.push(r)
    }
    return [...m.entries()]
  }, [requirementsWithCoverage])

  // KPI sammendrag
  const total = requirements.length
  const covered = requirementsWithCoverage.filter((r) => r.isCovered).length
  const mandatory = requirementsWithCoverage.filter((r) => r.obligation === 'mandatory').length
  const mandatoryCovered = requirementsWithCoverage.filter((r) => r.obligation === 'mandatory' && r.isCovered).length
  const coverageRate = total > 0 ? Math.round((covered / total) * 100) : 0
  const mandatoryCoverageRate = mandatory > 0 ? Math.round((mandatoryCovered / mandatory) * 100) : 0

  const regelverkOptions: SelectOption[] = REGELVERK.map((r) => ({
    value: r.id,
    label: `${r.label} — ${r.fullName}`,
  }))

  function toggleExpanded(ref: string) {
    setExpandedRefs((prev) => {
      const next = new Set(prev)
      if (next.has(ref)) next.delete(ref)
      else next.add(ref)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="mb-3 flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-[#1a3d32]" aria-hidden />
          <h2 className="text-lg font-semibold text-neutral-900">Regelverk-dekning</h2>
        </div>
        <p className="mb-5 text-sm text-neutral-600">
          Velg et regelverk for å se alle krav og hvordan NewAMU dekker dem. Compliance officer kan bruke dette ved tilsyn for å vise hvilke moduler som dekker hvilke §§.
        </p>

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700">Regelverk</label>
            <SearchableSelect
              value={selectedRegelverk}
              options={regelverkOptions}
              onChange={(v) => setSelectedRegelverk(v as string)}
            />
            {regelverk ? (
              <p className="mt-2 text-xs text-neutral-600">{regelverk.description}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-neutral-200 bg-white p-3 text-center">
              <div className="text-xs text-neutral-500">Krav totalt</div>
              <div className="mt-1 text-2xl font-semibold text-neutral-900">{total}</div>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
              <div className="text-xs text-emerald-700">Dekket</div>
              <div className="mt-1 text-2xl font-semibold text-emerald-900">{covered}</div>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-3 text-center">
              <div className="text-xs text-neutral-500">Dekningsgrad</div>
              <div className="mt-1 text-2xl font-semibold text-neutral-900">{coverageRate} %</div>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
              <div className="text-xs text-red-700">Pliktige dekket</div>
              <div className="mt-1 text-2xl font-semibold text-red-900">
                {mandatoryCovered}/{mandatory}
              </div>
              <div className="mt-0.5 text-[10px] text-red-700">{mandatoryCoverageRate} %</div>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-neutral-600">Henter dekning…</p>
        ) : groupedByCategory.length === 0 ? (
          <p className="text-sm text-neutral-600">Ingen krav definert for dette regelverket enda.</p>
        ) : (
          <div className="space-y-6">
            {groupedByCategory.map(([category, items]) => {
              const cCovered = items.filter((i) => i.isCovered).length
              return (
                <div key={category}>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-600">
                    <span>{category}</span>
                    <span className="text-xs font-normal normal-case text-neutral-500">
                      {cCovered}/{items.length} dekket
                    </span>
                  </h3>
                  <div className="overflow-hidden rounded-lg border border-neutral-200">
                    <table className="w-full text-sm">
                      <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-600">
                        <tr>
                          <th className="px-3 py-2 text-left">§</th>
                          <th className="px-3 py-2 text-left">Tittel</th>
                          <th className="px-3 py-2 text-left">Krav-type</th>
                          <th className="px-3 py-2 text-left">Aktuell når</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-left">Dekkes av</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((req) => {
                          const expanded = expandedRefs.has(req.lawRef)
                          const visibleCoverage = expanded ? req.coverage : req.coverage.slice(0, 3)
                          return (
                            <tr key={req.lawRef} className="border-t border-neutral-100 align-top">
                              <td className="px-3 py-2.5 font-mono text-xs text-neutral-800">{req.lawRef}</td>
                              <td className="px-3 py-2.5 text-neutral-900">{req.title}</td>
                              <td className="px-3 py-2.5">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${obligationColor(req.obligation)}`}>
                                  {obligationLabel(req.obligation)}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-neutral-600">{req.applies ?? '—'}</td>
                              <td className="px-3 py-2.5">
                                {req.isCovered ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-700">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span className="text-xs font-medium">Dekket</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-red-700">
                                    <XCircle className="h-4 w-4" />
                                    <span className="text-xs font-medium">Ikke dekket</span>
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5">
                                {req.coverage.length === 0 ? (
                                  <span className="text-xs italic text-neutral-400">—</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1.5">
                                    {visibleCoverage.map((c, i) => (
                                      <span
                                        key={`${c.kind}-${c.id}-${i}`}
                                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] ${KIND_COLOR[c.kind]}`}
                                        title={`${KIND_LABEL[c.kind]}: ${c.title}`}
                                      >
                                        <span className="font-medium">{KIND_LABEL[c.kind]}</span>
                                        <span className="opacity-70">{c.title.length > 25 ? c.title.slice(0, 25) + '…' : c.title}</span>
                                      </span>
                                    ))}
                                    {req.coverage.length > 3 ? (
                                      <button
                                        type="button"
                                        onClick={() => toggleExpanded(req.lawRef)}
                                        className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] text-neutral-600 hover:bg-neutral-100"
                                      >
                                        {expanded ? (
                                          <>
                                            <ChevronDown className="h-3 w-3" />
                                            Skjul
                                          </>
                                        ) : (
                                          <>
                                            <ChevronRight className="h-3 w-3" />+{req.coverage.length - 3} til
                                          </>
                                        )}
                                      </button>
                                    ) : null}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-6 rounded-md bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
          <p>
            <strong>Hvordan dekning beregnes:</strong> NewAMU matcher § fra regelverket mot{' '}
            <code>law_refs</code> / <code>legal_refs</code> / <code>law_ref</code> på alle moduler
            (kurs, dokumenter, undersøkelser, sjekklister, ROS, avvik, møter). Hvis en § har minst
            én ressurs som peker på den, regnes den som dekket. Eksport til CSV/PDF kan legges til
            ved behov.
          </p>
        </div>
      </ModuleSectionCard>
    </div>
  )
}
