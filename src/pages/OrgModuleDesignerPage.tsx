import { useCallback, useEffect, useState } from 'react'
import { Loader2, ToggleLeft, ToggleRight } from 'lucide-react'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'

type ModuleRow = {
  id: string
  slug: string
  display_name: string
  is_active: boolean
  required_permissions: string[]
  config: Record<string, unknown>
  updated_at: string
}

/**
 * Org-level module designer: lists all modules registered for this organisation,
 * lets admins toggle active state and inspect the config JSONB.
 * Route: /admin/modules  (perm: module.view.admin)
 */
export function OrgModuleDesignerPage() {
  const { supabase } = useOrgSetupContext()
  const [modules, setModules] = useState<ModuleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [editingConfig, setEditingConfig] = useState<string | null>(null)
  const [configDraft, setConfigDraft] = useState('')
  const [configError, setConfigError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('modules')
      .select('id, slug, display_name, is_active, required_permissions, config, updated_at')
      .order('display_name', { ascending: true })
    if (err) { setError(err.message); setLoading(false); return }
    setModules((data ?? []) as ModuleRow[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const toggleActive = useCallback(async (mod: ModuleRow) => {
    if (!supabase) return
    setSaving(mod.id)
    const { data, error: err } = await supabase
      .from('modules')
      .update({ is_active: !mod.is_active })
      .eq('id', mod.id)
      .select('id, slug, display_name, is_active, required_permissions, config, updated_at')
      .single()
    setSaving(null)
    if (err) { setError(err.message); return }
    if (data) setModules((prev) => prev.map((m) => (m.id === mod.id ? (data as ModuleRow) : m)))
  }, [supabase])

  const openConfigEditor = (mod: ModuleRow) => {
    setEditingConfig(mod.id)
    setConfigDraft(JSON.stringify(mod.config, null, 2))
    setConfigError(null)
  }

  const saveConfig = useCallback(async (modId: string) => {
    if (!supabase) return
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(configDraft) as Record<string, unknown>
    } catch {
      setConfigError('Ugyldig JSON')
      return
    }
    setSaving(modId)
    const { data, error: err } = await supabase
      .from('modules')
      .update({ config: parsed })
      .eq('id', modId)
      .select('id, slug, display_name, is_active, required_permissions, config, updated_at')
      .single()
    setSaving(null)
    if (err) { setConfigError(err.message); return }
    if (data) {
      setModules((prev) => prev.map((m) => (m.id === modId ? (data as ModuleRow) : m)))
      setEditingConfig(null)
    }
  }, [supabase, configDraft])

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 md:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
          Moduldesigner
        </h1>
        <p className="mt-1.5 text-sm text-neutral-600">
          Aktiver og konfigurer modulene som er tilgjengelig for organisasjonen. Endringer trer i kraft umiddelbart.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="size-4 animate-spin" /> Laster moduler…
        </div>
      ) : modules.length === 0 ? (
        <p className="text-sm text-neutral-500">Ingen moduler registrert for denne organisasjonen ennå.</p>
      ) : (
        <div className="space-y-3">
          {modules.map((mod) => (
            <div
              key={mod.id}
              className="rounded border border-neutral-200 bg-white shadow-sm"
            >
              <div className="flex items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-neutral-900">{mod.display_name}</span>
                    <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-500">{mod.slug}</code>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        mod.is_active
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-neutral-100 text-neutral-500'
                      }`}
                    >
                      {mod.is_active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </div>
                  {mod.required_permissions.length > 0 && (
                    <p className="mt-1 text-[11px] text-neutral-400">
                      Krever: {mod.required_permissions.join(', ')}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openConfigEditor(mod)}
                    className="rounded border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                  >
                    Config…
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleActive(mod)}
                    disabled={saving === mod.id}
                    aria-label={mod.is_active ? 'Deaktiver modul' : 'Aktiver modul'}
                    className="flex items-center gap-1 rounded border border-neutral-200 px-2.5 py-1 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    {saving === mod.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : mod.is_active ? (
                      <ToggleRight className="size-4 text-emerald-600" />
                    ) : (
                      <ToggleLeft className="size-4 text-neutral-400" />
                    )}
                    {mod.is_active ? 'Deaktiver' : 'Aktiver'}
                  </button>
                </div>
              </div>

              {editingConfig === mod.id && (
                <div className="border-t border-neutral-100 px-5 py-4">
                  <p className="mb-2 text-xs font-medium text-neutral-700">Config (JSON)</p>
                  {configError && (
                    <p className="mb-2 text-xs text-red-700">{configError}</p>
                  )}
                  <textarea
                    value={configDraft}
                    onChange={(e) => { setConfigDraft(e.target.value); setConfigError(null) }}
                    rows={8}
                    className="w-full rounded border border-neutral-300 px-3 py-2 font-mono text-xs focus:border-[#1a3d32] focus:outline-none"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => { setEditingConfig(null); setConfigError(null) }}
                      className="rounded border border-neutral-200 px-3 py-1.5 text-xs"
                    >
                      Avbryt
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveConfig(mod.id)}
                      disabled={saving === mod.id}
                      className="rounded bg-[#1a3d32] px-3 py-1.5 text-xs text-white disabled:opacity-50"
                    >
                      {saving === mod.id ? 'Lagrer…' : 'Lagre config'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
