import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Award, Search } from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { Badge } from '../../components/ui/Badge'
import { StandardInput } from '../../components/ui/Input'
import { LayoutTable1PostingsShell } from '../../components/layout/LayoutTable1PostingsShell'
import { LayoutScoreStatRow } from '../../components/layout/LayoutScoreStatRow'
import type { LayoutScoreStatItem } from '../../components/layout/platformLayoutKit'
import { ModuleSectionCard } from '../../components/module'
import { ComplianceBanner } from '../../components/ui/ComplianceBanner'

const TABLE_TH =
  'px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-600'
const TABLE_TR_BODY = 'border-t border-neutral-100 hover:bg-neutral-50/60 transition-colors'

function fmtDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function LearningCertifications() {
  const { certificates, courses } = useLearning()
  const [q, setQ] = useState('')
  const [nowMs] = useState(() => Date.now())

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return certificates
    return certificates.filter(
      (c) =>
        c.courseTitle.toLowerCase().includes(needle) ||
        c.learnerName.toLowerCase().includes(needle) ||
        c.verifyCode.toLowerCase().includes(needle),
    )
  }, [certificates, q])

  const yearStart = new Date(new Date().getFullYear(), 0, 1)
  const issuedThisYear = certificates.filter((c) => new Date(c.issuedAt) >= yearStart).length

  const expiringSoon = useMemo(() => {
    const sixtyDays = 60 * 24 * 60 * 60 * 1000
    return certificates.filter((c) => {
      const course = courses.find((x) => x.id === c.courseId)
      if (!course?.recertificationMonths) return false
      const issued = new Date(c.issuedAt).getTime()
      const expires = issued + course.recertificationMonths * 30 * 24 * 60 * 60 * 1000
      return expires - nowMs < sixtyDays && expires > nowMs
    }).length
  }, [certificates, courses, nowMs])

  const kpis = useMemo<LayoutScoreStatItem[]>(
    () => [
      { big: String(certificates.length), title: 'Utstedt totalt', sub: 'Alle kursbevis' },
      { big: String(issuedThisYear), title: 'Utstedt i år', sub: String(new Date().getFullYear()) },
      { big: String(expiringSoon), title: 'Utløper snart', sub: 'Neste 60 dager' },
      { big: String(courses.filter((c) => c.recertificationMonths).length), title: 'Resert.-kurs', sub: 'Med utløp' },
    ],
    [certificates.length, issuedThisYear, expiringSoon, courses],
  )

  return (
    <div className="space-y-6">
      <ComplianceBanner title="Sertifikater">
        Kursbeviset dokumenterer fullført opplæring etter AML § 3-2 og IK-forskriften § 5 nr. 2.
        Klarert varsler automatisk 60 dager før utløp på resertifiseringskurs.
      </ComplianceBanner>

      <LayoutScoreStatRow items={kpis} />

      <ModuleSectionCard className="!p-0">
        <LayoutTable1PostingsShell
          wrap={false}
          titleTypography="sans"
          title="Utstedte sertifikater"
          description="Søk på kurs, deltaker eller verifiseringskode."
          toolbar={
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <StandardInput
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Søk på navn, kurs eller kode…"
                className="pl-9"
                aria-label="Søk i sertifikater"
              />
            </div>
          }
          footer={
            <span>
              Viser {filtered.length} av {certificates.length} sertifikater
            </span>
          }
        >
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
              <Award className="h-8 w-8 text-neutral-300" aria-hidden />
              <p className="text-sm text-neutral-600">
                {certificates.length === 0
                  ? 'Ingen sertifikater ennå. Fullfør et publisert kurs for å få utstedt ett.'
                  : 'Ingen treff for søket.'}
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-neutral-50/60">
                <tr>
                  <th className={TABLE_TH}>Kurs</th>
                  <th className={TABLE_TH}>Mottaker</th>
                  <th className={TABLE_TH}>Utstedt</th>
                  <th className={TABLE_TH}>Versjon</th>
                  <th className={TABLE_TH}>Verifiseringskode</th>
                  <th className={TABLE_TH}>Status</th>
                  <th className={TABLE_TH} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className={TABLE_TR_BODY}>
                    <td className="px-5 py-3 font-medium text-neutral-900">{c.courseTitle}</td>
                    <td className="px-5 py-3 text-neutral-700">{c.learnerName}</td>
                    <td className="px-5 py-3 text-neutral-700">{fmtDate(c.issuedAt)}</td>
                    <td className="px-5 py-3 tabular-nums text-neutral-700">
                      {c.courseVersion ? `v${c.courseVersion}` : '—'}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-neutral-600">{c.verifyCode}</td>
                    <td className="px-5 py-3">
                      <Badge variant="success">Gyldig</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        to={`/learning/certificates/${c.id}/print`}
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                      >
                        Skriv ut
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </LayoutTable1PostingsShell>
      </ModuleSectionCard>
    </div>
  )
}
