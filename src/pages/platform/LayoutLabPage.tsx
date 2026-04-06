import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Download, Loader2, Plus, Radio, Save, Trash2 } from 'lucide-react'
import { getSupabaseBrowserClient } from '../../lib/supabaseClient'
import { getSupabaseErrorMessage } from '../../lib/supabaseError'
import {
  DEFAULT_LAYOUT_LAB,
  LAYOUT_LAB_CHANGED_EVENT,
  LAYOUT_LAB_STORAGE_KEY,
  type LayoutLabPayload,
} from '../../types/layoutLab'
import {
  layoutDensityPadding,
  layoutPageMaxClass,
  layoutRadiusClass,
  layoutSurfaceClass,
  layoutTableRowClass,
  mainbox1PaddingClass,
  mainbox1ShellClass,
  mainbox1ShellStyleObject,
  menu1ActiveTabClass,
  menu1ActiveTabTextStyle,
  menu1BarStyleObject,
  menu1InactiveTabClass,
  mergeLayoutPayload,
  table1BodyRowClass,
  table1CellPadding,
  table1HeaderRowClass,
} from '../../lib/layoutLabTokens'
import { SidebarBox1 } from '../../components/layout/SidebarBox1'
import { Table1Shell } from '../../components/layout/Table1Shell'
import { usePlatformAdmin } from '../../hooks/usePlatformAdmin'
import { useUiTheme } from '../../hooks/useUiTheme'

const SELECT_PANEL =
  'mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-sm text-white'

type PresetRow = {
  id: string
  name: string
  payload: LayoutLabPayload
  updated_at: string
}

function LabSection({
  title,
  description,
  controls,
  preview,
}: {
  title: string
  description: string
  controls: ReactNode
  preview: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/45">
      <header className="border-b border-white/10 px-4 py-3 md:px-5">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <p className="mt-0.5 text-xs text-neutral-400">{description}</p>
      </header>
      <div className="grid lg:grid-cols-[minmax(0,280px)_1fr] lg:divide-x lg:divide-white/10">
        <div className="space-y-3 p-4 md:p-5">{controls}</div>
        <div className="min-h-[140px] border-t border-white/10 bg-[#f5f0e8] p-4 md:p-5 lg:border-t-0">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Forhåndsvisning</p>
          {preview}
        </div>
      </div>
    </section>
  )
}

export function LayoutLabPage() {
  const { userId, isAdmin } = usePlatformAdmin()
  const { updatedAt: themeUpdatedAt, refresh: refreshGlobalTheme } = useUiTheme()
  const supabase = getSupabaseBrowserClient()
  const [settings, setSettings] = useState<LayoutLabPayload>(DEFAULT_LAYOUT_LAB)
  const [presets, setPresets] = useState<PresetRow[]>([])
  const [loadingPresets, setLoadingPresets] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAYOUT_LAB_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<LayoutLabPayload>
        setSettings(mergeLayoutPayload(parsed))
      }
    } catch {
      /* ignore */
    }
  }, [])

  const persistLocal = useCallback((next: LayoutLabPayload) => {
    setSettings(mergeLayoutPayload(next))
    try {
      localStorage.setItem(LAYOUT_LAB_STORAGE_KEY, JSON.stringify(mergeLayoutPayload(next)))
    } catch {
      /* ignore */
    }
    try {
      window.dispatchEvent(new Event(LAYOUT_LAB_CHANGED_EVENT))
    } catch {
      /* ignore */
    }
  }, [])

  const loadPresets = useCallback(async () => {
    if (!supabase || !userId || !isAdmin) return
    setLoadingPresets(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('platform_layout_presets')
        .select('id,name,payload,updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
      if (e) throw e
      setPresets(
        (data ?? []).map((row) => ({
          id: row.id as string,
          name: row.name as string,
          payload: row.payload as LayoutLabPayload,
          updated_at: row.updated_at as string,
        })),
      )
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setLoadingPresets(false)
    }
  }, [supabase, userId, isAdmin])

  useEffect(() => {
    void loadPresets()
  }, [loadPresets])

  const pageMax = useMemo(() => layoutPageMaxClass(settings.pageWidth), [settings.pageWidth])
  const densityPad = layoutDensityPadding(settings.density)
  const r = layoutRadiusClass(settings.radius)
  const surf = layoutSurfaceClass(settings.surface)

  async function saveToCloud() {
    if (!supabase || !userId || !saveName.trim()) {
      setError('Skriv inn et navn på forhåndsinnstillingen.')
      return
    }
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const { error: e } = await supabase.from('platform_layout_presets').insert({
        user_id: userId,
        name: saveName.trim(),
        payload: settings,
      })
      if (e) throw e
      setMessage('Lagret i skyen.')
      setSaveName('')
      await loadPresets()
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function publishToAllOrgs() {
    if (!supabase || !isAdmin) {
      setError('Kun plattform-admin kan publisere.')
      return
    }
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const { error: e } = await supabase.rpc('platform_ui_theme_publish', { p_payload: settings })
      if (e) throw e
      setMessage('Publisert til alle organisasjoner. Oppslag oppdateres i sanntid der Realtime er aktivert.')
      await refreshGlobalTheme()
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function deletePreset(id: string) {
    if (!supabase) return
    setBusy(true)
    setError(null)
    try {
      const { error: e } = await supabase.from('platform_layout_presets').delete().eq('id', id)
      if (e) throw e
      await loadPresets()
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `atics-layout-lab-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const cardRing =
    settings.cardStyle === 'borderAccent'
      ? 'border-2'
      : settings.cardStyle === 'shadow'
        ? 'border border-neutral-200/80 shadow-md'
        : 'border border-neutral-200/60'

  const kanbanColClass =
    settings.kanbanStyle === 'dense'
      ? 'gap-1 p-2'
      : settings.kanbanStyle === 'sharp'
        ? 'gap-2 p-3 rounded-none'
        : 'gap-2 p-3 rounded-xl'

  const tableRowClass = (i: number) => layoutTableRowClass(settings, i)

  return (
    <div className="space-y-8 text-neutral-900">
      <div>
        <h1 className="text-2xl font-semibold text-white">Layout-lab</h1>
        <p className="mt-1 max-w-3xl text-sm text-neutral-400">
          Hver seksjon har egne innstillinger og forhåndsvisning. Grunnleggende tokens (venstre) gjelder hele appen.{' '}
          <strong className="text-neutral-300">Publiser til app</strong> oppdaterer alle brukere.
        </p>
        {themeUpdatedAt && (
          <p className="mt-1 text-xs text-neutral-500">
            Sist publisert globalt: {new Date(themeUpdatedAt).toLocaleString('nb-NO')}
          </p>
        )}
        <Link
          to="/platform-admin/ui-advanced"
          className="mt-2 inline-block text-sm text-amber-400/90 hover:underline"
        >
          Avansert UI (ATS-kort, tabell, scorecard) →
        </Link>
      </div>

      {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
      {message && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</div>
      )}

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* —— Grunnleggende + handlinger (smalt panel) —— */}
        <aside className="w-full shrink-0 space-y-4 rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm text-neutral-200 lg:sticky lg:top-4 lg:w-72">
          <div>
            <h2 className="font-semibold text-white">Grunnleggende</h2>
            <p className="mt-0.5 text-[10px] text-neutral-500">Sidbredde, tetthet, hjørner, flate, aksent.</p>
          </div>

          <label className="block text-xs text-neutral-400">
            Sidbredde
            <select
              value={settings.pageWidth}
              onChange={(e) =>
                persistLocal({ ...settings, pageWidth: e.target.value as LayoutLabPayload['pageWidth'] })
              }
              className={SELECT_PANEL}
            >
              <option value="narrow">Smal</option>
              <option value="standard">Standard</option>
              <option value="wide">Bred</option>
            </select>
          </label>

          <label className="block text-xs text-neutral-400">
            Tetthet
            <select
              value={settings.density}
              onChange={(e) =>
                persistLocal({ ...settings, density: e.target.value as LayoutLabPayload['density'] })
              }
              className={SELECT_PANEL}
            >
              <option value="comfortable">Luftig</option>
              <option value="compact">Kompakt</option>
            </select>
          </label>

          <label className="block text-xs text-neutral-400">
            Hjørner (globale)
            <select
              value={settings.radius}
              onChange={(e) =>
                persistLocal({ ...settings, radius: e.target.value as LayoutLabPayload['radius'] })
              }
              className={SELECT_PANEL}
            >
              <option value="sm">Liten</option>
              <option value="md">Medium</option>
              <option value="lg">Stor</option>
              <option value="2xl">Avrundet (2xl)</option>
            </select>
          </label>

          <label className="block text-xs text-neutral-400">
            Overflate (forhåndsflate)
            <select
              value={settings.surface}
              onChange={(e) =>
                persistLocal({ ...settings, surface: e.target.value as LayoutLabPayload['surface'] })
              }
              className={SELECT_PANEL}
            >
              <option value="cream">Krem (#f5f0e8)</option>
              <option value="white">Hvit</option>
              <option value="muted">Nøytral</option>
            </select>
          </label>

          <label className="block text-xs text-neutral-400">
            Aksent (hex)
            <input
              type="text"
              value={settings.accent}
              onChange={(e) => persistLocal({ ...settings, accent: e.target.value })}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 font-mono text-sm text-white"
            />
          </label>

          <div className="border-t border-white/10 pt-4">
            <h3 className="text-xs font-semibold text-white">Lagring og publisering</h3>
            <p className="mt-1 text-[10px] text-neutral-500">Lagres automatisk i nettleseren.</p>
            <button
              type="button"
              disabled={busy || !isAdmin}
              onClick={() => void publishToAllOrgs()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              <Radio className="size-4" /> Publiser til alle organisasjoner
            </button>
            <p className="mt-1 text-[10px] text-neutral-500">
              Skriver til <code className="rounded bg-white/10 px-1">platform_ui_theme</code>.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Navn på preset"
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-sm text-white"
              />
              <button
                type="button"
                disabled={busy || !isAdmin}
                onClick={() => void saveToCloud()}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-900 disabled:opacity-40"
              >
                <Save className="size-4" /> Sky
              </button>
              <button
                type="button"
                onClick={exportJson}
                className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-2 text-xs text-neutral-200"
              >
                <Download className="size-4" /> JSON
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-neutral-400">
              Lagrede presets {loadingPresets && <Loader2 className="inline size-3 animate-spin" />}
            </p>
            <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-xs">
              {presets.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 rounded bg-white/5 px-2 py-1">
                  <button
                    type="button"
                    className="truncate text-left text-amber-300/90 hover:underline"
                    onClick={() => persistLocal(mergeLayoutPayload(p.payload as Partial<LayoutLabPayload>))}
                  >
                    {p.name}
                  </button>
                  <button
                    type="button"
                    className="text-neutral-500 hover:text-red-400"
                    onClick={() => void deletePreset(p.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* —— Seksjoner: innstilling + forhåndsvisning —— */}
        <div className="min-w-0 flex-1 space-y-8">
          <LabSection
            title="Globale mønstre"
            description="Tabellstil, kortstil og Kanban brukes mange steder; her ser du effekten på metrikk-kort, liste og tavle."
            controls={
              <>
                <label className="block text-xs text-neutral-400">
                  Tabellstil (global)
                  <select
                    value={settings.tableStyle}
                    onChange={(e) =>
                      persistLocal({ ...settings, tableStyle: e.target.value as LayoutLabPayload['tableStyle'] })
                    }
                    className={SELECT_PANEL}
                  >
                    <option value="ruled">Linjer</option>
                    <option value="zebra">Zebra</option>
                    <option value="minimal">Minimal</option>
                  </select>
                </label>
                <label className="block text-xs text-neutral-400">
                  Kortstil
                  <select
                    value={settings.cardStyle}
                    onChange={(e) =>
                      persistLocal({ ...settings, cardStyle: e.target.value as LayoutLabPayload['cardStyle'] })
                    }
                    className={SELECT_PANEL}
                  >
                    <option value="flat">Flat</option>
                    <option value="shadow">Skygge</option>
                    <option value="borderAccent">Aksentkant</option>
                  </select>
                </label>
                <label className="block text-xs text-neutral-400">
                  Kanban
                  <select
                    value={settings.kanbanStyle}
                    onChange={(e) =>
                      persistLocal({ ...settings, kanbanStyle: e.target.value as LayoutLabPayload['kanbanStyle'] })
                    }
                    className={SELECT_PANEL}
                  >
                    <option value="rounded">Avrundet</option>
                    <option value="sharp">Skarp</option>
                    <option value="dense">Tett</option>
                  </select>
                </label>
              </>
            }
            preview={
              <div className={`mx-auto w-full max-w-3xl ${pageMax}`}>
                <div className={`${surf} ${r} border border-neutral-200/50 p-3 shadow-inner`}>
                  <div className="mb-4 overflow-x-auto rounded-lg border border-neutral-200/60 bg-white/90">
                    <table className="w-full min-w-[280px] text-left text-xs">
                      <thead>
                        <tr className="bg-neutral-100/90 text-neutral-600">
                          <th className={densityPad}>Oppgave</th>
                          <th className={densityPad}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {['Rad A', 'Rad B'].map((label, i) => (
                          <tr key={label} className={tableRowClass(i)}>
                            <td className={densityPad}>{label}</td>
                            <td className={densityPad}>
                              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800">
                                Åpen
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mb-4 grid grid-cols-3 gap-2">
                    {['A', 'B', 'C'].map((t, i) => (
                      <div
                        key={t}
                        className={`${r} ${cardRing} ${densityPad} bg-white/95 text-center`}
                        style={settings.cardStyle === 'borderAccent' ? { borderColor: settings.accent } : undefined}
                      >
                        <p className="text-[10px] text-neutral-500">Metrikk {t}</p>
                        <p className="text-lg font-semibold" style={{ color: settings.accent }}>
                          {12 + i * 3}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className={`grid grid-cols-3 gap-2 ${settings.kanbanStyle === 'sharp' ? '' : ''}`}>
                    {['Å gjøre', 'Pågår', 'Ferdig'].map((titleCol) => (
                      <div
                        key={titleCol}
                        className={`${kanbanColClass} ${r} border border-neutral-200/70 bg-white/90`}
                        style={{ borderRadius: settings.kanbanStyle === 'sharp' ? 0 : undefined }}
                      >
                        <p className="mb-1 text-[10px] font-semibold text-neutral-600">{titleCol}</p>
                        <div
                          className={`border border-neutral-200 bg-neutral-50 text-[10px] ${
                            settings.kanbanStyle === 'dense' ? 'px-1 py-0.5' : 'px-2 py-1'
                          } ${settings.kanbanStyle === 'sharp' ? 'rounded-none' : 'rounded-md'}`}
                        >
                          Kort
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            }
          />

          <LabSection
            title="Fanemeny (menu_1)"
            description="Organisasjon — faner øverst på siden."
            controls={
              <>
                <label className="block text-xs text-neutral-400">
                  Menylinje
                  <select
                    value={settings.menu_1.barTone}
                    onChange={(e) =>
                      persistLocal({
                        ...settings,
                        menu_1: { ...settings.menu_1, barTone: e.target.value as LayoutLabPayload['menu_1']['barTone'] },
                      })
                    }
                    className={SELECT_PANEL}
                  >
                    <option value="accent">Aksent</option>
                    <option value="slate">Skifer</option>
                  </select>
                </label>
                <label className="block text-xs text-neutral-400">
                  Aktiv fane bakgrunn
                  <select
                    value={settings.menu_1.activeFill}
                    onChange={(e) =>
                      persistLocal({
                        ...settings,
                        menu_1: {
                          ...settings.menu_1,
                          activeFill: e.target.value as LayoutLabPayload['menu_1']['activeFill'],
                        },
                      })
                    }
                    className={SELECT_PANEL}
                  >
                    <option value="cream">Krem</option>
                    <option value="white">Hvit</option>
                  </select>
                </label>
                <label className="block text-xs text-neutral-400">
                  Fanehjørner
                  <select
                    value={settings.menu_1.tabRounding}
                    onChange={(e) =>
                      persistLocal({
                        ...settings,
                        menu_1: {
                          ...settings.menu_1,
                          tabRounding: e.target.value as LayoutLabPayload['menu_1']['tabRounding'],
                        },
                      })
                    }
                    className={SELECT_PANEL}
                  >
                    <option value="xl">Avrundet (xl)</option>
                    <option value="full">Pill</option>
                  </select>
                </label>
              </>
            }
            preview={
              <div className="overflow-hidden rounded-2xl border border-black/10 shadow-sm" style={menu1BarStyleObject(settings)}>
                <div className="flex min-h-[2.5rem] flex-wrap gap-0 px-1 py-1">
                  <button type="button" className={menu1ActiveTabClass(settings)} style={menu1ActiveTabTextStyle(settings)}>
                    Org.kart
                  </button>
                  <button type="button" className={menu1InactiveTabClass(settings)}>
                    Ansatte
                  </button>
                  <button type="button" className={menu1InactiveTabClass(settings)}>
                    Enheter
                  </button>
                </div>
              </div>
            }
          />

          <LabSection
            title="Datatabell (table_1)"
            description="Organisasjon → Ansatte-tabell."
            controls={
              <>
                <label className="block text-xs text-neutral-400">
                  Bakgrunn
                  <select
                    value={settings.table_1.surface}
                    onChange={(e) =>
                      persistLocal({
                        ...settings,
                        table_1: { ...settings.table_1, surface: e.target.value as LayoutLabPayload['table_1']['surface'] },
                      })
                    }
                    className={SELECT_PANEL}
                  >
                    <option value="white">Hvit</option>
                    <option value="cream">Krem</option>
                    <option value="muted">Nøytral</option>
                  </select>
                </label>
                <label className="block text-xs text-neutral-400">
                  Skygge
                  <select
                    value={settings.table_1.shadow}
                    onChange={(e) =>
                      persistLocal({
                        ...settings,
                        table_1: { ...settings.table_1, shadow: e.target.value as LayoutLabPayload['table_1']['shadow'] },
                      })
                    }
                    className={SELECT_PANEL}
                  >
                    <option value="none">Ingen</option>
                    <option value="sm">Liten</option>
                    <option value="md">Medium</option>
                  </select>
                </label>
                <label className="block text-xs text-neutral-400">
                  Radmønster
                  <select
                    value={settings.table_1.rowStyle}
                    onChange={(e) =>
                      persistLocal({
                        ...settings,
                        table_1: {
                          ...settings.table_1,
                          rowStyle: e.target.value as LayoutLabPayload['table_1']['rowStyle'],
                        },
                      })
                    }
                    className={SELECT_PANEL}
                  >
                    <option value="inherit">Arv global tabellstil</option>
                    <option value="zebra">Zebra</option>
                    <option value="ruled">Linjer</option>
                    <option value="minimal">Minimal</option>
                  </select>
                </label>
                <label className="block text-xs text-neutral-400">
                  Tabellhode
                  <select
                    value={settings.table_1.headerStyle}
                    onChange={(e) =>
                      persistLocal({
                        ...settings,
                        table_1: {
                          ...settings.table_1,
                          headerStyle: e.target.value as LayoutLabPayload['table_1']['headerStyle'],
                        },
                      })
                    }
                    className={SELECT_PANEL}
                  >
                    <option value="subtle">Diskret</option>
                    <option value="strong">Tydelig</option>
                    <option value="plain">Enkel</option>
                  </select>
                </label>
                <label className="block text-xs text-neutral-400">
                  Celle-padding
                  <select
                    value={settings.table_1.cellDensity}
                    onChange={(e) =>
                      persistLocal({
                        ...settings,
                        table_1: {
                          ...settings.table_1,
                          cellDensity: e.target.value as LayoutLabPayload['table_1']['cellDensity'],
                        },
                      })
                    }
                    className={SELECT_PANEL}
                  >
                    <option value="comfortable">Luftig</option>
                    <option value="compact">Kompakt</option>
                  </select>
                </label>
              </>
            }
            preview={
              <Table1Shell payloadOverride={settings}>
                <table className="w-full min-w-[400px] border-collapse text-left text-sm">
                  <thead>
                    <tr className={table1HeaderRowClass(settings)}>
                      <th className={`${table1CellPadding(settings)} font-medium`}>Oppgave</th>
                      <th className={`${table1CellPadding(settings)} font-medium`}>Eier</th>
                      <th className={`${table1CellPadding(settings)} font-medium`}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['ROS-gjennomgang', 'Vernerunde Q2', 'BHT-møte'].map((label, i) => (
                      <tr key={label} className={table1BodyRowClass(settings, i)}>
                        <td className={table1CellPadding(settings)}>{label}</td>
                        <td className={table1CellPadding(settings)}>Kari</td>
                        <td className={table1CellPadding(settings)}>
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Åpen</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Table1Shell>
            }
          />

          <LabSection
            title="Hovedboks (mainbox_1)"
            description="Organisasjon → innstillinger (venstre), brukergrupper-liste."
            controls={
              <>
                <label className="block text-xs text-neutral-400">
                  Bakgrunn
                  <select
                    value={settings.mainbox_1.surface}
                    onChange={(e) =>
                      persistLocal({
                        ...settings,
                        mainbox_1: {
                          ...settings.mainbox_1,
                          surface: e.target.value as LayoutLabPayload['mainbox_1']['surface'],
                        },
                      })
                    }
                    className={SELECT_PANEL}
                  >
                    <option value="white">Hvit</option>
                    <option value="cream">Krem</option>
                    <option value="muted">Nøytral</option>
                  </select>
                </label>
                <label className="block text-xs text-neutral-400">
                  Skygge
                  <select
                    value={settings.mainbox_1.shadow}
                    onChange={(e) =>
                      persistLocal({
                        ...settings,
                        mainbox_1: {
                          ...settings.mainbox_1,
                          shadow: e.target.value as LayoutLabPayload['mainbox_1']['shadow'],
                        },
                      })
                    }
                    className={SELECT_PANEL}
                  >
                    <option value="none">Ingen</option>
                    <option value="sm">Liten</option>
                    <option value="md">Medium</option>
                  </select>
                </label>
                <label className="block text-xs text-neutral-400">
                  Padding
                  <select
                    value={settings.mainbox_1.padding}
                    onChange={(e) =>
                      persistLocal({
                        ...settings,
                        mainbox_1: {
                          ...settings.mainbox_1,
                          padding: e.target.value as LayoutLabPayload['mainbox_1']['padding'],
                        },
                      })
                    }
                    className={SELECT_PANEL}
                  >
                    <option value="comfortable">Luftig</option>
                    <option value="compact">Kompakt</option>
                  </select>
                </label>
                <label className="block text-xs text-neutral-400">
                  Kant
                  <select
                    value={settings.mainbox_1.border}
                    onChange={(e) =>
                      persistLocal({
                        ...settings,
                        mainbox_1: {
                          ...settings.mainbox_1,
                          border: e.target.value as LayoutLabPayload['mainbox_1']['border'],
                        },
                      })
                    }
                    className={SELECT_PANEL}
                  >
                    <option value="neutral">Nøytral</option>
                    <option value="accent">Aksent</option>
                  </select>
                </label>
              </>
            }
            preview={
              <div className={`${mainbox1ShellClass(settings)}`} style={mainbox1ShellStyleObject(settings)}>
                <div className={mainbox1PaddingClass(settings)}>
                  <h3 className="text-base font-semibold text-neutral-900">Virksomhetsinnstillinger</h3>
                  <p className="mt-1 text-sm text-neutral-600">Eksempeltekst i hovedboks — samme komponent som i appen.</p>
                </div>
              </div>
            }
          />

          <LabSection
            title="Sidebar-boks (sidebar_box_1)"
            description="Organisasjon → Ny enhet, Ny brukergruppe, beregnede terskler."
            controls={
              <>
                <label className="block text-xs text-neutral-400">
                  Sidetittel (hoved)
                  <select
                    value={settings.sidebar_box_1.headingSize}
                    onChange={(e) =>
                      persistLocal({
                        ...settings,
                        sidebar_box_1: {
                          ...settings.sidebar_box_1,
                          headingSize: e.target.value as LayoutLabPayload['sidebar_box_1']['headingSize'],
                        },
                      })
                    }
                    className={SELECT_PANEL}
                  >
                    <option value="sm">Liten</option>
                    <option value="md">Medium</option>
                    <option value="lg">Stor</option>
                  </select>
                </label>
                <label className="block text-xs text-neutral-400">
                  Primærknapp
                  <select
                    value={settings.sidebar_box_1.buttonStyle}
                    onChange={(e) =>
                      persistLocal({
                        ...settings,
                        sidebar_box_1: {
                          ...settings.sidebar_box_1,
                          buttonStyle: e.target.value as LayoutLabPayload['sidebar_box_1']['buttonStyle'],
                        },
                      })
                    }
                    className={SELECT_PANEL}
                  >
                    <option value="solid">Fylt (aksent)</option>
                    <option value="outline">Omriss</option>
                    <option value="soft">Myk</option>
                  </select>
                </label>
                <label className="block text-xs text-neutral-400">
                  Padding
                  <select
                    value={settings.sidebar_box_1.padding}
                    onChange={(e) =>
                      persistLocal({
                        ...settings,
                        sidebar_box_1: {
                          ...settings.sidebar_box_1,
                          padding: e.target.value as LayoutLabPayload['sidebar_box_1']['padding'],
                        },
                      })
                    }
                    className={SELECT_PANEL}
                  >
                    <option value="comfortable">Luftig</option>
                    <option value="compact">Kompakt</option>
                  </select>
                </label>
                <label className="block text-xs text-neutral-400">
                  Boks bakgrunn
                  <select
                    value={settings.sidebar_box_1.surface}
                    onChange={(e) =>
                      persistLocal({
                        ...settings,
                        sidebar_box_1: {
                          ...settings.sidebar_box_1,
                          surface: e.target.value as LayoutLabPayload['sidebar_box_1']['surface'],
                        },
                      })
                    }
                    className={SELECT_PANEL}
                  >
                    <option value="white">Hvit</option>
                    <option value="cream">Krem</option>
                    <option value="muted">Nøytral</option>
                  </select>
                </label>
                <label className="block text-xs text-neutral-400">
                  Skygge
                  <select
                    value={settings.sidebar_box_1.shadow}
                    onChange={(e) =>
                      persistLocal({
                        ...settings,
                        sidebar_box_1: {
                          ...settings.sidebar_box_1,
                          shadow: e.target.value as LayoutLabPayload['sidebar_box_1']['shadow'],
                        },
                      })
                    }
                    className={SELECT_PANEL}
                  >
                    <option value="none">Ingen</option>
                    <option value="sm">Liten</option>
                    <option value="md">Medium</option>
                  </select>
                </label>
              </>
            }
            preview={
              <div className="max-w-md">
                <SidebarBox1
                  heading="Ny enhet"
                  subheading="Skjemafelt som i Organisasjon."
                  payloadOverride={settings}
                  primaryAction={({ className, style }) => (
                    <button type="button" className={className} style={style}>
                      <Plus className="size-4" />
                      Opprett enhet
                    </button>
                  )}
                >
                  <p className="text-sm text-neutral-600">Navn, type, overordnet …</p>
                </SidebarBox1>
              </div>
            }
          />

          {/* Full bredde: sidemaks som i app */}
          <div className={`rounded-2xl border border-white/10 bg-slate-900/30 px-4 py-3 text-xs text-neutral-500`}>
            <span className="font-medium text-neutral-400">Sidemaks (pageWidth):</span>{' '}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-amber-200/90">{pageMax}</code> — brukes bl.a. på
            forhåndsvisning over.
          </div>
        </div>
      </div>
    </div>
  )
}
