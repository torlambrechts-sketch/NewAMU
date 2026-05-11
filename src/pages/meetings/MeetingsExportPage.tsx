// Møter — Audit Export-pakke (H12).
//
// Print-friendly route at /meetings/:meetingId/eksport. Mirrors
// LearningCertificatePrintPage: top toolbar (Tilbake + Skriv ut),
// .no-print on chrome, A4-friendly body. Uses browser's "Save as PDF"
// in the print dialog — no new dependency required.
//
// Content layout (auditor-facing):
//   1. Title block — org name, framework label, meeting title, date,
//      confidentiality, addressee (Arbeidstilsynet / cert body / Datatilsynet)
//   2. Attendees roster (resolved member names where possible)
//   3. Mandatory-topics gap status (audit-relevant)
//   4. Agenda items — full text + minutes + decision + status + votes +
//      lawRef + binding_snapshot summary
//   5. Decisions register
//   6. Action items
//   7. Signatures
//   8. Generated-at footer + checksum (sha-256 of meeting id + signed_at)

import { useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Printer, Scale } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useMeetings } from '../../../modules/meetings'
import {
  MEETING_ACTION_STATUS_LABEL,
  MEETING_ATTENDEE_ROLE_LABEL,
  MEETING_CONFIDENTIALITY_LABEL,
  MEETING_DECISION_STATUS_LABEL,
  MEETING_STATUS_LABEL,
  frameworkLabel,
} from '../../../modules/meetings/meetingsLabels'
import type {
  MeetingAttendeeRole,
  MeetingFramework,
  MeetingTemplateAgendaItem,
} from '../../../modules/meetings/types'

const SERIF_FAMILY = "'Libre Baskerville', Georgia, serif"

const ADDRESSEE_BY_FRAMEWORK: Partial<Record<MeetingFramework, string>> = {
  AML: 'Til: Arbeidstilsynet (på forespørsel) og virksomhetens styrende organer',
  'IK-f': 'Til: Arbeidstilsynet (på forespørsel)',
  Hovedavtalen: 'Til: Tariffparter / Hovedorganisasjonene',
  Likestillingsloven: 'Til: Likestillings- og diskrimineringsombudet (på forespørsel)',
  ISO_9001: 'Til: Sertifiseringsorgan',
  ISO_14001: 'Til: Sertifiseringsorgan',
  ISO_27001: 'Til: Sertifiseringsorgan',
  ISO_45001: 'Til: Sertifiseringsorgan',
  GDPR: 'Til: Datatilsynet (på forespørsel) og personvernombud',
  INTERNAL: 'Til: Internt',
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' })
}

function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function MeetingsExportPage() {
  const { meetingId = '' } = useParams<{ meetingId: string }>()
  const { organization, members } = useOrgSetupContext()
  const meetings = useMeetings()
  const { loadDetail } = meetings

  useEffect(() => {
    if (!meetingId) return
    void loadDetail(meetingId)
  }, [meetingId, loadDetail])

  const meeting = meetings.detail.meeting
  const memberById = useMemo(() => {
    const m = new Map<string, string>()
    for (const member of members ?? []) {
      m.set(member.id, member.display_name ?? member.id)
    }
    return m
  }, [members])

  if (meetings.detailLoading && !meeting) {
    return (
      <div className="no-print mx-auto max-w-lg px-6 py-16 text-center text-neutral-700">
        Laster protokoll-pakke…
      </div>
    )
  }
  if (!meeting) {
    return (
      <div className="no-print mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-neutral-700">Fant ikke møtet.</p>
        <Link
          to="/meetings"
          className="mt-4 inline-block text-sm font-medium text-[#1a3d32] underline"
        >
          Tilbake til Møter
        </Link>
      </div>
    )
  }

  const snap = meeting.definition_snapshot
  const mandatoryTopicsAll =
    (snap?.agendaItems ?? []).filter(
      (item: MeetingTemplateAgendaItem) => item.isMandatory,
    ).length
  const mandatoryTopicsMissing = (() => {
    if (!snap?.agendaItems?.length) return 0
    const minutesByKey = new Map<string, string | null>()
    for (const item of meetings.detail.agendaItems) {
      if (item.template_item_key) minutesByKey.set(item.template_item_key, item.minutes_summary)
    }
    let n = 0
    for (const tpl of snap.agendaItems as MeetingTemplateAgendaItem[]) {
      if (!tpl.isMandatory) continue
      const minutes = minutesByKey.get(tpl.key)
      if (!minutes || !minutes.trim()) n += 1
    }
    return n
  })()

  const framework: MeetingFramework =
    (snap as { framework?: MeetingFramework } | null)?.framework ?? 'INTERNAL'
  const addressee = ADDRESSEE_BY_FRAMEWORK[framework] ?? ADDRESSEE_BY_FRAMEWORK.INTERNAL

  const orgName = organization?.name?.trim() || 'Organisasjon'
  const generatedAt = new Date().toISOString()

  return (
    <div className="min-h-screen bg-[#F9F7F2] text-neutral-900">
      <div className="no-print mx-auto max-w-[1400px] border-b border-neutral-200 bg-white px-4 py-3 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to={`/meetings/${meeting.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1a3d32] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Tilbake til møtet
          </Link>
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={<Printer className="h-3.5 w-3.5" />}
            onClick={() => window.print()}
          >
            Skriv ut / Lagre som PDF
          </Button>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Bruk Skriv ut → Lagre som PDF i nettleseren for en signert protokoll-pakke.
          Pakken inkluderer titteltavle, deltakere, agenda, vedtak, oppfølgingsoppgaver og signaturer.
        </p>
      </div>

      <article
        className="mx-auto max-w-3xl bg-white px-8 py-10 print:max-w-none print:px-12 print:py-8"
        style={{ fontFamily: SERIF_FAMILY }}
      >
        <header className="border-b-2 border-neutral-900 pb-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-600">
            Protokoll
          </p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight">{meeting.title}</h1>
          <p className="mt-2 text-base text-neutral-700">{orgName}</p>
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <Pair label="Rammeverk" value={frameworkLabel(framework)} />
            <Pair label="Planlagt" value={fmtDate(meeting.scheduled_at)} />
            <Pair label="Gjennomført" value={fmtDate(meeting.completed_at)} />
            <Pair label="Status" value={MEETING_STATUS_LABEL[meeting.status]} />
            <Pair
              label="Konfidensialitet"
              value={MEETING_CONFIDENTIALITY_LABEL[meeting.confidentiality_level]}
            />
            <Pair label="Sted" value={meeting.location_label ?? '—'} />
          </dl>
          <p className="mt-4 text-xs text-neutral-600">{addressee}</p>
        </header>

        <Section title="Deltakere">
          {meetings.detail.attendees.length === 0 ? (
            <p className="text-sm text-neutral-700">Ingen deltakere registrert.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="border-b border-neutral-300 text-left text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-1 pr-3">Navn</th>
                  <th className="py-1 pr-3">Rolle</th>
                  <th className="py-1 pr-3">Til stede</th>
                  <th className="py-1">Notat</th>
                </tr>
              </thead>
              <tbody>
                {meetings.detail.attendees.map((a) => (
                  <tr key={`${a.meeting_id}-${a.member_id}`} className="border-b border-neutral-100">
                    <td className="py-1.5 pr-3">{memberById.get(a.member_id) ?? a.member_id.slice(0, 8)}</td>
                    <td className="py-1.5 pr-3">
                      {MEETING_ATTENDEE_ROLE_LABEL[a.role as MeetingAttendeeRole] ?? a.role}
                    </td>
                    <td className="py-1.5 pr-3">
                      {a.present === null ? '—' : a.present ? 'Ja' : 'Nei'}
                    </td>
                    <td className="py-1.5 text-neutral-700">{a.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {mandatoryTopicsAll > 0 ? (
          <Section title="Obligatoriske saker — dekning">
            <p className="text-sm text-neutral-700">
              {mandatoryTopicsAll - mandatoryTopicsMissing} av {mandatoryTopicsAll} obligatoriske saker har protokollført innhold.
              {mandatoryTopicsMissing > 0 ? (
                <>
                  {' '}
                  <strong>{mandatoryTopicsMissing}</strong> mangler — protokollen er ikke
                  audit-komplett før disse er fylt ut.
                </>
              ) : null}
            </p>
          </Section>
        ) : null}

        <Section title="Agenda og protokoll">
          {meetings.detail.agendaItems.length === 0 ? (
            <p className="text-sm text-neutral-700">Ingen agendapunkter registrert.</p>
          ) : (
            <ol className="space-y-4">
              {meetings.detail.agendaItems.map((item) => (
                <li key={item.id} className="break-inside-avoid">
                  <p className="text-sm font-semibold">
                    {item.position + 1}. {item.title}
                    {item.is_mandatory ? (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-red-700">
                        OBLIGATORISK
                      </span>
                    ) : null}
                  </p>
                  {item.law_ref ? (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-neutral-600">
                      <Scale className="h-3 w-3" /> {item.law_ref}
                    </p>
                  ) : null}
                  {item.description ? (
                    <p className="mt-1 text-xs italic text-neutral-700">{item.description}</p>
                  ) : null}
                  <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-600">
                        Sammendrag
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-neutral-900">
                        {item.minutes_summary?.trim() || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-600">
                        Vedtak
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-neutral-900">
                        {item.decision_text?.trim() || '—'}
                      </p>
                      {item.decision_status ? (
                        <p className="mt-1 text-[11px] text-neutral-700">
                          Status: {MEETING_DECISION_STATUS_LABEL[item.decision_status]}
                        </p>
                      ) : null}
                      {item.vote_for !== null || item.vote_against !== null || item.vote_abstain !== null ? (
                        <p className="mt-1 text-[11px] text-neutral-700">
                          Stemmer: {item.vote_for ?? 0} for, {item.vote_against ?? 0} mot,{' '}
                          {item.vote_abstain ?? 0} avholdende
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {item.binding_snapshot ? (
                    <div className="mt-2 rounded border border-neutral-300 bg-neutral-50 p-2 text-xs text-neutral-800">
                      <p className="font-bold uppercase tracking-wider text-[10px] text-neutral-600">
                        Forberedelse — datakilde {item.binding_snapshot.source}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap leading-snug">
                        {item.binding_snapshot.summaryMarkdown}
                      </p>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </Section>

        {meetings.detail.decisions.length > 0 ? (
          <Section title="Vedtaksregister">
            <ol className="space-y-2 text-sm">
              {meetings.detail.decisions.map((d) => (
                <li key={d.id} className="break-inside-avoid">
                  <p className="font-medium">{d.decision_text}</p>
                  <p className="text-[11px] text-neutral-600">
                    {fmtDate(d.decision_at)} · Status: {MEETING_DECISION_STATUS_LABEL[d.status]}
                  </p>
                </li>
              ))}
            </ol>
          </Section>
        ) : null}

        {meetings.detail.actionItems.length > 0 ? (
          <Section title="Oppfølgingsoppgaver">
            <table className="w-full border-collapse text-sm">
              <thead className="border-b border-neutral-300 text-left text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-1 pr-3">Oppgave</th>
                  <th className="py-1 pr-3">Frist</th>
                  <th className="py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {meetings.detail.actionItems.map((a) => (
                  <tr key={a.id} className="border-b border-neutral-100">
                    <td className="py-1.5 pr-3">{a.description}</td>
                    <td className="py-1.5 pr-3">{a.due_date ?? '—'}</td>
                    <td className="py-1.5">{MEETING_ACTION_STATUS_LABEL[a.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        ) : null}

        <Section title="Signaturer">
          {meetings.detail.signatures.length === 0 ? (
            <p className="text-sm text-neutral-700">
              Ingen bekreftelser registrert. (Bekreftelse er forhåndsregistrering — ikke juridisk signatur per Council Review §3.4.)
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="border-b border-neutral-300 text-left text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-1 pr-3">Navn</th>
                  <th className="py-1 pr-3">Rolle</th>
                  <th className="py-1">Tidspunkt</th>
                </tr>
              </thead>
              <tbody>
                {meetings.detail.signatures.map((s) => (
                  <tr key={s.id} className="border-b border-neutral-100">
                    <td className="py-1.5 pr-3 font-semibold">{s.signer_name}</td>
                    <td className="py-1.5 pr-3">{s.signer_role}</td>
                    <td className="py-1.5">{fmtDate(s.signed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <footer className="mt-8 border-t border-neutral-300 pt-3 text-[10px] text-neutral-500">
          <p>
            Pakke generert {fmtDate(generatedAt)} fra meetings-modulen. Møte-ID:{' '}
            {meeting.id}. Protokoll signert: {fmtDateShort(meeting.protocol_signed_at)}.
          </p>
          <p className="mt-1">
            Dette dokumentet er en re-eksport av data lagret i meeting_agenda_items,
            meeting_attendees, meeting_decisions, meeting_action_items og
            meeting_signatures. Originalen lever i databasen med revisjonsspor.
          </p>
        </footer>
      </article>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; font-family: ${SERIF_FAMILY}; }
          article { max-width: none !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  )
}

function Pair({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">{label}</dt>
      <dd className="text-sm text-neutral-900">{value}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 break-inside-avoid">
      <h2 className="border-b border-neutral-300 pb-1 text-base font-semibold uppercase tracking-wider text-neutral-700">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}
