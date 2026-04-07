import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { getSupabaseBrowserClient } from '../../lib/supabaseClient'
import { getSupabaseErrorMessage } from '../../lib/supabaseError'
import { usePlatformAdmin } from '../../hooks/usePlatformAdmin'
import { UiBoxCorePreview } from '../../components/platform/UiBoxCorePreview'
import { UiTableCorePreview } from '../../components/platform/UiTableCorePreview'
import { UiMenuCorePreview } from '../../components/platform/UiMenuCorePreview'
import { UiButtonCorePreview } from '../../components/platform/UiButtonCorePreview'
import {
  clonePayloadForKind,
  mergePayload,
  payloadKind,
  type PlatformDesignerKind,
  type PlatformDesignerPayload,
  DESIGNER_KIND_LABELS,
} from '../../types/platformDesignerPayload'
import { UI_TABLE_CORE_ID } from '../../types/uiTableCore'
import { UI_MENU_CORE_ID } from '../../types/uiMenuCore'
import { UI_BUTTON_CORE_ID } from '../../types/uiButtonCore'
import { BoxCoreForm } from './boxDesigner/BoxCoreForm'
import { TableCoreForm } from './boxDesigner/TableCoreForm'
import { MenuCoreForm } from './boxDesigner/MenuCoreForm'
import { ButtonCoreForm } from './boxDesigner/ButtonCoreForm'
import { SelectField, TextField } from './boxDesigner/sharedFields'
import { LABEL, PANEL, SECTION } from './boxDesigner/fieldTokens'
import type { UiBoxCoreDesign } from '../../types/uiBoxCore'
import type { UiTableCoreDesign } from '../../types/uiTableCore'
import type { UiMenuCoreDesign } from '../../types/uiMenuCore'
import type { UiButtonCoreDesign } from '../../types/uiButtonCore'

type DesignTab = {
  localId: string
  dbId?: string
  referenceKey: string
  kind: PlatformDesignerKind
  design: PlatformDesignerPayload
}

function slugKey(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '')
      .slice(0, 64) || 'design'
  )
}

function inferKindFromPayload(p: unknown): PlatformDesignerKind {
  if (p && typeof p === 'object' && 'componentId' in p) {
    const id = (p as { componentId: string }).componentId
    if (id === UI_TABLE_CORE_ID) return 'ui_table_core'
    if (id === UI_MENU_CORE_ID) return 'ui_menu_core'
    if (id === UI_BUTTON_CORE_ID) return 'ui_button_core'
  }
  return 'ui_box_core'
}

export function PlatformBoxDesignerPage() {
  const { userId, isAdmin } = usePlatformAdmin()
  const supabase = getSupabaseBrowserClient()

  const [tabs, setTabs] = useState<DesignTab[]>(() => [
    {
      localId: crypto.randomUUID(),
      referenceKey: 'mainbox-1',
      kind: 'ui_box_core',
      design: clonePayloadForKind('ui_box_core'),
    },
  ])
  const [activeIdx, setActiveIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [newKind, setNewKind] = useState<PlatformDesignerKind>('ui_box_core')

  const active = tabs[activeIdx]

  const loadDesigns = useCallback(async () => {
    if (!supabase || !userId || !isAdmin) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('platform_box_designs')
        .select('id,reference_key,display_name,payload,updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (e) throw e
      const rows = data ?? []
      if (rows.length === 0) {
        setTabs([
          {
            localId: crypto.randomUUID(),
            referenceKey: 'mainbox-1',
            kind: 'ui_box_core',
            design: clonePayloadForKind('ui_box_core'),
          },
        ])
        setActiveIdx(0)
        return
      }

      setTabs(
        rows.map((row) => {
          const raw = row.payload as Record<string, unknown>
          const kind = inferKindFromPayload(raw)
          const design = mergePayload(clonePayloadForKind(kind), raw as Partial<PlatformDesignerPayload>)
          if (design.metadata) {
            design.metadata.name = (row.display_name as string) || design.metadata.name
          }
          return {
            localId: crypto.randomUUID(),
            dbId: row.id as string,
            referenceKey: row.reference_key as string,
            kind,
            design,
          }
        }),
      )
      setActiveIdx(0)
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [supabase, userId, isAdmin])

  useEffect(() => {
    void loadDesigns()
  }, [loadDesigns])

  const updateActive = useCallback(
    (patch: Partial<PlatformDesignerPayload>) => {
      setTabs((prev) => {
        const next = [...prev]
        const cur = next[activeIdx]
        if (!cur) return prev
        const design = mergePayload(structuredClone(cur.design), patch)
        next[activeIdx] = { ...cur, design, kind: payloadKind(design) }
        return next
      })
    },
    [activeIdx],
  )

  const setReferenceKeyRaw = useCallback(
    (referenceKey: string) => {
      setTabs((prev) => {
        const next = [...prev]
        const cur = next[activeIdx]
        if (!cur) return prev
        next[activeIdx] = { ...cur, referenceKey }
        return next
      })
    },
    [activeIdx],
  )

  const changeKind = useCallback(
    (kind: PlatformDesignerKind) => {
      setTabs((prev) => {
        const next = [...prev]
        const cur = next[activeIdx]
        if (!cur) return prev
        const fresh = clonePayloadForKind(kind)
        const name = cur.design.metadata?.name ?? cur.referenceKey
        fresh.metadata.name = name
        next[activeIdx] = { ...cur, kind, design: fresh }
        return next
      })
    },
    [activeIdx],
  )

  const defaultRefForKind = (kind: PlatformDesignerKind): string => {
    switch (kind) {
      case 'ui_table_core':
        return 'table-1'
      case 'ui_menu_core':
        return 'menu-1'
      case 'ui_button_core':
        return 'button-primary'
      default:
        return 'mainbox-1'
    }
  }

  const addTab = useCallback(() => {
    const kind = newKind
    const referenceKey = `${defaultRefForKind(kind)}-${Math.random().toString(36).slice(2, 6)}`
    const design = clonePayloadForKind(kind)
    design.metadata.name = referenceKey
    setTabs((prev) => [
      ...prev,
      {
        localId: crypto.randomUUID(),
        referenceKey,
        kind,
        design,
      },
    ])
    setActiveIdx(tabs.length)
    setMessage(null)
  }, [newKind, tabs.length])

  const removeTab = useCallback(
    async (idx: number) => {
      const tab = tabs[idx]
      if (!tab) return
      if (tabs.length <= 1) {
        setError('Minst én fane må være åpen.')
        return
      }
      if (tab.dbId && supabase) {
        setBusy(true)
        setError(null)
        try {
          const { error: e } = await supabase.from('platform_box_designs').delete().eq('id', tab.dbId)
          if (e) throw e
        } catch (err) {
          setError(getSupabaseErrorMessage(err))
          setBusy(false)
          return
        }
        setBusy(false)
      }
      setTabs((prev) => prev.filter((_, i) => i !== idx))
      setActiveIdx((i) => {
        if (i === idx) return Math.max(0, idx - 1)
        if (i > idx) return i - 1
        return i
      })
    },
    [supabase, tabs],
  )

  const saveActive = useCallback(async () => {
    if (!supabase || !userId || !isAdmin || !active) {
      setError('Kan ikke lagre.')
      return
    }
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const key = slugKey(active.referenceKey)
      if (!key) {
        setError('Referansenøkkel kan ikke være tom.')
        setBusy(false)
        return
      }
      const displayName = active.design.metadata?.name?.trim() || key
      const row = {
        user_id: userId,
        reference_key: key,
        display_name: displayName,
        payload: active.design,
      }
      let newId = active.dbId
      if (active.dbId) {
        const { error: e } = await supabase
          .from('platform_box_designs')
          .update({
            reference_key: key,
            display_name: displayName,
            payload: active.design,
          })
          .eq('id', active.dbId)
        if (e) throw e
      } else {
        const { data, error: e } = await supabase.from('platform_box_designs').insert(row).select('id').single()
        if (e) throw e
        newId = data?.id as string
      }
      setTabs((prev) => {
        const next = [...prev]
        const cur = next[activeIdx]
        if (cur) next[activeIdx] = { ...cur, referenceKey: key, dbId: newId }
        return next
      })
      setMessage(
        `Lagret «${key}» (${active.design.componentId}). Bruk referansen: ${key}`,
      )
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }, [supabase, userId, isAdmin, active, activeIdx])

  const exportJson = useMemo(() => {
    if (!active) return ''
    return JSON.stringify(active.design, null, 2)
  }, [active])

  const copyExport = useCallback(() => {
    void navigator.clipboard.writeText(exportJson)
    setMessage('JSON kopiert til utklippstavlen.')
  }, [exportJson])

  const previewHint = useMemo(() => {
    if (!active) return ''
    switch (active.kind) {
      case 'ui_table_core':
        return 'Eksempeldata — juster thead/tbody/td.'
      case 'ui_menu_core':
        return 'Klikk faner; hold over inaktiv for hover.'
      case 'ui_button_core':
        return 'Hover, trykk (active), Tab for fokus; disabled til høyre.'
      default:
        return 'Hold pekeren over boksen for hover.'
    }
  }, [active])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-neutral-300">
        <Loader2 className="size-5 animate-spin" />
        Laster komponentdesign…
      </div>
    )
  }

  if (!active) {
    return <p className="text-neutral-400">Ingen fane.</p>
  }

  const d = active.design
  const kind = active.kind

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Komponentdesigner</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Detaljerte spesifikasjoner for <code className="rounded bg-white/10 px-1">ui_box_core</code>,{' '}
          <code className="rounded bg-white/10 px-1">ui_table_core</code>, <code className="rounded bg-white/10 px-1">ui_menu_core</code> og{' '}
          <code className="rounded bg-white/10 px-1">ui_button_core</code>. Lagre med unik referansenøkkel.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
        {tabs.map((tab, idx) => (
          <div key={tab.localId} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                idx === activeIdx ? 'bg-white/15 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-white'
              }`}
              title={tab.kind}
            >
              {tab.referenceKey}
            </button>
            <button
              type="button"
              onClick={() => void removeTab(idx)}
              className="rounded p-1.5 text-neutral-500 hover:bg-white/10 hover:text-red-300"
              title="Fjern fane"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <SelectField
            value={newKind}
            options={(Object.keys(DESIGNER_KIND_LABELS) as PlatformDesignerKind[]).map((k) => ({
              value: k,
              label: DESIGNER_KIND_LABELS[k],
            }))}
            onChange={(v) => setNewKind(v)}
            className="text-xs text-neutral-400"
          />
          <button
            type="button"
            onClick={addTab}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/20 px-3 py-2 text-sm text-neutral-300 hover:border-white/40 hover:text-white"
          >
            <Plus className="size-4" />
            Ny komponent
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div className="space-y-4">
          <section className={SECTION}>
            <h2 className="text-sm font-semibold text-white">Identitet og referanse</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TextField label="Referansenøkkel (unik)" value={active.referenceKey} onChange={(v) => setReferenceKeyRaw(v)} />
              <TextField label="metadata.name" value={d.metadata?.name ?? ''} onChange={(v) => updateActive({ metadata: { ...d.metadata!, name: v } })} />
            </div>
            <label className={`${LABEL} mt-3`}>
              Beskrivelse
              <textarea
                value={d.metadata?.description ?? ''}
                onChange={(e) => updateActive({ metadata: { ...d.metadata!, description: e.target.value } })}
                rows={2}
                className={PANEL}
              />
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Komponenttype"
                value={kind}
                options={(Object.keys(DESIGNER_KIND_LABELS) as PlatformDesignerKind[]).map((k) => ({
                  value: k,
                  label: DESIGNER_KIND_LABELS[k],
                }))}
                onChange={(k) => changeKind(k)}
              />
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              Versjon: <code className="text-neutral-400">{d.version}</code> · ID:{' '}
              <code className="text-neutral-400">{d.componentId}</code>
            </p>
          </section>

          {kind === 'ui_box_core' && <BoxCoreForm d={d as UiBoxCoreDesign} update={updateActive} />}
          {kind === 'ui_table_core' && <TableCoreForm d={d as UiTableCoreDesign} update={updateActive} />}
          {kind === 'ui_menu_core' && <MenuCoreForm d={d as UiMenuCoreDesign} update={updateActive} />}
          {kind === 'ui_button_core' && <ButtonCoreForm d={d as UiButtonCoreDesign} update={updateActive} />}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveActive()}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500/90 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Lagre aktivt design
            </button>
            <button
              type="button"
              onClick={copyExport}
              className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-neutral-200 hover:bg-white/5"
            >
              Kopier JSON
            </button>
          </div>
        </div>

        <div className="lg:sticky lg:top-4 h-fit space-y-3">
          <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Forhåndsvisning</p>
            <p className="mt-1 text-xs text-neutral-500">{previewHint}</p>
            <div className="mt-4 rounded-lg bg-[#e8e4dc] p-4">
              {kind === 'ui_box_core' && <UiBoxCorePreview design={d as UiBoxCoreDesign} />}
              {kind === 'ui_table_core' && <UiTableCorePreview design={d as UiTableCoreDesign} />}
              {kind === 'ui_menu_core' && <UiMenuCorePreview design={d as UiMenuCoreDesign} />}
              {kind === 'ui_button_core' && <UiButtonCorePreview design={d as UiButtonCoreDesign} />}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Rå JSON</p>
            <pre className="mt-2 max-h-[min(480px,50vh)] overflow-auto rounded-lg bg-black/30 p-3 text-[10px] leading-relaxed text-emerald-100/90">
              {exportJson}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
