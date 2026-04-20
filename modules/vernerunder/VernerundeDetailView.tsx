import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ClipboardList, Loader2, Pencil, PenLine, Plus, Sparkles, Trash2, UserPlus } from 'lucide-react'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../../src/components/layout/WorkplaceStandardFormPanel'
import { WorkplacePageHeading1 } from '../../src/components/layout/WorkplacePageHeading1'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../src/components/layout/layoutTable1PostingsKit'
import { WORKPLACE_MODULE_CARD, WORKPLACE_MODULE_CARD_SHADOW } from '../../src/components/layout/workplaceModuleSurface'
import { WorkplaceStandardFormPanel } from '../../src/components/layout/WorkplaceStandardFormPanel'
import { Badge } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import { ComplianceBanner } from '../../src/components/ui/ComplianceBanner'
import { StandardInput } from '../../src/components/ui/Input'
import { SearchableSelect, type SelectOption } from '../../src/components/ui/SearchableSelect'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { Tabs, type TabItem } from '../../src/components/ui/Tabs'
import { WarningBox } from '../../src/components/ui/AlertBox'
import type { VernerundeCheckpointRow, VernerundeFindingRow, VernerundeParticipantRow, VernerunderRow } from './types'
import { SEVERITY_OPTIONS, SEVERITY_LABEL, findingBadgeVariant, findingSeverityClass } from './findingPresentation'
import { useVernerunde } from './useVernerunde'

const STATUS_LABEL: Record<VernerunderRow['status'], string> = {
  draft: 'Kladd',
  active: 'Aktiv',
  completed: 'Fullført',
  signed: 'Signert',
}

const CHECKPOINT_STATUS_LABEL: Record<VernerundeCheckpointRow['status'], string> = {
  ok: 'OK',
  deviation: 'Avvik',
  not_applicable: 'I/A',
}

const PARTICIPANT_ROLE_LABEL: Record<VernerundeParticipantRow['role'], string> = {
  manager: 'Nærmeste leder',
  safety_deputy: 'HMS / verneombud',
  employee: 'Ansatt / representant',
}

function statusBadgeVariant(s: VernerunderRow['status']): 'draft' | 'active' | 'signed' | 'success' {
  if (s === 'signed') return 'signed'
  if (s === 'completed') return 'success'
  if (s === 'active') return 'active'
  return 'draft'
}

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'draft', label: STATUS_LABEL.draft },
  { value: 'active', label: STATUS_LABEL.active },
  { value: 'completed', label: STATUS_LABEL.completed },
  { value: 'signed', label: STATUS_LABEL.signed },
]

const CHECK_STATUS_OPTIONS: SelectOption[] = [
  { value: 'ok', label: CHECKPOINT_STATUS_LABEL.ok },
  { value: 'deviation', label: CHECKPOINT_STATUS_LABEL.deviation },
  { value: 'not_applicable', label: CHECKPOINT_STATUS_LABEL.not_applicable },
]

const ROLE_OPTIONS: SelectOption[] = (Object.keys(PARTICIPANT_ROLE_LABEL) as VernerundeParticipantRow['role'][]).map(
  (r) => ({ value: r, label: PARTICIPANT_ROLE_LABEL[r] }),
)

type DetailTab = 'planlegging' | 'sjekkliste' | 'funn' | 'deltakere_signatur'

function TabEmpty({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 text-neutral-400">
        {icon}
      </div>
      <p className="max-w-sm text-sm font-medium text-neutral-800">{title}</p>
      <p className="max-w-md text-sm text-neutral-500">{body}</p>
    </div>
  )
}

export function VernerundeDetailView() {
  const { vernerundeId: rawId } = useParams()
  const vernerundeId = rawId ?? ''
  const v = useVernerunde()
  const [activeTab, setActiveTab] = useState<DetailTab>('planlegging')

  const round = v.byId[vernerundeId] ?? null
  const locked = round ? v.isLockedByStatus(round.status) : false
  const checkpoints = useMemo(() => v.checkpointsByRunde[vernerundeId] ?? [], [v.checkpointsByRunde, vernerundeId])
  const findings = useMemo(() => v.findingsByRunde[vernerundeId] ?? [], [v.findingsByRunde, vernerundeId])
  const [ckPanel, setCkPanel] = useState<null | { mode: 'add' } | { mode: 'edit'; row: VernerundeCheckpointRow }>(null)
  const [fPanel, setFPanel] = useState<null | { mode: 'add' } | { mode: 'edit'; row: VernerundeFindingRow }>(null)
  const [importing, setImporting] = useState(false)

  const [planTitle, setPlanTitle] = useState('')
  const [planTemplate, setPlanTemplate] = useState('')
  const [planDate, setPlanDate] = useState('')
  const [planStatus, setPlanStatus] = useState<VernerunderRow['status']>('draft')

  const ckQ = useId()
  const ckS = useId()
  const fDesc = useId()
  const fSev = useId()
  const fCp = useId()
  const fCat = useId()

  useEffect(() => {
    void v.load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- v.load is stable; full v dep causes loops
  }, [v.load])

  useEffect(() => {
    if (vernerundeId) {
      void v.loadRoundChildren(vernerundeId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.loadRoundChildren, vernerundeId])

  useEffect(() => {
    if (round) {
      setPlanTitle(round.title)
      setPlanTemplate(round.template_id ?? '')
      setPlanDate(round.planned_date ?? '')
      setPlanStatus(round.status)
    }
  }, [round?.id, round?.title, round?.template_id, round?.planned_date, round?.status, round])

  const templateOptions: SelectOption[] = useMemo(
    () => [{ value: '', label: 'Uten mal' }, ...v.templates.map((t) => ({ value: t.id, label: t.name }))],
    [v.templates],
  )

  const categoryOptions: SelectOption[] = useMemo(
    () => [{ value: '', label: 'Ingen kategori' }, ...v.categories.map((c) => ({ value: c.id, label: c.name }))],
    [v.categories],
  )

  const checkpointOptionsForFinding: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'Ikke tilknyttet' },
      ...checkpoints.map((c) => ({ value: c.id, label: c.question_text.slice(0, 80) + (c.question_text.length > 80 ? '…' : '') })),
    ],
    [checkpoints],
  )

  const userOptions: SelectOption[] = useMemo(
    () => v.assignableUsers.map((u) => ({ value: u.id, label: u.displayName })),
    [v.assignableUsers],
  )

  const participantsCount = useMemo(
    () => (v.participantsByRunde[vernerundeId] ?? []).length,
    [v.participantsByRunde, vernerundeId],
  )

  const critFinding = useMemo(() => findings.some((f) => f.severity === 'critical'), [findings])
  const tabItems: TabItem[] = useMemo(
    () => [
      { id: 'planlegging', label: 'Planlegging' },
      { id: 'sjekkliste', label: 'Sjekkliste', badgeCount: checkpoints.length, badgeVariant: 'default' },
      { id: 'funn', label: 'Funn', badgeCount: findings.length, badgeVariant: critFinding ? 'danger' : 'default' },
      { id: 'deltakere_signatur', label: 'Deltakere & signatur', badgeCount: participantsCount, badgeVariant: 'default' },
    ],
    [checkpoints.length, findings, critFinding, participantsCount],
  )

  const savePlan = useCallback(async () => {
    if (!round) return
    await v.updateVernerunde(vernerundeId, {
      title: planTitle,
      template_id: planTemplate || null,
      planned_date: planDate || null,
      status: planStatus,
    })
  }, [v, vernerundeId, round, planTitle, planTemplate, planDate, planStatus])

  const importFromTemplate = useCallback(async () => {
    if (!round?.template_id || locked) return
    setImporting(true)
    try {
      const tid = round.template_id
      const toImport = (await v.loadTemplateItems(tid)) ?? []
      for (const it of toImport) {
        await v.addCheckpoint(vernerundeId, {
          question_text: it.question_text,
          original_template_item_id: it.id,
        })
      }
      if (toImport.length === 0) {
        v.setError('Malen har ingen punkter å importere. Legg inn punkter i admin eller legg til manuelt.')
      } else {
        void v.loadRoundChildren(vernerundeId)
      }
    } finally {
      setImporting(false)
    }
  }, [v, vernerundeId, round, locked])

  if (!vernerundeId) {
    return <p className="p-6 text-sm text-neutral-600">Manglende vernerunde-id.</p>
  }

  if (v.loading && !round) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-neutral-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Laster…
      </div>
    )
  }

  if (!round) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-sm text-neutral-700">Fant ikke vernerunden.</p>
        <Link to="/vernerunder" className="mt-2 inline-block text-sm font-medium text-[#1a3d32] underline">
          Tilbake til listen
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9F7F2]">
      <div className="border-b border-neutral-200/80 bg-[#F9F7F2]">
        <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
          <WorkplacePageHeading1
            breadcrumb={[
              { label: 'HMS', to: '/compliance' },
              { label: 'Vernerunder', to: '/vernerunder' },
              { label: round.title },
            ]}
            title={round.title}
            description="Sjekkliste, funn og deltakere for denne vernerunden."
            headerActions={
              <Badge variant={statusBadgeVariant(round.status)} className="px-3 py-1 text-xs">
                {STATUS_LABEL[round.status]}
              </Badge>
            }
            menu={
              <Tabs
                className="mt-1"
                items={tabItems}
                activeId={activeTab}
                onChange={(id) => setActiveTab(id as DetailTab)}
              />
            }
          />
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-6 md:px-8">
        <div className={`${WORKPLACE_MODULE_CARD} overflow-hidden`} style={WORKPLACE_MODULE_CARD_SHADOW}>
          <ComplianceBanner title="Arbeidsmiljøloven Kap. 3 — Vernerunder og Medvirkning">
            <p>Plan, gjennomfør og dokumenter vernerunden slik at ansatte medvirker og forholdene vurderes systematisk.</p>
          </ComplianceBanner>
          {v.error ? <div className="border-b border-amber-100"><WarningBox>{v.error}</WarningBox></div> : null}

          {activeTab === 'planlegging' && (
            <div className="border-t border-neutral-100 px-5 py-5 md:px-6">
              {v.canManage && !locked ? (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Grunnopplysninger</p>
                  <div className="grid max-w-3xl gap-4">
                    <div className={WPSTD_FORM_ROW_GRID}>
                      <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="vnr-title">
                        Tittel
                      </label>
                      <StandardInput id="vnr-title" value={planTitle} onChange={(e) => setPlanTitle(e.target.value)} />
                    </div>
                    <div className={WPSTD_FORM_ROW_GRID}>
                      <span className={WPSTD_FORM_FIELD_LABEL}>Mal</span>
                      <SearchableSelect value={planTemplate} options={templateOptions} onChange={setPlanTemplate} />
                    </div>
                    <div className={WPSTD_FORM_ROW_GRID}>
                      <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="vnr-date">
                        Planlagt dato
                      </label>
                      <StandardInput
                        id="vnr-date"
                        type="date"
                        value={planDate}
                        onChange={(e) => setPlanDate(e.target.value)}
                      />
                    </div>
                    <div className={WPSTD_FORM_ROW_GRID}>
                      <span className={WPSTD_FORM_FIELD_LABEL}>Status</span>
                      <SearchableSelect
                        value={planStatus}
                        options={STATUS_OPTIONS}
                        onChange={(val) => setPlanStatus(val as VernerunderRow['status'])}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
                      <Button type="button" variant="primary" onClick={() => void savePlan()}>
                        Lagre endringer
                      </Button>
                      {round.template_id ? (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={importing}
                          onClick={() => void importFromTemplate()}
                        >
                          {importing ? 'Importerer…' : 'Importer sjekkliste fra mal'}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-neutral-600">Du har ikke rettigheter til å endre, eller runden er låst.</p>
              )}
            </div>
          )}

          {activeTab === 'sjekkliste' && (
            <div className="border-t border-neutral-100">
              <LayoutTable1PostingsShell
                wrap={false}
                titleTypography="sans"
                title="Punkter"
                description="Gjennomgå hvert punkt under runden. Status i tråd med sjekklisten (snapshot). "
                headerActions={
                  v.canManage && !locked ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      icon={<Plus className="h-4 w-4" aria-hidden />}
                      onClick={() => setCkPanel({ mode: 'add' })}
                    >
                      Legg til
                    </Button>
                  ) : null
                }
                toolbar={
                  v.canManage && !locked && round.template_id && checkpoints.length === 0 ? (
                    <div className="text-xs text-neutral-500">Tips: I Planlegging kan du importere punkter fra valgt mal.</div>
                  ) : (
                    <span className="text-xs text-neutral-400" />
                  )}
              >
                {checkpoints.length === 0 ? (
                  <TabEmpty
                    icon={<ClipboardList className="h-7 w-7" strokeWidth={1.25} aria-hidden />}
                    title="Ingen sjekkpunkter ennå"
                    body="Importer fra mal i Planlegging, eller legg til manuelle punkter med knappen over."
                  />
                ) : (
                  <table className="w-full min-w-0 text-left text-sm text-neutral-800">
                    <thead>
                      <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                        <th className={LAYOUT_TABLE1_POSTINGS_TH}>Punkt</th>
                        <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
                        <th className={`${LAYOUT_TABLE1_POSTINGS_TH} w-24 text-right`} />
                      </tr>
                    </thead>
                    <tbody>
                      {checkpoints.map((c) => (
                        <tr key={c.id} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                          <td className="px-5 py-3 text-neutral-900">
                            <span className="line-clamp-2">{c.question_text}</span>
                          </td>
                          <td className="px-5 py-3">
                            {v.canManage && !locked ? (
                              <SearchableSelect
                                value={c.status}
                                options={CHECK_STATUS_OPTIONS}
                                onChange={(val) => {
                                  void v.updateCheckpoint(vernerundeId, c.id, { status: val as VernerundeCheckpointRow['status'] })
                                }}
                              />
                            ) : (
                              <Badge variant="neutral">{CHECKPOINT_STATUS_LABEL[c.status]}</Badge>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {v.canManage && !locked ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setCkPanel({ mode: 'edit', row: c })}
                                icon={<Pencil className="h-4 w-4" aria-hidden />}
                                aria-label="Rediger punkt"
                              />
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </LayoutTable1PostingsShell>
            </div>
          )}

          {activeTab === 'funn' && (
            <div className="space-y-3 border-t border-neutral-100 p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-end gap-2">
                {v.canManage && !locked ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    icon={<Plus className="h-4 w-4" aria-hidden />}
                    onClick={() => setFPanel({ mode: 'add' })}
                  >
                    Nytt funn
                  </Button>
                ) : null}
              </div>
              {findings.length === 0 ? (
                <TabEmpty
                  icon={<AlertTriangle className="h-7 w-7" strokeWidth={1.25} aria-hidden />}
                  title="Ingen funn"
                  body="Når avvik identifiseres, registrer dem her med alvorlighetsgrad og eventuell kobling til sjekkliste."
                />
              ) : (
                <ul className="space-y-2">
                  {findings.map((f) => (
                    <li
                      key={f.id}
                      className={`flex flex-col gap-2 rounded-lg border border-neutral-200/80 p-4 ${findingSeverityClass(f.severity)}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge variant={findingBadgeVariant(f.severity)}>{SEVERITY_LABEL[f.severity]}</Badge>
                        {v.canManage && !locked ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setFPanel({ mode: 'edit', row: f })}
                            icon={<Pencil className="h-4 w-4" />}
                            aria-label="Rediger funn"
                          />
                        ) : null}
                      </div>
                      <p className="text-sm text-neutral-900 whitespace-pre-wrap">{f.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'deltakere_signatur' && (
            <ParticipantsBlock v={v} vernerundeId={vernerundeId} locked={locked} userOptions={userOptions} />
          )}
        </div>
      </div>

      <CheckpointPanel
        panelKey={ckPanel ? (ckPanel.mode === 'edit' ? `e-${ckPanel.row.id}` : 'add') : 'x'}
        open={ckPanel != null}
        onClose={() => setCkPanel(null)}
        v={v}
        vernerundeId={vernerundeId}
        state={ckPanel}
        labelIds={{ q: ckQ, s: ckS }}
      />
      <FindingPanel
        panelKey={fPanel ? (fPanel.mode === 'edit' ? `e-${fPanel.row.id}` : 'add') : 'x'}
        open={fPanel != null}
        onClose={() => setFPanel(null)}
        v={v}
        vernerundeId={vernerundeId}
        round={round}
        state={fPanel}
        categoryOptions={categoryOptions}
        checkpointOptions={checkpointOptionsForFinding}
        labelIds={{ d: fDesc, sev: fSev, cp: fCp, cat: fCat }}
      />
    </div>
  )
}

function ParticipantsBlock({
  v,
  vernerundeId,
  locked,
  userOptions,
}: {
  v: ReturnType<typeof useVernerunde>
  vernerundeId: string
  locked: boolean
  userOptions: SelectOption[]
}) {
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState<VernerundeParticipantRow['role']>('manager')
  const list = v.participantsByRunde[vernerundeId] ?? []
  const displayByUserId = useMemo(() => {
    const m: Record<string, string> = {}
    for (const u of v.assignableUsers) m[u.id] = u.displayName
    return m
  }, [v.assignableUsers])

  return (
    <div className="border-t border-neutral-100 px-5 py-5 md:px-6">
      {v.canManage && !locked ? (
        <div className="mb-6 max-w-3xl space-y-3 rounded-lg border border-neutral-100 bg-neutral-50/50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Legg til deltaker</p>
          <div className={WPSTD_FORM_ROW_GRID}>
            <span className={WPSTD_FORM_FIELD_LABEL}>Bruker</span>
            <SearchableSelect value={userId} options={userOptions} onChange={setUserId} placeholder="Velg bruker" />
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <span className={WPSTD_FORM_FIELD_LABEL}>Rolle</span>
            <SearchableSelect
              value={role}
              options={ROLE_OPTIONS}
              onChange={(r) => setRole(r as VernerundeParticipantRow['role'])}
            />
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={<UserPlus className="h-4 w-4" aria-hidden />}
            onClick={async () => {
              if (!userId) {
                v.setError('Velg en bruker.')
                return
              }
              await v.addParticipant(vernerundeId, { user_id: userId, role })
              setUserId('')
            }}
          >
            Legg til
          </Button>
        </div>
      ) : null}

      {list.length === 0 ? (
        <TabEmpty
          icon={<Sparkles className="h-7 w-7" strokeWidth={1.25} aria-hidden />}
          title="Ingen deltakere"
          body="Registrer leder, HMS/verneombud og ansatt som deltar i runden, og sørg for at signatur registreres når runden avsluttes."
        />
      ) : (
        <table className="w-full min-w-0 text-left text-sm text-neutral-800">
          <thead>
            <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Rolle</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Bruker</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Signert</th>
              <th className={`${LAYOUT_TABLE1_POSTINGS_TH} w-28 text-right`} />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                <td className="px-5 py-3">{PARTICIPANT_ROLE_LABEL[p.role]}</td>
                <td className="px-5 py-3 text-neutral-900">
                  {displayByUserId[p.user_id] ?? p.user_id}
                </td>
                <td className="px-5 py-3 text-neutral-600">
                  {p.signed_at ? <Badge variant="signed">Signert</Badge> : <Badge variant="warning">Mangler</Badge>}
                </td>
                <td className="px-5 py-3 text-right">
                  {v.canManage && !locked ? (
                    <div className="inline-flex items-center gap-1">
                      {!p.signed_at ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => void v.signParticipant(p.id, vernerundeId)}
                          icon={<PenLine className="h-3.5 w-3.5" />}
                        >
                          Signer
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => void v.deleteParticipant(p.id, vernerundeId)}
                        icon={<Trash2 className="h-4 w-4" />}
                        aria-label="Fjern"
                      />
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function CheckpointPanel({
  panelKey,
  open,
  onClose,
  v,
  vernerundeId,
  state,
  labelIds,
}: {
  panelKey: string
  open: boolean
  onClose: () => void
  v: ReturnType<typeof useVernerunde>
  vernerundeId: string
  state: { mode: 'add' } | { mode: 'edit'; row: VernerundeCheckpointRow } | null
  labelIds: { q: string; s: string }
}) {
  if (!open || !state) return null
  const isEdit = state.mode === 'edit'
  return (
    <CheckpointPanelForm
      key={panelKey}
      isEdit={isEdit}
      v={v}
      vernerundeId={vernerundeId}
      onClose={onClose}
      state={state}
      labelIds={labelIds}
    />
  )
}

function CheckpointPanelForm({
  isEdit,
  v,
  vernerundeId,
  onClose,
  state,
  labelIds,
}: {
  isEdit: boolean
  v: ReturnType<typeof useVernerunde>
  vernerundeId: string
  onClose: () => void
  state: { mode: 'add' } | { mode: 'edit'; row: VernerundeCheckpointRow }
  labelIds: { q: string; s: string }
}) {
  const [q, setQ] = useState(() => (isEdit && state.mode === 'edit' ? state.row.question_text : ''))
  const [s, setS] = useState<VernerundeCheckpointRow['status']>(() =>
    isEdit && state.mode === 'edit' ? state.row.status : 'ok',
  )
  return (
    <WorkplaceStandardFormPanel
      open
      onClose={onClose}
      titleId="vnr-ck-panel-title"
      title={isEdit ? 'Rediger sjekkpunkt' : 'Nytt sjekkpunkt'}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={async () => {
              if (!q.trim()) {
                v.setError('Spørsmålstekst er påkrevd.')
                return
              }
              if (isEdit && state.mode === 'edit') {
                await v.updateCheckpoint(vernerundeId, state.row.id, { question_text: q, status: s })
              } else {
                await v.addCheckpoint(vernerundeId, { question_text: q })
              }
              onClose()
            }}
          >
            {isEdit ? 'Lagre' : 'Opprett'}
          </Button>
        </div>
      }
    >
      <div className={WPSTD_FORM_ROW_GRID}>
        <label className={WPSTD_FORM_FIELD_LABEL} htmlFor={labelIds.q}>
          Sjekkspørsmål
        </label>
        <StandardTextarea
          className="min-h-[100px]"
          id={labelIds.q}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {isEdit ? (
        <div className={WPSTD_FORM_ROW_GRID}>
          <span className={WPSTD_FORM_FIELD_LABEL} id={labelIds.s}>
            Status
          </span>
          <SearchableSelect
            value={s}
            options={CHECK_STATUS_OPTIONS}
            onChange={(v2) => setS(v2 as VernerundeCheckpointRow['status'])}
          />
        </div>
      ) : null}
    </WorkplaceStandardFormPanel>
  )
}

function FindingPanel({
  panelKey,
  open,
  onClose,
  v,
  vernerundeId,
  round,
  state,
  categoryOptions,
  checkpointOptions,
  labelIds,
}: {
  panelKey: string
  open: boolean
  onClose: () => void
  v: ReturnType<typeof useVernerunde>
  vernerundeId: string
  round: VernerunderRow
  state: { mode: 'add' } | { mode: 'edit'; row: VernerundeFindingRow } | null
  categoryOptions: SelectOption[]
  checkpointOptions: SelectOption[]
  labelIds: { d: string; sev: string; cp: string; cat: string }
}) {
  if (!open || !state) return null
  const isEdit = state.mode === 'edit'
  return (
    <FindingPanelForm
      key={panelKey}
      isEdit={isEdit}
      v={v}
      vernerundeId={vernerundeId}
      round={round}
      onClose={onClose}
      state={state}
      categoryOptions={categoryOptions}
      checkpointOptions={checkpointOptions}
      labelIds={labelIds}
    />
  )
}

function FindingPanelForm({
  isEdit,
  v,
  vernerundeId,
  round,
  onClose,
  state,
  categoryOptions,
  checkpointOptions,
  labelIds,
}: {
  isEdit: boolean
  v: ReturnType<typeof useVernerunde>
  vernerundeId: string
  round: VernerunderRow
  onClose: () => void
  state: { mode: 'add' } | { mode: 'edit'; row: VernerundeFindingRow }
  categoryOptions: SelectOption[]
  checkpointOptions: SelectOption[]
  labelIds: { d: string; sev: string; cp: string; cat: string }
}) {
  const [d, setD] = useState(() =>
    isEdit && state.mode === 'edit' ? state.row.description : '',
  )
  const [sev, setSev] = useState<VernerundeFindingRow['severity']>(() =>
    isEdit && state.mode === 'edit' ? state.row.severity : 'medium',
  )
  const [cp, setCp] = useState(() =>
    isEdit && state.mode === 'edit' ? (state.row.checkpoint_id ?? '') : '',
  )
  const [cat, setCat] = useState(() =>
    isEdit && state.mode === 'edit' ? (state.row.category_id ?? '') : '',
  )

  return (
    <WorkplaceStandardFormPanel
      open
      onClose={onClose}
      titleId="vnr-fn-panel-title"
      title={isEdit ? 'Rediger funn' : 'Nytt funn'}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={async () => {
              if (!d.trim()) {
                v.setError('Beskrivelse er påkrevd.')
                return
              }
              if (isEdit && state.mode === 'edit') {
                const row = state.row
                await v.updateFinding(vernerundeId, row.id, {
                  description: d,
                  severity: sev,
                  checkpoint_id: cp || null,
                  category_id: cat || null,
                })
                const org = v.organizationId ?? round.organization_id
                void v.dispatchVernerunderWorkflow('ON_FINDING_UPDATED', {
                  source_module: 'vernerunder',
                  source_id: row.id,
                  row: {
                    id: row.id,
                    organization_id: org,
                    vernerunde_id: vernerundeId,
                    description: d,
                    severity: sev,
                    checkpoint_id: cp || null,
                    category_id: cat || null,
                    updated_at: new Date().toISOString(),
                    created_at: row.created_at,
                  },
                })
              } else {
                const created = await v.addFinding(vernerundeId, {
                  description: d,
                  severity: sev,
                  checkpoint_id: cp || null,
                  category_id: cat || null,
                })
                if (created) {
                  await v.dispatchVernerunderWorkflow('ON_FINDING_REGISTERED', {
                    source_module: 'vernerunder',
                    source_id: created.id,
                    row: {
                      id: created.id,
                      organization_id: created.organization_id,
                      vernerunde_id: vernerundeId,
                      description: created.description,
                      severity: created.severity,
                      checkpoint_id: created.checkpoint_id,
                      category_id: created.category_id,
                      created_at: created.created_at,
                      updated_at: created.updated_at,
                    },
                  })
                }
              }
              onClose()
            }}
          >
            {isEdit ? 'Lagre' : 'Registrer'}
          </Button>
        </div>
      }
    >
      <div className={WPSTD_FORM_ROW_GRID}>
        <label className={WPSTD_FORM_FIELD_LABEL} htmlFor={labelIds.d}>
          Beskrivelse
        </label>
        <StandardTextarea
          className="min-h-[120px]"
          id={labelIds.d}
          value={d}
          onChange={(e) => setD(e.target.value)}
        />
      </div>
      <div className={WPSTD_FORM_ROW_GRID}>
        <span className={WPSTD_FORM_FIELD_LABEL} id={labelIds.sev}>
          Alvorlighet
        </span>
        <SearchableSelect
          value={sev}
          options={SEVERITY_OPTIONS}
          onChange={(v2) => setSev(v2 as VernerundeFindingRow['severity'])}
        />
      </div>
      <div className={WPSTD_FORM_ROW_GRID}>
        <span className={WPSTD_FORM_FIELD_LABEL}>Sjekkpunkt</span>
        <SearchableSelect value={cp} options={checkpointOptions} onChange={setCp} />
      </div>
      <div className={WPSTD_FORM_ROW_GRID}>
        <span className={WPSTD_FORM_FIELD_LABEL}>Kategori</span>
        <SearchableSelect value={cat} options={categoryOptions} onChange={setCat} />
      </div>
    </WorkplaceStandardFormPanel>
  )
}

