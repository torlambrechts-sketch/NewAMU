import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ArrowLeft, ClipboardList, MapPin, Plus, Save, Shield, Trash2, X } from 'lucide-react'
import { WorkplacePageHeading1 } from '../../src/components/layout/WorkplacePageHeading1'
import { ModuleAdminShell } from '../../src/components/layout/ModuleAdminShell'
import { LocationsCrudTab } from '../../src/components/hse/LocationsCrudTab'
import { useInspectionModule } from '../inspection/useInspectionModule'
import type { SjaControlType, SjaHazardCategory, SjaJobType, SjaPpeKey, SjaTemplate } from './types'
import { SJA_PPE_OPTIONS } from './types'
import { useSja } from './useSja'
import type { PrefillTask } from './types'

const JOB_TYPE_LABEL: Record<SjaJobType, string> = {
  hot_work: 'Varmt arbeid',
  confined_space: 'Arbeid i trange rom',
  work_at_height: 'Arbeid i høyden',
  electrical: 'Elektrisk arbeid',
  lifting: 'Løft / rigging',
  excavation: 'Graving',
  custom: 'Annet',
}

const HAZARD_CATEGORY_LABEL: Record<SjaHazardCategory, string> = {
  fall: 'Fall fra høyde',
  chemical: 'Kjemikalier / gasser',
  electrical: 'Elektrisk fare',
  mechanical: 'Mekanisk fare',
  fire: 'Brann / eksplosjon',
  ergonomic: 'Ergonomi / belastning',
  dropped_object: 'Fallende gjenstander',
  other: 'Annet',
}

const JOB_TYPES: SjaJobType[] = [
  'hot_work',
  'confined_space',
  'work_at_height',
  'electrical',
  'lifting',
  'excavation',
  'custom',
]

const CERT_PRESETS = ['hot_work', 'scaffold', 'forklift', 'crane', 'rope_access', 'electrical', 'confined_space']

const SJA_PERMISSIONS = [
  { key: 'sja.create', label: 'Opprette SJA' },
  { key: 'sja.manage', label: 'Administrere SJA (edit/delete others)' },
  { key: 'sja.template_admin', label: 'Administrere maler' },
  { key: 'sja.sign', label: 'Signere SJA' },
  { key: 'sja.archive', label: 'Arkivere' },
] as const

const CARD = 'rounded-xl border border-neutral-200/80 bg-white shadow-sm'
const CARD_SHADOW = { boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } as const
const SETTINGS_FIELD_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-800'

type Tab = 'templates' | 'locations' | 'access'

type PrefillMeasureDraft = { description: string; control_type: SjaControlType; is_mandatory: boolean }

type PrefillHazardDraft = { description: string; category: SjaHazardCategory; measures: PrefillMeasureDraft[] }

type PrefillTaskDraft = { title: string; description: string; position: number; hazards: PrefillHazardDraft[] }

function emptyTask(position: number): PrefillTaskDraft {
  return { title: '', description: '', hazards: [], position }
}

function parsePrefillTasks(raw: unknown): PrefillTaskDraft[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((t, ti) => {
      const o = t as { title?: unknown; description?: unknown; position?: unknown; hazards?: unknown }
      const title = typeof o.title === 'string' ? o.title : ''
      const description = typeof o.description === 'string' ? o.description : ''
      const position = typeof o.position === 'number' && Number.isFinite(o.position) ? o.position : ti
      const hz = Array.isArray(o.hazards) ? o.hazards : []
      const hazards = hz
        .map((h) => {
          const ho = h as { description?: unknown; category?: unknown; measures?: unknown }
          const descriptionH = typeof ho.description === 'string' ? ho.description : ''
          const category =
            typeof ho.category === 'string' && ho.category in HAZARD_CATEGORY_LABEL
              ? (ho.category as SjaHazardCategory)
              : 'other'
          const mz = Array.isArray(ho.measures) ? ho.measures : []
          const measures: PrefillMeasureDraft[] = mz.map((m) => {
            const mo = m as { description?: unknown; control_type?: unknown; is_mandatory?: unknown }
            const md = typeof mo.description === 'string' ? mo.description : ''
            const ct =
              typeof mo.control_type === 'string' &&
              ['eliminate', 'substitute', 'engineering', 'administrative', 'ppe'].includes(mo.control_type)
                ? (mo.control_type as SjaControlType)
                : 'administrative'
            return {
              description: md,
              control_type: ct,
              is_mandatory: Boolean(mo.is_mandatory),
            }
          })
          return { description: descriptionH, category, measures }
        })
        .filter((h) => h.description.trim().length > 0)
      return { title, description, hazards, position }
    })
    .filter((t) => t.title.trim().length > 0)
}

function toDbPrefillTasks(tasks: PrefillTaskDraft[]): PrefillTask[] {
  return tasks.map((t, i) => ({
    title: t.title.trim(),
    description: t.description.trim() || undefined,
    position: typeof t.position === 'number' ? t.position : i,
    hazards: t.hazards.map((h) => ({
      description: h.description.trim(),
      category: h.category,
      measures: h.measures
        .filter((m) => m.description.trim().length > 0)
        .map((m) => ({
          description: m.description.trim(),
          control_type: m.control_type,
          is_mandatory: m.is_mandatory,
        })),
    })),
  }))
}

export function SjaModuleAdminView({
  supabase,
  canManageRbac,
  organizationId,
}: {
  supabase: SupabaseClient | null
  canManageRbac: boolean
  organizationId: string | null
}) {
  const sja = useSja({ supabase })
  const inspection = useInspectionModule({ supabase })
  const [tab, setTab] = useState<Tab>('templates')

  useEffect(() => {
    void sja.load()
  }, [sja.load])

  useEffect(() => {
    if (tab === 'locations') void inspection.load()
  }, [tab, inspection.load])

  const tabs = useMemo(
    () => [
      { key: 'templates', label: 'Maler', icon: <ClipboardList className="h-4 w-4" /> },
      { key: 'locations', label: 'Lokasjoner', icon: <MapPin className="h-4 w-4" /> },
      { key: 'access', label: 'Tilgang', icon: <Shield className="h-4 w-4" /> },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <WorkplacePageHeading1
        breadcrumb={[{ label: 'HMS' }, { label: 'Sikker jobbanalyse', to: '/sja' }, { label: 'Innstillinger' }]}
        title="SJA-innstillinger"
        description="Maler for sikker jobbanalyse, delte lokasjoner og tilganger."
        headerActions={
          <Link
            to="/sja"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbake til SJA
          </Link>
        }
      />

      {sja.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{sja.error}</div>
      ) : null}

      <ModuleAdminShell
        title="SJA-innstillinger"
        description="Administrer maler og tilganger."
        tabs={tabs}
        activeTab={tab}
        onTabChange={(k) => setTab(k as Tab)}
      >
        {tab === 'templates' && <SjaTemplatesAdmin sja={sja} />}
        {tab === 'locations' && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              Lokasjoner deles med inspeksjonsmodulen (<code className="rounded bg-neutral-100 px-1">inspection_locations</code>
              ). Endringer her synes også der.
            </p>
            <LocationsCrudTab
              supabase={supabase}
              locations={inspection.locations}
              assignableUsers={inspection.assignableUsers}
              onRefresh={() => inspection.load()}
            />
          </div>
        )}
        {tab === 'access' && (
          <SjaAccessTab supabase={supabase} canManageRbac={canManageRbac} organizationId={organizationId} />
        )}
      </ModuleAdminShell>
    </div>
  )
}

function SjaTemplatesAdmin({ sja }: { sja: ReturnType<typeof useSja> }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [draftName, setDraftName] = useState('')
  const [draftJobType, setDraftJobType] = useState<SjaJobType>('custom')
  const [draftDesc, setDraftDesc] = useState('')
  const [draftCerts, setDraftCerts] = useState<string[]>([])
  const [certInput, setCertInput] = useState('')
  const [draftRequiredPpe, setDraftRequiredPpe] = useState<SjaPpeKey[]>([])
  const [draftTasks, setDraftTasks] = useState<PrefillTaskDraft[]>([emptyTask(0)])

  const selected = useMemo(
    () => sja.templates.find((t) => t.id === selectedId) ?? null,
    [sja.templates, selectedId],
  )

  const openEdit = useCallback((t: SjaTemplate) => {
    setSelectedId(t.id)
    setDraftName(t.name)
    setDraftJobType(t.job_type as SjaJobType)
    setDraftDesc(t.description ?? '')
    setDraftCerts(t.required_certs ?? [])
    setDraftRequiredPpe(
      (t.required_ppe ?? []).filter((k): k is SjaPpeKey => SJA_PPE_OPTIONS.some((o) => o.key === k)),
    )
    setDraftTasks(
      parsePrefillTasks(t.prefill_tasks).length ? parsePrefillTasks(t.prefill_tasks) : [emptyTask(0)],
    )
    setPanelOpen(true)
  }, [])

  const resetModal = () => {
    setDraftName('')
    setDraftJobType('custom')
    setDraftDesc('')
    setDraftCerts([])
    setCertInput('')
    setDraftRequiredPpe([])
    setDraftTasks([emptyTask(0)])
  }

  const saveSelected = async () => {
    if (!selectedId) return
    setSaving(true)
    await sja.updateTemplate(selectedId, {
      name: draftName,
      job_type: draftJobType,
      description: draftDesc.trim() || null,
      required_certs: draftCerts.length ? draftCerts : null,
      required_ppe: draftRequiredPpe,
      prefill_tasks: toDbPrefillTasks(draftTasks.filter((t) => t.title.trim())),
    })
    setSaving(false)
  }

  const createNew = async () => {
    setSaving(true)
    const created = await sja.createTemplate({
      name: draftName.trim() || 'Ny mal',
      job_type: draftJobType,
      description: draftDesc.trim() || null,
      required_certs: draftCerts.length ? draftCerts : null,
      required_ppe: draftRequiredPpe,
      prefill_tasks: toDbPrefillTasks(draftTasks.filter((t) => t.title.trim())),
    })
    setSaving(false)
    setModalOpen(false)
    resetModal()
    if (created) {
      setSelectedId(created.id)
      openEdit(created)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            resetModal()
            setModalOpen(true)
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
        >
          <Plus className="h-4 w-4" />
          Ny mal
        </button>
      </div>

      <div className={`${CARD} overflow-hidden`} style={CARD_SHADOW}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
              <th className="px-4 py-3">Navn</th>
              <th className="px-4 py-3">Jobbtype</th>
              <th className="px-4 py-3">Sertifikater</th>
              <th className="px-4 py-3">Deloppgaver</th>
              <th className="px-4 py-3">Aktiv</th>
              <th className="w-10 px-2" />
            </tr>
          </thead>
          <tbody>
            {sja.templates.map((t) => {
              const tasks = parsePrefillTasks(t.prefill_tasks)
              return (
                <tr key={t.id} className="border-b border-neutral-100 hover:bg-neutral-50/80">
                  <td className="px-4 py-3 font-medium text-neutral-900">{t.name}</td>
                  <td className="px-4 py-3 text-neutral-600">{JOB_TYPE_LABEL[t.job_type as SjaJobType] ?? t.job_type}</td>
                  <td className="px-4 py-3 text-xs text-neutral-600">
                    {(t.required_certs ?? []).join(', ') || '—'}
                    {t.required_ppe?.length ? (
                      <span className="mt-1 block text-[10px] text-neutral-500">
                        PPE: {t.required_ppe.map((k) => SJA_PPE_OPTIONS.find((o) => o.key === k)?.label ?? k).join(', ')}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs">{tasks.length}</td>
                  <td className="px-4 py-3">{t.is_active ? 'Ja' : 'Nei'}</td>
                  <td className="px-2 py-3">
                    <button
                      type="button"
                      className="text-[#1a3d32] hover:underline"
                      onClick={() => openEdit(t)}
                    >
                      →
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {sja.templates.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-500">Ingen maler ennå.</p>
        ) : null}
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900">Ny mal</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-neutral-400 hover:text-neutral-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="mb-4 flex flex-col gap-1 text-xs">
              <span className="font-semibold text-neutral-600">Malnavn</span>
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                placeholder="F.eks. Varmt arbeid — standard"
              />
            </label>
            <TemplateFormBody
              draftName={draftName}
              setDraftName={setDraftName}
              draftJobType={draftJobType}
              setDraftJobType={setDraftJobType}
              draftDesc={draftDesc}
              setDraftDesc={setDraftDesc}
              draftCerts={draftCerts}
              setDraftCerts={setDraftCerts}
              certInput={certInput}
              setCertInput={setCertInput}
              draftRequiredPpe={draftRequiredPpe}
              setDraftRequiredPpe={setDraftRequiredPpe}
              draftTasks={draftTasks}
              setDraftTasks={setDraftTasks}
            />
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded border px-3 py-2 text-sm">
                Avbryt
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void createNew()}
                className="rounded bg-[#1a3d32] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? 'Oppretter…' : 'Opprett'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {panelOpen && selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <div className="h-full w-full max-w-lg overflow-y-auto border-l border-neutral-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <h2 className="text-lg font-semibold text-neutral-900">Rediger mal</h2>
              <button type="button" onClick={() => setPanelOpen(false)} className="text-neutral-400 hover:text-neutral-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-semibold text-neutral-600">Malnavn</span>
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>
              <TemplateFormBody
                draftName={draftName}
                setDraftName={setDraftName}
                draftJobType={draftJobType}
                setDraftJobType={setDraftJobType}
                draftDesc={draftDesc}
                setDraftDesc={setDraftDesc}
                draftCerts={draftCerts}
                setDraftCerts={setDraftCerts}
                certInput={certInput}
                setCertInput={setCertInput}
                draftRequiredPpe={draftRequiredPpe}
                setDraftRequiredPpe={setDraftRequiredPpe}
                draftTasks={draftTasks}
                setDraftTasks={setDraftTasks}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.is_active}
                  onChange={(e) => void sja.updateTemplate(selected.id, { is_active: e.target.checked })}
                />
                Aktiv
              </label>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveSelected()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: '#1a3d32' }}
              >
                <Save className="h-4 w-4" />
                {saving ? 'Lagrer…' : 'Lagre'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function TemplateFormBody({
  draftName: _dn,
  setDraftName: _sdn,
  draftJobType,
  setDraftJobType,
  draftDesc,
  setDraftDesc,
  draftCerts,
  setDraftCerts,
  certInput,
  setCertInput,
  draftRequiredPpe,
  setDraftRequiredPpe,
  draftTasks,
  setDraftTasks,
}: {
  draftName: string
  setDraftName: (v: string) => void
  draftJobType: SjaJobType
  setDraftJobType: (v: SjaJobType) => void
  draftDesc: string
  setDraftDesc: (v: string) => void
  draftCerts: string[]
  setDraftCerts: (v: string[]) => void
  certInput: string
  setCertInput: (v: string) => void
  draftRequiredPpe: SjaPpeKey[]
  setDraftRequiredPpe: (v: SjaPpeKey[] | ((p: SjaPpeKey[]) => SjaPpeKey[])) => void
  draftTasks: PrefillTaskDraft[]
  setDraftTasks: (v: PrefillTaskDraft[] | ((p: PrefillTaskDraft[]) => PrefillTaskDraft[])) => void
}) {
  void _dn
  void _sdn

  type FormMeasure = { description: string; control_type: string; is_mandatory: boolean }

  function addMeasure(taskIdx: number, hazardIdx: number) {
    setDraftTasks((prev) => {
      const next = structuredClone(prev)
      next[taskIdx].hazards[hazardIdx].measures.push({
        description: '',
        control_type: 'administrative',
        is_mandatory: false,
      })
      return next
    })
  }

  function removeMeasure(taskIdx: number, hazardIdx: number, measureIdx: number) {
    setDraftTasks((prev) => {
      const next = structuredClone(prev)
      next[taskIdx].hazards[hazardIdx].measures.splice(measureIdx, 1)
      return next
    })
  }

  function updateMeasure(
    taskIdx: number,
    hazardIdx: number,
    measureIdx: number,
    field: keyof FormMeasure,
    value: string | boolean,
  ) {
    setDraftTasks((prev) => {
      const next = structuredClone(prev)
      const row = next[taskIdx].hazards[hazardIdx].measures[measureIdx] as Record<string, unknown>
      row[field] = value
      return next
    })
  }

  return (
    <div className="space-y-4">
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-semibold text-neutral-600">Jobbtype</span>
        <select
          value={draftJobType}
          onChange={(e) => setDraftJobType(e.target.value as SjaJobType)}
          className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        >
          {JOB_TYPES.map((j) => (
            <option key={j} value={j}>
              {JOB_TYPE_LABEL[j]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-semibold text-neutral-600">Beskrivelse</span>
        <textarea
          value={draftDesc}
          onChange={(e) => setDraftDesc(e.target.value)}
          rows={3}
          className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        />
      </label>
      <div>
        <p className="text-xs font-semibold text-neutral-600">Påkrevde sertifikater (tags)</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CERT_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                if (!draftCerts.includes(c)) setDraftCerts([...draftCerts, c])
              }}
              className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs hover:bg-neutral-100"
            >
              + {c}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={certInput}
            onChange={(e) => setCertInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                const t = certInput.trim()
                if (t && !draftCerts.includes(t)) setDraftCerts([...draftCerts, t])
                setCertInput('')
              }
            }}
            placeholder="Fritekst-tag, Enter for å legge til"
            className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
        </div>
        <ul className="mt-2 flex flex-wrap gap-2">
          {draftCerts.map((c) => (
            <li key={c} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-xs">
              {c}
              <button type="button" onClick={() => setDraftCerts(draftCerts.filter((x) => x !== c))} className="text-red-600">
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <label className={SETTINGS_FIELD_LABEL}>Standard verneutstyr (PPE)</label>
        <p className="mt-1 text-xs text-neutral-500">
          Grunnleggende verneutstyr for hele jobben — uavhengig av deloppgaver.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SJA_PPE_OPTIONS.map((opt) => {
            const active = draftRequiredPpe.includes(opt.key)
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() =>
                  setDraftRequiredPpe((prev) =>
                    active ? prev.filter((k) => k !== opt.key) : [...prev, opt.key],
                  )
                }
                className={`rounded border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                    : 'border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-neutral-600">Forhåndsutfylte deloppgaver</p>
        <div className="mt-2 space-y-4">
          {draftTasks.map((task, ti) => (
            <div key={ti} className="rounded-lg border border-neutral-200 p-3">
              <input
                value={task.title}
                onChange={(e) =>
                  setDraftTasks((prev) => {
                    const next = [...prev]
                    next[ti] = { ...next[ti], title: e.target.value, position: ti }
                    return next
                  })
                }
                placeholder="Deloppgavetittel"
                className="mb-2 w-full rounded border px-2 py-1.5 text-sm"
              />
              <textarea
                value={task.description}
                onChange={(e) =>
                  setDraftTasks((prev) => {
                    const next = [...prev]
                    next[ti] = { ...next[ti], description: e.target.value }
                    return next
                  })
                }
                placeholder="Valgfri beskrivelse av deloppgaven…"
                rows={2}
                className="mb-2 w-full rounded border px-2 py-1.5 text-xs"
              />
              <ul className="space-y-3">
                {task.hazards.map((hz, hi) => (
                  <li key={hi} className="rounded border border-neutral-100 bg-neutral-50/80 p-2">
                    <div className="flex flex-wrap gap-2">
                      <input
                        value={hz.description}
                        onChange={(e) =>
                          setDraftTasks((prev) => {
                            const next = [...prev]
                            const th = [...next[ti].hazards]
                            th[hi] = { ...th[hi], description: e.target.value }
                            next[ti] = { ...next[ti], hazards: th }
                            return next
                          })
                        }
                        placeholder="Farekilde"
                        className="min-w-[8rem] flex-1 rounded border bg-white px-2 py-1 text-xs"
                      />
                      <select
                        value={hz.category}
                        onChange={(e) =>
                          setDraftTasks((prev) => {
                            const next = [...prev]
                            const th = [...next[ti].hazards]
                            th[hi] = { ...th[hi], category: e.target.value as SjaHazardCategory }
                            next[ti] = { ...next[ti], hazards: th }
                            return next
                          })
                        }
                        className="rounded border bg-white px-2 py-1 text-xs"
                      >
                        {(Object.keys(HAZARD_CATEGORY_LABEL) as SjaHazardCategory[]).map((k) => (
                          <option key={k} value={k}>
                            {HAZARD_CATEGORY_LABEL[k]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="text-neutral-400 hover:text-red-600"
                        onClick={() =>
                          setDraftTasks((prev) => {
                            const next = [...prev]
                            next[ti] = {
                              ...next[ti],
                              hazards: next[ti].hazards.filter((_, i) => i !== hi),
                            }
                            return next
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="ml-4 mt-2 space-y-1">
                      {hz.measures.map((m, mi) => (
                        <div key={mi} className="flex items-center gap-2">
                          <select
                            value={m.control_type}
                            onChange={(e) => updateMeasure(ti, hi, mi, 'control_type', e.target.value)}
                            className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                          >
                            <option value="eliminate">Eliminering</option>
                            <option value="substitute">Substitusjon</option>
                            <option value="engineering">Teknisk tiltak</option>
                            <option value="administrative">Administrativt</option>
                            <option value="ppe">Verneutstyr</option>
                          </select>
                          <input
                            type="text"
                            value={m.description}
                            onChange={(e) => updateMeasure(ti, hi, mi, 'description', e.target.value)}
                            placeholder="Beskriv tiltaket…"
                            className="flex-1 rounded border border-neutral-300 px-2 py-1 text-xs"
                          />
                          <label className="flex cursor-pointer items-center gap-1 text-xs text-neutral-600">
                            <input
                              type="checkbox"
                              checked={m.is_mandatory}
                              onChange={(e) => updateMeasure(ti, hi, mi, 'is_mandatory', e.target.checked)}
                              className="rounded"
                            />
                            Obligatorisk
                          </label>
                          <button
                            type="button"
                            onClick={() => removeMeasure(ti, hi, mi)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addMeasure(ti, hi)}
                        className="mt-1 text-xs text-[#1a3d32] hover:underline"
                      >
                        + Legg til standard tiltak
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="mt-2 text-xs font-semibold text-[#1a3d32] underline"
                onClick={() =>
                  setDraftTasks((prev) => {
                    const next = [...prev]
                    next[ti] = {
                      ...next[ti],
                      hazards: [
                        ...next[ti].hazards,
                        { description: '', category: 'other' as SjaHazardCategory, measures: [] },
                      ],
                    }
                    return next
                  })
                }
              >
                + Legg til farekilder
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-2 text-sm font-medium text-[#1a3d32] underline"
          onClick={() => setDraftTasks((p) => [...p, emptyTask(p.length)])}
        >
          + Deloppgave
        </button>
      </div>
    </div>
  )
}

function SjaAccessTab({
  supabase,
  canManageRbac,
  organizationId,
}: {
  supabase: SupabaseClient | null
  canManageRbac: boolean
  organizationId: string | null
}) {
  const [roles, setRoles] = useState<{ id: string; slug: string; name: string }[]>([])
  const [matrix, setMatrix] = useState<Record<string, Set<string>>>({})
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const permKeys = useMemo(() => SJA_PERMISSIONS.map((p) => p.key), [])

  const load = useCallback(async () => {
    if (!supabase || !organizationId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setErr(null)
    try {
      const { data: roleRows, error: rErr } = await supabase
        .from('role_definitions')
        .select('id, slug, name')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true })
      if (rErr) throw rErr
      const rs = (roleRows ?? []) as { id: string; slug: string; name: string }[]
      setRoles(rs)

      const { data: permRows, error: pErr } = await supabase
        .from('role_permissions')
        .select('role_id, permission_key')
        .in('permission_key', [...permKeys])
      if (pErr) throw pErr
      const next: Record<string, Set<string>> = {}
      for (const r of rs) next[r.id] = new Set()
      for (const row of permRows ?? []) {
        const rid = (row as { role_id?: string }).role_id
        const key = (row as { permission_key?: string }).permission_key
        if (rid && key && next[rid]) next[rid].add(key)
      }
      setMatrix(next)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Kunne ikke laste roller.')
    } finally {
      setLoading(false)
    }
  }, [supabase, permKeys, organizationId])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = async (roleId: string, permissionKey: string, on: boolean) => {
    if (!supabase || !canManageRbac) return
    setErr(null)
    if (on) {
      const { error } = await supabase.from('role_permissions').insert({ role_id: roleId, permission_key: permissionKey })
      if (error) {
        setErr(error.message)
        return
      }
    } else {
      const { error } = await supabase.from('role_permissions').delete().eq('role_id', roleId).eq('permission_key', permissionKey)
      if (error) {
        setErr(error.message)
        return
      }
    }
    await load()
  }

  if (!canManageRbac) {
    return (
      <p className="text-sm text-neutral-600">
        Du trenger administrator-tilgang for å endre rolletilganger. Kontakt en organisasjonsadministrator.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">
        Koblinger lagres i <code className="rounded bg-neutral-100 px-1">role_permissions</code>. Kun org-administratorer
        kan endre disse (RLS).
      </p>
      {err ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</div> : null}
      {loading ? <p className="text-sm text-neutral-500">Laster…</p> : null}
      {!loading && roles.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white" style={CARD_SHADOW}>
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                <th className="px-4 py-3 font-semibold text-neutral-700">Rolle</th>
                {SJA_PERMISSIONS.map((p) => (
                  <th key={p.key} className="px-2 py-3 text-center text-xs font-semibold text-neutral-600">
                    {p.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id} className="border-b border-neutral-100">
                  <td className="px-4 py-2">
                    <span className="font-medium text-neutral-900">{r.name}</span>
                    <span className="ml-2 text-xs text-neutral-400">{r.slug}</span>
                  </td>
                  {SJA_PERMISSIONS.map((p) => {
                    const on = matrix[r.id]?.has(p.key) ?? false
                    return (
                      <td key={p.key} className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[#1a3d32]"
                          checked={on}
                          onChange={(e) => void toggle(r.id, p.key, e.target.checked)}
                          aria-label={`${r.name}: ${p.label}`}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
