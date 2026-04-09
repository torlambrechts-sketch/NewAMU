import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { getSupabaseBrowserClient } from '../../lib/supabaseClient'
import { getSupabaseErrorMessage } from '../../lib/supabaseError'
import { usePlatformAdmin } from '../../hooks/usePlatformAdmin'
import { ComponentDesignPreview } from '../../components/platform/ComponentDesignPreview'
import {
  cloneLayoutComposition,
  mergeLayoutComposition,
  newSlotId,
  type LayoutCompositionPayload,
  type LayoutCompositionSlot,
  type LayoutSlotSpan,
} from '../../types/layoutComposition'
import type { PlatformDesignerPayload } from '../../types/platformDesignerPayload'
import {
  mergePayload,
  clonePayloadForKind,
  payloadKind,
  inferDesignerKindFromUnknown,
} from '../../types/platformDesignerPayload'
import { ColorField, SelectField, TextField } from './boxDesigner/sharedFields'
import { LABEL, PANEL, SECTION } from './boxDesigner/fieldTokens'

type DesignTab = {
  localId: string
  dbId?: string
  referenceKey: string
  payload: LayoutCompositionPayload
}

type ComponentRow = {
  reference_key: string
  display_name: string
  payload: PlatformDesignerPayload
}

function slugKey(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '')
      .slice(0, 64) || 'layout'
  )
}

function spanClass(span: LayoutSlotSpan): string {
  switch (span) {
    case 'half':
      return 'col-span-12 md:col-span-6'
    case 'third':
      return 'col-span-12 md:col-span-4'
    default:
      return 'col-span-12'
  }
}

function alignClass(align: LayoutCompositionSlot['align']): string {
  switch (align) {
    case 'start':
      return 'self-start'
    case 'center':
      return 'self-center'
    case 'end':
      return 'self-end'
    default:
      return 'self-stretch'
  }
}

export function PlatformLayoutCompositionPage() {
  const { userId, isAdmin } = usePlatformAdmin()
  const supabase = getSupabaseBrowserClient()

  const [tabs, setTabs] = useState<DesignTab[]>(() => [
    {
      localId: crypto.randomUUID(),
      referenceKey: 'layout-dashboard',
      payload: cloneLayoutComposition(),
    },
  ])
  const [activeIdx, setActiveIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [library, setLibrary] = useState<ComponentRow[]>([])

  const active = tabs[activeIdx]

  const libraryMap = useMemo(() => {
    const m = new Map<string, PlatformDesignerPayload>()
    for (const row of library) {
      m.set(row.reference_key, row.payload)
    }
    return m
  }, [library])

  const libraryOptions = useMemo(() => {
    return library.map((r) => ({
      value: r.reference_key,
      label: `${r.reference_key} (${payloadKind(r.payload)})`,
    }))
  }, [library])

  const loadLibrary = useCallback(async () => {
    if (!supabase || !userId || !isAdmin) return
    try {
      const { data, error: e } = await supabase
        .from('platform_box_designs')
        .select('reference_key,display_name,payload')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
      if (e) throw e
      setLibrary(
        (data ?? []).map((row: { reference_key: string; display_name: string; payload: unknown }) => {
          const raw = row.payload
          const kind = inferDesignerKindFromUnknown(raw)
          const payload = mergePayload(clonePayloadForKind(kind), raw as object)
          return {
            reference_key: row.reference_key as string,
            display_name: row.display_name as string,
            payload,
          }
        }),
      )
    } catch {
      setLibrary([])
    }
  }, [supabase, userId, isAdmin])

  const loadCompositions = useCallback(async () => {
    if (!supabase || !userId || !isAdmin) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      await loadLibrary()
      const { data, error: e } = await supabase
        .from('platform_layout_compositions')
        .select('id,reference_key,display_name,payload,updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
      if (e) throw e
      const rows = (data ?? []) as { id: string; reference_key: string; display_name: string; payload: unknown }[]
      if (rows.length === 0) {
        setTabs([
          {
            localId: crypto.randomUUID(),
            referenceKey: 'layout-dashboard',
            payload: cloneLayoutComposition(),
          },
        ])
        setActiveIdx(0)
        return
      }
      setTabs(
        rows.map((row) => ({
          localId: crypto.randomUUID(),
          dbId: row.id as string,
          referenceKey: row.reference_key as string,
          payload: mergeLayoutComposition(row.payload as Partial<LayoutCompositionPayload>),
        })),
      )
      setActiveIdx(0)
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [supabase, userId, isAdmin, loadLibrary])

  useEffect(() => {
    void loadCompositions()
  }, [loadCompositions])

  const updatePayload = useCallback(
    (patch: Partial<LayoutCompositionPayload>) => {
      setTabs((prev) => {
        const next = [...prev]
        const cur = next[activeIdx]
        if (!cur) return prev
        next[activeIdx] = {
          ...cur,
          payload: mergeLayoutComposition({ ...cur.payload, ...patch }),
        }
        return next
      })
    },
    [activeIdx],
  )

  const updateSlot = useCallback(
    (slotId: string, patch: Partial<LayoutCompositionSlot>) => {
      setTabs((prev) => {
        const next = [...prev]
        const cur = next[activeIdx]
        if (!cur) return prev
        const slots = cur.payload.slots.map((s) => (s.id === slotId ? { ...s, ...patch } : s))
        next[activeIdx] = { ...cur, payload: { ...cur.payload, slots } }
        return next
      })
    },
    [activeIdx],
  )

  const addSlot = useCallback(() => {
    setTabs((prev) => {
      const next = [...prev]
      const cur = next[activeIdx]
      if (!cur) return prev
      const slot: LayoutCompositionSlot = {
        id: newSlotId(),
        label: `Seksjon ${cur.payload.slots.length + 1}`,
        componentReferenceKey: null,
        span: 'full',
        align: 'stretch',
      }
      next[activeIdx] = { ...cur, payload: { ...cur.payload, slots: [...cur.payload.slots, slot] } }
      return next
    })
  }, [activeIdx])

  const removeSlot = useCallback(
    (slotId: string) => {
      setTabs((prev) => {
        const next = [...prev]
        const cur = next[activeIdx]
        if (!cur || cur.payload.slots.length <= 1) return prev
        next[activeIdx] = {
          ...cur,
          payload: { ...cur.payload, slots: cur.payload.slots.filter((s) => s.id !== slotId) },
        }
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

  const addTab = useCallback(() => {
    const n = tabs.length + 1
    const referenceKey = `layout-${n}-${Math.random().toString(36).slice(2, 6)}`
    const payload = cloneLayoutComposition({
      metadata: { name: `Ny layout ${n}`, description: 'Legg til komponenter fra biblioteket.' },
    })
    setTabs((prev) => [...prev, { localId: crypto.randomUUID(), referenceKey, payload }])
    setActiveIdx(tabs.length)
    setMessage(null)
  }, [tabs.length])

  const removeTab = useCallback(
    async (idx: number) => {
      const tab = tabs[idx]
      if (!tab) return
      if (tabs.length <= 1) {
        setError('Minst én layout-fane må være åpen.')
        return
      }
      if (tab.dbId && supabase) {
        setBusy(true)
        setError(null)
        try {
          const { error: e } = await supabase.from('platform_layout_compositions').delete().eq('id', tab.dbId)
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
    if (!supabase || !userId || !isAdmin || !active) return
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
      const displayName = active.payload.metadata.name.trim() || key
      let newId = active.dbId
      if (active.dbId) {
        const { error: e } = await supabase
          .from('platform_layout_compositions')
          .update({
            reference_key: key,
            display_name: displayName,
            payload: active.payload,
          })
          .eq('id', active.dbId)
        if (e) throw e
      } else {
        const { data, error: e } = await supabase
          .from('platform_layout_compositions')
          .insert({
            user_id: userId,
            reference_key: key,
            display_name: displayName,
            payload: active.payload,
          })
          .select('id')
          .single()
        if (e) throw e
        newId = data?.id as string
      }
      setTabs((prev) => {
        const next = [...prev]
        const cur = next[activeIdx]
        if (cur) next[activeIdx] = { ...cur, referenceKey: key, dbId: newId }
        return next
      })
      setMessage(`Layout lagret som «${key}». Referer i prompt: layout:${key}`)
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }, [supabase, userId, isAdmin, active, activeIdx])

  const exportJson = useMemo(() => (active ? JSON.stringify(active.payload, null, 2) : ''), [active])

  const copyExport = useCallback(() => {
    void navigator.clipboard.writeText(exportJson)
    setMessage('JSON kopiert.')
  }, [exportJson])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-neutral-300">
        <Loader2 className="size-5 animate-spin" />
        Laster layout…
      </div>
    )
  }

  if (!active) {
    return <p className="text-neutral-400">Ingen fane.</p>
  }

  const p = active.payload
  const c = p.canvas

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Layout-bygger</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Design sider med navngitte faner. Hver rad er en <strong className="text-neutral-300">plassholder</strong> som peker til en lagret komponent i{' '}
          <span className="text-neutral-300">Komponentdesigner</span> (referansenøkkel). Opprett komponenter først, velg dem i hver slot.
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
        <button
          type="button"
          onClick={addTab}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/20 px-3 py-2 text-sm text-neutral-300 hover:border-white/40 hover:text-white"
        >
          <Plus className="size-4" />
          Ny layout
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,440px)]">
        <div className="space-y-4">
          <section className={SECTION}>
            <h2 className="text-sm font-semibold text-white">Identitet</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TextField label="Referansenøkkel (layout)" value={active.referenceKey} onChange={setReferenceKeyRaw} />
              <TextField label="metadata.name" value={p.metadata.name} onChange={(v) => updatePayload({ metadata: { ...p.metadata, name: v } })} />
            </div>
            <label className={`${LABEL} mt-3`}>
              Beskrivelse
              <textarea
                value={p.metadata.description}
                onChange={(e) => updatePayload({ metadata: { ...p.metadata, description: e.target.value } })}
                rows={2}
                className={PANEL}
              />
            </label>
          </section>

          <section className={SECTION}>
            <h2 className="text-sm font-semibold text-white">Lerret (canvas)</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TextField label="maxWidth" value={c.maxWidth} onChange={(v) => updatePayload({ canvas: { ...c, maxWidth: v } })} />
              <TextField label="padding" value={c.padding} onChange={(v) => updatePayload({ canvas: { ...c, padding: v } })} />
              <TextField label="gap (mellom rader)" value={c.gap} onChange={(v) => updatePayload({ canvas: { ...c, gap: v } })} />
              <TextField label="minHeight" value={c.minHeight} onChange={(v) => updatePayload({ canvas: { ...c, minHeight: v } })} />
              <ColorField label="backgroundColor" value={c.backgroundColor} onChange={(v) => updatePayload({ canvas: { ...c, backgroundColor: v } })} />
              <TextField label="borderRadius" value={c.borderRadius} onChange={(v) => updatePayload({ canvas: { ...c, borderRadius: v } })} />
              <TextField label="borderWidth" value={c.borderWidth} onChange={(v) => updatePayload({ canvas: { ...c, borderWidth: v } })} />
              <TextField label="borderStyle" value={c.borderStyle} onChange={(v) => updatePayload({ canvas: { ...c, borderStyle: v } })} />
              <ColorField label="borderColor" value={c.borderColor} onChange={(v) => updatePayload({ canvas: { ...c, borderColor: v } })} />
              <label className={`${LABEL} sm:col-span-2`}>
                backgroundGradient (valgfritt)
                <textarea
                  value={c.backgroundGradient}
                  onChange={(e) => updatePayload({ canvas: { ...c, backgroundGradient: e.target.value } })}
                  rows={2}
                  className={PANEL}
                  placeholder="linear-gradient(...)"
                />
              </label>
            </div>
          </section>

          <section className={SECTION}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">Komponentplassering (slots)</h2>
              <button
                type="button"
                onClick={addSlot}
                className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-xs text-neutral-300 hover:bg-white/5"
              >
                <Plus className="size-3.5" />
                Ny rad
              </button>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Bibliotek: {library.length} komponent(er). Opprett flere i Komponentdesigner hvis listen er tom.
            </p>
            <div className="mt-4 space-y-4">
              {p.slots.map((slot) => (
                <div key={slot.id} className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <TextField label="Etikett (redigeringsnavn)" value={slot.label} onChange={(v) => updateSlot(slot.id, { label: v })} />
                    <button
                      type="button"
                      onClick={() => removeSlot(slot.id)}
                      className="mt-6 rounded p-1.5 text-neutral-500 hover:bg-white/10 hover:text-red-300"
                      title="Fjern rad"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <SelectField
                      label="Komponent (referanse)"
                      value={slot.componentReferenceKey ?? ''}
                      options={[{ value: '', label: '— Ingen —' }, ...libraryOptions.map((o) => ({ value: o.value, label: o.label }))]}
                      onChange={(v) => updateSlot(slot.id, { componentReferenceKey: v || null })}
                    />
                    <SelectField
                      label="Bredde (kolonne)"
                      value={slot.span}
                      options={[
                        { value: 'full', label: 'Full bredde (12/12)' },
                        { value: 'half', label: 'Halv (6/12)' },
                        { value: 'third', label: 'Tredjedel (4/12)' },
                      ]}
                      onChange={(v) => updateSlot(slot.id, { span: v as LayoutSlotSpan })}
                    />
                    <SelectField
                      label="Justering (vertikal)"
                      value={slot.align}
                      options={[
                        { value: 'stretch', label: 'stretch' },
                        { value: 'start', label: 'start' },
                        { value: 'center', label: 'center' },
                        { value: 'end', label: 'end' },
                      ]}
                      onChange={(v) => updateSlot(slot.id, { align: v as LayoutCompositionSlot['align'] })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveActive()}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500/90 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Lagre layout
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
            <div
              className="mt-4 grid grid-cols-12"
              style={{
                maxWidth: c.maxWidth,
                margin: '0 auto',
                padding: c.padding,
                gap: c.gap,
                minHeight: c.minHeight,
                borderRadius: c.borderRadius,
                borderWidth: c.borderWidth,
                borderStyle: c.borderStyle,
                borderColor: c.borderColor,
                background: c.backgroundGradient?.trim() || c.backgroundColor,
              }}
            >
              {p.slots.map((slot) => {
                const comp = slot.componentReferenceKey ? libraryMap.get(slot.componentReferenceKey) : undefined
                return (
                  <div key={slot.id} className={`${spanClass(slot.span)} ${alignClass(slot.align)} min-w-0`}>
                    <div className="rounded-lg border border-dashed border-black/10 bg-white/40 p-2 text-[10px] uppercase tracking-wide text-neutral-600">
                      {slot.label}
                      {slot.componentReferenceKey ? (
                        <span className="ml-1 font-mono normal-case text-neutral-800">→ {slot.componentReferenceKey}</span>
                      ) : (
                        <span className="ml-1 normal-case text-amber-800"> (ingen komponent)</span>
                      )}
                    </div>
                    <div className="mt-2 overflow-hidden rounded-lg bg-white/90">
                      {comp ? (
                        <ComponentDesignPreview payload={comp} />
                      ) : (
                        <p className="p-6 text-center text-sm text-neutral-500">Velg en komponent for denne plassen.</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Rå JSON</p>
            <pre className="mt-2 max-h-[min(360px,40vh)] overflow-auto rounded-lg bg-black/30 p-3 text-[10px] leading-relaxed text-emerald-100/90">
              {exportJson}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
