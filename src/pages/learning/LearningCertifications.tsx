import { Award, Search } from 'lucide-react'
import { useState } from 'react'
import { useLearning } from '../../hooks/useLearning'

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-[#2D403A]">Sertifiseringer</h1>
        <p className="mt-2 text-sm text-[#6b6f68]">
          Sertifikater utstedt ved fullført kurs. Gjelder som dokumentasjon på gjennomført opplæring.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Utstedt totalt" value={certificates.length} accent="ok" />
        <Kpi label="Utstedt i år" value={issuedThisYear} accent="warn" />
        <Kpi label="Under gjennomføring" value={inProgress} accent="neutral" />
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Søk på navn, kurs eller kode…"
          className="w-full rounded-full border border-[#e3ddcc] bg-[#fbf9f3] py-2 pl-10 pr-4 text-sm"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-[#e3ddcc] bg-[#fbf9f3]">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Award className="size-8 text-[#e3ddcc]" aria-hidden />
            <p className="text-sm text-[#6b6f68]">Ingen sertifikater ennå. Fullfør et publisert kurs for å få utstedt ett.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#e3ddcc] bg-[#f7f5ee] text-[#6b6f68]">
                <th className="px-4 py-3 font-medium">Kurs</th>
                <th className="px-4 py-3 font-medium">Deltaker</th>
                <th className="px-4 py-3 font-medium">Dato</th>
                <th className="px-4 py-3 font-medium">Versjon</th>
                <th className="px-4 py-3 font-medium">Verifiseringskode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e3ddcc]">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-[#f7f5ee]">
                  <td className="px-4 py-3 font-medium text-[#1a3d32]">{c.courseTitle}</td>
                  <td className="px-4 py-3">{c.learnerName}</td>
                  <td className="px-4 py-3 text-xs text-[#6b6f68]">
                    {new Date(c.issuedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#6b6f68]">{c.courseVersion ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{c.verifyCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Kpi({ label, value, accent }: { label: string; value: number; accent: 'ok'|'warn'|'neutral' }) {
  const bl = accent === 'ok' ? 'border-l-[3px] border-l-[#2f7757]'
    : accent === 'warn' ? 'border-l-[3px] border-l-[#c98a2b]'
    : 'border-l-[3px] border-l-[#6b6f68]'
  return (
    <div className={`rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-4 ${bl}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.7px] text-[#6b6f68]">{label}</div>
      <div className="mt-1 font-serif text-[28px] font-semibold leading-none text-[#1d1f1c]">{value}</div>
    </div>
  )
}
