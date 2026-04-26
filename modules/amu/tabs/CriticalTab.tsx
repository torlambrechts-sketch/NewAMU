import { AlertTriangle } from 'lucide-react'
import { ModuleSectionCard } from '../../../src/components/module'
import { Button } from '../../../src/components/ui/Button'
import { ComplianceBanner } from '../../../src/components/ui/ComplianceBanner'
import type { AmuHook } from './types'

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('nb-NO', { dateStyle: 'medium' })
  } catch {
    return iso
  }
}

export function CriticalTab({ amu }: { amu: AmuHook }) {
  const unsignedMeetings = amu.meetings.filter((m) => m.status === 'completed' && !m.signed_at)
  const openAvvik = amu.avvik.length
  const openVarsler = amu.whistleblowingStats?.open ?? 0
  const missingSigs = unsignedMeetings.length

  const kpis = [
    { label: 'Avvik åpne', value: openAvvik, severity: openAvvik > 0 },
    { label: 'Varsler åpne (aggregert)', value: openVarsler, severity: false },
    { label: 'Manglende signaturer', value: missingSigs, severity: missingSigs > 0 },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((k) => (
          <ModuleSectionCard key={k.label} className={`p-4 ${k.severity ? 'border-l-4 border-l-red-500' : ''}`}>
            <p className="text-2xl font-bold text-neutral-900">{k.value}</p>
            <p className="text-sm text-neutral-500">{k.label}</p>
          </ModuleSectionCard>
        ))}
      </div>

      <ModuleSectionCard className="p-5">
        <h2 className="mb-3 text-base font-semibold text-neutral-900">Avvik som AMU må behandle</h2>
        {amu.avvik.map((a) => (
          <div
            key={a.id}
            className={`mb-2 flex items-center gap-3 rounded border-l-4 p-3 ${
              (a.risk_score ?? 0) >= 12 ? 'border-l-red-500 bg-red-50' : 'border-l-amber-400 bg-amber-50'
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-900">{a.title}</p>
              <p className="text-xs text-neutral-500">Status: {a.status}</p>
            </div>
            <Button variant="secondary" size="sm" type="button">
              Åpne
            </Button>
          </div>
        ))}
        {amu.avvik.length === 0 ? (
          <p className="py-4 text-center text-sm text-neutral-500">Ingen åpne avvik i oversikten</p>
        ) : null}
      </ModuleSectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ModuleSectionCard className="p-5">
          <h2 className="mb-3 text-base font-semibold text-neutral-900">Varslingssaker — aggregert</h2>
          <ComplianceBanner title="AML § 2 A-3" className="rounded-md">
            AMU mottar kun aggregerte tall uten persondata.
          </ComplianceBanner>
          <div className="mt-4 flex gap-8">
            <div>
              <p className="text-2xl font-bold text-neutral-900">{amu.whistleblowingStats?.open ?? 0}</p>
              <p className="text-xs text-neutral-500">Åpne</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">{amu.whistleblowingStats?.closed ?? 0}</p>
              <p className="text-xs text-neutral-500">Lukket (rapportert)</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            Kontakt: {amu.members.find((m) => m.role === 'leader')?.display_name ?? '—'}
          </p>
        </ModuleSectionCard>

        <ModuleSectionCard className="p-5">
          <h2 className="mb-3 text-base font-semibold text-neutral-900">Manglende signaturer</h2>
          {unsignedMeetings.map((m) => (
            <div key={m.id} className="flex items-center gap-2 border-b border-neutral-100 py-2 last:border-0">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
              <span className="flex-1 text-sm text-neutral-800">{m.title}</span>
              <span className="text-xs text-neutral-400">{formatDate(m.scheduled_at)}</span>
              <Button variant="secondary" size="sm" type="button">
                Påminn
              </Button>
              <Button variant="primary" size="sm" type="button">
                Åpne
              </Button>
            </div>
          ))}
          {unsignedMeetings.length === 0 ? (
            <p className="py-4 text-center text-sm text-neutral-500">Alle referater er signert</p>
          ) : null}
        </ModuleSectionCard>
      </div>
    </div>
  )
}
