// SystemRulesPanel — read-only view of platform-owned non-optional rules.
//
// Different from "Mine arbeidsflyter" (per-org workflow_rules) and
// "Mal-bibliotek" (optional templates the org can install). System rules
// are the compliance backbone — they run for every org automatically,
// dispatched by workflow_dispatch_db_event alongside per-org rules. The
// org admin can't edit, disable or delete them; they can only see what's
// running on their behalf.
//
// Hierarchy: framework → category → subcategory (rule). The UI presents
// AML's 16 chapters first, then IK-f, then GDPR.

import { useMemo, useState } from 'react'
import { AlertCircle, ChevronDown, ChevronRight, Lock, Scale, ShieldCheck } from 'lucide-react'
import { useWorkflowSystemRules, type WorkflowSystemRuleRow } from '../../../hooks/useWorkflowSystemRules'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'

const FRAMEWORK_LABEL: Record<string, string> = {
  AML: 'Arbeidsmiljøloven',
  'IK-f': 'Internkontrollforskriften',
  GDPR: 'GDPR / Personopplysningsloven',
  Folketrygd: 'Folketrygdloven',
}

const FRAMEWORK_ACCENT: Record<string, string> = {
  AML: '#1a3d32',
  'IK-f': '#0e7490',
  GDPR: '#7c3aed',
  Folketrygd: '#c2410c',
}

export function SystemRulesPanel() {
  const { rules, loading, error } = useWorkflowSystemRules()
  const [search, setSearch] = useState('')
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({})
  const [activeRule, setActiveRule] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!search) return rules
    const q = search.toLowerCase()
    return rules.filter((r) => {
      return (
        r.subcategory.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.rationale.toLowerCase().includes(q) ||
        r.law_refs.some((l) => l.toLowerCase().includes(q))
      )
    })
  }, [rules, search])

  // Group: framework → category → rules[]
  const grouped = useMemo(() => {
    const tree: Record<string, Record<string, WorkflowSystemRuleRow[]>> = {}
    filtered.forEach((r) => {
      tree[r.framework] = tree[r.framework] ?? {}
      tree[r.framework][r.category] = tree[r.framework][r.category] ?? []
      tree[r.framework][r.category].push(r)
    })
    return tree
  }, [filtered])

  const frameworkOrder = ['AML', 'IK-f', 'GDPR', 'Folketrygd']
  const frameworks = Object.keys(grouped).sort(
    (a, b) => frameworkOrder.indexOf(a) - frameworkOrder.indexOf(b),
  )

  if (loading && rules.length === 0) {
    return <div className="p-6 text-sm text-neutral-500">Laster system-regler …</div>
  }
  if (error) {
    return <div className="p-6 text-sm text-red-700">Kunne ikke laste system-regler: {error}</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200/80 bg-[#e8f4ec] px-4 py-3">
        <ShieldCheck className="h-5 w-5 text-emerald-800" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-emerald-900">System-regler — compliance-ryggraden</h2>
          <p className="mt-0.5 text-xs text-emerald-900/80">
            Plattform-eide, ikke-valgfrie regler som garanterer AML / IK-f / GDPR-compliance. Disse
            kjøres for alle organisasjoner og kan ikke deaktiveres. Hver kjøring logges som vanlig
            i kjøringshistorikken (workflow_runs).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-64">
            <StandardInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk § / regel / lov-referanse …"
              aria-label="Søk system-regler"
            />
          </div>
          <Badge variant="info">{rules.length} regler</Badge>
        </div>
      </div>

      {frameworks.map((fw) => {
        const accent = FRAMEWORK_ACCENT[fw] ?? '#1a3d32'
        const categories = grouped[fw]
        const categoryEntries = Object.entries(categories).sort((a, b) => {
          const oa = a[1][0]?.category_order ?? 0
          const ob = b[1][0]?.category_order ?? 0
          return oa - ob
        })
        return (
          <div key={fw} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <div
              className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3"
              style={{ background: `${accent}10` }}
            >
              <Scale className="h-4 w-4" style={{ color: accent }} />
              <span className="text-sm font-semibold" style={{ color: accent }}>
                {FRAMEWORK_LABEL[fw] ?? fw}
              </span>
              <span className="text-xs text-neutral-500">
                {Object.values(categories).reduce((n, arr) => n + arr.length, 0)} regler
              </span>
            </div>
            <div className="divide-y divide-neutral-100">
              {categoryEntries.map(([catName, catRules]) => {
                const key = `${fw}::${catName}`
                const open = openCategories[key] !== false // default-expanded
                return (
                  <div key={key}>
                    <Button
                      variant="ghost"
                      aria-expanded={open}
                      onClick={() => setOpenCategories((p) => ({ ...p, [key]: !open }))}
                      className="flex w-full items-center justify-between gap-2 rounded-none px-4 py-2.5 text-left font-normal hover:bg-neutral-50"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-neutral-800">
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        {catName}
                      </span>
                      <span className="text-xs text-neutral-500">{catRules.length}</span>
                    </Button>
                    {open && (
                      <ul className="divide-y divide-neutral-100 border-t border-neutral-100 bg-neutral-50/40">
                        {catRules.map((rule) => (
                          <li key={rule.id} className="px-4 py-3">
                            <Button
                              variant="ghost"
                              aria-expanded={activeRule === rule.id}
                              onClick={() => setActiveRule(activeRule === rule.id ? null : rule.id)}
                              className="flex w-full items-start justify-between gap-3 rounded-none p-0 text-left font-normal hover:bg-transparent"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <Lock className="h-3 w-3 text-neutral-400" aria-label="Ikke deaktiverbar" />
                                  <span className="font-medium text-neutral-900">{rule.subcategory}</span>
                                  {rule.applies_if_employee_count_gte && (
                                    <Badge variant="info">≥{rule.applies_if_employee_count_gte} ansatte</Badge>
                                  )}
                                  {rule.pdca_phase && (
                                    <Badge variant="neutral">{rule.pdca_phase.toUpperCase()}</Badge>
                                  )}
                                </div>
                                <p className="mt-1 text-xs text-neutral-600">{rule.description}</p>
                                <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] text-neutral-500">
                                  <span>Trigger:</span>
                                  <code className="rounded bg-neutral-100 px-1 py-0.5 text-[10px]">
                                    {rule.source_module} · {rule.trigger_event_name ?? rule.schedule_cron ?? '—'}
                                  </code>
                                  {rule.law_refs.map((l) => (
                                    <code key={l} className="rounded bg-emerald-50 px-1 py-0.5 text-[10px] text-emerald-800">
                                      {l}
                                    </code>
                                  ))}
                                </div>
                              </div>
                              <ChevronRight
                                className={`mt-1 h-4 w-4 shrink-0 text-neutral-400 transition ${activeRule === rule.id ? 'rotate-90' : ''}`}
                              />
                            </Button>
                            {activeRule === rule.id && (
                              <div className="mt-3 rounded-md border border-neutral-200 bg-white p-3 text-xs">
                                <p className="font-semibold uppercase text-neutral-500 text-[10px] tracking-wide">
                                  Hvorfor regelen er obligatorisk
                                </p>
                                <p className="mt-1 text-neutral-700">{rule.rationale}</p>
                                <details className="mt-3">
                                  <summary className="cursor-pointer text-neutral-600">
                                    Vis tekniske detaljer (handlinger)
                                  </summary>
                                  <pre className="mt-2 overflow-x-auto rounded bg-neutral-50 p-2 text-[10px] text-neutral-700">
                                    {JSON.stringify(rule.actions_json, null, 2)}
                                  </pre>
                                </details>
                                {rule.notes && (
                                  <p className="mt-2 flex items-start gap-1 text-[11px] text-amber-800">
                                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                                    {rule.notes}
                                  </p>
                                )}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {frameworks.length === 0 && (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
          Ingen system-regler matchet søket.
        </p>
      )}

      <p className="text-xs text-neutral-500">
        <Lock className="mr-1 inline h-3 w-3" />
        System-regler kan ikke deaktiveres lokalt. De vedlikeholdes sentralt av plattform-teamet og
        oppgraderes når lovverket endres. Kjøringene de produserer dukker opp i fanen «Kjøringer»
        med <code>rule_id = null</code> og <code>detail.system_rule_slug</code> satt.
      </p>
    </div>
  )
}
