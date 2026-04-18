import { useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Building2, Loader2, Plus } from 'lucide-react'
import { LayoutTable1PostingsShell } from '../layout/LayoutTable1PostingsShell'
import type { InspectionLocationRow } from '../../../modules/inspection/types'

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

export function LocationsCrudTab({
  supabase,
  locations,
  assignableUsers,
  onRefresh,
}: {
  supabase: SupabaseClient | null
  locations: InspectionLocationRow[]
  assignableUsers: { id: string; displayName: string }[]
  onRefresh: () => void | Promise<void>
}) {
  const [form, setForm] = useState({
    name: '',
    locationCode: '',
    description: '',
    parentId: '',
    kind: 'other',
    managerId: '',
    safetyDeputyId: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const roots = useMemo(() => locations.filter((l) => !l.parent_id), [locations])
  const childrenByParent = useMemo(() => {
    const map = new Map<string, InspectionLocationRow[]>()
    for (const loc of locations) {
      if (loc.parent_id) {
        if (!map.has(loc.parent_id)) map.set(loc.parent_id, [])
        map.get(loc.parent_id)!.push(loc)
      }
    }
    return map
  }, [locations])

  const save = async () => {
    if (!supabase) {
      setError('Supabase ikke konfigurert')
      return
    }
    const name = form.name.trim()
    if (!name) {
      setError('Navn er påkrevd')
      return
    }
    setSaving(true)
    setError(null)
    const { error: insertError } = await supabase.from('inspection_locations').insert({
      name,
      location_code: form.locationCode.trim() || null,
      description: form.description.trim() || null,
      parent_id: form.parentId || null,
      kind: form.kind,
      manager_id: form.managerId || null,
      safety_deputy_id: form.safetyDeputyId || null,
      metadata: {},
      is_active: true,
    })
    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }
    await onRefresh()
    setForm({ name: '', locationCode: '', description: '', parentId: '', kind: 'other', managerId: '', safetyDeputyId: '' })
    setSaving(false)
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <LayoutTable1PostingsShell
        wrap
        title="Lokasjonshierarki"
        description="Bygg → Etasje → Rom / Avdeling"
        toolbar={<span className="text-xs text-neutral-500">{locations.length} lokasjoner totalt</span>}
      >
        {roots.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-neutral-400">Ingen lokasjoner ennå.</p>
        ) : (
          <div className="p-4">
            <LocationTree locations={roots} childrenByParent={childrenByParent} assignableUsers={assignableUsers} depth={0} />
          </div>
        )}
      </LayoutTable1PostingsShell>

      <div className={`${CARD} p-5`} style={CARD_SHADOW}>
        <h2
          className="mb-4 text-base font-semibold text-neutral-900"
          style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
        >
          Legg til lokasjon
        </h2>
        {error ? <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}
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
            <select
              value={form.kind}
              onChange={(e) => setForm((p) => ({ ...p, kind: e.target.value }))}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none"
            >
              {LOCATION_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-neutral-600">Overordnet lokasjon</span>
            <select
              value={form.parentId}
              onChange={(e) => setForm((p) => ({ ...p, parentId: e.target.value }))}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none"
            >
              <option value="">(Rot-lokasjon)</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </label>
          {[
            { key: 'managerId', label: 'Leder (Arbeidsgiver)' },
            { key: 'safetyDeputyId', label: 'Verneombud' },
          ].map(({ key, label }) => (
            <label key={key} className="flex flex-col gap-1 text-xs">
              <span className="font-semibold text-neutral-600">{label}</span>
              <select
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none"
              >
                <option value="">(Ingen)</option>
                {assignableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-neutral-600">Beskrivelse</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={2}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: '#1a3d32' }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Legg til
          </button>
        </div>
      </div>
    </div>
  )
}

function LocationTree({
  locations,
  childrenByParent,
  assignableUsers,
  depth,
}: {
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
                {loc.location_code ? (
                  <span className="rounded bg-neutral-200 px-1.5 py-0.5 font-mono text-[10px] text-neutral-600">
                    {loc.location_code}
                  </span>
                ) : null}
                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">{kindLabel}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-neutral-500">
                {loc.manager_id ? (
                  <span>
                    <span className="text-neutral-400">Leder: </span>
                    {userById.get(loc.manager_id) ?? loc.manager_id}
                  </span>
                ) : null}
                {loc.safety_deputy_id ? (
                  <span>
                    <span className="text-neutral-400">Verneombud: </span>
                    {userById.get(loc.safety_deputy_id) ?? loc.safety_deputy_id}
                  </span>
                ) : null}
                {loc.description ? <span className="text-neutral-400">{loc.description}</span> : null}
              </div>
            </div>
            {children.length > 0 ? (
              <div className="mt-1.5">
                <LocationTree
                  locations={children}
                  childrenByParent={childrenByParent}
                  assignableUsers={assignableUsers}
                  depth={depth + 1}
                />
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
