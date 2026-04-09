import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { GripVertical, LayoutDashboard, Loader2, Pencil, Plus, Save, X } from 'lucide-react'
import { useOrganisation } from '../hooks/useOrganisation'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { useReporting } from '../hooks/useReporting'
import { useTasks } from '../hooks/useTasks'
import { useUiTheme } from '../hooks/useUiTheme'
import { useWorkplaceDashboard } from '../hooks/useWorkplaceDashboard'
import { mergeLayoutPayload } from '../lib/layoutLabTokens'
import { buildReportDatasets } from '../lib/reportDatasets'
import type { ReportDatasetKey } from '../types/reportBuilder'
import type { DashboardColSpan, WorkplaceDashboardTab } from '../types/dashboardLayout'
import {
  addColumnToLastRow,
  addRow,
  assignModuleToCell,
  createDefaultTab,
  moduleById,
  moveModuleBetweenCells,
  moveRow,
  placedModuleIds,
  removeRow,
  setCellSpan,
} from '../lib/dashboardLayoutHelpers'
import { ReportModuleWidget } from '../components/reports/ReportModuleWidget'
import { ReportModuleDesigner } from '../components/dashboard/ReportModuleDesigner'
import { WorkplaceReportingHubMenu } from '../components/workplace/WorkplaceReportingHubMenu'

const PAGE = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'
const R = 'rounded-none'
const BTN =
  'inline-flex h-9 items-center justify-center gap-2 rounded-none border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 hover:bg-neutral-50'
const BTN_PRI =
  'inline-flex h-9 items-center justify-center gap-2 rounded-none border border-[#1a3d32] bg-[#1a3d32] px-3 text-sm font-medium text-white hover:bg-[#142e26]'

const SPAN_OPTIONS: DashboardColSpan[] = [12, 6, 4, 3, 2, 1]

const DT_MODULE = 'application/x-atics-dashboard-module'
const DT_CELL = 'application/x-atics-dashboard-cell'

type CellDragPayload = { rowId: string; cellId: string }

function collectDatasetKeys(tab: WorkplaceDashboardTab): ReportDatasetKey[] {
  const s = new Set<ReportDatasetKey>()
  for (const m of tab.inventory) s.add(m.datasetKey)
  for (const row of tab.rows) {
    for (const c of row.cells) {
      const mod = moduleById(tab, c.moduleId)
      if (mod) s.add(mod.datasetKey)
    }
  }
  return [...s]
}

export function WorkplaceDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { supabaseConfigured } = useOrgSetupContext()
  const org = useOrganisation()
  const rep = useReporting()
  const { tasks } = useTasks()
  const { payload: layoutPayload } = useUiTheme()
  const layout = mergeLayoutPayload(layoutPayload)
  const accent = layout.accent

  const wd = useWorkplaceDashboard()
  const [editMode, setEditMode] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveHint, setSaveHint] = useState<string | null>(null)
  const year = new Date().getFullYear()
  const [y, setY] = useState(year)
  const [datasets, setDatasets] = useState<Record<string, unknown>>({})
  const [dataLoading, setDataLoading] = useState(false)

  const activeTabIdParam = searchParams.get('dashTab')

  useEffect(() => {
    if (wd.payload.tabs.length > 0) return
    wd.setPayloadAndPersist((p) => {
      if (p.tabs.length > 0) return p
      const t = createDefaultTab('Oversikt')
      return { tabs: [t], activeTabId: t.id }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once when empty; wd identity changes each render
  }, [wd.payload.tabs.length, wd.setPayloadAndPersist])

  const activeTab = useMemo(() => {
    const tabs = wd.payload.tabs
    if (tabs.length === 0) return null
    const byParam = activeTabIdParam ? tabs.find((t) => t.id === activeTabIdParam) : null
    const byStored = wd.payload.activeTabId ? tabs.find((t) => t.id === wd.payload.activeTabId) : null
    return byParam ?? byStored ?? tabs[0]!
  }, [wd.payload, activeTabIdParam])

  useEffect(() => {
    if (!activeTab) return
    if (activeTabIdParam === activeTab.id) return
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        n.set('dashTab', activeTab.id)
        return n
      },
      { replace: true },
    )
  }, [activeTab, activeTabIdParam, setSearchParams])

  const refreshData = useCallback(async () => {
    if (!activeTab) return
    setDataLoading(true)
    try {
      const keys = collectDatasetKeys(activeTab)
      const data = await buildReportDatasets({
        keys,
        year: y,
        org: {
          settings: org.settings,
          employees: org.employees,
          units: org.units,
        },
        tasks,
        fetchAmuAnnual: rep.fetchAmuAnnual,
        fetchAnnualIk: rep.fetchAnnualIk,
        fetchArp: rep.fetchArp,
        fetchSickByDept: rep.fetchSickByDept,
        fetchCorrelation: rep.fetchCorrelation,
        fetchCostFriction: rep.fetchCostFriction,
        fetchComplianceScore: rep.fetchComplianceScore,
      })
      setDatasets(data)
    } catch (e) {
      console.error(e)
    } finally {
      setDataLoading(false)
    }
  }, [activeTab, y, org.settings, org.employees, org.units, tasks, rep])

  useEffect(() => {
    void refreshData()
  }, [refreshData])

  function setActiveTabId(id: string) {
    wd.setPayloadAndPersist((p) => ({ ...p, activeTabId: id }))
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        n.set('dashTab', id)
        return n
      },
      { replace: true },
    )
  }

  function updateActiveTab(updater: (t: WorkplaceDashboardTab) => WorkplaceDashboardTab) {
    if (!activeTab) return
    wd.setPayloadAndPersist((p) => ({
      ...p,
      tabs: p.tabs.map((t) => (t.id === activeTab.id ? updater(t) : t)),
      activeTabId: p.activeTabId,
    }))
  }

  function addTab() {
    const t = createDefaultTab(`Fane ${wd.payload.tabs.length + 1}`)
    wd.setPayloadAndPersist((p) => ({
      ...p,
      tabs: [...p.tabs, t],
      activeTabId: t.id,
    }))
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        n.set('dashTab', t.id)
        return n
      },
      { replace: true },
    )
  }

  function deleteTab(id: string) {
    wd.setPayloadAndPersist((p) => {
      const next = p.tabs.filter((t) => t.id !== id)
      const nextActive =
        p.activeTabId === id ? next[0]?.id ?? null : p.activeTabId && next.some((t) => t.id === p.activeTabId)
          ? p.activeTabId
          : next[0]?.id ?? null
      return { tabs: next, activeTabId: nextActive }
    })
  }

  const placed = activeTab ? placedModuleIds(activeTab.rows) : new Set<string>()
  const unplacedModules = activeTab?.inventory.filter((m) => !placed.has(m.id)) ?? []

  async function handleSaveDashboard() {
    setSaveBusy(true)
    setSaveHint(null)
    try {
      await wd.flushSave()
      setSaveHint(supabaseConfigured ? 'Lagret til organisasjonen.' : 'Lagret lokalt (økt).')
      window.setTimeout(() => setSaveHint(null), 4000)
    } catch {
      /* wd.error set in hook */
    } finally {
      setSaveBusy(false)
    }
  }

  function onDropCell(e: React.DragEvent, rowId: string, cellId: string) {
    e.preventDefault()
    if (!activeTab) return
    const modRaw = e.dataTransfer.getData(DT_MODULE)
    const cellRaw = e.dataTransfer.getData(DT_CELL)
    if (modRaw) {
      updateActiveTab((t) => assignModuleToCell(t, rowId, cellId, modRaw))
      return
    }
    if (cellRaw) {
      try {
        const from = JSON.parse(cellRaw) as CellDragPayload
        updateActiveTab((t) => moveModuleBetweenCells(t, from, { rowId, cellId }))
      } catch {
        /* ignore */
      }
    }
  }

  function onDragOverCell(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  if (!activeTab) {
    return (
      <div className={PAGE}>
        <p className="text-sm text-neutral-500">Laster dashbord…</p>
      </div>
    )
  }

  return (
    <div className={PAGE}>
      <nav className="mb-4 text-sm text-neutral-600">
        <Link to="/" className="text-neutral-500 hover:text-[#1a3d32]">
          Workspace
        </Link>
        <span className="mx-2 text-neutral-400">→</span>
        <span className="font-medium text-neutral-800">Arbeidsplassrapportering</span>
        <span className="mx-2 text-neutral-400">→</span>
        <span className="font-medium text-neutral-800">Dashbord</span>
      </nav>

      <header className="border-b border-neutral-200/80 pb-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1
                className="text-2xl font-semibold text-neutral-900 md:text-3xl"
                style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
              >
                Arbeidsplass-dashbord
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600">
                Bygg faner med rutenett (12 kolonner), dra rapport-widgets inn fra paletten — samme modultyper som under
                Rapporter. Data hentes med samme datasett-motor som rapportbyggeren.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className={`${BTN} cursor-pointer`}>
                År{' '}
                <input
                  type="number"
                  value={y}
                  min={2000}
                  max={2100}
                  onChange={(e) => setY(Number(e.target.value))}
                  className="ml-2 w-[4.5rem] rounded-none border border-neutral-200 bg-white px-2 py-1 text-center text-sm tabular-nums"
                />
              </label>
              <button
                type="button"
                onClick={() => void refreshData()}
                disabled={dataLoading}
                className={BTN}
              >
                {dataLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                Oppdater data
              </button>
              <button
                type="button"
                onClick={() => void handleSaveDashboard()}
                disabled={saveBusy}
                className={BTN_PRI}
              >
                {saveBusy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4 shrink-0" />}
                Lagre dashbord
              </button>
              <button
                type="button"
                onClick={() => setEditMode((v) => !v)}
                className={editMode ? `${BTN_PRI} border-[#1a3d32]` : BTN}
              >
                <Pencil className="size-4 shrink-0" />
                {editMode ? 'Visning' : 'Rediger layout'}
              </button>
            </div>
          </div>
          {saveHint ? <p className="text-sm text-emerald-800">{saveHint}</p> : null}
        </div>
      </header>

      <div className="mt-6">
        <WorkplaceReportingHubMenu />
      </div>

      {(wd.error || rep.error) && (
        <p className="mt-4 rounded-none border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {wd.error ?? rep.error}
        </p>
      )}
      {wd.loading && supabaseConfigured && (
        <p className="mt-2 text-sm text-neutral-500">Synkroniserer dashbord…</p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2 border-b border-neutral-200/80 pb-4">
        {wd.payload.tabs.map((t) => {
          const sel = t.id === activeTab.id
          return (
            <div key={t.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTabId(t.id)}
                className={`${R} border px-3 py-2 text-sm font-medium ${
                  sel ? 'border-[#1a3d32] bg-[#1a3d32] text-white' : 'border-neutral-200 bg-white text-neutral-800'
                }`}
              >
                {t.name}
              </button>
              {editMode && wd.payload.tabs.length > 1 ? (
                <button
                  type="button"
                  onClick={() => deleteTab(t.id)}
                  className="rounded-none p-1 text-red-600 hover:bg-red-50"
                  aria-label="Slett fane"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
          )
        })}
        {editMode ? (
          <button type="button" onClick={addTab} className={`${BTN_PRI} h-9`}>
            <Plus className="size-4 shrink-0" />
            Ny fane
          </button>
        ) : null}
      </div>

      {editMode ? (
        <div className="mt-2">
          <label className="text-xs font-medium text-neutral-500">Navn på aktiv fane</label>
          <input
            value={activeTab.name}
            onChange={(e) =>
              updateActiveTab((t) => ({ ...t, name: e.target.value, updatedAt: new Date().toISOString() }))
            }
            className="mt-1 max-w-md rounded-none border border-neutral-200 px-3 py-2 text-sm"
          />
        </div>
      ) : null}

      {editMode && unplacedModules.length > 0 ? (
        <div className="mt-4 rounded-none border border-dashed border-amber-300 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
          <strong>Palett:</strong> dra en widget inn i en rute nedenfor.{' '}
          {unplacedModules.map((m) => (
            <span
              key={m.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DT_MODULE, m.id)
                e.dataTransfer.effectAllowed = 'move'
              }}
              className="mr-2 mt-2 inline-flex cursor-grab items-center gap-1 rounded-none border border-amber-400 bg-white px-2 py-1 text-xs font-medium active:cursor-grabbing"
            >
              <LayoutDashboard className="size-3.5" />
              {m.title}
            </span>
          ))}
        </div>
      ) : null}

      <div className={`mt-6 ${editMode ? 'grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]' : ''}`}>
        {editMode ? (
          <ReportModuleDesigner
            modules={activeTab.inventory}
            onModulesChange={(next) =>
              updateActiveTab((t) => ({ ...t, inventory: next, updatedAt: new Date().toISOString() }))
            }
          />
        ) : null}

        <div className="min-w-0 space-y-4">
          {editMode ? (
            <div className="flex flex-wrap gap-2 rounded-none border border-neutral-200 bg-neutral-50 p-3">
              <button
                type="button"
                onClick={() => updateActiveTab((t) => addRow(t))}
                className={BTN}
              >
                <Plus className="size-4 shrink-0" />
                Ny rad
              </button>
              <button
                type="button"
                onClick={() => updateActiveTab((t) => addColumnToLastRow(t))}
                className={BTN}
              >
                + Kolonne (siste rad)
              </button>
              <span className="self-center text-xs text-neutral-500">
                Dra rader ↑↓ for rekkefølge. Juster kolonnebredde per celle (1–12).
              </span>
            </div>
          ) : null}

          {activeTab.rows.map((row, rowIndex) => (
            <div
              key={row.id}
              className={`${R} border border-neutral-200/90 bg-white p-3 shadow-sm`}
              onDragOver={onDragOverCell}
              onDrop={(e) => {
                e.preventDefault()
                const rowRaw = e.dataTransfer.getData('application/x-atics-dashboard-row')
                if (rowRaw && editMode) {
                  const fromIdx = Number(rowRaw)
                  if (!Number.isNaN(fromIdx)) {
                    updateActiveTab((t) => moveRow(t, fromIdx, rowIndex))
                  }
                }
              }}
            >
              {editMode ? (
                <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-neutral-100 pb-2">
                  <span
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/x-atics-dashboard-row', String(rowIndex))
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    className="inline-flex cursor-grab items-center gap-1 text-neutral-400 active:cursor-grabbing"
                  >
                    <GripVertical className="size-4" />
                    Rad {rowIndex + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateActiveTab((t) => removeRow(t, row.id))}
                    className="ml-auto text-xs text-red-600 hover:underline"
                  >
                    Fjern rad
                  </button>
                </div>
              ) : null}
              <div className="grid grid-cols-12 gap-3">
                {row.cells.map((cell) => {
                  const mod = cell.moduleId ? moduleById(activeTab, cell.moduleId) : undefined
                  return (
                    <div
                      key={cell.id}
                      className={`min-h-[100px] ${editMode ? 'border-2 border-dashed border-neutral-300 bg-neutral-50/50' : ''}`}
                      style={{ gridColumn: `span ${cell.colSpan} / span ${cell.colSpan}` }}
                      onDragOver={onDragOverCell}
                      onDrop={(e) => onDropCell(e, row.id, cell.id)}
                    >
                      {editMode ? (
                        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200/80 p-2">
                          <select
                            value={String(cell.colSpan)}
                            onChange={(e) =>
                              updateActiveTab((t) =>
                                setCellSpan(t, row.id, cell.id, Number(e.target.value) as DashboardColSpan),
                              )
                            }
                            className="rounded-none border border-neutral-200 bg-white px-2 py-1 text-xs"
                          >
                            {SPAN_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {s}/12 bredde
                              </option>
                            ))}
                          </select>
                          {mod ? (
                            <span
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData(
                                  DT_CELL,
                                  JSON.stringify({ rowId: row.id, cellId: cell.id } satisfies CellDragPayload),
                                )
                                e.dataTransfer.effectAllowed = 'move'
                              }}
                              className="cursor-grab text-xs font-medium text-[#1a3d32] active:cursor-grabbing"
                            >
                              {mod.title}
                            </span>
                          ) : (
                            <span className="text-xs text-neutral-400">Tom celle — slipp widget her</span>
                          )}
                          {mod ? (
                            <button
                              type="button"
                              onClick={() => updateActiveTab((t) => assignModuleToCell(t, row.id, cell.id, ''))}
                              className="ml-auto text-xs text-neutral-500 hover:text-red-600"
                            >
                              Tøm
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      <div className={editMode ? 'p-2' : ''}>
                        {mod ? (
                          <ReportModuleWidget
                            module={mod}
                            datasets={datasets}
                            accent={accent}
                            layoutMode="fluid"
                            emptyLabel="Ingen data for valgt år / datasett."
                          />
                        ) : editMode ? (
                          <p className="py-6 text-center text-xs text-neutral-400">Tom</p>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {editMode ? (
        <p className="mt-6 text-xs text-neutral-500">
          Tips: Opprett flere moduler i widget-designeren til venstre, dra dem fra paletten (gule brikker) inn i celler.
          Én widget kan bare ligge i én celle om gangen. Rapportmalene under <Link to="/reports" className="text-[#1a3d32] underline">Rapporter</Link> bruker samme modulmotor.
        </p>
      ) : null}
    </div>
  )
}
