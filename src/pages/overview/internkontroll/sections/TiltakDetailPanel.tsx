// TiltakDetailPanel — slide-over showing one tiltak (compliance_plan_item)
// plus the embedded task chrome (subtasks / comments / evidence / activity
// log) when the row has a bridge task.
//
// Phase 4 of the Tasks-module alignment: instead of rebuilding the
// CAPA workspace inside internkontroll, we mount the canonical Tasks-
// module components against the bridge task id. The auditor sees the
// same workflow chrome the doer sees in Oppgavestyring, without
// leaving the §-anchored page.

import { useState } from 'react'
import { ArrowUpRight, ExternalLink, X } from 'lucide-react'
import { Button } from '../../../../components/ui/Button'
import { SlidePanel } from '../../../../components/layout/SlidePanel'
import { Tabs } from '../../../../components/ui/Tabs'
import { TaskSubtaskList } from '../../../../../modules/tasks/components/TaskSubtaskList'
import { TaskCommentThread } from '../../../../../modules/tasks/components/TaskCommentThread'
import { TaskEvidenceSection } from '../../../../../modules/tasks/components/TaskEvidenceSection'
import { TaskActivityFeed } from '../../../../../modules/tasks/components/TaskActivityFeed'
import {
  BridgeStatusBadge,
  FwChip,
  Initials,
  PRIO_TONE,
  TiltakStatusPill,
} from './internkontrollShared'
import type { IkData, IkTiltak } from '../useInternkontrollPageData'

const TABS = [
  { id: 'oversikt', label: 'Oversikt' },
  { id: 'oppgaver', label: 'Underoppgaver' },
  { id: 'aktivitet', label: 'Aktivitet' },
  { id: 'bevis', label: 'Bevis' },
  { id: 'kommentarer', label: 'Kommentarer' },
] as const

type TabId = (typeof TABS)[number]['id']

export function TiltakDetailPanel({
  open,
  onClose,
  tiltak,
  frameworks,
}: {
  open: boolean
  onClose: () => void
  tiltak: IkTiltak | null
  frameworks: IkData['frameworks']
}) {
  const [tab, setTab] = useState<TabId>('oversikt')

  if (!tiltak) return null

  const hasBridge = Boolean(tiltak.taskId)

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="tiltak-detail-title"
      title={
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Tiltak
          </span>
          <span id="tiltak-detail-title" className="text-lg font-semibold text-neutral-900">
            {tiltak.title}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <FwChip fw={tiltak.fw} frameworks={frameworks} />
            <span className="font-mono text-[10px] tabular-nums font-bold text-neutral-500">
              {tiltak.krav[0]?.replace(/^k-[^-]+-/, '') ?? ''}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${PRIO_TONE[tiltak.priority].bg} ${PRIO_TONE[tiltak.priority].text}`}
            >
              {tiltak.priority}
            </span>
            <TiltakStatusPill status={tiltak.status} />
            {tiltak.bridgeStatus && <BridgeStatusBadge status={tiltak.bridgeStatus} />}
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] text-neutral-500">
            {hasBridge ? (
              <>
                Aktivitet, kommentarer og bevis er synkroniserte med oppgaven i Oppgavestyring.
              </>
            ) : (
              <>
                Underoppgaver, kommentarer og bevis blir tilgjengelige når tiltaket flyttes
                til «Pågår» og en oppgave opprettes automatisk.
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasBridge && (
              <a
                href={`/tasks/management/alle?task=${tiltak.taskId}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#1a3d32]/20 bg-[#e7efe9]/40 px-3 py-1.5 text-xs font-semibold text-[#1a3d32] hover:bg-[#e7efe9]"
                target="_blank"
                rel="noopener"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Åpne i Oppgaver
              </a>
            )}
            <Button variant="secondary" size="sm" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
              Lukk
            </Button>
          </div>
        </div>
      }
    >
      <Tabs
        items={TABS.map((t) => ({
          id: t.id,
          label: t.label,
          // Dim the tabs that depend on the bridge task when there is none.
          disabled:
            !hasBridge && (t.id === 'oppgaver' || t.id === 'aktivitet' || t.id === 'bevis' || t.id === 'kommentarer'),
        }))}
        activeId={tab}
        onChange={(id: string) => setTab(id as TabId)}
      />

      <div className="mt-4">
        {tab === 'oversikt' && <OverviewTab tiltak={tiltak} frameworks={frameworks} />}
        {tab === 'oppgaver' && hasBridge && <TaskSubtaskList taskItemId={tiltak.taskId!} />}
        {tab === 'aktivitet' && hasBridge && <TaskActivityFeed taskItemId={tiltak.taskId!} />}
        {tab === 'bevis' && hasBridge && <TaskEvidenceSection taskItemId={tiltak.taskId!} />}
        {tab === 'kommentarer' && hasBridge && <TaskCommentThread taskItemId={tiltak.taskId!} />}
        {(tab === 'oppgaver' ||
          tab === 'aktivitet' ||
          tab === 'bevis' ||
          tab === 'kommentarer') &&
          !hasBridge && (
            <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50/60 px-4 py-6 text-center text-[12px] italic text-neutral-500">
              Ingen oppgave knyttet til tiltaket ennå. Sett status til «Pågår» for å mint en
              bridge-oppgave med samme tittel og lovreferanse — den blir tilgjengelig både her
              og i Oppgavestyring.
            </div>
          )}
      </div>
    </SlidePanel>
  )
}

function OverviewTab({
  tiltak,
  frameworks,
}: {
  tiltak: IkTiltak
  frameworks: IkData['frameworks']
}) {
  return (
    <div className="space-y-4 text-sm">
      {tiltak.description && (
        <div>
          <h5 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            Beskrivelse
          </h5>
          <p className="mt-1 whitespace-pre-wrap text-[13px] text-neutral-700">
            {tiltak.description}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Eier (ansvarlig)">
          <span className="inline-flex items-center gap-2">
            <Initials name={tiltak.owner} size={20} />
            <span>{tiltak.owner}</span>
          </span>
        </Field>
        <Field label="Tildelt (utfører)">
          {tiltak.bridgeAssignee ? (
            <span className="inline-flex items-center gap-2">
              <Initials name={tiltak.bridgeAssignee} size={20} />
              <span>{tiltak.bridgeAssignee}</span>
            </span>
          ) : (
            <span className="text-neutral-500">—</span>
          )}
        </Field>
        <Field label="Frist (plan)">
          <span className="font-mono tabular-nums">{tiltak.deadline}</span>
        </Field>
        <Field label="SLA (oppgave)">
          <span className="font-mono tabular-nums">
            {tiltak.bridgeSlaDueAt
              ? new Date(tiltak.bridgeSlaDueAt).toLocaleString('nb-NO', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'}
          </span>
        </Field>
        <Field label="Rammeverk">
          <FwChip fw={tiltak.fw} frameworks={frameworks} />
        </Field>
        <Field label="Lukker paragraf">
          <span className="font-mono text-[11px]">
            {tiltak.krav[0]?.replace(/^k-[^-]+-/, '') ?? '—'}
          </span>
        </Field>
        {tiltak.project && (
          <Field label="Prosjekt">
            <span className="inline-flex items-center gap-1.5">
              {tiltak.project}
              {tiltak.taskId && (
                <a
                  href={`/tasks/management/alle?task=${tiltak.taskId}`}
                  className="text-[#1a3d32] hover:underline"
                  title="Åpne i Oppgaver"
                >
                  <ArrowUpRight className="inline h-3 w-3" />
                </a>
              )}
            </span>
          </Field>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-neutral-200/80 bg-[#fbf9f3]/40 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-sm text-neutral-900">{children}</div>
    </div>
  )
}
