import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ModulePreflightChecklist,
  ModuleSectionCard,
  ModuleSignatureCard,
} from '../../../src/components/module'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import type { AmuAnnualReport } from '../types'
import type { AmuHook } from './types'

const SECTIONS = [
  { key: 'sammensetning', label: '§ 1 Sammensetning og møtevirksomhet' },
  { key: 'hms', label: '§ 2 HMS-arbeid' },
  { key: 'avvik', label: '§ 3 Avvik og yrkesskader' },
  { key: 'sykefravær', label: '§ 4 Sykefravær' },
  { key: 'varsling', label: '§ 5 Varsling og medvirkning' },
] as const

function debounce<T extends (...args: never[]) => void>(fn: T, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined
  return (...args: Parameters<T>) => {
    if (t) window.clearTimeout(t)
    t = window.setTimeout(() => fn(...args), ms)
  }
}

function bodyString(body: AmuAnnualReport['body'], key: string): string {
  const v = body[key]
  if (typeof v === 'string') return v
  if (v == null) return ''
  return String(v)
}

function buildAnnualReportHtml(report: AmuAnnualReport, committeeName: string): string {
  const parts = SECTIONS.map(
    (s) => `<h2>${s.label}</h2><p>${bodyString(report.body, s.key).replace(/\n/g, '<br/>')}</p>`,
  ).join('')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Årsrapport ${report.year}</title></head><body><h1>Årsrapport ${report.year} — ${committeeName}</h1>${parts}</body></html>`
}

export function AnnualReportTab({ amu }: { amu: AmuHook }) {
  const currentYear = new Date().getFullYear()
  const report = amu.annualReport
  const signedReports = amu.annualReports

  const [showSignOff, setShowSignOff] = useState(false)
  const [leaderSignerId, setLeaderSignerId] = useState<string | null>(null)
  const [deputySignerId, setDeputySignerId] = useState<string | null>(null)

  const leader = amu.members.find((m) => m.role === 'leader')
  const deputy = amu.members.find((m) => m.role === 'deputy_leader')

  const signedMeetings = amu.meetings.filter((m) => m.status === 'signed').length
  const totalMeetings = amu.meetings.length
  const sickLeaveQuarters = 2
  const hmsPlanned = true

  const reportRef = useRef(report)
  reportRef.current = report

  const persistSection = useMemo(
    () =>
      debounce(async (key: string, value: string) => {
        const r = reportRef.current
        if (!r) return
        const nextBody = { ...r.body, [key]: value }
        await amu.updateAnnualReportBody(r.id, nextBody)
      }, 500),
    [amu],
  )

  const handleSectionEdit = useCallback(
    (key: string, value: string) => {
      persistSection(key, value)
    },
    [persistSection],
  )

  const handleExportPdf = () => {
    if (!report) return
    const html = buildAnnualReportHtml(report, amu.committee?.name ?? 'AMU')
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    window.setTimeout(() => w.print(), 500)
  }

  const allSectionsFilled =
    report &&
    SECTIONS.every((s) => {
      const t = bodyString(report.body, s.key).trim()
      return t.length > 0
    })
  const sourceDataComplete = signedMeetings === totalMeetings && (amu.avvik?.length ?? 0) >= 0

  useEffect(() => {
    if (!showSignOff) {
      setLeaderSignerId(null)
      setDeputySignerId(null)
    }
  }, [showSignOff])

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
      <ModuleSectionCard className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-neutral-900">
            Årsrapport · {currentYear}
            {report?.status === 'draft' ? ' (kladd)' : ''}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" type="button" onClick={handleExportPdf} disabled={!report}>
              Eksporter PDF
            </Button>
            {amu.canChair && report?.status === 'draft' ? (
              <Button variant="primary" type="button" onClick={() => setShowSignOff(true)}>
                Send til signering
              </Button>
            ) : null}
          </div>
        </div>

        {!report && amu.canManage ? (
          <div className="space-y-3 py-8 text-center">
            <p className="text-sm text-neutral-600">Ingen årsrapport for {currentYear} ennå.</p>
            <Button variant="primary" type="button" onClick={() => void amu.draftAnnualReport(currentYear)}>
              Generer kladd automatisk
            </Button>
          </div>
        ) : null}

        {report
          ? SECTIONS.map((section) => (
              <div key={section.key} className="mb-6">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">{section.label}</p>
                {amu.canChair && report.status === 'draft' ? (
                  <StandardTextarea
                    rows={4}
                    defaultValue={bodyString(report.body, section.key)}
                    onChange={(e) => handleSectionEdit(section.key, e.target.value)}
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-sm text-neutral-700">
                    {bodyString(report.body, section.key) || '—'}
                  </p>
                )}
              </div>
            ))
          : null}
      </ModuleSectionCard>

      <div className="space-y-4">
        <ModuleSectionCard className="p-5">
          <h2 className="mb-3 text-base font-semibold text-neutral-900">Kildedata · auto-trukket</h2>
          {[
            { label: 'Møtereferat', value: `${signedMeetings}/${totalMeetings}`, ok: signedMeetings === totalMeetings },
            { label: 'Avvik', value: String(amu.avvik?.length ?? 0), ok: true },
            { label: 'Sykefravær (kvartal)', value: `${sickLeaveQuarters}/4`, ok: sickLeaveQuarters >= 2 },
            { label: 'HMS-plan', value: hmsPlanned ? '✓' : '–', ok: hmsPlanned },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-2 border-b border-neutral-100 py-1.5 last:border-0">
              <span className="flex-1 text-sm text-neutral-800">{row.label}</span>
              <Badge variant={row.ok ? 'success' : 'warning'}>{row.value}</Badge>
            </div>
          ))}
        </ModuleSectionCard>

        <ModuleSectionCard className="p-5">
          <h2 className="mb-3 text-base font-semibold text-neutral-900">Versjoner</h2>
          {signedReports.map((r) => (
            <div key={r.id} className="flex items-center gap-2 border-b border-neutral-100 py-1.5 last:border-0">
              <span className="flex-1 text-sm text-neutral-800">Årsrapport {r.year}</span>
              <Badge variant="success">Signert</Badge>
              <Button variant="ghost" size="sm" type="button">
                PDF →
              </Button>
            </div>
          ))}
          {signedReports.length === 0 ? (
            <p className="text-xs text-neutral-400">Ingen tidligere signerte rapporter</p>
          ) : null}
        </ModuleSectionCard>
      </div>

      {showSignOff && report ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <ModuleSectionCard className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
            <h3 className="text-lg font-semibold text-neutral-900">Signer årsrapport</h3>
            <div className="mt-4">
              <ModulePreflightChecklist
                items={[
                  { label: 'Alle § 1–5 seksjoner utfylt', ok: Boolean(allSectionsFilled) },
                  { label: 'Alle møtereferat signert', ok: signedMeetings === totalMeetings },
                  { label: 'Kildedata komplett', ok: sourceDataComplete },
                ]}
              />
            </div>
            <div className="mt-6 space-y-4">
              <ModuleSignatureCard
                title="Leder (AMU)"
                contextLine={leader?.display_name ?? '—'}
                lawReference="AML § 7-2"
                buttonLabel="Bekreft leder som signatar"
                onSign={() => setLeaderSignerId(leader?.id ?? null)}
              />
              <ModuleSignatureCard
                title="Nestleder (AMU)"
                contextLine={deputy?.display_name ?? '—'}
                lawReference="AML § 7-2"
                variant="secondary"
                buttonLabel="Bekreft nestleder som signatar"
                onSign={() => setDeputySignerId(deputy?.id ?? null)}
              />
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button variant="secondary" type="button" onClick={() => setShowSignOff(false)}>
                Avbryt
              </Button>
              <Button
                variant="primary"
                type="button"
                disabled={!leaderSignerId || !deputySignerId}
                onClick={() =>
                  void amu.signAnnualReport(report.id, leaderSignerId!, deputySignerId!).then(() => {
                    setShowSignOff(false)
                  })
                }
              >
                Signer årsrapport
              </Button>
            </div>
          </ModuleSectionCard>
        </div>
      ) : null}
    </div>
  )
}
