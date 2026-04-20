import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ClipboardList,
  FolderTree,
  GitBranch,
  Loader2,
  Settings2,
  Trash2,
} from 'lucide-react'
import { WorkplacePageHeading1 } from '../components/layout/WorkplacePageHeading1'
import { ModuleAdminShell } from '../components/layout/ModuleAdminShell'
import { WorkflowRulesTab } from '../components/workflow/WorkflowRulesTab'
import { ROS_WORKFLOW_TRIGGER_EVENTS } from '../components/workflow/workflowRuleFactory'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { useRos } from '../../modules/ros/useRos'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../components/layout/WorkplaceStandardFormPanel'
import { StandardInput } from '../components/ui/Input'
import { StandardTextarea } from '../components/ui/Textarea'
import { Button } from '../components/ui/Button'
import { WarningBox } from '../components/ui/AlertBox'
import type { ParsedRosTemplateRow } from '../../modules/ros/schema'
import { RosTemplateDefinitionSchema } from '../../modules/ros/schema'

type AdminTab = 'general' | 'matrix' | 'templates' | 'workflow'

export function RosModuleAdminPage() {
  const navigate = useNavigate()
  const { supabase, organization } = useOrgSetupContext()
  const ros = useRos({ supabase })
  const { loadRosSettings } = ros
  const [tab, setTab] = useState<AdminTab>('general')

  useEffect(() => {
    if (!organization?.id) return
    void loadRosSettings()
  }, [organization?.id, loadRosSettings])

  const tabs = useMemo(
    () => [
      { key: 'general', label: 'Generelt', icon: <Settings2 className="h-4 w-4" /> },
      { key: 'matrix', label: 'Kategorier & Matrise', icon: <FolderTree className="h-4 w-4" /> },
      { key: 'templates', label: 'Maler', icon: <ClipboardList className="h-4 w-4" /> },
      { key: 'workflow', label: 'Arbeidsflyt', icon: <GitBranch className="h-4 w-4" /> },
    ],
    [],
  )

  const workflowEvents = useMemo(
    () => ROS_WORKFLOW_TRIGGER_EVENTS.map((e) => ({ value: e.value, label: e.label })),
    [],
  )

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-8">
      <WorkplacePageHeading1
        breadcrumb={[{ label: 'HMS' }, { label: 'ROS-analyser', to: '/ros' }, { label: 'Innstillinger' }]}
        title="ROS — Innstillinger"
        description="Konfigurer sannsynlighetsskala, konsekvens- og farekategorier, standardmaler og arbeidsflyt for organisasjonen."
        headerActions={
          <Button variant="secondary" type="button" onClick={() => navigate('/ros')}>
            <ArrowLeft className="h-4 w-4" />
            Tilbake til analyser
          </Button>
        }
      />

      {ros.error && <WarningBox>{ros.error}</WarningBox>}

      <ModuleAdminShell
        title="ROS-innstillinger"
        description="Alle lister lagres per organisasjon og brukes i risikomatrisen og farekilde-skjemaer."
        tabs={tabs}
        activeTab={tab}
        onTabChange={(k) => setTab(k as AdminTab)}
      >
        {tab === 'general' && <RosAdminGeneralTab ros={ros} />}
        {tab === 'matrix' && <RosAdminMatrixTab ros={ros} />}
        {tab === 'templates' && <RosAdminTemplatesTab ros={ros} />}
        {tab === 'workflow' && (
          <WorkflowRulesTab supabase={supabase} triggerModule="ros" triggerEvents={workflowEvents} />
        )}
      </ModuleAdminShell>
    </div>
  )
}

function RosAdminGeneralTab({ ros }: { ros: ReturnType<typeof useRos> }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-neutral-600">
        Sannsynlighetsnivå 1–5 brukes i matrisen og i sammendragstekster. Du kan tilpasse etiketter og hjelpetekst
        uten å endre skalaen.
      </p>
      {ros.settingsLoading ? (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Laster innstillinger…
        </div>
      ) : (
        <div className="space-y-4">
          {ros.probabilityScale.map((row) => (
            <ProbabilityLevelEditor key={row.id} row={row} ros={ros} />
          ))}
          {ros.probabilityScale.length === 0 && (
            <p className="text-sm text-neutral-500">Ingen rader funnet. Kjør database-migrasjoner for å opprette standardverdier.</p>
          )}
        </div>
      )}
    </div>
  )
}

function ProbabilityLevelEditor({
  row,
  ros,
}: {
  row: (typeof ros.probabilityScale)[0]
  ros: ReturnType<typeof useRos>
}) {
  const [label, setLabel] = useState(row.label)
  const [description, setDescription] = useState(row.description ?? '')

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-neutral-500">Nivå {row.level}</p>
      <div className={WPSTD_FORM_ROW_GRID}>
        <label className="md:col-span-1">
          <span className={WPSTD_FORM_FIELD_LABEL}>Etikett</span>
          <StandardInput value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className="md:col-span-2">
          <span className={WPSTD_FORM_FIELD_LABEL}>Beskrivelse</span>
          <StandardTextarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="primary"
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
          Lagre nivå {row.level}
        </Button>
        <Button variant="danger" size="sm" onClick={() => void ros.softDeleteProbabilityLevel(row.id)}>
          <Trash2 className="h-3.5 w-3.5" /> Fjern
        </Button>
      </div>
    </div>
  )
}

function RosAdminMatrixTab({ ros }: { ros: ReturnType<typeof useRos> }) {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <h3 className="text-sm font-semibold text-neutral-900">Konsekvenskategorier (kolonner 1–5)</h3>
        <p className="mt-1 text-xs text-neutral-500">Kobles til konsekvensakse i 5×5-matrisen.</p>
        <div className="mt-4 space-y-4">
          {ros.consequenceCategories.map((c) => (
            <ConsequenceCategoryEditor key={c.id} row={c} ros={ros} />
          ))}
        </div>
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() =>
            void ros.upsertConsequenceCategory({
              code: `NY_${Date.now().toString(36)}`,
              label: 'Ny kategori',
              matrix_column: 3,
              description: null,
              sort_order: (ros.consequenceCategories[ros.consequenceCategories.length - 1]?.sort_order ?? 0) + 10,
            })
          }
        >
          Legg til konsekvenskategori
        </Button>
      </section>
      <section>
        <h3 className="text-sm font-semibold text-neutral-900">Farekategorier</h3>
        <p className="mt-1 text-xs text-neutral-500">Velges ved registrering av farekilder.</p>
        <div className="mt-4 space-y-4">
          {ros.hazardCategories.map((h) => (
            <HazardCategoryEditor key={h.id} row={h} ros={ros} />
          ))}
        </div>
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() =>
            void ros.upsertHazardCategory({
              code: `fare_${Date.now().toString(36)}`,
              label: 'Ny farekategori',
              description: null,
              sort_order: (ros.hazardCategories[ros.hazardCategories.length - 1]?.sort_order ?? 0) + 10,
            })
          }
        >
          Legg til farekategori
        </Button>
      </section>
    </div>
  )
}

function ConsequenceCategoryEditor({
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
    <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-3">
      <div className={WPSTD_FORM_ROW_GRID}>
        <label>
          <span className={WPSTD_FORM_FIELD_LABEL}>Kode</span>
          <StandardInput value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        <label>
          <span className={WPSTD_FORM_FIELD_LABEL}>Etikett</span>
          <StandardInput value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label>
          <span className={WPSTD_FORM_FIELD_LABEL}>Matrisekolonne (1–5)</span>
          <StandardInput
            type="number"
            min={1}
            max={5}
            value={matrixColumn}
            onChange={(e) => setMatrixColumn(e.target.value)}
          />
        </label>
        <label className="md:col-span-3">
          <span className={WPSTD_FORM_FIELD_LABEL}>Beskrivelse</span>
          <StandardTextarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
      </div>
      <div className="mt-2 flex gap-2">
        <Button
          variant="primary"
          size="sm"
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
        >
          Lagre
        </Button>
        <Button variant="danger" size="sm" onClick={() => void ros.softDeleteConsequenceCategory(row.id)}>
          Slett
        </Button>
      </div>
    </div>
  )
}

function HazardCategoryEditor({
  row,
  ros,
}: {
  row: (typeof ros.hazardCategories)[0]
  ros: ReturnType<typeof useRos>
}) {
  const [code, setCode] = useState(row.code)
  const [label, setLabel] = useState(row.label)
  const [description, setDescription] = useState(row.description ?? '')

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-3">
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
      <div className="mt-2 flex gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() =>
            void ros.upsertHazardCategory({
              id: row.id,
              code: code.trim(),
              label: label.trim(),
              description: description.trim() || null,
              sort_order: row.sort_order,
            })
          }
        >
          Lagre
        </Button>
        <Button variant="danger" size="sm" onClick={() => void ros.softDeleteHazardCategory(row.id)}>
          Slett
        </Button>
      </div>
    </div>
  )
}

function RosAdminTemplatesTab({ ros }: { ros: ReturnType<typeof useRos> }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const activeTemplateId = selectedId ?? ros.templates[0]?.id ?? null
  const selected = ros.templates.find((t) => t.id === activeTemplateId) ?? null

  const createTemplate = async () => {
    const id = await ros.upsertTemplate({ name: 'Ny mal', definition: { version: 1, hazard_stubs: [] } })
    if (id) setSelectedId(id)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
      <aside className="space-y-2">
        <Button variant="secondary" className="w-full" type="button" onClick={() => void createTemplate()}>
          Ny mal
        </Button>
        <ul className="space-y-1 border-t border-neutral-200 pt-2">
          {ros.templates.map((t) => (
            <li key={t.id}>
              <Button
                variant={t.id === activeTemplateId ? 'primary' : 'ghost'}
                className="w-full justify-start text-left"
                size="sm"
                onClick={() => setSelectedId(t.id)}
              >
                {t.name}
              </Button>
            </li>
          ))}
        </ul>
      </aside>
      <div>
        {selected ? (
          <TemplateEditor key={selected.id} template={selected} ros={ros} />
        ) : (
          <p className="text-sm text-neutral-500">Opprett en mal for å komme i gang.</p>
        )}
      </div>
    </div>
  )
}

function TemplateEditor({
  template,
  ros,
}: {
  template: ParsedRosTemplateRow
  ros: ReturnType<typeof useRos>
}) {
  const [name, setName] = useState(template.name)
  const [jsonDraft, setJsonDraft] = useState(JSON.stringify(template.definition, null, 2))

  const save = useCallback(() => {
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

  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4">
      <label>
        <span className={WPSTD_FORM_FIELD_LABEL}>Malnavn</span>
        <StandardInput value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        <span className={WPSTD_FORM_FIELD_LABEL}>Definition (JSON)</span>
        <StandardTextarea rows={12} value={jsonDraft} onChange={(e) => setJsonDraft(e.target.value)} className="font-mono text-xs" />
      </label>
      <div className="flex gap-2">
        <Button variant="primary" onClick={save}>
          Lagre mal
        </Button>
        <Button variant="danger" onClick={() => void ros.softDeleteTemplate(template.id)}>
          Slett mal
        </Button>
      </div>
    </div>
  )
}
