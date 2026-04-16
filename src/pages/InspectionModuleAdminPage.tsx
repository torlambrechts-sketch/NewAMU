import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Circle,
  ClipboardList,
  Loader2,
  MapPin,
  Plus,
  Save,
  Trash2,
  UserCheck,
} from 'lucide-react'
import { WorkplacePageHeading1 } from '../components/layout/WorkplacePageHeading1'
import { HubMenu1Bar } from '../components/layout/HubMenu1Bar'
import { LayoutTable1PostingsShell } from '../components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../components/layout/layoutTable1PostingsKit'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { useInspectionModule } from '../../modules/inspection/useInspectionModule'
import { parseChecklistItems } from '../../modules/inspection/schema'
import type {
  HmsCategory,
  InspectionChecklistItem,
  InspectionFieldType,
  InspectionLocationRow,
  InspectionTemplateRow,
} from '../../modules/inspection/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const HMS_CATEGORIES: { value: HmsCategory; label: string; color: string }[] = [
  { value: 'fysisk', label: 'Fysisk', color: 'bg-blue-100 text-blue-800' },
  { value: 'ergonomi', label: 'Ergonomi', color: 'bg-teal-100 text-teal-800' },
  { value: 'kjemikalier', label: 'Kjemikalier', color: 'bg-amber-100 text-amber-800' },
  { value: 'psykososialt', label: 'Psykososialt', color: 'bg-purple-100 text-purple-800' },
  { value: 'brann', label: 'Brann', color: 'bg-red-100 text-red-800' },
  { value: 'maskiner', label: 'Maskiner', color: 'bg-slate-100 text-slate-800' },
  { value: 'annet', label: 'Annet', color: 'bg-neutral-100 text-neutral-700' },
]

const FIELD_TYPES: { value: InspectionFieldType; label: string }[] = [
  { value: 'yes_no_na', label: 'Ja / Nei / N/A' },
  { value: 'text', label: 'Tekst' },
  { value: 'number', label: 'Tall' },
  { value: 'photo', label: 'Foto' },
  { value: 'photo_required', label: 'Foto (påkrevd)' },
  { value: 'signature', label: 'Signatur' },
]

const LOCATION_KINDS = [
  { value: 'building', label: 'Bygg' },
  { value: 'floor', label: 'Etasje' },
  { value: 'room', label: 'Rom' },
  { value: 'department', label: 'Avdeling' },
  { value: 'equipment', label: 'Utstyr' },
  { value: 'site', label: 'Lokasjon' },
  { value: 'other', label: 'Annet' },
]

const CARD = 'rounded-xl border border-neutral-200/80 bg-white shadow-sm'
const CARD_SHADOW = { boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(input: string | null) {
  if (!input) return null
  try {
    return new Date(input).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' })
  } catch { return input }
}

function hmsCategoryColor(cat: HmsCategory | undefined): string {
  return cat ? (HMS_CATEGORIES.find((c) => c.value === cat)?.color ?? '') : ''
}

function newItem(index: number): InspectionChecklistItem {
  return { key: `item_${Date.now()}_${index}`, label: '', fieldType: 'yes_no_na', required: true }
}

type Tab = 'templates' | 'locations' | 'signoff'

// ── Page ──────────────────────────────────────────────────────────────────────

export function InspectionModuleAdminPage() {
  const { supabase } = useOrgSetupContext()
  const inspection = useInspectionModule({ supabase })
  const [tab, setTab] = useState<Tab>('templates')

  useEffect(() => { void inspection.load() }, [inspection.load])

  const hubItems = useMemo(() => [
    { key: 'templates', label: 'Maler', icon: ClipboardList, active: tab === 'templates', onClick: () => setTab('templates') },
    { key: 'locations', label: 'Lokasjoner', icon: MapPin, active: tab === 'locations', onClick: () => setTab('locations') },
    { key: 'signoff', label: 'Signaturer', icon: UserCheck, active: tab === 'signoff', onClick: () => setTab('signoff') },
  ], [tab])

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 space-y-6">
      <WorkplacePageHeading1
        breadcrumb={[{ label: 'HMS' }, { label: 'Inspeksjonsrunder', to: '/inspection-module' }, { label: 'Innstillinger' }]}
        title="Inspeksjonsinnstillinger"
        description="Administrer sjekkliste-maler, lokasjoner og signeringsregler for vernerunder."
        headerActions={
          <Link
            to="/inspection-module"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbake til runder
          </Link>
        }
      />

      <HubMenu1Bar ariaLabel="Inspeksjonsinnstillinger" items={hubItems} />

      {inspection.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {inspection.error}
        </div>
      )}

      {tab === 'templates' && <TemplatesTab inspection={inspection} />}
      {tab === 'locations' && <LocationsTab inspection={inspection} supabase={supabase} />}
      {tab === 'signoff' && <SignoffTab inspection={inspection} supabase={supabase} />}
    </div>
  )
}

// ── Templates tab ─────────────────────────────────────────────────────────────

function TemplatesTab({ inspection }: { inspection: ReturnType<typeof useInspectionModule> }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ name: string; items: InspectionChecklistItem[] } | null>(null)
  const [saving, setSaving] = useState(false)

  const selectTemplate = useCallback((template: InspectionTemplateRow) => {
    setSelectedId(template.id)
    setDraft({ name: template.name, items: parseChecklistItems(template.checklist_definition) })
  }, [])

  useEffect(() => {
    if (!selectedId && inspection.templates.length > 0) selectTemplate(inspection.templates[0])
  }, [inspection.templates, selectedId, selectTemplate])

  const addItem = () =>
    setDraft((p) => p ? { ...p, items: [...p.items, newItem(p.items.length)] } : p)

  const patchItem = (index: number, patch: Partial<InspectionChecklistItem>) =>
    setDraft((p) => {
      if (!p) return p
      const items = [...p.items]
      items[index] = { ...items[index], ...patch }
      return { ...p, items }
    })

  const removeItem = (index: number) =>
    setDraft((p) => p ? { ...p, items: p.items.filter((_, i) => i !== index) } : p)

  const save = async () => {
    if (!draft || !selectedId) return
    setSaving(true)
    await inspection.updateTemplate({
      templateId: selectedId,
      name: draft.name,
      checklistItems: draft.items.filter((item) => item.label.trim().length > 0),
    })
    setSaving(false)
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
      {/* List */}
      <aside className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Maler</p>
          <button
            type="button"
            onClick={() => void inspection.createTemplate({ name: 'Ny mal', checklistItems: [] })}
            className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
          >
            <Plus className="h-3.5 w-3.5" /> Ny
          </button>
        </div>
        <ul className="space-y-1">
          {inspection.templates.map((t) => {
            const count = parseChecklistItems(t.checklist_definition).length
            const active = selectedId === t.id
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => selectTemplate(t)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    active ? 'border-[#1a3d32] bg-[#1a3d32]/5' : 'border-neutral-200 bg-white hover:border-neutral-300'
                  }`}
                  style={active ? undefined : CARD_SHADOW}
                >
                  <p className="truncate text-sm font-semibold text-neutral-900">{t.name}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">{count} spørsmål</p>
                </button>
              </li>
            )
          })}
          {inspection.templates.length === 0 && (
            <li className="rounded-xl border border-dashed border-neutral-300 px-3 py-4 text-center text-xs text-neutral-500">
              Ingen maler ennå
            </li>
          )}
        </ul>
      </aside>

      {/* Editor */}
      {draft && selectedId ? (
        <div className="space-y-4">
          <div className={`${CARD} p-4`} style={CARD_SHADOW}>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Malnavn</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft((p) => p ? { ...p, name: e.target.value } : p)}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none"
              />
            </label>
          </div>

          <div className={CARD} style={CARD_SHADOW}>
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                  Sjekkliste
                </h2>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Kategorier kobles til AML §§ og Internkontrollforskriften
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Legg til rad
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: '#1a3d32' }}
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Lagre mal
                </button>
              </div>
            </div>

            {draft.items.length > 0 && (
              <div
                className="grid items-center gap-2 border-b border-neutral-100 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-400"
                style={{ gridTemplateColumns: '1.5rem 1fr 130px 140px 100px 2rem 1.5rem' }}
              >
                <span>#</span>
                <span>Kontrollpunkt</span>
                <span>HMS-kategori</span>
                <span>Felttype</span>
                <span>Lovhenvisning</span>
                <span className="text-center">Krav</span>
                <span />
              </div>
            )}

            <ul className="divide-y divide-neutral-50">
              {draft.items.map((item, index) => (
                <ChecklistItemRow
                  key={item.key}
                  index={index}
                  item={item}
                  onChange={(patch) => patchItem(index, patch)}
                  onDelete={() => removeItem(index)}
                />
              ))}
              {draft.items.length === 0 && (
                <li className="px-5 py-10 text-center text-sm text-neutral-400">
                  Ingen punkter ennå — klikk «Legg til rad»
                </li>
              )}
            </ul>
          </div>

          {/* Legend */}
          <div className={`${CARD} px-5 py-4`} style={CARD_SHADOW}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">HMS-kategorier</p>
            <div className="flex flex-wrap gap-2">
              {HMS_CATEGORIES.map((cat) => (
                <span key={cat.value} className={`rounded-full px-2.5 py-1 text-xs font-medium ${cat.color}`}>
                  {cat.label}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-neutral-400">
              Fysisk / Ergonomi → AML § 4-4 · Psykososialt → AML § 4-3 · Kjemikalier → Stoffkartotekforskriften · Brann → IK-forskriften
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-neutral-300 py-16 text-sm text-neutral-400">
          Velg en mal fra listen for å redigere
        </div>
      )}
    </div>
  )
}

function ChecklistItemRow({
  index, item, onChange, onDelete,
}: {
  index: number
  item: InspectionChecklistItem
  onChange: (patch: Partial<InspectionChecklistItem>) => void
  onDelete: () => void
}) {
  return (
    <li
      className="grid items-center gap-2 px-5 py-2 hover:bg-neutral-50"
      style={{ gridTemplateColumns: '1.5rem 1fr 130px 140px 100px 2rem 1.5rem' }}
    >
      <span className="text-xs text-neutral-400">{index + 1}</span>
      <input
        value={item.label}
        onChange={(e) => onChange({ label: e.target.value })}
        placeholder="Kontrollpunkt…"
        className="rounded-lg border border-neutral-200 px-2 py-1.5 text-sm focus:border-[#1a3d32] focus:outline-none"
      />
      <select
        value={item.hmsCategory ?? ''}
        onChange={(e) => onChange({ hmsCategory: e.target.value ? (e.target.value as HmsCategory) : undefined })}
        className={`w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-xs focus:border-[#1a3d32] focus:outline-none ${item.hmsCategory ? hmsCategoryColor(item.hmsCategory) : 'text-neutral-400'}`}
      >
        <option value="">— Kategori —</option>
        {HMS_CATEGORIES.map((cat) => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
      </select>
      <select
        value={item.fieldType ?? 'yes_no_na'}
        onChange={(e) => onChange({ fieldType: e.target.value as InspectionFieldType })}
        className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs focus:border-[#1a3d32] focus:outline-none"
      >
        {FIELD_TYPES.map((ft) => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
      </select>
      <input
        value={item.lawRef ?? ''}
        onChange={(e) => onChange({ lawRef: e.target.value || undefined })}
        placeholder="AML § 4-4"
        className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs focus:border-[#1a3d32] focus:outline-none"
      />
      <div className="flex justify-center">
        <input
          type="checkbox"
          checked={item.required ?? false}
          onChange={(e) => onChange({ required: e.target.checked })}
          className="h-4 w-4 accent-[#1a3d32]"
        />
      </div>
      <button type="button" onClick={onDelete} className="flex items-center justify-center text-neutral-300 hover:text-red-500">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  )
}

// ── Locations tab ─────────────────────────────────────────────────────────────

function LocationsTab({
  inspection, supabase,
}: {
  inspection: ReturnType<typeof useInspectionModule>
  supabase: SupabaseClient | null
}) {
  const [form, setForm] = useState({
    name: '', locationCode: '', description: '',
    parentId: '', kind: 'other', managerId: '', safetyDeputyId: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const roots = useMemo(() => inspection.locations.filter((l) => !l.parent_id), [inspection.locations])
  const childrenByParent = useMemo(() => {
    const map = new Map<string, InspectionLocationRow[]>()
    for (const loc of inspection.locations) {
      if (loc.parent_id) {
        if (!map.has(loc.parent_id)) map.set(loc.parent_id, [])
        map.get(loc.parent_id)!.push(loc)
      }
    }
    return map
  }, [inspection.locations])

  const save = async () => {
    if (!supabase) { setError('Supabase ikke konfigurert'); return }
    const name = form.name.trim()
    if (!name) { setError('Navn er påkrevd'); return }
    setSaving(true); setError(null)
    const { error: insertError } = await supabase.from('inspection_locations').insert({
      name, location_code: form.locationCode.trim() || null,
      description: form.description.trim() || null,
      parent_id: form.parentId || null, kind: form.kind,
      manager_id: form.managerId || null,
      safety_deputy_id: form.safetyDeputyId || null,
      metadata: {}, is_active: true,
    })
    if (insertError) { setError(insertError.message); setSaving(false); return }
    await inspection.load()
    setForm({ name: '', locationCode: '', description: '', parentId: '', kind: 'other', managerId: '', safetyDeputyId: '' })
    setSaving(false)
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <LayoutTable1PostingsShell
        wrap title="Lokasjonshierarki" description="Bygg → Etasje → Rom / Avdeling"
        toolbar={<span className="text-xs text-neutral-500">{inspection.locations.length} lokasjoner totalt</span>}
      >
        {roots.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-neutral-400">Ingen lokasjoner ennå.</p>
        ) : (
          <div className="p-4">
            <LocationTree locations={roots} childrenByParent={childrenByParent} assignableUsers={inspection.assignableUsers} depth={0} />
          </div>
        )}
      </LayoutTable1PostingsShell>

      <div className={`${CARD} p-5`} style={CARD_SHADOW}>
        <h2 className="mb-4 text-base font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
          Legg til lokasjon
        </h2>
        {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
        <div className="space-y-3">
          {[
            { key: 'name', label: 'Navn *', placeholder: '' },
            { key: 'locationCode', label: 'Kode', placeholder: 'BLD-01' },
          ].map(({ key, label, placeholder }) => (
            <label key={key} className="flex flex-col gap-1 text-xs">
              <span className="font-semibold text-neutral-600">{label}</span>
              <input
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none"
              />
            </label>
          ))}
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-neutral-600">Type</span>
            <select value={form.kind} onChange={(e) => setForm((p) => ({ ...p, kind: e.target.value }))}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none">
              {LOCATION_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-neutral-600">Overordnet lokasjon</span>
            <select value={form.parentId} onChange={(e) => setForm((p) => ({ ...p, parentId: e.target.value }))}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none">
              <option value="">(Rot-lokasjon)</option>
              {inspection.locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
            </select>
          </label>
          {[
            { key: 'managerId', label: 'Leder (Arbeidsgiver)' },
            { key: 'safetyDeputyId', label: 'Verneombud' },
          ].map(({ key, label }) => (
            <label key={key} className="flex flex-col gap-1 text-xs">
              <span className="font-semibold text-neutral-600">{label}</span>
              <select value={form[key as keyof typeof form]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none">
                <option value="">(Ingen)</option>
                {inspection.assignableUsers.map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
              </select>
            </label>
          ))}
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-neutral-600">Beskrivelse</span>
            <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={2} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none" />
          </label>
          <button type="button" onClick={() => void save()} disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: '#1a3d32' }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Legg til
          </button>
        </div>
      </div>
    </div>
  )
}

function LocationTree({ locations, childrenByParent, assignableUsers, depth }: {
  locations: InspectionLocationRow[]
  childrenByParent: Map<string, InspectionLocationRow[]>
  assignableUsers: { id: string; displayName: string }[]
  depth: number
}) {
  const userById = useMemo(() => {
    const map = new Map<string, string>()
    for (const u of assignableUsers) map.set(u.id, u.displayName)
    return map
  }, [assignableUsers])

  return (
    <ul className="space-y-2">
      {locations.map((loc) => {
        const children = childrenByParent.get(loc.id) ?? []
        const kindLabel = LOCATION_KINDS.find((k) => k.value === loc.kind)?.label ?? loc.kind
        return (
          <li key={loc.id} style={{ marginLeft: depth * 16 }}>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                <span className="text-sm font-semibold text-neutral-900">{loc.name}</span>
                {loc.location_code && (
                  <span className="rounded bg-neutral-200 px-1.5 py-0.5 font-mono text-[10px] text-neutral-600">{loc.location_code}</span>
                )}
                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">{kindLabel}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-neutral-500">
                {loc.manager_id && <span><span className="text-neutral-400">Leder: </span>{userById.get(loc.manager_id) ?? loc.manager_id}</span>}
                {loc.safety_deputy_id && <span><span className="text-neutral-400">Verneombud: </span>{userById.get(loc.safety_deputy_id) ?? loc.safety_deputy_id}</span>}
                {loc.description && <span className="text-neutral-400">{loc.description}</span>}
              </div>
            </div>
            {children.length > 0 && (
              <div className="mt-1.5">
                <LocationTree locations={children} childrenByParent={childrenByParent} assignableUsers={assignableUsers} depth={depth + 1} />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// ── Sign-off tab ──────────────────────────────────────────────────────────────

function SignoffTab({ inspection, supabase }: {
  inspection: ReturnType<typeof useInspectionModule>
  supabase: SupabaseClient | null
}) {
  const [signing, setSigning] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  const userById = useMemo(() => {
    const map = new Map<string, string>()
    for (const u of inspection.assignableUsers) map.set(u.id, u.displayName)
    return map
  }, [inspection.assignableUsers])

  const signRound = async (roundId: string, role: 'manager' | 'deputy') => {
    if (!supabase) return
    const key = `${roundId}-${role}`
    setSigning((p) => ({ ...p, [key]: true }))
    setError(null)
    const { error: signError } = await supabase.rpc('sign_inspection_round', { p_round_id: roundId, p_role: role })
    if (signError) setError(signError.message)
    else await inspection.load()
    setSigning((p) => ({ ...p, [key]: false }))
  }

  const unsigned = inspection.rounds.filter((r) => r.status !== 'signed')
  const signed = inspection.rounds.filter((r) => r.status === 'signed')

  return (
    <div className="space-y-5">
      <div className={CARD} style={CARD_SHADOW}>
        <div className="border-b border-neutral-100 px-5 py-4">
          <h2 className="text-base font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
            Venter på signering
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Internkontrollforskriften § 5 — krever signatur fra leder og verneombud
          </p>
        </div>
        {error && <div className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Runde</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Planlagt</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Leder</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Verneombud</th>
            </tr>
          </thead>
          <tbody>
            {unsigned.map((round) => (
              <tr key={round.id} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                <td className="px-5 py-3 font-medium text-neutral-900">{round.title}</td>
                <td className="px-5 py-3 text-neutral-500">{formatDate(round.scheduled_for) ?? '—'}</td>
                {(['manager', 'deputy'] as const).map((role) => {
                  const at = role === 'manager' ? round.manager_signed_at : round.deputy_signed_at
                  const by = role === 'manager' ? round.manager_signed_by : round.deputy_signed_by
                  const key = `${round.id}-${role}`
                  return (
                    <td key={role} className="px-5 py-3">
                      {at ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                          <span className="text-xs text-green-700">
                            {formatDate(at)}{by ? ` · ${userById.get(by) ?? by}` : ''}
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void signRound(round.id, role)}
                          disabled={signing[key]}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-[#1a3d32] hover:text-[#1a3d32] disabled:opacity-60"
                        >
                          {signing[key] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Circle className="h-3 w-3" />}
                          {role === 'manager' ? 'Signer som leder' : 'Signer som verneombud'}
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
            {unsigned.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-neutral-400">Alle runder er signert.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {signed.length > 0 && (
        <div className={CARD} style={CARD_SHADOW}>
          <div className="border-b border-neutral-100 px-5 py-4">
            <h2 className="text-base font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
              Signerte runder
            </h2>
          </div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                <th className={LAYOUT_TABLE1_POSTINGS_TH}>Runde</th>
                <th className={LAYOUT_TABLE1_POSTINGS_TH}>Leder signert</th>
                <th className={LAYOUT_TABLE1_POSTINGS_TH}>Verneombud signert</th>
              </tr>
            </thead>
            <tbody>
              {signed.map((round) => (
                <tr key={round.id} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                  <td className="px-5 py-3 font-medium text-neutral-900">{round.title}</td>
                  <td className="px-5 py-3 text-xs text-neutral-600">
                    {round.manager_signed_at ? (
                      <span>{formatDate(round.manager_signed_at)}{round.manager_signed_by ? ` · ${userById.get(round.manager_signed_by) ?? ''}` : ''}</span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3 text-xs text-neutral-600">
                    {round.deputy_signed_at ? (
                      <span>{formatDate(round.deputy_signed_at)}{round.deputy_signed_by ? ` · ${userById.get(round.deputy_signed_by) ?? ''}` : ''}</span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
