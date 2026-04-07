import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { getSupabaseBrowserClient } from '../../lib/supabaseClient'
import { getSupabaseErrorMessage } from '../../lib/supabaseError'
import { usePlatformAdmin } from '../../hooks/usePlatformAdmin'
import { UiBoxCorePreview } from '../../components/platform/UiBoxCorePreview'
import {
  cloneUiBoxCore,
  deepMergeUiBox,
  type UiBoxCoreDesign,
} from '../../types/uiBoxCore'

const PANEL = 'mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-sm text-white'
const SECTION = 'rounded-xl border border-white/10 bg-slate-900/40 p-4'
const LABEL = 'block text-xs font-medium text-neutral-400'

type DesignTab = {
  localId: string
  dbId?: string
  /** Stable key for prompts / cross-reference */
  referenceKey: string
  design: UiBoxCoreDesign
}

function slugKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
    .slice(0, 64) || 'box'
}

function hexForPicker(value: string): string {
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) return value
  return '#ffffff'
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (next: string) => void
}) {
  return (
    <label className={LABEL}>
      {label}
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={hexForPicker(value)}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 shrink-0 cursor-pointer rounded border border-white/10 bg-transparent p-0"
          aria-label={label}
        />
        <input value={value} onChange={(e) => onChange(e.target.value)} className={PANEL} />
      </div>
    </label>
  )
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (next: string) => void
}) {
  return (
    <label className={LABEL}>
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} className={PANEL} />
    </label>
  )
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  label: string
  value: number
  onChange: (next: number) => void
  step?: number
  min?: number
  max?: number
}) {
  return (
    <label className={LABEL}>
      {label}
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={PANEL}
      />
    </label>
  )
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (next: T) => void
}) {
  return (
    <label className={LABEL}>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className={PANEL}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function PlatformBoxDesignerPage() {
  const { userId, isAdmin } = usePlatformAdmin()
  const supabase = getSupabaseBrowserClient()

  const [tabs, setTabs] = useState<DesignTab[]>(() => [
    {
      localId: crypto.randomUUID(),
      referenceKey: 'mainbox-1',
      design: cloneUiBoxCore(),
    },
  ])
  const [activeIdx, setActiveIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

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
            design: cloneUiBoxCore(),
          },
        ])
        setActiveIdx(0)
        return
      }

      setTabs(
        rows.map((row) => {
          const raw = row.payload as Partial<UiBoxCoreDesign>
          const design = deepMergeUiBox(cloneUiBoxCore(), raw)
          design.metadata.name = (row.display_name as string) || design.metadata.name
          return {
            localId: crypto.randomUUID(),
            dbId: row.id as string,
            referenceKey: row.reference_key as string,
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

  const updateActive = useCallback((patch: Partial<UiBoxCoreDesign> | ((d: UiBoxCoreDesign) => UiBoxCoreDesign)) => {
    setTabs((prev) => {
      const next = [...prev]
      const cur = next[activeIdx]
      if (!cur) return prev
      const design =
        typeof patch === 'function'
          ? patch(structuredClone(cur.design))
          : deepMergeUiBox(structuredClone(cur.design), patch)
      next[activeIdx] = { ...cur, design }
      return next
    })
  }, [activeIdx])

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
    const referenceKey = `box-${n}-${Math.random().toString(36).slice(2, 7)}`
    setTabs((prev) => [
      ...prev,
      {
        localId: crypto.randomUUID(),
        referenceKey,
        design: cloneUiBoxCore({
          metadata: {
            name: `Ny boks ${n}`,
            description: 'Tilpass i panelet til venstre.',
          },
        }),
      },
    ])
    setActiveIdx(tabs.length)
    setMessage(null)
  }, [tabs.length])

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
      const displayName = active.design.metadata.name.trim() || key
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
        const { data, error: e } = await supabase
          .from('platform_box_designs')
          .insert(row)
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
      setMessage(`Lagret «${key}». Bruk referansen i prompt eller dokumentasjon: ${key}`)
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

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-neutral-300">
        <Loader2 className="size-5 animate-spin" />
        Laster boksdesign…
      </div>
    )
  }

  if (!active) {
    return <p className="text-neutral-400">Ingen fane.</p>
  }

  const d = active.design

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Boksdesigner</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Avansert redigering av <code className="rounded bg-white/10 px-1">ui_box_core</code>. Lagre med unik referansenøkkel du kan bruke senere i prompt eller dokumentasjon.
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
          Ny boks
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div className="space-y-4">
          <section className={SECTION}>
            <h2 className="text-sm font-semibold text-white">Identitet og referanse</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TextField
                label="Referansenøkkel (unik, normaliseres ved lagring)"
                value={active.referenceKey}
                onChange={(v) => setReferenceKeyRaw(v)}
              />
              <TextField
                label="metadata.name (JSON)"
                value={d.metadata.name}
                onChange={(v) => updateActive({ metadata: { ...d.metadata, name: v } })}
              />
            </div>
            <label className={`${LABEL} mt-3`}>
              Beskrivelse
              <textarea
                value={d.metadata.description}
                onChange={(e) => updateActive({ metadata: { ...d.metadata, description: e.target.value } })}
                rows={2}
                className={PANEL}
              />
            </label>
            <p className="mt-2 text-xs text-neutral-500">
              Versjon: <code className="text-neutral-400">{d.version}</code> · Komponent:{' '}
              <code className="text-neutral-400">{d.componentId}</code>
            </p>
          </section>

          <section className={SECTION}>
            <h2 className="text-sm font-semibold text-white">Layout</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TextField label="display" value={d.layout.display} onChange={(v) => updateActive({ layout: { ...d.layout, display: v } })} />
              <TextField label="position" value={d.layout.position} onChange={(v) => updateActive({ layout: { ...d.layout, position: v } })} />
              <TextField label="width" value={d.layout.width} onChange={(v) => updateActive({ layout: { ...d.layout, width: v } })} />
              <TextField label="height" value={d.layout.height} onChange={(v) => updateActive({ layout: { ...d.layout, height: v } })} />
              <TextField label="minHeight" value={d.layout.minHeight} onChange={(v) => updateActive({ layout: { ...d.layout, minHeight: v } })} />
              <TextField label="margin" value={d.layout.margin} onChange={(v) => updateActive({ layout: { ...d.layout, margin: v } })} />
              <TextField label="padding" value={d.layout.padding} onChange={(v) => updateActive({ layout: { ...d.layout, padding: v } })} />
              <TextField label="overflow" value={d.layout.overflow} onChange={(v) => updateActive({ layout: { ...d.layout, overflow: v } })} />
              <TextField label="zIndex" value={d.layout.zIndex} onChange={(v) => updateActive({ layout: { ...d.layout, zIndex: v } })} />
            </div>
          </section>

          <section className={SECTION}>
            <h2 className="text-sm font-semibold text-white">Flexbox</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TextField
                label="flexDirection"
                value={d.flexbox.flexDirection}
                onChange={(v) => updateActive({ flexbox: { ...d.flexbox, flexDirection: v } })}
              />
              <TextField
                label="justifyContent"
                value={d.flexbox.justifyContent}
                onChange={(v) => updateActive({ flexbox: { ...d.flexbox, justifyContent: v } })}
              />
              <TextField
                label="alignItems"
                value={d.flexbox.alignItems}
                onChange={(v) => updateActive({ flexbox: { ...d.flexbox, alignItems: v } })}
              />
              <TextField label="gap" value={d.flexbox.gap} onChange={(v) => updateActive({ flexbox: { ...d.flexbox, gap: v } })} />
              <TextField
                label="flexWrap"
                value={d.flexbox.flexWrap}
                onChange={(v) => updateActive({ flexbox: { ...d.flexbox, flexWrap: v } })}
              />
            </div>
          </section>

          <section className={SECTION}>
            <h2 className="text-sm font-semibold text-white">Typografi</h2>
            <p className="mt-1 text-xs text-neutral-500">Base</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <TextField
                label="fontFamily"
                value={d.typography.base.fontFamily}
                onChange={(v) => updateActive({ typography: { ...d.typography, base: { ...d.typography.base, fontFamily: v } } })}
              />
              <ColorField
                label="base color"
                value={d.typography.base.color}
                onChange={(v) => updateActive({ typography: { ...d.typography, base: { ...d.typography.base, color: v } } })}
              />
              <SelectField
                label="textAlign"
                value={d.typography.base.textAlign as 'left' | 'center' | 'right' | 'justify'}
                options={[
                  { value: 'left', label: 'left' },
                  { value: 'center', label: 'center' },
                  { value: 'right', label: 'right' },
                  { value: 'justify', label: 'justify' },
                ]}
                onChange={(v) => updateActive({ typography: { ...d.typography, base: { ...d.typography.base, textAlign: v } } })}
              />
              <TextField
                label="fontSize"
                value={d.typography.base.fontSize}
                onChange={(v) => updateActive({ typography: { ...d.typography, base: { ...d.typography.base, fontSize: v } } })}
              />
              <TextField
                label="lineHeight"
                value={d.typography.base.lineHeight}
                onChange={(v) => updateActive({ typography: { ...d.typography, base: { ...d.typography.base, lineHeight: v } } })}
              />
            </div>
            <p className="mt-4 text-xs text-neutral-500">Overskrift</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  className="rounded border-white/20"
                  checked={d.typography.heading.enabled}
                  onChange={(e) =>
                    updateActive({
                      typography: {
                        ...d.typography,
                        heading: { ...d.typography.heading, enabled: e.target.checked },
                      },
                    })
                  }
                />
                Aktivert
              </label>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TextField
                label="Tekst"
                value={d.typography.heading.text}
                onChange={(v) => updateActive({ typography: { ...d.typography, heading: { ...d.typography.heading, text: v } } })}
              />
              <SelectField
                label="tag"
                value={d.typography.heading.tag}
                options={[
                  { value: 'h1', label: 'h1' },
                  { value: 'h2', label: 'h2' },
                  { value: 'h3', label: 'h3' },
                  { value: 'h4', label: 'h4' },
                  { value: 'h5', label: 'h5' },
                  { value: 'h6', label: 'h6' },
                  { value: 'div', label: 'div' },
                ]}
                onChange={(v) => updateActive({ typography: { ...d.typography, heading: { ...d.typography.heading, tag: v } } })}
              />
              <ColorField
                label="heading color"
                value={d.typography.heading.color}
                onChange={(v) => updateActive({ typography: { ...d.typography, heading: { ...d.typography.heading, color: v } } })}
              />
              <TextField
                label="fontSize"
                value={d.typography.heading.fontSize}
                onChange={(v) => updateActive({ typography: { ...d.typography, heading: { ...d.typography.heading, fontSize: v } } })}
              />
              <TextField
                label="fontWeight"
                value={d.typography.heading.fontWeight}
                onChange={(v) => updateActive({ typography: { ...d.typography, heading: { ...d.typography.heading, fontWeight: v } } })}
              />
              <TextField
                label="lineHeight"
                value={d.typography.heading.lineHeight}
                onChange={(v) => updateActive({ typography: { ...d.typography, heading: { ...d.typography.heading, lineHeight: v } } })}
              />
              <TextField
                label="letterSpacing"
                value={d.typography.heading.letterSpacing}
                onChange={(v) => updateActive({ typography: { ...d.typography, heading: { ...d.typography.heading, letterSpacing: v } } })}
              />
              <TextField
                label="textTransform"
                value={d.typography.heading.textTransform}
                onChange={(v) => updateActive({ typography: { ...d.typography, heading: { ...d.typography.heading, textTransform: v } } })}
              />
              <TextField
                label="marginBottom"
                value={d.typography.heading.marginBottom}
                onChange={(v) => updateActive({ typography: { ...d.typography, heading: { ...d.typography.heading, marginBottom: v } } })}
              />
            </div>
          </section>

          <section className={SECTION}>
            <h2 className="text-sm font-semibold text-white">Styling og bakgrunn</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <ColorField
                label="backgroundColor"
                value={d.styling.backgroundColor}
                onChange={(v) => updateActive({ styling: { ...d.styling, backgroundColor: v } })}
              />
              <NumberField
                label="opacity"
                value={d.styling.opacity}
                step={0.05}
                min={0}
                max={1}
                onChange={(v) => updateActive({ styling: { ...d.styling, opacity: Math.min(1, Math.max(0, v)) } })}
              />
              <label className={`${LABEL} sm:col-span-2`}>
                backgroundGradient (CSS)
                <textarea
                  value={d.styling.backgroundGradient}
                  onChange={(e) => updateActive({ styling: { ...d.styling, backgroundGradient: e.target.value } })}
                  rows={2}
                  placeholder="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                  className={PANEL}
                />
              </label>
              <TextField
                label="backgroundImage (url eller kort)"
                value={d.styling.backgroundImage}
                onChange={(v) => updateActive({ styling: { ...d.styling, backgroundImage: v } })}
              />
              <TextField
                label="backgroundSize"
                value={d.styling.backgroundSize}
                onChange={(v) => updateActive({ styling: { ...d.styling, backgroundSize: v } })}
              />
              <TextField
                label="backgroundPosition"
                value={d.styling.backgroundPosition}
                onChange={(v) => updateActive({ styling: { ...d.styling, backgroundPosition: v } })}
              />
              <TextField
                label="backgroundAttachment"
                value={d.styling.backgroundAttachment}
                onChange={(v) => updateActive({ styling: { ...d.styling, backgroundAttachment: v } })}
              />
              <TextField
                label="backgroundBlendMode"
                value={d.styling.backgroundBlendMode}
                onChange={(v) => updateActive({ styling: { ...d.styling, backgroundBlendMode: v } })}
              />
            </div>
          </section>

          <section className={SECTION}>
            <h2 className="text-sm font-semibold text-white">Avanserte effekter</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TextField
                label="backdropFilter"
                value={d.advancedVisuals.backdropFilter}
                onChange={(v) => updateActive({ advancedVisuals: { ...d.advancedVisuals, backdropFilter: v } })}
              />
              <TextField
                label="filter"
                value={d.advancedVisuals.filter}
                onChange={(v) => updateActive({ advancedVisuals: { ...d.advancedVisuals, filter: v } })}
              />
              <TextField
                label="clipPath"
                value={d.advancedVisuals.clipPath}
                onChange={(v) => updateActive({ advancedVisuals: { ...d.advancedVisuals, clipPath: v } })}
              />
              <TextField
                label="mixBlendMode"
                value={d.advancedVisuals.mixBlendMode}
                onChange={(v) => updateActive({ advancedVisuals: { ...d.advancedVisuals, mixBlendMode: v } })}
              />
            </div>
          </section>

          <section className={SECTION}>
            <h2 className="text-sm font-semibold text-white">Ramme og skygge</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TextField
                label="borderWidth"
                value={d.borders.borderWidth}
                onChange={(v) => updateActive({ borders: { ...d.borders, borderWidth: v } })}
              />
              <TextField
                label="borderStyle"
                value={d.borders.borderStyle}
                onChange={(v) => updateActive({ borders: { ...d.borders, borderStyle: v } })}
              />
              <ColorField
                label="borderColor"
                value={d.borders.borderColor}
                onChange={(v) => updateActive({ borders: { ...d.borders, borderColor: v } })}
              />
              <TextField
                label="borderRadius"
                value={d.borders.borderRadius}
                onChange={(v) => updateActive({ borders: { ...d.borders, borderRadius: v } })}
              />
              <label className={`${LABEL} sm:col-span-2`}>
                boxShadow
                <textarea
                  value={d.borders.boxShadow}
                  onChange={(e) => updateActive({ borders: { ...d.borders, boxShadow: e.target.value } })}
                  rows={2}
                  className={PANEL}
                />
              </label>
            </div>
          </section>

          <section className={SECTION}>
            <h2 className="text-sm font-semibold text-white">Transforms</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <NumberField
                label="scale"
                value={d.transforms.scale}
                step={0.05}
                min={0.1}
                max={3}
                onChange={(v) => updateActive({ transforms: { ...d.transforms, scale: v } })}
              />
              <TextField
                label="rotate"
                value={d.transforms.rotate}
                onChange={(v) => updateActive({ transforms: { ...d.transforms, rotate: v } })}
              />
              <TextField
                label="translateX"
                value={d.transforms.translateX}
                onChange={(v) => updateActive({ transforms: { ...d.transforms, translateX: v } })}
              />
              <TextField
                label="translateY"
                value={d.transforms.translateY}
                onChange={(v) => updateActive({ transforms: { ...d.transforms, translateY: v } })}
              />
              <TextField label="skewX" value={d.transforms.skewX} onChange={(v) => updateActive({ transforms: { ...d.transforms, skewX: v } })} />
              <TextField label="skewY" value={d.transforms.skewY} onChange={(v) => updateActive({ transforms: { ...d.transforms, skewY: v } })} />
              <TextField
                label="transformOrigin"
                value={d.transforms.transformOrigin}
                onChange={(v) => updateActive({ transforms: { ...d.transforms, transformOrigin: v } })}
              />
            </div>
          </section>

          <section className={SECTION}>
            <h2 className="text-sm font-semibold text-white">Animasjon</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TextField
                label="transitionProperty"
                value={d.animation.transitionProperty}
                onChange={(v) => updateActive({ animation: { ...d.animation, transitionProperty: v } })}
              />
              <TextField
                label="transitionDuration"
                value={d.animation.transitionDuration}
                onChange={(v) => updateActive({ animation: { ...d.animation, transitionDuration: v } })}
              />
              <TextField
                label="transitionTimingFunction"
                value={d.animation.transitionTimingFunction}
                onChange={(v) => updateActive({ animation: { ...d.animation, transitionTimingFunction: v } })}
              />
              <TextField
                label="transitionDelay"
                value={d.animation.transitionDelay}
                onChange={(v) => updateActive({ animation: { ...d.animation, transitionDelay: v } })}
              />
              <TextField
                label="entranceAnimation"
                value={d.animation.entranceAnimation}
                onChange={(v) => updateActive({ animation: { ...d.animation, entranceAnimation: v } })}
              />
            </div>
          </section>

          <section className={SECTION}>
            <h2 className="text-sm font-semibold text-white">Interaksjon (hover)</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TextField
                label="cursor"
                value={d.interaction.cursor}
                onChange={(v) => updateActive({ interaction: { ...d.interaction, cursor: v } })}
              />
              <ColorField
                label="hover backgroundColor"
                value={d.interaction.hoverState.backgroundColor || '#ffffff'}
                onChange={(v) => updateActive({ interaction: { ...d.interaction, hoverState: { ...d.interaction.hoverState, backgroundColor: v } } })}
              />
              <NumberField
                label="hover scale"
                value={d.interaction.hoverState.scale}
                step={0.05}
                min={0.5}
                max={2}
                onChange={(v) =>
                  updateActive({ interaction: { ...d.interaction, hoverState: { ...d.interaction.hoverState, scale: v } } })
                }
              />
              <label className={`${LABEL} sm:col-span-2`}>
                hover boxShadow
                <textarea
                  value={d.interaction.hoverState.boxShadow}
                  onChange={(e) =>
                    updateActive({
                      interaction: { ...d.interaction, hoverState: { ...d.interaction.hoverState, boxShadow: e.target.value } },
                    })
                  }
                  rows={2}
                  className={PANEL}
                />
              </label>
              <TextField
                label="hover rotate"
                value={d.interaction.hoverState.rotate}
                onChange={(v) =>
                  updateActive({ interaction: { ...d.interaction, hoverState: { ...d.interaction.hoverState, rotate: v } } })
                }
              />
              <TextField
                label="onClick (merknad)"
                value={d.interaction.onClick}
                onChange={(v) => updateActive({ interaction: { ...d.interaction, onClick: v } })}
              />
            </div>
          </section>

          <section className={SECTION}>
            <h2 className="text-sm font-semibold text-white">Data (valgfritt)</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TextField
                label="provider"
                value={d.data.provider}
                onChange={(v) => updateActive({ data: { ...d.data, provider: v } })}
              />
              <TextField
                label="documentPath"
                value={d.data.documentPath}
                onChange={(v) => updateActive({ data: { ...d.data, documentPath: v } })}
              />
              <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-300 sm:col-span-2">
                <input
                  type="checkbox"
                  className="rounded border-white/20"
                  checked={d.data.bindToStyle}
                  onChange={(e) => updateActive({ data: { ...d.data, bindToStyle: e.target.checked } })}
                />
                bindToStyle
              </label>
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
            <p className="mt-1 text-xs text-neutral-500">Hold pekeren over boksen for hover.</p>
            <div className="mt-4 rounded-lg bg-[#e8e4dc] p-4">
              <UiBoxCorePreview design={d} />
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
