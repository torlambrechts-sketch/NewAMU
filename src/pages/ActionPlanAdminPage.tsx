import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FolderTree, GitBranch, Loader2 } from 'lucide-react'
import { ModulePageShell } from '../components/module/ModulePageShell'
import { useActionPlan } from '../../modules/action_plan/useActionPlan'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { WorkflowRulesTab } from '../components/workflow/WorkflowRulesTab'
import { ACTION_PLAN_WORKFLOW_TRIGGER_EVENTS } from '../components/workflow/workflowTriggerRegistry'
import { Button } from '../components/ui/Button'
import { StandardInput } from '../components/ui/Input'
import { WarningBox } from '../components/ui/AlertBox'
import { Tabs, type TabItem } from '../components/ui/Tabs'

type SubTab = 'kategorier' | 'arbeidsflyt'

const innerTabs: TabItem[] = [
  { id: 'kategorier', label: 'Kategorier' },
  { id: 'arbeidsflyt', label: 'Arbeidsflyt' },
]

type ActionPlanAdminPageProps = { embedded?: boolean }

export function ActionPlanAdminPage({ embedded = false }: ActionPlanAdminPageProps) {
  const navigate = useNavigate()
  const { supabase, can, isAdmin } = useOrgSetupContext()
  const canManage = isAdmin || can('action_plan.manage')
  const ap = useActionPlan({ supabase })
  const { load, categories, error, saveCategory, deleteCategory, loading } = ap
  const [subTab, setSubTab] = useState<SubTab>('kategorier')
  const [draft, setDraft] = useState<Record<string, { name: string; sort: string }>>({})

  useEffect(() => {
    if (canManage) {
      void load()
    }
  }, [load, canManage])

  const ensureDraft = useCallback(
    (id: string, name: string, sort: number) => {
      if (draft[id] !== undefined) return
      setDraft((d) => ({ ...d, [id]: { name, sort: String(sort) } }))
    },
    [draft],
  )

  if (!canManage) {
    if (embedded) {
      return (
        <WarningBox>Du har ikke tilgang til modulens innstillinger. Kontakt administrator.</WarningBox>
      )
    }
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'Tiltaksplan', to: '/tiltak' }, { label: 'Innstillinger' }]}
        title="Tiltaksplan – innstillinger"
      >
        <WarningBox>Du har ikke tilgang til modulens innstillinger. Kontakt administrator.</WarningBox>
      </ModulePageShell>
    )
  }

  const tabsNode = (
    <Tabs
      items={innerTabs as TabItem[]}
      activeId={subTab}
      onChange={(id) => setSubTab(id as SubTab)}
      overflow="scroll"
    />
  )

  const body = (
    <div className="max-w-4xl space-y-4">
      {error ? <WarningBox>{error}</WarningBox> : null}
      {subTab === 'kategorier' && (
          <div className="space-y-4">
            {loading && (
              <p className="flex items-center gap-2 text-sm text-neutral-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Laster…
              </p>
            )}
            <p className="text-xs text-neutral-600">Opprett og rediger kategorier. De vises i nedtrekkslisten når brukere registrerer tiltak.</p>
            <div className="space-y-3">
              {categories.map((c) => {
                ensureDraft(c.id, c.name, c.sort_order)
                const row = draft[c.id] ?? { name: c.name, sort: String(c.sort_order) }
                return (
                  <div key={c.id} className="flex flex-col gap-2 border border-neutral-200/80 bg-white p-3 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase text-neutral-500">Navn</p>
                      <StandardInput
                        className="mt-1 w-full"
                        value={row.name}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, [c.id]: { ...row, name: e.target.value } }))
                        }
                      />
                    </div>
                    <div className="w-24">
                      <p className="text-[10px] font-bold uppercase text-neutral-500">Sekvens</p>
                      <StandardInput
                        className="mt-1 w-full"
                        value={row.sort}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, [c.id]: { ...row, sort: e.target.value } }))
                        }
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        onClick={() =>
                          void saveCategory({
                            id: c.id,
                            name: row.name,
                            sort_order: Number.parseInt(row.sort, 10) || 0,
                          })
                        }
                      >
                        Lagre
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          if (window.confirm('Slette denne kategorien?')) {
                            void deleteCategory(c.id)
                            setDraft((d) => {
                              const n = { ...d }
                              delete n[c.id]
                              return n
                            })
                          }
                        }}
                      >
                        Slett
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center gap-2 border-t border-dashed border-neutral-200 pt-3">
              <span className="shrink-0" aria-hidden>
                <FolderTree className="h-4 w-4 text-[#1a3d32]" />
              </span>
              <NewCategoryForm onCreate={(name, order) => void saveCategory({ name, sort_order: order })} />
            </div>
          </div>
        )}
      {subTab === 'arbeidsflyt' && (
        <div className="space-y-2">
          <p className="text-sm text-neutral-600">
            Bruk forfall og lukking (hendelser fra database): opprettelse, løsning, forfall.
          </p>
          <div className="inline-flex items-center gap-1 text-xs text-neutral-500" aria-hidden>
            <GitBranch className="h-3.5 w-3.5" />
            <span>ON_MEASURE_CREATED / ON_MEASURE_RESOLVED / ON_MEASURE_OVERDUE</span>
          </div>
          <WorkflowRulesTab
            supabase={supabase}
            module="action_plan"
            triggerEvents={[...ACTION_PLAN_WORKFLOW_TRIGGER_EVENTS]}
          />
        </div>
      )}
    </div>
  )

  if (embedded) {
    return (
      <div className="space-y-4">
        {tabsNode}
        {body}
      </div>
    )
  }

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'HMS' }, { label: 'Tiltaksplan', to: '/tiltak' }, { label: 'Innstillinger' }]}
      title="Tiltaksplan – innstillinger"
      description="Kategorier og arbeidsflyt for oppfølgingstiltak (IK-f § 5.7 retninger)."
      headerActions={
        <Button
          type="button"
          variant="secondary"
          icon={<ArrowLeft className="h-4 w-4" aria-hidden />}
          onClick={() => void navigate('/tiltak')}
        >
          Tilbake
        </Button>
      }
      tabs={tabsNode}
    >
      {body}
    </ModulePageShell>
  )
}

function NewCategoryForm({ onCreate }: { onCreate: (name: string, order: number) => void }) {
  const [name, setName] = useState('')
  const [ord, setOrd] = useState('0')
  return (
    <div className="flex flex-1 flex-wrap items-end gap-2">
      <div className="min-w-0 grow">
        <p className="text-[10px] font-bold uppercase text-neutral-500">Ny kategori</p>
        <StandardInput
          className="mt-1 w-full"
          value={name}
          placeholder="Navn"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="w-20">
        <p className="text-[10px] font-bold uppercase text-neutral-500">Rekke</p>
        <StandardInput
          className="mt-1 w-full"
          value={ord}
          onChange={(e) => setOrd(e.target.value)}
        />
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={!name.trim()}
        onClick={() => {
          onCreate(name.trim(), Number.parseInt(ord, 10) || 0)
          setName('')
        }}
      >
        Legg til
      </Button>
    </div>
  )
}
