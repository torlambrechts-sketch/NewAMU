import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, X } from 'lucide-react'
import { Table1Shell } from '../layout/Table1Shell'
import { Table1Toolbar } from '../layout/Table1Toolbar'
import { WorkplaceSerifSectionTitle } from '../layout/WorkplacePageHeading1'
import { WORKPLACE_LAYOUT_BOX_CARD, WORKPLACE_LAYOUT_BOX_SHADOW } from '../layout/workplaceLayoutKit'
import { WORKPLACE_LIST_LAYOUT_CTA } from '../layout/WorkplaceStandardListLayout'
import { WORKPLACE_CASE_CATEGORIES, categoryDef } from '../../data/workplaceCaseCategories'
import { useWorkplaceReportingCases } from '../../hooks/useWorkplaceReportingCases'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useUiTheme } from '../../hooks/useUiTheme'
import {
  mergeLayoutPayload,
  table1BodyRowClass,
  table1CellPadding,
  table1HeaderRowClass,
} from '../../lib/layoutLabTokens'
import { canEditWorkplaceCaseStatus, canViewWorkplaceCase } from '../../lib/workplaceCaseAccess'
import type { WorkplaceCase, WorkplaceCaseCategory, WorkplaceCaseDetails, WorkplaceCaseStatus } from '../../types/workplaceReportingCase'

const R_FLAT = 'rounded-none'
const HERO_ACTION =
  'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-medium leading-none text-white shadow-sm hover:opacity-95'
const INPUT =
  'mt-1.5 w-full rounded-none border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-none focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900'
const LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-800'
const PANEL_GRID =
  'grid grid-cols-1 gap-4 border-b border-neutral-200 px-4 py-4 last:border-b-0 md:grid-cols-[minmax(0,38%)_minmax(0,62%)] md:items-start md:gap-8 md:px-5 md:py-5'
const INSET = `${R_FLAT} border border-neutral-200/90 bg-[#f4f1ea] p-5 sm:p-6`

const STATUS_LABELS: Record<WorkplaceCaseStatus, string> = {
  received: 'Mottatt',
  triage: 'Vurdering',
  in_progress: 'Under arbeid',
  closed: 'Lukket',
}

type PanelMode = 'closed' | 'pick' | 'create' | 'view'

function formatShort(iso: string) {
  try {
    return new Date(iso).toLocaleString('no-NO', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

const emptyDetails = (): WorkplaceCaseDetails => ({})

export function WorkplaceReportingCasesSection() {
  const [searchParams, setSearchParams] = useSearchParams()
  const wr = useWorkplaceReportingCases()
  const { user, isAdmin, permissionKeys } = useOrgSetupContext()
  const { payload: layoutPayload } = useUiTheme()
  const layout = mergeLayoutPayload(layoutPayload)
  const tableCell = `${table1CellPadding(layout)} align-middle text-sm text-neutral-800`
  const theadRow = table1HeaderRowClass(layout)

  const viewerCtx = useMemo(
    () => ({
      userId: user?.id,
      isAdmin: Boolean(isAdmin),
      isCommittee: permissionKeys.has('whistleblowing.committee'),
    }),
    [user?.id, isAdmin, permissionKeys],
  )

  const visibleCases = useMemo(
    () => wr.cases.filter((c) => canViewWorkplaceCase(c, viewerCtx)),
    [wr.cases, viewerCtx],
  )

  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return visibleCases
    return visibleCases.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        (categoryDef(c.category)?.labelNb ?? '').toLowerCase().includes(q),
    )
  }, [visibleCases, search])

  const [panelMode, setPanelMode] = useState<PanelMode>('closed')
  const [viewId, setViewId] = useState<string | null>(null)
  const [category, setCategory] = useState<WorkplaceCaseCategory | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [confidential, setConfidential] = useState(false)
  const [details, setDetails] = useState<WorkplaceCaseDetails>(emptyDetails)
  const [statusEdit, setStatusEdit] = useState<WorkplaceCaseStatus>('received')

  const resetCreateForm = useCallback(() => {
    setCategory(null)
    setTitle('')
    setDescription('')
    setConfidential(false)
    setDetails(emptyDetails())
  }, [])

  const openNew = useCallback(() => {
    resetCreateForm()
    setViewId(null)
    setPanelMode('pick')
  }, [resetCreateForm])

  useEffect(() => {
    if (searchParams.get('newCase') !== '1') return
    queueMicrotask(() => {
      openNew()
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('newCase')
          return next
        },
        { replace: true },
      )
    })
  }, [searchParams, setSearchParams, openNew])

  const closePanel = useCallback(() => {
    setPanelMode('closed')
    setViewId(null)
    resetCreateForm()
  }, [resetCreateForm])

  const viewing = viewId ? wr.cases.find((c) => c.id === viewId) : undefined

  useEffect(() => {
    if (panelMode === 'closed') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [panelMode])

  useEffect(() => {
    if (panelMode === 'closed') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelMode, closePanel])

  const pickCategory = (id: WorkplaceCaseCategory) => {
    setCategory(id)
    setPanelMode('create')
    if (id === 'coworkers' || id === 'ethics') setConfidential(true)
  }

  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!category || !title.trim() || !description.trim()) return
    wr.addCase({
      category,
      title,
      description,
      details,
      confidential,
    })
    closePanel()
  }

  const openView = (c: WorkplaceCase) => {
    if (!canViewWorkplaceCase(c, viewerCtx)) return
    setViewId(c.id)
    setStatusEdit(c.status)
    setPanelMode('view')
  }

  const patchDetail = (key: keyof WorkplaceCaseDetails, value: string) => {
    setDetails((d) => ({ ...d, [key]: value }))
  }

  const renderExtraFields = () => {
    if (!category) return null
    switch (category) {
      case 'work_environment':
        return (
          <div>
            <label className={LABEL} htmlFor="wr-loc">
              Sted / avdeling / arbeidsområde
            </label>
            <input
              id="wr-loc"
              value={details.locationOrUnit ?? ''}
              onChange={(e) => patchDetail('locationOrUnit', e.target.value)}
              className={INPUT}
              placeholder="F.eks. Kantine, lager, kontor 2B"
            />
          </div>
        )
      case 'coworkers':
        return (
          <div>
            <label className={LABEL} htmlFor="wr-rel">
              Tema eller relasjon (uten navn hvis mulig)
            </label>
            <textarea
              id="wr-rel"
              rows={3}
              value={details.relationshipOrTheme ?? ''}
              onChange={(e) => patchDetail('relationshipOrTheme', e.target.value)}
              className={INPUT}
              placeholder="Beskriv situasjonen uten å identifisere personer unødig."
            />
          </div>
        )
      case 'health_safety':
        return (
          <div className="space-y-4">
            <div>
              <label className={LABEL} htmlFor="wr-risk">
                Fare / konsekvens
              </label>
              <textarea
                id="wr-risk"
                rows={2}
                value={details.riskOrConsequence ?? ''}
                onChange={(e) => patchDetail('riskOrConsequence', e.target.value)}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="wr-imm">
                Eksisterende eller foreslåtte tiltak
              </label>
              <textarea
                id="wr-imm"
                rows={2}
                value={details.immediateMeasures ?? ''}
                onChange={(e) => patchDetail('immediateMeasures', e.target.value)}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="wr-loc2">
                Sted / prosess
              </label>
              <input
                id="wr-loc2"
                value={details.locationOrUnit ?? ''}
                onChange={(e) => patchDetail('locationOrUnit', e.target.value)}
                className={INPUT}
              />
            </div>
          </div>
        )
      case 'management':
        return (
          <div>
            <label className={LABEL} htmlFor="wr-mgmt">
              Ledelseskontekst
            </label>
            <textarea
              id="wr-mgmt"
              rows={3}
              value={details.managementContext ?? ''}
              onChange={(e) => patchDetail('managementContext', e.target.value)}
              className={INPUT}
              placeholder="Hva forventet du, og hva skjedde?"
            />
          </div>
        )
      case 'ethics':
        return (
          <div>
            <label className={LABEL} htmlFor="wr-eth">
              Etisk problemstilling
            </label>
            <textarea
              id="wr-eth"
              rows={3}
              value={details.ethicalQuestion ?? ''}
              onChange={(e) => patchDetail('ethicalQuestion', e.target.value)}
              className={INPUT}
            />
          </div>
        )
      case 'policy_violation':
        return (
          <div>
            <label className={LABEL} htmlFor="wr-pol">
              Retningslinje / policy (referanse)
            </label>
            <input
              id="wr-pol"
              value={details.policyReference ?? ''}
              onChange={(e) => patchDetail('policyReference', e.target.value)}
              className={INPUT}
              placeholder="F.eks. HMS-håndbok kap. 4, IT-policy …"
            />
          </div>
        )
      default:
        return (
          <p className="text-sm text-neutral-600">
            Beskriv saken så konkret som mulig. Du kan markere saken som konfidensiell nedenfor.
          </p>
        )
    }
  }

  return (
    <>
      <div className="mt-10 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <WorkplaceSerifSectionTitle>Saker (internt)</WorkplaceSerifSectionTitle>
          <button
            type="button"
            onClick={openNew}
            className={`${HERO_ACTION} gap-2`}
            style={{ backgroundColor: WORKPLACE_LIST_LAYOUT_CTA }}
          >
            <Plus className="size-4 shrink-0" />
            + Ny sak
          </button>
        </div>
        {wr.error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{wr.error}</p>
        ) : null}
        {wr.loading ? <p className="text-sm text-neutral-500">Laster saker…</p> : null}

        <div className={`${WORKPLACE_LAYOUT_BOX_CARD} p-0`} style={WORKPLACE_LAYOUT_BOX_SHADOW}>
          <div className="border-b border-neutral-100 px-5 py-4">
            <WorkplaceSerifSectionTitle as="h3" variant="compact">
              Alle saker
            </WorkplaceSerifSectionTitle>
            <p className="mt-1 text-sm text-neutral-600">
              {viewerCtx.isAdmin || viewerCtx.isCommittee
                ? 'Du ser alle saker i organisasjonen. Andre brukere ser kun egne konfidensielle saker og alle ikke-konfidensielle.'
                : 'Konfidensielle saker vises kun for deg og for administrator / varslingsmottak.'}
            </p>
          </div>
          <Table1Shell
            variant="pinpoint"
            toolbar={
              <Table1Toolbar
                searchSlot={
                  <div className="min-w-[200px] flex-1">
                    <label className="sr-only" htmlFor="wr-case-search">
                      Søk
                    </label>
                    <input
                      id="wr-case-search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Søk i tittel, beskrivelse, kategori …"
                      className={INPUT}
                    />
                  </div>
                }
              />
            }
          >
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left">
                <thead>
                  <tr className={theadRow}>
                    <th className={tableCell}>Registrert</th>
                    <th className={tableCell}>Kategori</th>
                    <th className={tableCell}>Tittel</th>
                    <th className={tableCell}>Status</th>
                    <th className={tableCell}>Konfidensiell</th>
                    <th className={`${tableCell} text-right`}>Handling</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, ri) => (
                    <tr key={c.id} className={table1BodyRowClass(layout, ri)}>
                      <td className={`${tableCell} text-neutral-600`}>{formatShort(c.createdAt)}</td>
                      <td className={tableCell}>{categoryDef(c.category)?.labelNb ?? c.category}</td>
                      <td className={tableCell}>
                        <div className="max-w-[240px] font-medium text-neutral-900">{c.title}</div>
                      </td>
                      <td className={tableCell}>
                        <span className={`${R_FLAT} border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs`}>
                          {STATUS_LABELS[c.status]}
                        </span>
                      </td>
                      <td className={tableCell}>{c.confidential ? 'Ja' : 'Nei'}</td>
                      <td className={`${tableCell} text-right`}>
                        <button
                          type="button"
                          onClick={() => openView(c)}
                          className={`${R_FLAT} inline-flex h-9 items-center border border-neutral-300 bg-white px-3 text-sm text-neutral-800 hover:bg-neutral-50`}
                        >
                          Åpne
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-neutral-500">Ingen saker å vise.</p>
            ) : null}
          </Table1Shell>
        </div>
      </div>

      {panelMode !== 'closed' ? (
        <>
          <button
            type="button"
            aria-label="Lukk"
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={closePanel}
          />
          <aside className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-[640px] flex-col border-l border-neutral-200 bg-[#f7f6f2] shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 bg-[#f7f6f2] px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">
                  {panelMode === 'pick' && 'Ny sak'}
                  {panelMode === 'create' && 'Utfyll skjema'}
                  {panelMode === 'view' && (viewing?.title ?? 'Sak')}
                </h2>
                <p className="text-xs text-neutral-500">
                  {panelMode === 'pick' && 'Velg hva saken gjelder'}
                  {panelMode === 'create' && category ? categoryDef(category)?.labelNb : null}
                  {panelMode === 'view' && viewing ? categoryDef(viewing.category)?.labelNb : null}
                </p>
              </div>
              <button type="button" onClick={closePanel} className={`${R_FLAT} p-2 text-neutral-500 hover:bg-neutral-100`}>
                <X className="size-5" />
              </button>
            </div>

            {panelMode === 'pick' ? (
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
                <p className="text-base font-semibold text-[#1a3d32]">Hva gjelder bekymringen?</p>
                <p className="mt-1 text-sm text-neutral-600">Velg den kategorien som passer best — du kan utdype i neste steg.</p>
                <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {WORKPLACE_CASE_CATEGORIES.map((c) => {
                    const Icon = c.icon
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => pickCategory(c.id)}
                        className="flex flex-col items-center gap-2 rounded-none border border-neutral-200 bg-white p-4 text-center transition hover:border-[#1a3d32] hover:shadow-sm"
                      >
                        <span className="flex size-14 items-center justify-center rounded-full border-2 border-[#1e3a5f] bg-[#1e3a5f]/10 text-[#1e3a5f]">
                          <Icon className="size-7" aria-hidden />
                        </span>
                        <span className="text-xs font-medium leading-tight text-neutral-800">{c.labelNb}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {panelMode === 'create' && category ? (
              <form className="flex min-h-0 flex-1 flex-col" onSubmit={submitCreate}>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                  <div className={PANEL_GRID}>
                    <div>
                      <h3 className="text-base font-semibold text-neutral-900">Grunnleggende</h3>
                      <p className="mt-2 text-sm text-neutral-600">{categoryDef(category)?.shortHint}</p>
                    </div>
                    <div className={INSET}>
                      <div>
                        <label className={LABEL} htmlFor="wr-title">
                          Tittel *
                        </label>
                        <input
                          id="wr-title"
                          required
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className={INPUT}
                        />
                      </div>
                      <div className="mt-4">
                        <label className={LABEL} htmlFor="wr-desc">
                          Beskrivelse *
                        </label>
                        <textarea
                          id="wr-desc"
                          required
                          rows={5}
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className={INPUT}
                        />
                      </div>
                    </div>
                  </div>

                  <div className={PANEL_GRID}>
                    <div>
                      <h3 className="text-base font-semibold text-neutral-900">Tillegg for denne kategorien</h3>
                    </div>
                    <div className={INSET}>{renderExtraFields()}</div>
                  </div>

                  <div className={PANEL_GRID}>
                    <div>
                      <h3 className="text-base font-semibold text-neutral-900">Synlighet</h3>
                      <p className="mt-2 text-sm text-neutral-600">
                        Konfidensielle saker er kun synlige for deg og for administrator / varslingsmottak (samme rolle som
                        varslingssaker).
                      </p>
                    </div>
                    <div className={INSET}>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={confidential}
                          onChange={(e) => setConfidential(e.target.checked)}
                          className="size-4 rounded border-neutral-300"
                        />
                        Konfidensiell sak
                      </label>
                    </div>
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap justify-between gap-2 border-t border-neutral-200 bg-[#f0efe9] px-5 py-4">
                  <button
                    type="button"
                    onClick={() => {
                      resetCreateForm()
                      setPanelMode('pick')
                    }}
                    className={`${R_FLAT} border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-800`}
                  >
                    ← Velg kategori på nytt
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={closePanel}
                      className={`${R_FLAT} border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-800`}
                    >
                      Avbryt
                    </button>
                    <button type="submit" className={`${R_FLAT} bg-[#1a3d32] px-4 py-2 text-sm text-white hover:bg-[#142e26]`}>
                      Registrer sak
                    </button>
                  </div>
                </div>
              </form>
            ) : null}

            {panelMode === 'view' && viewing && canViewWorkplaceCase(viewing, viewerCtx) ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                  <div className={PANEL_GRID}>
                    <div>
                      <h3 className="text-base font-semibold text-neutral-900">Status</h3>
                    </div>
                    <div className={INSET}>
                      {canEditWorkplaceCaseStatus(viewing, viewerCtx) ? (
                        <div>
                          <label className={LABEL} htmlFor="wr-status">
                            Oppdater status
                          </label>
                          <select
                            id="wr-status"
                            value={statusEdit}
                            onChange={(e) => {
                              const v = e.target.value as WorkplaceCaseStatus
                              setStatusEdit(v)
                              wr.updateCase(viewing.id, { status: v })
                            }}
                            className={INPUT}
                          >
                            {(Object.keys(STATUS_LABELS) as WorkplaceCaseStatus[]).map((k) => (
                              <option key={k} value={k}>
                                {STATUS_LABELS[k]}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <p className="text-sm text-neutral-700">
                          Status: <strong>{STATUS_LABELS[viewing.status]}</strong>
                        </p>
                      )}
                      <p className="mt-3 text-xs text-neutral-500">
                        Registrert {formatShort(viewing.createdAt)}
                        {viewing.confidential ? ' · Konfidensiell' : ''}
                      </p>
                    </div>
                  </div>
                  <div className={PANEL_GRID}>
                    <div>
                      <h3 className="text-base font-semibold text-neutral-900">Innhold</h3>
                    </div>
                    <div className={INSET}>
                      <p className="text-sm font-semibold text-neutral-900">{viewing.title}</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">{viewing.description}</p>
                      {Object.entries(viewing.details).some(([, v]) => String(v ?? '').trim()) ? (
                        <ul className="mt-4 space-y-2 border-t border-neutral-200 pt-4 text-sm text-neutral-600">
                          {viewing.details.locationOrUnit ? (
                            <li>
                              <span className="font-medium text-neutral-800">Sted / avdeling:</span> {viewing.details.locationOrUnit}
                            </li>
                          ) : null}
                          {viewing.details.relationshipOrTheme ? (
                            <li>
                              <span className="font-medium text-neutral-800">Tema:</span> {viewing.details.relationshipOrTheme}
                            </li>
                          ) : null}
                          {viewing.details.riskOrConsequence ? (
                            <li>
                              <span className="font-medium text-neutral-800">Fare / konsekvens:</span>{' '}
                              {viewing.details.riskOrConsequence}
                            </li>
                          ) : null}
                          {viewing.details.immediateMeasures ? (
                            <li>
                              <span className="font-medium text-neutral-800">Tiltak:</span> {viewing.details.immediateMeasures}
                            </li>
                          ) : null}
                          {viewing.details.managementContext ? (
                            <li>
                              <span className="font-medium text-neutral-800">Ledelse:</span> {viewing.details.managementContext}
                            </li>
                          ) : null}
                          {viewing.details.ethicalQuestion ? (
                            <li>
                              <span className="font-medium text-neutral-800">Etikk:</span> {viewing.details.ethicalQuestion}
                            </li>
                          ) : null}
                          {viewing.details.policyReference ? (
                            <li>
                              <span className="font-medium text-neutral-800">Policy:</span> {viewing.details.policyReference}
                            </li>
                          ) : null}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="border-t border-neutral-200 bg-[#f0efe9] px-5 py-4 text-right">
                  <button
                    type="button"
                    onClick={closePanel}
                    className={`${R_FLAT} border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-800`}
                  >
                    Lukk
                  </button>
                </div>
              </div>
            ) : null}
          </aside>
        </>
      ) : null}
    </>
  )
}
