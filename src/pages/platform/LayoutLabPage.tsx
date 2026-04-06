import { useCallback, useEffect, useMemo, useState } from 'react'
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
  mergeLayoutPayload,
} from '../../lib/layoutLabTokens'
import { SidebarBox1 } from '../../components/layout/SidebarBox1'
import { usePlatformAdmin } from '../../hooks/usePlatformAdmin'
import { useUiTheme } from '../../hooks/useUiTheme'

type PresetRow = {
  id: string
  name: string
  payload: LayoutLabPayload
  updated_at: string
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

  const tableRowClass = (i: number) => layoutTableRowClass(settings, i)

  const kanbanColClass =
    settings.kanbanStyle === 'dense'
      ? 'gap-1 p-2'
      : settings.kanbanStyle === 'sharp'
        ? 'gap-2 p-3 rounded-none'
        : 'gap-2 p-3 rounded-xl'

  return (
    <div className="space-y-8 text-neutral-900">
      <div>
        <h1 className="text-2xl font-semibold text-white">Layout-lab</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Test tabeller, kort og Kanban med felles innstillinger. Lagring lokalt + i databasen.{' '}
          <strong className="text-neutral-300">Publiser til app</strong> sprer tokens til alle brukere (accent, flate, tabell,
          kort, Kanban — se kode).
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
      {message && <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</div>}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm text-neutral-200">
          <h2 className="font-semibold text-white">Innstillinger</h2>

          <label className="block text-xs text-neutral-400">
            Sidbredde
            <select
              value={settings.pageWidth}
              onChange={(e) =>
                persistLocal({ ...settings, pageWidth: e.target.value as LayoutLabPayload['pageWidth'] })
              }
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-white"
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
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-white"
            >
              <option value="comfortable">Luftig</option>
              <option value="compact">Kompakt</option>
            </select>
          </label>

          <label className="block text-xs text-neutral-400">
            Hjørner
            <select
              value={settings.radius}
              onChange={(e) =>
                persistLocal({ ...settings, radius: e.target.value as LayoutLabPayload['radius'] })
              }
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-white"
            >
              <option value="sm">Liten</option>
              <option value="md">Medium</option>
              <option value="lg">Stor</option>
              <option value="2xl">Avrundet (2xl)</option>
            </select>
          </label>

          <label className="block text-xs text-neutral-400">
            Overflate
            <select
              value={settings.surface}
              onChange={(e) =>
                persistLocal({ ...settings, surface: e.target.value as LayoutLabPayload['surface'] })
              }
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-white"
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
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 font-mono text-white"
            />
          </label>

          <label className="block text-xs text-neutral-400">
            Tabellstil
            <select
              value={settings.tableStyle}
              onChange={(e) =>
                persistLocal({ ...settings, tableStyle: e.target.value as LayoutLabPayload['tableStyle'] })
              }
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-white"
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
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-white"
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
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-white"
            >
              <option value="rounded">Avrundet</option>
              <option value="sharp">Skarp</option>
              <option value="dense">Tett</option>
            </select>
          </label>

          <div className="border-t border-white/10 pt-3">
            <p className="text-xs font-semibold text-white">Sidebar-boks (sidebar_box_1)</p>
            <p className="mt-0.5 text-[10px] text-neutral-500">Organisasjon → enheter, brukergrupper, terskler.</p>
          </div>

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
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-white"
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
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-white"
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
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-white"
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
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-white"
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
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-white"
            >
              <option value="none">Ingen</option>
              <option value="sm">Liten</option>
              <option value="md">Medium</option>
            </select>
          </label>

          <div className="border-t border-white/10 pt-4">
            <p className="text-xs text-neutral-500">Lagres automatisk i nettleseren. Sky-lagring krever navn.</p>
            <button
              type="button"
              disabled={busy || !isAdmin}
              onClick={() => void publishToAllOrgs()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              <Radio className="size-4" /> Publiser til alle organisasjoner
            </button>
            <p className="mt-1 text-[10px] text-neutral-500">
              Skriver til <code className="rounded bg-white/10 px-1">platform_ui_theme</code> og oppdaterer shell via
              sanntid.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Navn på preset"
                className="min-w-[140px] flex-1 rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-white"
              />
              <button
                type="button"
                disabled={busy || !isAdmin}
                onClick={() => void saveToCloud()}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-900 disabled:opacity-40"
              >
                <Save className="size-4" /> Lagre i sky
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
            <p className="text-xs font-medium text-neutral-400">Lagrede presets {loadingPresets && <Loader2 className="inline size-3 animate-spin" />}</p>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
              {presets.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 rounded bg-white/5 px-2 py-1">
                  <button
                    type="button"
                    className="truncate text-left text-amber-300/90 hover:underline"
                    onClick={() => persistLocal(mergeLayoutPayload(p.payload as Partial<LayoutLabPayload>))}
                  >
                    {p.name}
                  </button>
                  <button type="button" className="text-neutral-500 hover:text-red-400" onClick={() => void deletePreset(p.id)}>
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={`mx-auto w-full ${pageMax} ${surf} ${r} border border-neutral-200/60 p-4 shadow-inner`}>
          <p className="mb-4 text-xs font-medium text-neutral-500">Forhåndsvisning</p>

          <div className={`mb-6 overflow-x-auto ${r} border border-neutral-200/50 bg-white/90`}>
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="bg-neutral-100/90 text-xs uppercase text-neutral-600">
                  <th className={densityPad}>Oppgave</th>
                  <th className={densityPad}>Eier</th>
                  <th className={densityPad}>Status</th>
                </tr>
              </thead>
              <tbody>
                {['ROS-gjennomgang', 'Vernerunde Q2', 'BHT-møte'].map((label, i) => (
                  <tr key={label} className={tableRowClass(i)}>
                    <td className={densityPad}>{label}</td>
                    <td className={densityPad}>Kari</td>
                    <td className={densityPad}>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Åpen</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            {['Metrikk A', 'Metrikk B', 'Metrikk C'].map((t, i) => (
              <div
                key={t}
                className={`${r} ${cardRing} ${densityPad} bg-white/95`}
                style={settings.cardStyle === 'borderAccent' ? { borderColor: settings.accent } : undefined}
              >
                <p className="text-xs text-neutral-500">{t}</p>
                <p className="mt-1 text-2xl font-semibold" style={{ color: settings.accent }}>
                  {12 + i * 7}
                </p>
              </div>
            ))}
          </div>

          <div className={`grid grid-cols-1 gap-3 sm:grid-cols-3 ${settings.kanbanStyle === 'sharp' ? '' : ''}`}>
            {[
              { title: 'Å gjøre', items: ['Avvik #12', 'Henvendelse'] },
              { title: 'Pågår', items: ['ROS-låsing'] },
              { title: 'Ferdig', items: ['Signert protokoll'] },
            ].map((col) => (
              <div
                key={col.title}
                className={`${kanbanColClass} ${r} border border-neutral-200/70 bg-white/90`}
                style={{ borderRadius: settings.kanbanStyle === 'sharp' ? 0 : undefined }}
              >
                <p className="mb-2 text-xs font-semibold text-neutral-600">{col.title}</p>
                <ul className="space-y-2">
                  {col.items.map((it) => (
                    <li
                      key={it}
                      className={`${settings.kanbanStyle === 'dense' ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} ${
                        settings.kanbanStyle === 'sharp' ? 'rounded-none' : 'rounded-lg'
                      } border border-neutral-200 bg-neutral-50`}
                    >
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-8 max-w-sm">
            <p className="mb-2 text-xs font-medium text-neutral-500">Forhåndsvisning: sidebar_box_1</p>
            <SidebarBox1
              heading="Ny enhet"
              subheading="Eksempel — samme komponent som på Organisasjon."
              payloadOverride={settings}
              primaryAction={({ className, style }) => (
                <button type="button" className={className} style={style}>
                  <Plus className="size-4" />
                  Opprett enhet
                </button>
              )}
            >
              <p className="text-sm text-neutral-600">Skjemafelt vises her i appen.</p>
            </SidebarBox1>
          </div>
        </div>
      </div>
    </div>
  )
}
