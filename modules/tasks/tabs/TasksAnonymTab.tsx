import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Shield } from 'lucide-react'
import { ModuleSectionCard } from '../../../src/components/module'
import { LayoutScoreStatRow } from '../../../src/components/layout/LayoutScoreStatRow'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { useWorkplaceReportingCases } from '../../../src/hooks/useWorkplaceReportingCases'
import type { AnonymousAmlReport } from '../../../src/types/orgHealth'

const URGENCY_LABELS: Record<AnonymousAmlReport['urgency'], string> = {
  low: 'Lav',
  medium: 'Middels',
  high: 'Høy',
}

const KIND_LABELS: Record<AnonymousAmlReport['kind'], string> = {
  work_injury_illness: 'Skade / sykdom',
  near_miss: 'Nestenulykke',
  harassment_discrimination: 'Trakassering / diskriminering',
  violence_threat: 'Vold / trusler',
  psychosocial: 'Psykososialt',
  whistleblowing: 'Varsling',
  other: 'Annet',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return '—'
  return t.toLocaleString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type Props = {
  pageSlug: string
}

/**
 * Anonyme arbeidsmiljøhenvendelser — read-only oversikt.
 *
 * AML § 4-3 og personopplysningsloven § 1: arbeidstakere skal kunne melde
 * fra om psykososiale forhold uten å bli identifisert. Innholdet i fritekst
 * lagres ikke (kun ja/nei på «detaljer skrevet»). Innstillinger for siden —
 * tittel, ledetekst, fotnote — settes i Innstillinger-fanen.
 */
export function TasksAnonymTab({ pageSlug }: Props) {
  const wr = useWorkplaceReportingCases()
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const stats = useMemo(() => {
    const last24h = wr.anonymousAmlReports.filter(
      (r) => nowMs - new Date(r.submittedAt).getTime() < 24 * 60 * 60 * 1000,
    )
    const high = wr.anonymousAmlReports.filter((r) => r.urgency === 'high')
    return [
      { big: String(wr.anonymousAmlReports.length), title: 'Innmeldte saker', sub: 'Akkumulert' },
      { big: String(last24h.length), title: 'Siste 24t', sub: 'Nye henvendelser' },
      { big: String(high.length), title: 'Høy hastegrad', sub: 'Rød kategori' },
      {
        big: wr.amlReportStats.lastAt ? formatDate(wr.amlReportStats.lastAt).split(' ').slice(0, 2).join(' ') : '—',
        title: 'Siste melding',
        sub: 'Tidspunkt',
      },
    ]
  }, [wr.anonymousAmlReports, wr.amlReportStats.lastAt, nowMs])

  const recent = useMemo(
    () => [...wr.anonymousAmlReports].sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    ).slice(0, 25),
    [wr.anonymousAmlReports],
  )

  const publicUrl = `/anonym-aml/${pageSlug.replace(/^\/+|\/+$/g, '')}`

  return (
    <div className="space-y-4">
      <LayoutScoreStatRow items={stats} columns={4} />

      <ModuleSectionCard className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 text-emerald-700" aria-hidden />
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Anonym arbeidsmiljøhenvendelse</h3>
              <p className="mt-1 max-w-2xl text-sm text-neutral-600">
                Offentlig kanal for varsler om arbeidsmiljø uten identifikasjon. Fritekst
                lagres ikke — kun kategori, hastegrad og tidspunkt. Sett tittel og ledetekst
                under fanen Innstillinger → Anonym AML.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<ExternalLink className="h-4 w-4" />}
            onClick={() => window.open(publicUrl, '_blank', 'noopener,noreferrer')}
          >
            Forhåndsvis
          </Button>
        </div>
      </ModuleSectionCard>

      <ModuleSectionCard className="p-4 md:p-5">
        <h3 className="mb-3 text-sm font-semibold text-neutral-800">Nylige henvendelser</h3>
        {recent.length === 0 ? (
          <p className="text-sm text-neutral-500">Ingen henvendelser registrert enda.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((report) => (
              <li
                key={report.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-200 bg-white p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={report.urgency === 'high' ? 'critical' : report.urgency === 'medium' ? 'warning' : 'neutral'}>
                    {URGENCY_LABELS[report.urgency]}
                  </Badge>
                  <span className="text-sm font-medium text-neutral-900">
                    {KIND_LABELS[report.kind] ?? report.kind}
                  </span>
                  {report.detailsIndicated ? (
                    <Badge variant="info">Detaljer skrevet (ikke lagret)</Badge>
                  ) : null}
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-500">
                  <span>{formatDate(report.submittedAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ModuleSectionCard>
    </div>
  )
}
