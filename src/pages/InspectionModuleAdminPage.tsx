import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ArrowLeft,
  BarChart2,
  CheckCircle2,
  Circle,
  ClipboardList,
  GitBranch,
  Loader2,
  MapPin,
  Plus,
  Save,
  Trash2,
  UserCheck,
} from 'lucide-react'
import { ModulePageShell } from '../components/module/ModulePageShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../components/layout/layoutTable1PostingsKit'
import { Button } from '../components/ui/Button'
import { WarningBox } from '../components/ui/AlertBox'
import { StandardInput } from '../components/ui/Input'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { Tabs as UITabs } from '../components/ui/Tabs'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { useInspectionModule } from '../../modules/inspection/useInspectionModule'
import { WorkflowRulesTab } from '../components/workflow/WorkflowRulesTab'
import { INSPECTION_WORKFLOW_TRIGGER_EVENTS } from '../components/workflow/workflowTriggerRegistry'
import { parseChecklistItems } from '../../modules/inspection/schema'
import { HseStatsPanel } from '../components/hse/HseStatsPanel'
import { LocationsCrudTab } from '../components/hse/LocationsCrudTab'
import type { HmsCategory, InspectionChecklistItem, InspectionFieldType, InspectionTemplateRow } from '../../modules/inspection/types'

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

const CARD = 'border border-neutral-200/80 bg-white shadow-sm'
const CARD_SHADOW = { boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(input: string | null) {
  if (!input) return null
  try {
    return new Date(input).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' })
  } catch { return input }
}

function newItem(index: number): InspectionChecklistItem {
  return { key: `item_${Date.now()}_${index}`, label: '', fieldType: 'yes_no_na', required: true }
}

type Tab = 'templates' | 'locations' | 'signoff' | 'workflow' | 'stats'

// ── Page ──────────────────────────────────────────────────────────────────────

export function InspectionModuleAdminPage() {
  const navigate = useNavigate()
  const { supabase } = useOrgSetupContext()
  const inspection = useInspectionModule({ supabase })
  const [tab, setTab] = useState<Tab>('templates')

  useEffect(() => { void inspection.load() }, [inspection.load])

  const tabsUiItems = useMemo(
    () => [
      { id: 'templates', label: 'Maler', icon: ClipboardList },
      { id: 'locations', label: 'Lokasjoner', icon: MapPin },
      { id: 'signoff', label: 'Signaturer', icon: UserCheck },
      { id: 'workflow', label: 'Arbeidsflyt', icon: GitBranch },
      { id: 'stats', label: 'Statistikk', icon: BarChart2 },
    ],
    [],
  )

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'HMS' },
        { label: 'Inspeksjonsrunder', to: '/inspection-module' },
        { label: 'Innstillinger' },
      ]}
      title="Inspeksjonsinnstillinger"
      description="Administrer sjekkliste-maler, lokasjoner og signeringsregler for vernerunder."
      headerActions={
        <Button
          type="button"
          variant="secondary"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate('/inspection-module')}
        >
          Tilbake til runder
        </Button>
      }
      tabs={
        <UITabs
          items={tabsUiItems}
          activeId={tab}
          onChange={(id) => setTab(id as Tab)}
          overflow="scroll"
        />
      }
    >
      {inspection.error ? <WarningBox>{inspection.error}</WarningBox> : null}

      {tab === 'templates' && <TemplatesTab inspection={inspection} />}
      {tab === 'locations' && (
        <LocationsCrudTab
          supabase={supabase}
          locations={inspection.locations}
          assignableUsers={inspection.assignableUsers}
          onRefresh={() => inspection.load()}
        />
      )}
      {tab === 'signoff' && <SignoffTab inspection={inspection} supabase={supabase} />}
      {tab === 'workflow' && (
        <WorkflowRulesTab
          supabase={supabase}
          module="inspection"
          triggerEvents={[...INSPECTION_WORKFLOW_TRIGGER_EVENTS]}
        />
      )}
      {tab === 'stats' && <HseStatsPanel supabase={supabase} />}
    </ModulePageShell>
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
            className="inline-flex items-center gap-1 border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
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
                  className={`w-full border px-3 py-2.5 text-left transition-colors ${
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
            <li className="border border-dashed border-neutral-300 px-3 py-4 text-center text-xs text-neutral-500">
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
              <StandardInput
                value={draft.name}
                onChange={(e) => setDraft((p) => p ? { ...p, name: e.target.value } : p)}
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
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<Plus className="h-3.5 w-3.5" />}
                  onClick={addItem}
                >
                  Legg til rad
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={saving}
                  icon={saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  onClick={() => void save()}
                >
                  Lagre mal
                </Button>
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
        <div className="flex items-center justify-center border border-dashed border-neutral-300 py-16 text-sm text-neutral-400">
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
      <StandardInput
        value={item.label}
        onChange={(e) => onChange({ label: e.target.value })}
        placeholder="Kontrollpunkt…"
        className="py-1.5 text-sm"
      />
      <SearchableSelect
        value={item.hmsCategory ?? ''}
        options={[
          { value: '', label: '— Kategori —' },
          ...HMS_CATEGORIES.map((cat) => ({ value: cat.value, label: cat.label })),
        ]}
        onChange={(v) =>
          onChange({ hmsCategory: v ? (v as HmsCategory) : undefined })
        }
        triggerClassName="py-1.5 px-2 text-xs"
      />
      <SearchableSelect
        value={item.fieldType ?? 'yes_no_na'}
        options={FIELD_TYPES.map((ft) => ({ value: ft.value, label: ft.label }))}
        onChange={(v) => onChange({ fieldType: v as InspectionFieldType })}
        triggerClassName="py-1.5 px-2 text-xs"
      />
      <StandardInput
        value={item.lawRef ?? ''}
        onChange={(e) => onChange({ lawRef: e.target.value || undefined })}
        placeholder="AML § 4-4"
        className="py-1.5 text-xs"
      />
      <div className="flex justify-center">
        <input
          type="checkbox"
          checked={item.required ?? false}
          onChange={(e) => onChange({ required: e.target.checked })}
          className="h-4 w-4 accent-[#1a3d32]"
          aria-label={`Krav — rad ${index + 1}`}
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onDelete}
        icon={<Trash2 className="h-3.5 w-3.5" />}
        aria-label="Slett punkt"
        className="text-neutral-300 hover:text-red-500"
      />
    </li>
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
        {error && <div className="mx-5 mt-4 border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

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
                          className="inline-flex items-center gap-1.5 border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-[#1a3d32] hover:text-[#1a3d32] disabled:opacity-60"
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
