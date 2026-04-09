import { useMemo, useState } from 'react'
import { GripVertical, Search, Trash2 } from 'lucide-react'
import type { ReportModule, ReportModuleKind } from '../../types/reportBuilder'
import {
  BAR_SERIES_PRESETS,
  createDefaultModule,
  DATASET_OPTIONS,
  KPI_PATHS,
  TABLE_COLUMNS,
} from '../../lib/reportModuleCatalog'

const SETTINGS_FIELD_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-800'
const SETTINGS_INPUT =
  'mt-1.5 w-full rounded-none border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 shadow-none placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900'
const R_FLAT = 'rounded-none'

type Props = {
  modules: ReportModule[]
  onModulesChange: (modules: ReportModule[]) => void
}

export function ReportModuleDesigner({ modules, onModulesChange }: Props) {
  const [moduleSearch, setModuleSearch] = useState('')

  const filtered = useMemo(() => {
    const q = moduleSearch.trim().toLowerCase()
    return modules.filter((m) => !q || m.title.toLowerCase().includes(q))
  }, [modules, moduleSearch])

  function updateModule(mid: string, patch: Partial<ReportModule>) {
    onModulesChange(modules.map((m) => (m.id === mid ? ({ ...m, ...patch } as ReportModule) : m)))
  }

  function removeModule(mid: string) {
    onModulesChange(modules.filter((m) => m.id !== mid))
  }

  function moveModule(mid: string, dir: -1 | 1) {
    const i = modules.findIndex((m) => m.id === mid)
    const j = i + dir
    if (i < 0 || j < 0 || j >= modules.length) return
    const next = [...modules]
    const t = next[i]!
    next[i] = next[j]!
    next[j] = t
    onModulesChange(next)
  }

  function addModuleKind(kind: ReportModuleKind) {
    onModulesChange([...modules, createDefaultModule(kind)])
  }

  return (
    <div className="flex min-h-0 flex-col rounded-none border border-neutral-200/90 bg-[#f4f1ea]">
      <div className="border-b border-neutral-200/80 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Widget-designer</p>
        <p className="mt-1 text-xs text-neutral-500">
          KPI, tabell, søyle og donut — delt med rapportbyggeren. Brukes i tilpassede rapporter og på arbeidsplass-dashbord.
        </p>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={moduleSearch}
            onChange={(e) => setModuleSearch(e.target.value)}
            placeholder="Søk i moduler…"
            className={`${SETTINGS_INPUT} bg-white pl-10`}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['kpi', 'table', 'bar', 'donut'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => addModuleKind(k)}
              className={`${R_FLAT} border border-neutral-300 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-700 hover:bg-neutral-50`}
            >
              + {k}
            </button>
          ))}
        </div>
      </div>
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {filtered.map((m) => (
          <li key={m.id} className={`${R_FLAT} border border-neutral-200 bg-white p-3 shadow-sm`}>
            <div className="flex items-start gap-2">
              <div className="mt-0.5 text-neutral-400">
                <GripVertical className="size-4" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  value={m.title}
                  onChange={(e) => updateModule(m.id, { title: e.target.value })}
                  className="w-full rounded-none border border-neutral-200 px-2 py-1 text-sm font-medium"
                />
                <div className="flex flex-wrap gap-1">
                  <span className="text-[10px] font-bold uppercase text-neutral-500">{m.kind}</span>
                </div>
                <label className={SETTINGS_FIELD_LABEL}>Datasett</label>
                <select
                  value={m.datasetKey}
                  onChange={(e) => {
                    const dk = e.target.value as ReportModule['datasetKey']
                    if (m.kind === 'kpi') {
                      const opts = KPI_PATHS[dk]
                      updateModule(m.id, {
                        datasetKey: dk,
                        valuePath: opts?.[0]?.path ?? m.valuePath,
                        subtitle: opts?.[0]?.label ?? m.subtitle,
                      })
                    } else if (m.kind === 'table') {
                      const cols = TABLE_COLUMNS[dk]
                      updateModule(m.id, {
                        datasetKey: dk,
                        rowKeys: cols ? cols.slice(0, 4) : m.rowKeys,
                      })
                    } else if (m.kind === 'bar') {
                      const s = BAR_SERIES_PRESETS[dk]
                      updateModule(m.id, {
                        datasetKey: dk,
                        seriesKeys: s ? [...s] : m.seriesKeys,
                      })
                    } else {
                      updateModule(m.id, { datasetKey: dk })
                    }
                  }}
                  className={`${SETTINGS_INPUT} bg-white text-xs`}
                >
                  {DATASET_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {m.kind === 'kpi' ? (
                  <>
                    <label className={SETTINGS_FIELD_LABEL}>Verdifelt</label>
                    <select
                      value={m.valuePath}
                      onChange={(e) => updateModule(m.id, { valuePath: e.target.value })}
                      className={`${SETTINGS_INPUT} bg-white text-xs`}
                    >
                      {(KPI_PATHS[m.datasetKey] ?? [{ path: m.valuePath, label: m.valuePath }]).map((o) => (
                        <option key={o.path} value={o.path}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <label className={SETTINGS_FIELD_LABEL}>Undertittel</label>
                    <input
                      value={m.subtitle ?? ''}
                      onChange={(e) => updateModule(m.id, { subtitle: e.target.value })}
                      className={`${SETTINGS_INPUT} bg-white text-xs`}
                    />
                  </>
                ) : null}
                {m.kind === 'table' ? (
                  <>
                    <label className={SETTINGS_FIELD_LABEL}>Kolonner (kommaseparert)</label>
                    <input
                      value={m.rowKeys.join(', ')}
                      onChange={(e) =>
                        updateModule(m.id, {
                          rowKeys: e.target.value
                            .split(',')
                            .map((x) => x.trim())
                            .filter(Boolean),
                        })
                      }
                      className={`${SETTINGS_INPUT} bg-white font-mono text-xs`}
                    />
                  </>
                ) : null}
                {m.kind === 'bar' ? (
                  <>
                    <label className={SETTINGS_FIELD_LABEL}>Serienøkler (kommaseparert)</label>
                    <input
                      value={m.seriesKeys.join(', ')}
                      onChange={(e) =>
                        updateModule(m.id, {
                          seriesKeys: e.target.value
                            .split(',')
                            .map((x) => x.trim())
                            .filter(Boolean),
                        })
                      }
                      className={`${SETTINGS_INPUT} bg-white font-mono text-xs`}
                    />
                  </>
                ) : null}
                {m.kind === 'donut' ? (
                  <>
                    <label className={SETTINGS_FIELD_LABEL}>Sti til segmenter (valgfri)</label>
                    <input
                      value={m.segmentsPath}
                      onChange={(e) => updateModule(m.id, { segmentsPath: e.target.value })}
                      className={`${SETTINGS_INPUT} bg-white font-mono text-xs`}
                      placeholder="f.eks. nested.path"
                    />
                  </>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  onClick={() => moveModule(m.id, -1)}
                  className="rounded-none px-1 text-xs text-neutral-500 hover:bg-neutral-100"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveModule(m.id, 1)}
                  className="rounded-none px-1 text-xs text-neutral-500 hover:bg-neutral-100"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeModule(m.id)}
                  className="rounded-none p-1 text-red-600 hover:bg-red-50"
                  aria-label="Fjern"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
