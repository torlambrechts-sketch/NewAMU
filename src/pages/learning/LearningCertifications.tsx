import { Award } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLearning } from '../../hooks/useLearning'
import { StandardInput } from '../../components/ui/Input'
import { LayoutTable1PostingsShell } from '../../components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TD,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../components/layout/layoutTable1PostingsKit'
import { LayoutScoreStatRow } from '../../components/layout/LayoutScoreStatRow'
import type { LayoutScoreStatItem } from '../../components/layout/platformLayoutKit'
import { ModuleSectionCard } from '../../components/module'

export function LearningCertifications() {
  const { certificates } = useLearning()
  const [q, setQ] = useState('')

  const filtered = certificates.filter(
    (c) =>
      c.courseTitle.toLowerCase().includes(q.toLowerCase()) ||
      c.learnerName.toLowerCase().includes(q.toLowerCase()) ||
      c.verifyCode.toLowerCase().includes(q.toLowerCase()),
  )

  const now = new Date()
  const yearStart = new Date(now.getFullYear(), 0, 1)
  const issuedThisYear = certificates.filter((c) => new Date(c.issuedAt) >= yearStart).length
  const inProgress = 0

  const statItems: LayoutScoreStatItem[] = useMemo(
    () => [
      { big: String(certificates.length), title: 'Utstedt totalt', sub: 'Alle kursbevis' },
      { big: String(issuedThisYear), title: 'Utstedt i år', sub: new Date().getFullYear().toString() },
      { big: String(inProgress), title: 'Under gjennomføring', sub: 'Sporbar fremdrift' },
    ],
    [certificates.length, issuedThisYear],
  )

  return (
    <div className="space-y-8">
      <ModuleSectionCard>
        <h1 className="font-serif text-3xl font-semibold text-[#2D403A]">Sertifiseringer</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Sertifikater utstedt ved fullført kurs. Gjelder som dokumentasjon på gjennomført opplæring.
        </p>
      </ModuleSectionCard>

      <ModuleSectionCard>
        <LayoutScoreStatRow items={statItems} columns={3} variant="compact" />
      </ModuleSectionCard>

      <LayoutTable1PostingsShell
        title="Sertifikatliste"
        titleTypography="sans"
        description="Søk på kurs, deltaker eller verifiseringskode."
        toolbar={
          <div className="min-w-[200px] max-w-md flex-1">
            <StandardInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Søk på navn, kurs eller kode…"
              aria-label="Søk i sertifikater"
            />
          </div>
        }
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <Award className="size-8 text-neutral-300" aria-hidden />
            <p className="text-sm text-neutral-600">Ingen sertifikater ennå. Fullfør et publisert kurs for å få utstedt ett.</p>
          </div>
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                <th className={LAYOUT_TABLE1_POSTINGS_TH}>Kurs</th>
                <th className={LAYOUT_TABLE1_POSTINGS_TH}>Deltaker</th>
                <th className={LAYOUT_TABLE1_POSTINGS_TH}>Dato</th>
                <th className={LAYOUT_TABLE1_POSTINGS_TH}>Versjon</th>
                <th className={LAYOUT_TABLE1_POSTINGS_TH}>Verifiseringskode</th>
                <th className={LAYOUT_TABLE1_POSTINGS_TH} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                  <td className={`${LAYOUT_TABLE1_POSTINGS_TD} font-medium text-[#1a3d32]`}>{c.courseTitle}</td>
                  <td className={LAYOUT_TABLE1_POSTINGS_TD}>{c.learnerName}</td>
                  <td className={`${LAYOUT_TABLE1_POSTINGS_TD} text-xs text-neutral-500`}>
                    {new Date(c.issuedAt).toLocaleString()}
                  </td>
                  <td className={`${LAYOUT_TABLE1_POSTINGS_TD} text-xs text-neutral-500`}>{c.courseVersion ?? '—'}</td>
                  <td className={`${LAYOUT_TABLE1_POSTINGS_TD} font-mono text-xs`}>{c.verifyCode}</td>
                  <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                    <Link
                      to={`/learning/certificates/${c.id}/print`}
                      className="text-xs font-medium text-emerald-800 underline"
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
    </div>
  )
}
