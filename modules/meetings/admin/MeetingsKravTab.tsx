// MeetingsKravTab — legal-requirement coverage view for the meetings module.
// Groups law_refs from system- and org templates by framework so admins can
// see which statutory obligations are covered by their current template set.

import { ShieldCheck } from 'lucide-react'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { Badge } from '../../../src/components/ui/Badge'
import { useMeetings } from '../index'
import { MEETING_FRAMEWORK_LABEL } from '../meetingsLabels'
import { MeetingFrameworkIcon } from '../MeetingFrameworkIcon'

export function MeetingsKravTab() {
  const meetings = useMeetings()

  // Collect all templates (system + org) and their law_refs, grouped by framework
  const allTemplates = [
    ...meetings.systemTemplates,
    ...meetings.orgTemplates,
  ]

  type RefGroup = { framework: string; refs: string[]; templateCount: number }
  const groupMap = new Map<string, RefGroup>()

  for (const t of allTemplates) {
    const fw = t.framework ?? 'INTERNAL'
    if (!groupMap.has(fw)) {
      groupMap.set(fw, { framework: fw, refs: [], templateCount: 0 })
    }
    const g = groupMap.get(fw)!
    g.templateCount++
    for (const ref of t.law_refs ?? []) {
      if (!g.refs.includes(ref)) g.refs.push(ref)
    }
  }

  const groups = Array.from(groupMap.values()).sort((a, b) =>
    a.framework.localeCompare(b.framework),
  )

  const totalRefs = groups.reduce((n, g) => n + g.refs.length, 0)

  return (
    <div className="space-y-6">
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-5 w-5 text-[#1a3d32]" aria-hidden />
          <h2 className="text-lg font-semibold text-neutral-900">Lovkrav</h2>
          {totalRefs > 0 && (
            <span className="ml-auto text-xs text-neutral-500">
              {totalRefs} referanse{totalRefs !== 1 ? 'r' : ''} totalt
            </span>
          )}
        </div>
        <p className="text-sm text-neutral-600 mb-5">
          Oversikt over lovhenvisninger knyttet til møtemaler. Referansene hentes
          direkte fra maldefinisjonene og oppdateres automatisk når maler endres.
        </p>

        {groups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 p-6 text-center text-sm text-neutral-500">
            Ingen maler med lovhenvisninger funnet.
          </p>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <div
                key={g.framework}
                className="rounded-lg border border-neutral-200/80 bg-neutral-50/40 p-4"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="shrink-0 rounded border border-neutral-200 bg-white p-1.5">
                    <MeetingFrameworkIcon
                      framework={g.framework}
                      className="h-4 w-4 text-[#1a3d32]"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-neutral-900">
                      {MEETING_FRAMEWORK_LABEL[g.framework as keyof typeof MEETING_FRAMEWORK_LABEL] ?? g.framework}
                    </span>
                    <p className="text-xs text-neutral-500">
                      {g.templateCount} {g.templateCount === 1 ? 'mal' : 'maler'}
                    </p>
                  </div>
                </div>
                {g.refs.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {g.refs.sort().map((ref) => (
                      <Badge key={ref} variant="info">{ref}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-400 italic">
                    Ingen lovhenvisninger på disse malene.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </ModuleSectionCard>
    </div>
  )
}
