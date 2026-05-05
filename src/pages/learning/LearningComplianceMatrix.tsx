import { useMemo } from 'react'
import { LayoutGrid, ShieldAlert } from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { LayoutScoreStatRow } from '../../components/layout/LayoutScoreStatRow'
import type { LayoutScoreStatItem } from '../../components/layout/platformLayoutKit'
import { LayoutTable1PostingsShell } from '../../components/layout/LayoutTable1PostingsShell'
import { ModuleSectionCard } from '../../components/module'
import { ComplianceBanner } from '../../components/ui/ComplianceBanner'
import { WarningBox } from '../../components/ui/AlertBox'

function cellColor(status: string) {
  if (status === 'complete') return 'bg-green-500'
  if (status === 'in_progress') return 'bg-amber-400'
  return 'bg-red-400'
}

export function LearningComplianceMatrix() {
  const { can } = useOrgSetupContext()
  const canManage = can('learning.manage')
  const { complianceMatrix, learningLoading, learningError } = useLearning()

  const { users, courses, grid } = useMemo(() => {
    const uids = [...new Set(complianceMatrix.map((c) => c.userId))]
    const userNames = new Map(complianceMatrix.map((c) => [c.userId, c.displayName]))
    const cids = [...new Set(complianceMatrix.map((c) => c.courseId))]
    const courseTitles = new Map(complianceMatrix.map((c) => [c.courseId, c.courseTitle]))
    const g = new Map<string, (typeof complianceMatrix)[0]>()
    for (const cell of complianceMatrix) {
      g.set(`${cell.userId}:${cell.courseId}`, cell)
    }
    return {
      users: uids.map((id) => ({ id, name: userNames.get(id) ?? id })),
      courses: cids.map((id) => ({ id, title: courseTitles.get(id) ?? id })),
      grid: g,
    }
  }, [complianceMatrix])

  const kpis = useMemo<LayoutScoreStatItem[]>(() => {
    const total = complianceMatrix.length
    const complete = complianceMatrix.filter((c) => c.cellStatus === 'complete').length
    const inProg = complianceMatrix.filter((c) => c.cellStatus === 'in_progress').length
    const notStarted = total - complete - inProg
    const pct = total ? Math.round((complete / total) * 100) : 0
    return [
      { big: `${pct}%`, title: 'Dekning', sub: `${complete} av ${total} celler` },
      { big: String(complete), title: 'Fullført', sub: 'Grønne celler' },
      { big: String(inProg), title: 'Pågående', sub: 'Gule celler' },
      { big: String(notStarted), title: 'Ikke startet', sub: 'Røde celler' },
    ]
  }, [complianceMatrix])

  if (!canManage) {
    return (
      <ModuleSectionCard>
        <WarningBox>
          Team-heatmap er kun tilgjengelig for kursansvarlige med rettigheten «E-learning — opprette og redigere
          kurs».
        </WarningBox>
      </ModuleSectionCard>
    )
  }

  return (
    <div className="space-y-6">
      <ComplianceBanner title="Team-heatmap">
        Aggregert oversikt over opplæringsdekning per medarbeider — dokumenterer arbeidsgivers plikt til
        opplæring etter AML § 3-2 og IK-forskriften § 5 nr. 2.
      </ComplianceBanner>

      {learningError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{learningError}</p>
      ) : null}
      {learningLoading ? <p className="text-sm text-neutral-600">Laster…</p> : null}

      <LayoutScoreStatRow items={kpis} />

      <ModuleSectionCard className="!p-0">
        <LayoutTable1PostingsShell
          wrap={false}
          titleTypography="sans"
          title="Publiserte kurs × medarbeidere"
          description="Grønn = fullført, gul = påbegynt, rød = ikke startet."
          toolbar={
            <div className="flex items-center gap-3 text-xs text-neutral-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm bg-green-500" />
                Fullført
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm bg-amber-400" />
                Pågående
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm bg-red-400" />
                Ikke startet
              </span>
            </div>
          }
          footer={
            <span>
              {users.length} medarbeidere × {courses.length} kurs
            </span>
          }
        >
          {users.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <LayoutGrid className="h-8 w-8 text-neutral-300" />
              <p className="text-sm text-neutral-600">Ingen data ennå.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-neutral-50/60">
                  <tr>
                    <th className="sticky left-0 z-10 bg-neutral-50/80 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600 backdrop-blur">
                      Medarbeider
                    </th>
                    {courses.map((c) => (
                      <th
                        key={c.id}
                        className="max-w-[10rem] px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600"
                        title={c.title}
                      >
                        <span className="line-clamp-3">{c.title}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-neutral-100 hover:bg-neutral-50/60">
                      <td className="sticky left-0 z-10 bg-white/95 px-4 py-2.5 text-sm font-medium text-neutral-900 backdrop-blur">
                        {u.name}
                      </td>
                      {courses.map((c) => {
                        const cell = grid.get(`${u.id}:${c.id}`)
                        const st = cell?.cellStatus ?? 'not_started'
                        const label = st === 'complete' ? 'Fullført' : st === 'in_progress' ? 'Påbegynt' : 'Ikke startet'
                        return (
                          <td key={c.id} className="px-2 py-2.5 text-center">
                            <span
                              className={`inline-block h-4 w-4 rounded-sm ${cellColor(st)}`}
                              title={`${Math.round((cell?.completionPct ?? 0) * 100)}% · ${label}`}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </LayoutTable1PostingsShell>
      </ModuleSectionCard>

      <ModuleSectionCard>
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm text-neutral-700">
            <p className="font-semibold text-neutral-900">Personvern (GDPR art. 5)</p>
            <p className="mt-1">
              Heatmap viser identifiserbar informasjon på personnivå — kun ledere med behandlingsgrunnlag har
              tilgang. Ikke del eksterne kopier av denne tabellen.
            </p>
          </div>
        </div>
      </ModuleSectionCard>
    </div>
  )
}
