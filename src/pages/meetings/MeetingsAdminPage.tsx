// Møter — admin (Innstillinger). Tabs: Maler, Kategorier, Arbeidsflyt.
//
// Renders embedded under the hub orchestrator (`MeetingsHubPage`) when
// `embedded={true}` so the chrome stays stable across root tabs. The
// non-embedded variant powers the legacy `/meetings/admin` deep link.
//
// Template rows show a per-framework icon matching the Oppgaver pattern
// (TaskKindIcon) so the visual language is consistent across all modules.

import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Award,
  Building2,
  ClipboardList,
  Edit3,
  FolderTree,
  GitBranch,
  Globe,
  Layers,
  Lock,
  Pin,
  Plus,
  Save,
  Scale,
  Shield,
  Tags,
  Users,
} from 'lucide-react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { ModulePageShell } from '../../components/module/ModulePageShell'
import { ModuleSectionCard } from '../../components/module/ModuleSectionCard'
import { Tabs, type TabItem } from '../../components/ui/Tabs'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import { WarningBox } from '../../components/ui/AlertBox'
import {
  MODULE_TABLE_TH,
  MODULE_TABLE_TR_BODY,
} from '../../components/module/moduleTableKit'
import { WPSTD_FORM_FIELD_LABEL } from '../../components/layout/WorkplaceStandardFormPanel'
import { WorkflowRulesTab } from '../../components/workflow/WorkflowRulesTab'
import { MEETINGS_WORKFLOW_TRIGGER_EVENTS } from '../../components/workflow/workflowTriggerRegistry'
import { useMeetings } from '../../../modules/meetings'
import {
  MEETING_CADENCE_LABEL,
  frameworkLabel,
} from '../../../modules/meetings/meetingsLabels'
import type { MeetingOrgTemplateRow } from '../../../modules/meetings/types'
import { MeetingsTemplateEditorPanel } from './MeetingsTemplateEditorPanel'

type AdminTab = 'maler' | 'kategorier' | 'arbeidsflyt'

const ADMIN_TABS: TabItem[] = [
  { id: 'maler', label: 'Maler', icon: ClipboardList },
  { id: 'kategorier', label: 'Kategorier', icon: Tags },
  { id: 'arbeidsflyt', label: 'Arbeidsflyt', icon: GitBranch },
]

// Framework icon map — keeps visual parity with TaskKindIcon in Oppgaver.
type ElementType = React.ElementType
const FRAMEWORK_ICON: Record<string, ElementType> = {
  INTERNAL: Building2,
  AML: Shield,
  'IK-f': ClipboardList,
  Hovedavtalen: Users,
  Likestillingsloven: Scale,
  ISO_9001: Award,
  ISO_14001: Globe,
  ISO_27001: Lock,
  ISO_45001: Layers,
  GDPR: Lock,
}

export function MeetingFrameworkIcon({
  framework,
  className = 'h-4 w-4',
}: {
  framework: string
  className?: string
}) {
  const Icon = FRAMEWORK_ICON[framework] ?? Shield
  return <Icon className={className} aria-hidden />
}

export function MeetingsAdminPage({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate()
  const meetings = useMeetings()
  const { supabase, isAdmin, can } = useOrgSetupContext()
  const canManage = isAdmin || can('meetings.manage')
  const [tab, setTab] = useState<AdminTab>('maler')

  if (!canManage) {
    const accessBody = (
      <WarningBox>
        Du har ikke tilgang til å administrere møtemodulen. Be administrator om å tildele
        permisjonen «Møter — administrere».
      </WarningBox>
    )
    if (embedded) return accessBody
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'Møter', to: '/meetings' }, { label: 'Innstillinger' }]}
        title="Møter — innstillinger"
        description="Krever tilgangen `meetings.manage`."
      >
        {accessBody}
      </ModulePageShell>
    )
  }

  const tabsNode = (
    <Tabs
      items={ADMIN_TABS}
      activeId={tab}
      onChange={(id) => setTab(id as AdminTab)}
      overflow="scroll"
    />
  )

  const body = (
    <>
      {meetings.error ? <WarningBox>{meetings.error}</WarningBox> : null}
      {tab === 'maler' && <TemplatesTab />}
      {tab === 'kategorier' && <CategoriesTab />}
      {tab === 'arbeidsflyt' && (
        <ModuleSectionCard className="p-5 md:p-6">
          <div className="mb-3 flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-[#1a3d32]" />
            <h2 className="text-lg font-semibold text-neutral-900">Arbeidsflyt</h2>
          </div>
          <p className="mb-4 text-sm text-neutral-600">
            Koble møtehendelser til e-postregler og automatisering — f.eks. varsling
            ved planlagt møte, fullføring eller manglende signatur.
          </p>
          <WorkflowRulesTab
            supabase={supabase}
            module="meetings"
            triggerEvents={MEETINGS_WORKFLOW_TRIGGER_EVENTS.map((e) => ({ value: e.value, label: e.label }))}
          />
        </ModuleSectionCard>
      )}
    </>
  )

  if (embedded) {
    return (
      <div className="space-y-6">
        {tabsNode}
        {body}
      </div>
    )
  }

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'HMS' }, { label: 'Møter', to: '/meetings' }, { label: 'Innstillinger' }]}
      title="Møter — innstillinger"
      description="Slå på/av systemmaler, fest favoritter i sidemenyen og forvalt kategorier."
      tabs={tabsNode}
      headerActions={
        <Button
          variant="secondary"
          type="button"
          onClick={() => navigate('/meetings')}
        >
          Tilbake til Møter
        </Button>
      }
    >
      {body}
    </ModulePageShell>
  )
}

// ── Templates tab ─────────────────────────────────────────────────────────

function TemplatesTab() {
  const meetings = useMeetings()
  const { orgSettings } = meetings
  const [editorOpen, setEditorOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<MeetingOrgTemplateRow | null>(null)

  const settingsById = useMemo(() => {
    const m = new Map<string, (typeof orgSettings)[number]>()
    for (const s of orgSettings) m.set(s.system_template_id, s)
    return m
  }, [orgSettings])

  const categoryOptions = useMemo(
    () => [
      { value: '', label: '— Uten kategori —' },
      ...meetings.categories.map((c) => ({ value: c.id, label: c.name })),
    ],
    [meetings.categories],
  )

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of meetings.categories) m.set(c.id, c.name)
    return m
  }, [meetings.categories])

  function openCreate() {
    setEditTarget(null)
    setEditorOpen(true)
  }
  function openEdit(template: MeetingOrgTemplateRow) {
    setEditTarget(template)
    setEditorOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Org templates */}
      <ModuleSectionCard className="!p-0">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-[#1a3d32]" aria-hidden />
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Egne maler</h2>
              <p className="mt-0.5 text-sm text-neutral-600">
                Organisasjonsspesifikke maler. Disse vises sammen med systemmalene i hovedsiden.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            type="button"
            size="sm"
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={openCreate}
          >
            Ny mal
          </Button>
        </div>
        {meetings.orgTemplates.length === 0 ? (
          <p className="px-5 py-5 text-sm text-neutral-600">
            Ingen egne maler ennå. Trykk «Ny mal» for å bygge en organisasjonsspesifikk mal med egen agenda og roller.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {meetings.orgTemplates.map((t) => (
              <li key={t.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => openEdit(t)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <div className="mt-0.5 shrink-0 rounded-md border border-neutral-200 bg-white p-2">
                      <MeetingFrameworkIcon framework={t.framework} className="h-4 w-4 text-[#1a3d32]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-neutral-900">{t.name}</span>
                        <Badge variant="info">{frameworkLabel(t.framework)}</Badge>
                        {t.cadence_hint ? (
                          <Badge variant="neutral">{MEETING_CADENCE_LABEL[t.cadence_hint]}</Badge>
                        ) : null}
                        {!t.is_active ? <Badge variant="neutral">Inaktiv</Badge> : null}
                        {t.category_id ? (
                          <Badge variant="neutral">{categoryNameById.get(t.category_id) ?? '—'}</Badge>
                        ) : null}
                      </div>
                      {t.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-neutral-600">{t.description}</p>
                      ) : null}
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    type="button"
                    size="sm"
                    icon={<Edit3 className="h-3.5 w-3.5" />}
                    onClick={() => openEdit(t)}
                  >
                    Rediger
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ModuleSectionCard>

      {/* System templates */}
      <ModuleSectionCard className="!p-0">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-[#1a3d32]" aria-hidden />
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Systemmaler</h2>
              <p className="mt-0.5 text-sm text-neutral-600">
                Systemmaler kan slås av per organisasjon, knyttes til kategorier og festes i sidemenyen.
              </p>
            </div>
          </div>
          <span className="text-xs text-neutral-500">{meetings.systemTemplates.length} maler</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="bg-neutral-50/60">
              <tr>
                <th className={MODULE_TABLE_TH}>Mal</th>
                <th className={MODULE_TABLE_TH}>Rammeverk</th>
                <th className={MODULE_TABLE_TH}>Kadens</th>
                <th className={MODULE_TABLE_TH}>Kategori</th>
                <th className={MODULE_TABLE_TH}>Aktiv</th>
                <th className={MODULE_TABLE_TH}>Festet</th>
              </tr>
            </thead>
            <tbody>
              {meetings.systemTemplates.map((t) => {
                const setting = settingsById.get(t.id)
                const enabled = setting?.enabled ?? true
                const pinned = setting?.nav_pinned ?? false
                const categoryId = setting?.category_id ?? ''
                return (
                  <tr key={t.id} className={MODULE_TABLE_TR_BODY}>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex items-center gap-2">
                        <MeetingFrameworkIcon
                          framework={t.framework}
                          className="h-4 w-4 shrink-0 text-[#1a3d32]/60"
                        />
                        <div>
                          <div className="font-medium text-neutral-900">
                            {setting?.override_name ?? t.label}
                          </div>
                          {t.description ? (
                            <p className="mt-0.5 line-clamp-2 text-xs text-neutral-600">{t.description}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <Badge variant="info">{frameworkLabel(t.framework)}</Badge>
                    </td>
                    <td className="px-5 py-4 align-middle text-xs text-neutral-600">
                      {t.cadence_hint ? MEETING_CADENCE_LABEL[t.cadence_hint] : '—'}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <SearchableSelect
                        value={categoryId}
                        options={categoryOptions}
                        onChange={(val) => void meetings.setTemplateCategory(t.id, val || null)}
                        triggerClassName="py-1.5 text-xs"
                      />
                    </td>
                    <td className="px-5 py-4 align-middle text-center">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => void meetings.setTemplateEnabled(t.id, e.target.checked)}
                        aria-label={`Aktiv: ${t.label}`}
                      />
                    </td>
                    <td className="px-5 py-4 align-middle text-center">
                      <Button
                        variant={pinned ? 'primary' : 'ghost'}
                        size="icon"
                        type="button"
                        aria-label={`Fest ${t.label} i sidemenyen`}
                        onClick={() => void meetings.setTemplatePinned(t.id, !pinned)}
                        className="h-8 w-8"
                      >
                        <Pin className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </ModuleSectionCard>

      <MeetingsTemplateEditorPanel
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        editTarget={editTarget}
      />
    </div>
  )
}

// ── Categories tab ────────────────────────────────────────────────────────────

function CategoriesTab() {
  const meetings = useMeetings()
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  function slugify(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (busy || !name.trim()) return
    setBusy(true)
    try {
      const ok = await meetings.upsertCategory({
        slug: slug.trim() || slugify(name),
        name: name.trim(),
        description: description.trim() || null,
      })
      if (ok) {
        setName('')
        setSlug('')
        setDescription('')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-[#1a3d32]" aria-hidden />
            <h2 className="text-lg font-semibold text-neutral-900">Kategorier</h2>
          </div>
          <span className="text-xs text-neutral-500">{meetings.categories.length}</span>
        </div>
        <p className="mt-1.5 text-sm text-neutral-600">
          Kategorier bestemmer hvordan maler grupperes i hovedsiden og sidemenyen.
        </p>
        {meetings.categories.length === 0 ? (
          <p className="mt-5 text-sm text-neutral-600">Ingen kategorier ennå.</p>
        ) : (
          <ul className="mt-5 space-y-3">
            {meetings.categories.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-900">{c.name}</p>
                  <p className="mt-0.5 text-[11px] text-neutral-500">{c.slug}</p>
                  {c.description ? (
                    <p className="mt-2 text-xs text-neutral-600">{c.description}</p>
                  ) : null}
                </div>
                <FolderTree className="h-4 w-4 shrink-0 text-neutral-400" />
              </li>
            ))}
          </ul>
        )}
      </ModuleSectionCard>

      <ModuleSectionCard className="p-5 md:p-6">
        <h3 className="text-sm font-semibold text-neutral-900">Ny kategori</h3>
        <form onSubmit={handleAdd} className="mt-4 space-y-4">
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="meetings-cat-name">
              Navn
            </label>
            <StandardInput
              id="meetings-cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="meetings-cat-slug">
              Slug
            </label>
            <StandardInput
              id="meetings-cat-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="autogenerert fra navnet"
              className="mt-1.5"
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="meetings-cat-desc">
              Beskrivelse
            </label>
            <StandardTextarea
              id="meetings-cat-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1.5"
            />
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-neutral-100 pt-4">
            <Button
              variant="primary"
              type="submit"
              icon={<Plus className="h-4 w-4" />}
              disabled={busy || !name.trim()}
            >
              <Save className="h-4 w-4" /> Lagre
            </Button>
          </div>
        </form>
      </ModuleSectionCard>
    </div>
  )
}
