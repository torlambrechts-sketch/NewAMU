import { useCallback, useEffect, useMemo, useState, type ElementType } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ClipboardList,
  GitBranch,
  Loader2,
  Plus,
  Save,
  SlidersHorizontal,
  Tags,
  Trash2,
} from 'lucide-react'
import { WorkplacePageHeading1 } from '../components/layout/WorkplacePageHeading1'
import { ModuleAdminShell } from '../components/layout/ModuleAdminShell'
import { WorkplaceSplit7030Layout } from '../components/layout/WorkplaceSplit7030Layout'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../components/layout/WorkplaceStandardFormPanel'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../components/layout/layoutTable1PostingsKit'
import { WorkflowRulesTab } from '../components/workflow/WorkflowRulesTab'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { useRos } from '../../modules/ros/useRos'
import { StandardInput } from '../components/ui/Input'
import { StandardTextarea } from '../components/ui/Textarea'
import { Button } from '../components/ui/Button'
import { Tabs } from '../components/ui/Tabs'
import { WarningBox } from '../components/ui/AlertBox'
import { SearchableSelect, type SelectOption } from '../components/ui/SearchableSelect'
import { Badge } from '../components/ui/Badge'
import { ToggleSwitch } from '../components/ui/FormToggles'
import type { ParsedRosTemplateRow } from '../../modules/ros/schema'
import { RosTemplateDefinitionSchema } from '../../modules/ros/schema'
import type { RosLawDomain } from '../../modules/ros/types'
import { ALL_LAW_DOMAINS } from '../../modules/ros/types'

const CARD = 'rounded-xl border border-neutral-200/80 bg-white shadow-sm'
const CARD_SHADOW = { boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } as const

function isRosSystemEntity(organizationId: string | null | undefined): boolean {
  return organizationId == null
}

function SystemBadge() {
  return <Badge variant="info">System</Badge>
}

const MATRIX_SIZE_OPTIONS: SelectOption[] = [
  { value: '5', label: '5×5 (standard)' },
  { value: '3', label: '3×3' },
]

type AdminTab = 'generelt' | 'kategorier' | 'maler' | 'arbeidsflyt'

const TAB_ICONS: Record<AdminTab, ElementType> = {
  generelt: SlidersHorizontal,
  kategorier: Tags,
  maler: ClipboardList,
  arbeidsflyt: GitBranch,
}

type RosModuleAdminPageProps = { embedded?: boolean }

export function RosModuleAdminPage({ embedded = false }: RosModuleAdminPageProps) {
  const navigate = useNavigate()
  const { supabase, organization } = useOrgSetupContext()
  const ros = useRos({ supabase })
  const { loadRosSettings } = ros
  const [tab, setTab] = useState<AdminTab>('generelt')

  useEffect(() => {
    if (!organization?.id) return
    void loadRosSettings()
  }, [organization?.id, loadRosSettings])

  const shellTabs = useMemo(
    () => [
      { key: 'generelt', label: 'Generelt', icon: <SlidersHorizontal className="h-4 w-4" /> },
      { key: 'kategorier', label: 'Kategorier', icon: <Tags className="h-4 w-4" /> },
      { key: 'maler', label: 'Maler', icon: <ClipboardList className="h-4 w-4" /> },
      { key: 'arbeidsflyt', label: 'Arbeidsflyt', icon: <GitBranch className="h-4 w-4" /> },
    ],
    [],
  )

  const tabsUiItems = useMemo(
    () =>
      shellTabs.map((t) => ({
        id: t.key,
        label: t.label,
        icon: TAB_ICONS[t.key as AdminTab],
      })),
    [shellTabs],
  )

  const shellClass = embedded ? 'space-y-6' : 'mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-8'

  return (
    <div className={shellClass}>
      <WorkplacePageHeading1
        breadcrumb={
          embedded
            ? [{ label: 'HMS' }, { label: 'ROS-analyser' }]
            : [{ label: 'HMS' }, { label: 'ROS-analyser', to: '/ros' }, { label: 'Administrasjon' }]
        }
        title={embedded ? 'Innstillinger' : 'ROS Administrasjon'}
        description="Konfigurer modulen, fare- og konsekvenskategorier, standardmaler og automatiserte arbeidsflyter — samme mønster som inspeksjonsmodulen."
        headerActions={
          embedded ? null : (
            <Button variant="secondary" type="button" onClick={() => navigate('/ros')}>
              <ArrowLeft className="h-4 w-4" />
              Tilbake til analyser
            </Button>
          )
        }
      />

      {ros.error && <WarningBox>{ros.error}</WarningBox>}

      <ModuleAdminShell
        title="ROS Administrasjon"
        description="Innstillinger lagres per organisasjon og brukes i risikomatrise og farekilde-skjemaer."
        tabs={shellTabs}
        activeTab={tab}
        onTabChange={(k) => setTab(k as AdminTab)}
        layout="tabsTop"
        tabStrip={<Tabs items={tabsUiItems} activeId={tab} onChange={(id) => setTab(id as AdminTab)} />}
      >
        {tab === 'generelt' && <RosAdminGenereltTab ros={ros} />}
        {tab === 'kategorier' && <RosAdminKategorierTab ros={ros} />}
        {tab === 'maler' && <RosAdminMalerTab ros={ros} />}
        {tab === 'arbeidsflyt' && <WorkflowRulesTab supabase={supabase} module="ros" />}
      </ModuleAdminShell>
    </div>
  )
}

// ── Generelt ─────────────────────────────────────────────────────────────────

function RosAdminGenereltTab({ ros }: { ros: ReturnType<typeof useRos> }) {
  const s = ros.moduleSettings
  const matrixValue = String(s?.default_matrix_size ?? 5)

  if (ros.settingsLoading && !s) {
    return (
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Laster innstillinger…
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className={`${CARD} p-4 md:p-6`} style={CARD_SHADOW}>
        <h3 className="text-sm font-semibold text-neutral-900">Moduloppførsel</h3>
        <p className="mt-1 text-xs text-neutral-500">
          Signatur og matrisestørrelse styrer hvordan analyser oppfører seg i skjemaer (videre validering i analyser
          bygges ut fra disse flaggene).
        </p>
        <div className={`${WPSTD_FORM_ROW_GRID} mt-4`}>
          <div className="md:col-span-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Krev dobbeltsignatur</p>
              <p className="text-xs text-neutral-500">Ansvarlig og verneombud må signere før godkjenning.</p>
            </div>
            <ToggleSwitch
              checked={s?.require_dual_signature ?? true}
              onChange={(v) => void ros.updateRosModuleSettings({ require_dual_signature: v })}
              label="Krev dobbeltsignatur"
            />
          </div>
          <label className="md:col-span-2">
            <span className={WPSTD_FORM_FIELD_LABEL}>Standard matrisestørrelse</span>
            <SearchableSelect
              value={matrixValue}
              options={MATRIX_SIZE_OPTIONS}
              onChange={(v) =>
                void ros.updateRosModuleSettings({
                  default_matrix_size: v === '3' ? 3 : 5,
                })
              }
            />
          </label>
        </div>
      </div>

      <div className={`${CARD} p-4 md:p-6`} style={CARD_SHADOW}>
        <h3 className="text-sm font-semibold text-neutral-900">Sannsynlighetsskala (1–5)</h3>
        <p className="mt-1 text-xs text-neutral-500">Etiketter hentes fra databasen og vises i matrise og oppsummeringer.</p>
        <div className="mt-4 divide-y divide-neutral-100 border-t border-neutral-100">
          {ros.probabilityScale.map((row) => (
            <ProbabilityRow key={row.id} row={row} ros={ros} />
          ))}
        </div>
        {ros.probabilityScale.length === 0 && (
          <p className="mt-4 text-sm text-neutral-500">Ingen rader — kjør database-migrasjoner for standardverdier.</p>
        )}
      </div>
    </div>
  )
}

function ProbabilityRow({
  row,
  ros,
}: {
  row: (typeof ros.probabilityScale)[0]
  ros: ReturnType<typeof useRos>
}) {
  const [label, setLabel] = useState(row.label)
  const [description, setDescription] = useState(row.description ?? '')

  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-xs font-semibold text-neutral-500">Nivå {row.level}</p>
        <StandardInput value={label} onChange={(e) => setLabel(e.target.value)} />
        <StandardTextarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() =>
            void ros.upsertProbabilityLevel({
              id: row.id,
              level: row.level,
              label: label.trim() || row.label,
              description: description.trim() || null,
              sort_order: row.sort_order,
            })
          }
        >
          Lagre
        </Button>
        <Button
          variant="ghost"
          size="icon"
          icon={<Trash2 className="h-4 w-4" />}
          aria-label="Fjern nivå"
          onClick={() => void ros.softDeleteProbabilityLevel(row.id)}
        />
      </div>
    </div>
  )
}

// ── Kategorier (70/30) ───────────────────────────────────────────────────────

function RosAdminKategorierTab({ ros }: { ros: ReturnType<typeof useRos> }) {
  return (
    <WorkplaceSplit7030Layout
      cardWrap={false}
      main={
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">Konsekvenskategorier</h3>
          <p className="mt-1 text-xs text-neutral-500">Kobles til konsekvensakse (kolonne 1–5) i matrisen.</p>
          <NewConsequenceForm ros={ros} />
          <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Kode</th>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Etikett</th>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Kolonne</th>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Beskrivelse</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {ros.consequenceCategories.map((c) => (
                  <ConsequenceTableRow key={c.id} row={c} ros={ros} />
                ))}
              </tbody>
            </table>
            {ros.consequenceCategories.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-neutral-400">Ingen konsekvenskategorier.</p>
            )}
          </div>
        </div>
      }
      aside={
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">Farekategorier</h3>
          <p className="mt-1 text-xs text-neutral-500">Velges ved registrering av farekilder.</p>
          <NewHazardCategoryForm ros={ros} />
          <ul className="mt-4 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
            {ros.hazardCategories.map((h) => (
              <HazardCategoryListRow key={h.id} row={h} ros={ros} />
            ))}
          </ul>
          {ros.hazardCategories.length === 0 && (
            <p className="mt-4 text-center text-sm text-neutral-400">Ingen farekategorier.</p>
          )}
        </div>
      }
    />
  )
}

function NewConsequenceForm({ ros }: { ros: ReturnType<typeof useRos> }) {
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [matrixColumn, setMatrixColumn] = useState('3')
  const [description, setDescription] = useState('')

  const add = () => {
    if (!code.trim() || !label.trim()) return
    void ros.addConsequenceCategory({
      code: code.trim(),
      label: label.trim(),
      matrix_column: Math.min(5, Math.max(1, parseInt(matrixColumn, 10) || 1)),
      description: description.trim() || null,
      sort_order: (ros.consequenceCategories[ros.consequenceCategories.length - 1]?.sort_order ?? 0) + 10,
    })
    setCode('')
    setLabel('')
    setDescription('')
  }

  return (
    <div className={`${CARD} mt-4 p-4`} style={CARD_SHADOW}>
      <p className={WPSTD_FORM_FIELD_LABEL}>Ny konsekvenskategori</p>
      <div className={WPSTD_FORM_ROW_GRID}>
        <label>
          <span className={WPSTD_FORM_FIELD_LABEL}>Kode</span>
          <StandardInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="f.eks. C6" />
        </label>
        <label>
          <span className={WPSTD_FORM_FIELD_LABEL}>Etikett</span>
          <StandardInput value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label>
          <span className={WPSTD_FORM_FIELD_LABEL}>Matrisekolonne (1–5)</span>
          <StandardInput type="number" min={1} max={5} value={matrixColumn} onChange={(e) => setMatrixColumn(e.target.value)} />
        </label>
        <label className="md:col-span-3">
          <span className={WPSTD_FORM_FIELD_LABEL}>Beskrivelse</span>
          <StandardTextarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
      </div>
      <Button variant="primary" className="mt-3" type="button" onClick={add} disabled={!code.trim() || !label.trim()}>
        <Plus className="h-4 w-4" />
        Legg til
      </Button>
    </div>
  )
}

function ConsequenceTableRow({
  row,
  ros,
}: {
  row: (typeof ros.consequenceCategories)[0]
  ros: ReturnType<typeof useRos>
}) {
  const [code, setCode] = useState(row.code)
  const [label, setLabel] = useState(row.label)
  const [matrixColumn, setMatrixColumn] = useState(String(row.matrix_column))
  const [description, setDescription] = useState(row.description ?? '')

  return (
    <tr className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
      <td className="px-4 py-2 align-top">
        <StandardInput value={code} onChange={(e) => setCode(e.target.value)} className="text-sm" />
      </td>
      <td className="px-4 py-2 align-top">
        <StandardInput value={label} onChange={(e) => setLabel(e.target.value)} className="text-sm" />
      </td>
      <td className="px-4 py-2 align-top">
        <StandardInput
          type="number"
          min={1}
          max={5}
          value={matrixColumn}
          onChange={(e) => setMatrixColumn(e.target.value)}
          className="text-sm"
        />
      </td>
      <td className="px-4 py-2 align-top">
        <StandardTextarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className="text-sm" />
      </td>
      <td className="px-2 py-2 align-top text-right">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            icon={<Save className="h-4 w-4" />}
            aria-label="Lagre rad"
            onClick={() =>
              void ros.upsertConsequenceCategory({
                id: row.id,
                code: code.trim(),
                label: label.trim(),
                matrix_column: Math.min(5, Math.max(1, parseInt(matrixColumn, 10) || 1)),
                description: description.trim() || null,
                sort_order: row.sort_order,
              })
            }
          />
          <Button
            variant="ghost"
            size="icon"
            icon={<Trash2 className="h-4 w-4 text-red-600" />}
            aria-label="Slett"
            onClick={() => void ros.deleteConsequenceCategory(row.id)}
          />
        </div>
      </td>
    </tr>
  )
}

function NewHazardCategoryForm({ ros }: { ros: ReturnType<typeof useRos> }) {
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')

  const add = () => {
    if (!code.trim() || !label.trim()) return
    void ros.addHazardCategory({
      code: code.trim(),
      label: label.trim(),
      description: description.trim() || null,
      sort_order: (ros.hazardCategories[ros.hazardCategories.length - 1]?.sort_order ?? 0) + 10,
    })
    setCode('')
    setLabel('')
    setDescription('')
  }

  return (
    <div className={`${CARD} mt-4 p-4`} style={CARD_SHADOW}>
      <p className={WPSTD_FORM_FIELD_LABEL}>Ny farekategori</p>
      <div className={WPSTD_FORM_ROW_GRID}>
        <label>
          <span className={WPSTD_FORM_FIELD_LABEL}>Kode</span>
          <StandardInput value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        <label>
          <span className={WPSTD_FORM_FIELD_LABEL}>Etikett</span>
          <StandardInput value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className="md:col-span-2">
          <span className={WPSTD_FORM_FIELD_LABEL}>Beskrivelse</span>
          <StandardTextarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
      </div>
      <Button variant="primary" className="mt-3" type="button" onClick={add} disabled={!code.trim() || !label.trim()}>
        <Plus className="h-4 w-4" />
        Legg til
      </Button>
    </div>
  )
}

function HazardCategoryListRow({
  row,
  ros,
}: {
  row: (typeof ros.hazardCategories)[0]
  ros: ReturnType<typeof useRos>
}) {
  const [code, setCode] = useState(row.code)
  const [label, setLabel] = useState(row.label)
  const [description, setDescription] = useState(row.description ?? '')
  const isSystem = isRosSystemEntity(row.organization_id)

  if (isSystem) {
    return (
      <li className="flex flex-col gap-2 border-b border-neutral-100 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-xs text-neutral-500">{row.code}</p>
            <SystemBadge />
          </div>
          <p className="mt-1 text-sm font-medium text-neutral-900">{row.label}</p>
          {row.description ? <p className="mt-1 text-xs text-neutral-600">{row.description}</p> : null}
        </div>
      </li>
    )
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex-1 space-y-2">
        <StandardInput value={code} onChange={(e) => setCode(e.target.value)} />
        <StandardInput value={label} onChange={(e) => setLabel(e.target.value)} />
        <StandardTextarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          variant="ghost"
          size="icon"
          icon={<Save className="h-4 w-4" />}
          aria-label="Lagre"
          onClick={() =>
            void ros.upsertHazardCategory({
              id: row.id,
              code: code.trim(),
              label: label.trim(),
              description: description.trim() || null,
              sort_order: row.sort_order,
            })
          }
        />
        <Button
          variant="ghost"
          size="icon"
          icon={<Trash2 className="h-4 w-4 text-red-600" />}
          aria-label="Slett"
          onClick={() => void ros.deleteHazardCategory(row.id)}
        />
      </div>
    </li>
  )
}

// ── Maler (speilet mot inspeksjon: liste + editor) ───────────────────────────

function RosAdminMalerTab({ ros }: { ros: ReturnType<typeof useRos> }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const activeTemplateId = selectedId ?? ros.templates[0]?.id ?? null
  const selected = ros.templates.find((t) => t.id === activeTemplateId) ?? null

  const createTemplate = async () => {
    const id = await ros.addTemplate({ name: 'Ny mal', definition: { version: 1, hazard_stubs: [] } })
    if (id) setSelectedId(id)
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
      <aside className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Maler</p>
          <Button variant="secondary" size="sm" type="button" onClick={() => void createTemplate()}>
            <Plus className="h-3.5 w-3.5" /> Ny
          </Button>
        </div>
        <ul className="space-y-1">
          {ros.templates.map((t) => {
            const count = t.definition.hazard_stubs?.length ?? 0
            const active = activeTemplateId === t.id
            const sys = isRosSystemEntity(t.organization_id)
            return (
              <li key={t.id}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSelectedId(t.id)}
                  className={`h-auto w-full justify-start border px-3 py-2.5 text-left ${
                    active ? 'border-[#1a3d32] bg-[#1a3d32]/5' : 'border-neutral-200 bg-white hover:border-neutral-300'
                  }`}
                  style={active ? undefined : CARD_SHADOW}
                >
                  <div className="flex min-w-0 w-full items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-semibold text-neutral-900">{t.name}</p>
                    {sys ? <SystemBadge /> : null}
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-500">{count} farekilder i mal</p>
                </Button>
              </li>
            )
          })}
          {ros.templates.length === 0 && (
            <li className="border border-dashed border-neutral-300 px-3 py-4 text-center text-xs text-neutral-500">
              Ingen maler ennå
            </li>
          )}
        </ul>
      </aside>

      {selected ? (
        <TemplateEditorPanel key={selected.id} template={selected} ros={ros} />
      ) : (
        <div className="flex items-center justify-center border border-dashed border-neutral-300 py-16 text-sm text-neutral-400">
          Velg en mal fra listen for å redigere
        </div>
      )}
    </div>
  )
}

function TemplateEditorPanel({
  template,
  ros,
}: {
  template: ParsedRosTemplateRow
  ros: ReturnType<typeof useRos>
}) {
  const isSystemTemplate = isRosSystemEntity(template.organization_id)
  const [name, setName] = useState(template.name)
  const [jsonDraft, setJsonDraft] = useState(JSON.stringify(template.definition, null, 2))

  const saveMeta = useCallback(() => {
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonDraft)
    } catch {
      ros.setClientError('Ugyldig JSON i maldefinisjonen.')
      return
    }
    const def = RosTemplateDefinitionSchema.safeParse(parsed)
    if (!def.success) {
      ros.setClientError('Maldefinisjonen samsvarer ikke med det tillatte formatet (Zod).')
      return
    }
    ros.setClientError(null)
    void ros.upsertTemplate({ id: template.id, name: name.trim(), definition: def.data })
  }, [jsonDraft, name, ros, template.id])

  const stubs = template.definition.hazard_stubs ?? []
  const lawOptions: SelectOption[] = ALL_LAW_DOMAINS.map((d) => ({ value: d, label: d }))
  const categoryOptions: SelectOption[] = [
    { value: '', label: '(ingen)' },
    ...ros.hazardCategories.map((c) => ({
      value: c.code,
      label: c.label,
      suffix: isRosSystemEntity(c.organization_id) ? <SystemBadge /> : undefined,
    })),
  ]

  const patchStubs = (next: NonNullable<ParsedRosTemplateRow['definition']['hazard_stubs']>) => {
    if (isSystemTemplate) return
    const merged: ParsedRosTemplateRow['definition'] = {
      ...template.definition,
      version: 1,
      hazard_stubs: next,
    }
    setJsonDraft(JSON.stringify(merged, null, 2))
    void ros.upsertTemplate({ id: template.id, name: name.trim(), definition: merged })
  }

  const addStub = () => {
    if (isSystemTemplate) return
    patchStubs([...stubs, { description: '', category_code: null, law_domain: 'AML', existing_controls: null }])
  }

  const removeStub = (index: number) => {
    if (isSystemTemplate) return
    patchStubs(stubs.filter((_, i) => i !== index))
  }

  const patchStub = (index: number, patch: Partial<(typeof stubs)[0]>) => {
    if (isSystemTemplate) return
    const next = stubs.map((s, i) => (i === index ? { ...s, ...patch } : s))
    patchStubs(next)
  }

  return (
    <div className="space-y-4">
      <div className={`${CARD} p-4`} style={CARD_SHADOW}>
        {isSystemTemplate ? (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SystemBadge />
            <span className="text-xs text-neutral-600">Systemmal kan ikke redigeres eller slettes.</span>
          </div>
        ) : null}
        <label className="flex flex-col gap-1">
          <span className={WPSTD_FORM_FIELD_LABEL}>Malnavn</span>
          <StandardInput value={name} onChange={(e) => setName(e.target.value)} disabled={isSystemTemplate} />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" size="sm" type="button" onClick={saveMeta} disabled={isSystemTemplate}>
            <Save className="h-3.5 w-3.5" />
            Lagre mal
          </Button>
          <Button variant="danger" size="sm" type="button" onClick={() => void ros.deleteTemplate(template.id)} disabled={isSystemTemplate}>
            Slett mal
          </Button>
        </div>
      </div>

      <div className={`${CARD}`} style={CARD_SHADOW}>
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Farekilder i mal</h2>
            <p className="mt-0.5 text-xs text-neutral-500">Legg til forhåndsdefinerte farekilder (kobles til kategorier fra databasen).</p>
          </div>
          <Button variant="secondary" size="sm" type="button" onClick={addStub} disabled={isSystemTemplate}>
            <Plus className="h-3.5 w-3.5" />
            Legg til rad
          </Button>
        </div>
        <ul className="divide-y divide-neutral-100">
          {stubs.map((stub, index) => (
            <li key={index} className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-end`}>
              <div className="min-w-0 flex-1 space-y-2">
                <label>
                  <span className={WPSTD_FORM_FIELD_LABEL}>Beskrivelse</span>
                  <StandardInput
                    value={stub.description}
                    onChange={(e) => patchStub(index, { description: e.target.value })}
                    placeholder="Farekilde…"
                    disabled={isSystemTemplate}
                  />
                </label>
                <div className={WPSTD_FORM_ROW_GRID}>
                  <label>
                    <span className={WPSTD_FORM_FIELD_LABEL}>Lovdomene</span>
                    <SearchableSelect
                      value={stub.law_domain}
                      options={lawOptions}
                      onChange={(v) => patchStub(index, { law_domain: v as RosLawDomain })}
                      disabled={isSystemTemplate}
                    />
                  </label>
                  <label>
                    <span className={WPSTD_FORM_FIELD_LABEL}>Farekategori</span>
                    <SearchableSelect
                      value={stub.category_code ?? ''}
                      options={categoryOptions}
                      onChange={(v) => patchStub(index, { category_code: v || null })}
                      disabled={isSystemTemplate}
                    />
                  </label>
                </div>
                <label>
                  <span className={WPSTD_FORM_FIELD_LABEL}>Eksisterende barrierer</span>
                  <StandardTextarea
                    rows={2}
                    value={stub.existing_controls ?? ''}
                    onChange={(e) => patchStub(index, { existing_controls: e.target.value || null })}
                    disabled={isSystemTemplate}
                  />
                </label>
              </div>
              <Button
                variant="ghost"
                size="icon"
                icon={<Trash2 className="h-4 w-4 text-red-600" />}
                aria-label="Fjern rad"
                onClick={() => removeStub(index)}
                disabled={isSystemTemplate}
              />
            </li>
          ))}
          {stubs.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-neutral-400">Ingen farekilder i malen — klikk «Legg til rad»</li>
          )}
        </ul>
      </div>

      <div className={`${CARD} p-4`} style={CARD_SHADOW}>
        <p className={WPSTD_FORM_FIELD_LABEL}>Rå JSON (avansert)</p>
        <StandardTextarea
          rows={10}
          value={jsonDraft}
          onChange={(e) => setJsonDraft(e.target.value)}
          className="mt-2 font-mono text-xs"
          disabled={isSystemTemplate}
        />
        <Button variant="secondary" size="sm" className="mt-2" type="button" onClick={saveMeta} disabled={isSystemTemplate}>
          Valider og lagre fra JSON
        </Button>
      </div>
    </div>
  )
}
