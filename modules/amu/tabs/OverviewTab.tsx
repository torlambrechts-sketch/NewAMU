import { useEffect } from 'react'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { ModuleSectionCard } from '../../../src/components/module'
import { InfoBox, WarningBox } from '../../../src/components/ui/AlertBox'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { ComplianceBanner } from '../../../src/components/ui/ComplianceBanner'
import type { AmuHook } from './types'

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export function OverviewTab({ amu, onOpenReport }: { amu: AmuHook; onOpenReport?: () => void }) {
  const year = new Date().getFullYear()
  const next = amu.meetings.find((m) => m.status === 'scheduled' || m.status === 'draft')

  useEffect(() => {
    if (!next?.id) return
    void amu.loadMeetingDetail(next.id).catch(() => {
      /* feil vises via amu.error */
    })
  }, [next?.id, amu.loadMeetingDetail])

  const nextAgenda = next
    ? amu.agendaItems.filter((a) => a.meeting_id === next.id).sort((a, b) => a.position - b.position)
    : []
  const pendingCount = amu.agendaItems.filter((a) => a.status === 'pending').length
  const employer = amu.members.filter((m) => m.side === 'employer' && m.active).length
  const employee = amu.members.filter((m) => m.side === 'employee' && m.active).length
  const bhtOk = amu.members.some((m) => m.side === 'bht' && m.active)

  const comp = amu.compliance

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ModuleSectionCard className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Møter i {year}</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">
            {comp ? `${comp.meetings_held} / ${comp.meetings_required}` : '—'}
          </p>
          <p className="mt-2 text-xs text-neutral-600">
            Lovkrav: {comp?.meetings_required ?? 4}
            {next ? ` · neste ${formatDateTime(next.scheduled_at)}` : ''}
          </p>
        </ModuleSectionCard>
        <ModuleSectionCard className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Sammensetning</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">{amu.members.length} medlemmer</p>
          <p className="mt-2 text-xs text-neutral-600">
            {employer}/{employee} paritet · BHT {bhtOk ? 'representert' : 'mangler'}
          </p>
        </ModuleSectionCard>
        <ModuleSectionCard className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Saker til behandling</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">{pendingCount}</p>
          <p className="mt-2 text-xs text-neutral-600">{pendingCount} må avklares før neste møte</p>
        </ModuleSectionCard>
        <ModuleSectionCard
          className={`p-4 ${amu.criticalQueue.length > 0 ? 'border-l-4 border-l-red-500 bg-red-50/30' : ''}`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Kritiske aktiviteter</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">{amu.criticalQueue.length}</p>
          <p className="mt-2 text-xs text-neutral-600">{amu.criticalQueue.length} forsinket signering / oppfølging</p>
        </ModuleSectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <ModuleSectionCard className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-neutral-900">Neste møte — automatisk saksliste</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">AML § 7-2</Badge>
                <Button variant="ghost" size="sm" type="button">
                  Forhåndsvis
                </Button>
                {amu.canManage && next ? (
                  <Button variant="primary" size="sm" type="button" onClick={() => void amu.startMeeting(next.id)}>
                    Åpne møterom
                  </Button>
                ) : null}
              </div>
            </div>
            {!next ? (
              <InfoBox>Ingen kommende møter. Beram neste møte under Møteplan.</InfoBox>
            ) : (
              <>
                <div className="flex flex-wrap items-start gap-3">
                  <span className="shrink-0 rounded-full bg-[#1a3d32] px-3 py-1 text-xs font-semibold text-white">
                    {formatDateTime(next.scheduled_at)}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-900">{next.title}</h3>
                    <p className="text-sm text-neutral-600">{next.location ?? '—'}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {amu.members.slice(0, 5).map((m) => (
                    <span
                      key={m.id}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-700"
                      title={m.display_name}
                    >
                      {m.display_name
                        .split(/\s+/)
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)}
                    </span>
                  ))}
                  {amu.members.length > 5 ? (
                    <span className="text-xs text-neutral-500">+{amu.members.length - 5}</span>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge variant="success">Saksliste generert automatisk</Badge>
                  <span className="text-xs text-neutral-600">Standardpunkter og koblede saker</span>
                  {amu.canManage ? (
                    <Button variant="ghost" size="sm" type="button">
                      Rediger
                    </Button>
                  ) : null}
                </div>
                {nextAgenda.length === 0 && amu.canManage ? (
                  <div className="mt-4">
                    <Button variant="secondary" type="button" onClick={() => void amu.generateAutoAgenda(next.id)}>
                      Generer saksliste automatisk
                    </Button>
                  </div>
                ) : (
                  <ul className="mt-4 space-y-2">
                    {nextAgenda.slice(0, 8).map((item) => (
                      <li key={item.id} className="flex items-start gap-2 text-sm">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs">
                          {item.position}
                        </span>
                        <span className="flex-1 text-neutral-800">{item.title}</span>
                        <Badge variant="neutral">{item.source_type}</Badge>
                        {item.legal_ref ? <Badge variant="neutral">{item.legal_ref}</Badge> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </ModuleSectionCard>

          <ModuleSectionCard className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-neutral-900">Lovkrav inneværende år</h2>
              <div className="max-w-md shrink-0">
                <ComplianceBanner title="Hjemmel" className="rounded-md">
                  AML kap. 7 · IK § 5
                </ComplianceBanner>
              </div>
            </div>
            {!comp ? (
              <WarningBox>Kunne ikke laste samsvar — opprett utvalg og medlemmer.</WarningBox>
            ) : (
              <div>
                {[
                  {
                    label: 'Minimum 4 møter',
                    ok: comp.meetings_held >= comp.meetings_required,
                    partial: comp.meetings_held > 0 && comp.meetings_held < comp.meetings_required,
                  },
                  { label: 'Lik representasjon', ok: comp.parity_ok, partial: false },
                  { label: 'BHT representert', ok: comp.bht_present, partial: false },
                  { label: 'HMS-kurs gyldig', ok: comp.hms_training_all_valid, partial: false },
                  { label: 'Årsrapport signert (i fjor)', ok: comp.annual_report_signed, partial: false },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-3 border-b border-neutral-100 py-2 last:border-0">
                    {row.ok ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" aria-hidden />
                    ) : row.partial ? (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-red-500" aria-hidden />
                    )}
                    <span className="flex-1 text-sm text-neutral-800">{row.label}</span>
                    {!row.ok ? (
                      <Button variant="ghost" size="sm" type="button">
                        Fullfør →
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </ModuleSectionCard>
        </div>

        <div className="space-y-6">
          <ModuleSectionCard className="p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-neutral-900">Kritiske aktiviteter</h2>
              <Badge variant="danger">{amu.criticalQueue.length} åpne</Badge>
            </div>
            {amu.criticalQueue.map((item) => (
              <div
                key={`${item.item_type}-${item.source_id}`}
                className={`mb-2 flex items-start gap-3 rounded border-l-4 p-3 ${
                  item.severity === 'high' ? 'border-l-red-500 bg-red-50' : 'border-l-amber-400 bg-amber-50'
                }`}
              >
                <span className="flex-1 text-sm text-neutral-800">{item.label}</span>
                <Button variant="secondary" size="sm" type="button">
                  Åpne
                </Button>
              </div>
            ))}
            {amu.criticalQueue.length === 0 ? (
              <p className="py-4 text-center text-sm text-neutral-500">Ingen kritiske aktiviteter</p>
            ) : null}
          </ModuleSectionCard>

          <ModuleSectionCard className="p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-neutral-900">Årsrapport {year}</h2>
              <Badge variant="neutral">§ 7-2 (6)</Badge>
            </div>
            <p className="mb-4 text-sm text-neutral-600">
              {amu.annualReport?.status === 'signed' ? 'Signert og arkivert.' : 'Kladd under arbeid.'}
            </p>
            <Button variant="secondary" type="button" onClick={() => onOpenReport?.()}>
              Åpne kladd
            </Button>
          </ModuleSectionCard>
        </div>
      </div>
    </div>
  )
}
