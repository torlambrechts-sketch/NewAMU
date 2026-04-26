import { CheckCircle2, XCircle } from 'lucide-react'
import { ModuleSectionCard } from '../../../src/components/module'
import { WarningBox } from '../../../src/components/ui/AlertBox'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { ComplianceBanner } from '../../../src/components/ui/ComplianceBanner'
import type { AmuHook } from './types'

function formatDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('nb-NO', { dateStyle: 'medium' })
  } catch {
    return iso
  }
}

export function MembersTab({ amu }: { amu: AmuHook }) {
  const year = new Date().getFullYear()
  const nextYear = year + 1
  const employerVoting = amu.members.filter((m) => m.side === 'employer' && m.voting && m.active).length
  const employeeVoting = amu.members.filter((m) => m.side === 'employee' && m.voting && m.active).length
  const bhtPresent = amu.members.some((m) => m.side === 'bht' && m.active)
  const yearMeetings = amu.meetings.filter((m) => m.year === year)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        {employerVoting !== employeeVoting ? (
          <div className="mb-4">
            <WarningBox>
              Ubalanse i representasjon: {employerVoting} arbeidsgiver vs {employeeVoting} arbeidstaker (krav: lik AML §
              7-1).
            </WarningBox>
          </div>
        ) : null}
        {!bhtPresent ? (
          <div className="mb-4">
            <WarningBox>BHT er ikke representert i utvalget (krav AML § 7-1 (3)).</WarningBox>
          </div>
        ) : null}

        <ModuleSectionCard className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-neutral-900">
              AMU-medlemmer · {amu.committee?.term_start ?? ''}–{amu.committee?.term_end ?? ''}
            </h2>
            {amu.canManage ? (
              <Button variant="primary" size="sm" type="button">
                Legg til medlem
              </Button>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs font-semibold uppercase text-neutral-500">
                  <th className="py-2 pr-3">Medlem</th>
                  <th className="py-2 pr-3">Side</th>
                  <th className="py-2 pr-3">Rolle</th>
                  <th className="py-2 pr-3">HMS-kurs</th>
                  <th className="py-2 pr-3">Frammøte</th>
                  <th className="py-2 pr-3">Stemmerett</th>
                  {amu.canManage ? <th className="py-2" /> : null}
                </tr>
              </thead>
              <tbody>
                {amu.members.map((m) => {
                  const valid = m.hms_training_valid_until && new Date(m.hms_training_valid_until) >= new Date()
                  const expiringSoon =
                    m.hms_training_valid_until &&
                    new Date(m.hms_training_valid_until) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                  const presentYear = amu.attendance.filter(
                    (a) => a.member_id === m.id && yearMeetings.some((mt) => mt.id === a.meeting_id) && a.status === 'present',
                  ).length
                  const totalYear = yearMeetings.length
                  return (
                    <tr key={m.id} className="border-b border-neutral-100">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold">
                            {m.display_name
                              .split(/\s+/)
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)}
                          </span>
                          <div>
                            <p className="font-medium text-neutral-900">{m.display_name}</p>
                            {m.function_label ? <p className="text-xs text-neutral-500">{m.function_label}</p> : null}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <Badge variant={m.side === 'employer' ? 'warning' : m.side === 'employee' ? 'info' : 'success'}>
                          {m.side === 'employer' ? 'Arbeidsgiver' : m.side === 'employee' ? 'Arbeidstaker' : 'BHT'}
                        </Badge>
                      </td>
                      <td className="py-3 pr-3 text-neutral-800">
                        {m.role === 'leader' ? (
                          <>
                            <span className="font-semibold">Leder</span>
                            <small className="ml-1 text-neutral-500">(rotere {nextYear})</small>
                          </>
                        ) : m.role === 'deputy_leader' ? (
                          'Nestleder'
                        ) : m.role === 'bht_observer' ? (
                          'BHT-observatør'
                        ) : (
                          'Medlem'
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <Badge variant={valid && !expiringSoon ? 'success' : expiringSoon ? 'warning' : 'danger'}>
                          {valid ? '40t · gyldig' : 'Utløpt'}
                          {m.hms_training_valid_until ? ` · ${formatDate(m.hms_training_valid_until)}` : ''}
                        </Badge>
                      </td>
                      <td className="py-3 pr-3 text-neutral-700">
                        {presentYear}/{totalYear || '—'}
                      </td>
                      <td className="py-3 pr-3">{m.voting ? '✓' : '–'}</td>
                      {amu.canManage ? (
                        <td className="py-3">
                          <Button variant="ghost" size="sm" type="button">
                            …
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </ModuleSectionCard>
      </div>

      <div className="space-y-4">
        <ModuleSectionCard className="p-5">
          <h2 className="mb-3 text-base font-semibold text-neutral-900">Krav til sammensetning</h2>
          <ComplianceBanner title="AML § 7-1" className="rounded-md">
            Likt antall representanter fra arbeidsgiver og arbeidstaker. BHT skal delta.
          </ComplianceBanner>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex gap-2">
              {employerVoting > 0 ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" aria-hidden />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-red-500" aria-hidden />
              )}
              {employerVoting} arbeidsgiverside (stemmeberettiget)
            </li>
            <li className="flex gap-2">
              {employeeVoting > 0 ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" aria-hidden />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-red-500" aria-hidden />
              )}
              {employeeVoting} arbeidstakerside (stemmeberettiget)
            </li>
            <li className="flex gap-2">
              {bhtPresent ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" aria-hidden />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-red-500" aria-hidden />
              )}
              BHT representert
            </li>
          </ul>
        </ModuleSectionCard>

        <ModuleSectionCard className="p-5">
          <h2 className="mb-3 text-base font-semibold text-neutral-900">Frammøte {year}</h2>
          {yearMeetings.length === 0 ? (
            <p className="text-sm text-neutral-500">Ingen møter registrert i år.</p>
          ) : (
            yearMeetings.map((mt) => {
              const att = amu.attendance.filter((a) => a.meeting_id === mt.id)
              const presentCount = att.filter((a) => a.status === 'present').length
              const totalCount = amu.members.length
              const ratio = totalCount > 0 ? presentCount / totalCount : 0
              return (
                <div key={mt.id} className="flex items-center gap-2 border-b border-neutral-100 py-1.5 last:border-0">
                  <div className={`h-3 w-3 shrink-0 rounded-full ${ratio >= 0.5 ? 'bg-green-500' : 'bg-red-400'}`} />
                  <span className="flex-1 text-sm text-neutral-800">{mt.title}</span>
                  <span className="text-xs text-neutral-500">
                    {presentCount}/{totalCount}
                  </span>
                </div>
              )
            })
          )}
        </ModuleSectionCard>
      </div>
    </div>
  )
}
