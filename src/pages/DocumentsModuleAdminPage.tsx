import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, BookOpen, Download, FileText, GitBranch,
  Loader2, Lock, RefreshCw, Settings,
} from 'lucide-react'
import { ModulePageShell, ModuleSectionCard } from '../components/module'
import { ComplianceBanner } from '../components/ui/ComplianceBanner'
import { Button } from '../components/ui/Button'
import { Tabs, type TabItem } from '../components/ui/Tabs'
import { WarningBox } from '../components/ui/AlertBox'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { fetchOrgModulePayload, upsertOrgModulePayload } from '../lib/orgModulePayload'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import {
  parseDocumentsModuleSettings,
  type DocumentsModuleSettings,
} from '../../modules/documents/documentsModuleSettingsSchema'
import { WorkflowRulesTab } from '../components/workflow/WorkflowRulesTab'
import { DOCUMENTS_WORKFLOW_TRIGGER_EVENTS } from '../components/workflow/workflowTriggerRegistry'
import { DocumentsSettingsGenerelt } from '../components/documents/settings/DocumentsSettingsGenerelt'
import { DocumentsSettingsRevisjon } from '../components/documents/settings/DocumentsSettingsRevisjon'
import { DocumentsSettingsKvitteringer } from '../components/documents/settings/DocumentsSettingsKvitteringer'
import { DocumentsSettingsMaler } from '../components/documents/settings/DocumentsSettingsMaler'
import { DocumentsSettingsImportEksport } from '../components/documents/settings/DocumentsSettingsImportEksport'
import { DocumentsSettingsTilgang } from '../components/documents/settings/DocumentsSettingsTilgang'

const SETTINGS_KEY = 'documents_settings' as const

type AdminTab = 'generelt' | 'revisjon' | 'kvitteringer' | 'maler' | 'import' | 'tilgang' | 'arbeidsflyt'

const ADMIN_TABS: TabItem[] = [
  { id: 'generelt',     label: 'Generelt',       icon: Settings    },
  { id: 'revisjon',     label: 'Revisjon',        icon: RefreshCw   },
  { id: 'kvitteringer', label: 'Kvitteringer',    icon: FileText    },
  { id: 'maler',        label: 'Maler',           icon: BookOpen    },
  { id: 'import',       label: 'Import/Eksport',  icon: Download    },
  { id: 'tilgang',      label: 'Tilgang',         icon: Lock        },
  { id: 'arbeidsflyt',  label: 'Arbeidsflyt',     icon: GitBranch   },
]

export function DocumentsModuleAdminPage() {
  const navigate = useNavigate()
  const { supabase, can, isAdmin, organization } = useOrgSetupContext()
  const orgId = organization?.id
  const canManage = isAdmin || can('documents.manage')

  const [tab, setTab] = useState<AdminTab>('generelt')
  const [settings, setSettings] = useState<DocumentsModuleSettings>(() => parseDocumentsModuleSettings({}))
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    if (!supabase || !orgId) return
    setSettingsError(null)
    try {
      const raw = await fetchOrgModulePayload<Record<string, unknown>>(supabase, orgId, SETTINGS_KEY)
      setSettings(parseDocumentsModuleSettings(raw))
    } catch (e) {
      setSettingsError(getSupabaseErrorMessage(e))
    } finally {
      setSettingsLoading(false)
    }
  }, [supabase, orgId])

  useEffect(() => {
    if (canManage && orgId) void loadSettings()
  }, [canManage, orgId, loadSettings])

  const handleSave = useCallback(async () => {
    if (!supabase || !orgId) return
    setSaving(true); setSettingsError(null)
    try {
      await upsertOrgModulePayload(supabase, orgId, SETTINGS_KEY, {
        require_legal_ref_on_publish: settings.require_legal_ref_on_publish,
        show_revision_badge: settings.show_revision_badge,
        auto_create_annual_review: settings.auto_create_annual_review,
        default_language: settings.default_language,
        default_revision_interval_months: settings.default_revision_interval_months,
        revision_warning_days: settings.revision_warning_days,
        notify_owner_on_revision_due: settings.notify_owner_on_revision_due,
        notify_admins_on_revision_due: settings.notify_admins_on_revision_due,
        default_ack_audience: settings.default_ack_audience,
        ack_reminder_days: settings.ack_reminder_days,
        ack_max_reminders: settings.ack_max_reminders,
        ack_grace_period_days: settings.ack_grace_period_days,
      })
    } catch (e) {
      setSettingsError(getSupabaseErrorMessage(e))
    } finally { setSaving(false) }
  }, [supabase, orgId, settings])

  if (!canManage) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'Dokumenter', to: '/documents' }, { label: 'Innstillinger' }]}
        title="Innstillinger — Dokumenter"
      >
        <WarningBox>Du har ikke tilgang. Krever rollen «documents.manage» eller administrator.</WarningBox>
      </ModulePageShell>
    )
  }

  const saveProps = { settings, setSettings, saving, onSave: () => void handleSave() }
  const settingsTabs: AdminTab[] = ['generelt', 'revisjon', 'kvitteringer']

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'HMS' }, { label: 'Dokumenter', to: '/documents' }, { label: 'Innstillinger' }]}
      title="Innstillinger — Dokumenter"
      description="Konfigurer standardinnstillinger, revisjonspolicy, kvitteringsregler og arbeidsflyt for hele virksomheten."
      headerActions={
        <Button type="button" variant="secondary" size="sm" onClick={() => navigate('/documents')}>
          <ArrowLeft className="h-4 w-4" /> Tilbake
        </Button>
      }
      tabs={
        <Tabs className="w-full md:w-auto" overflow="scroll" items={ADMIN_TABS} activeId={tab} onChange={(id) => setTab(id as AdminTab)} />
      }
    >
      <div className="space-y-6">
        <ComplianceBanner title="Modulinnstillinger — Dokumenter">
          Innstillinger lagres for hele organisasjonen. Kun administratorer og personer med «documents.manage»
          kan endre disse. Visse innstillinger påvirker samsvar med internkontrollforskriften (IK-f §5) og
          arbeidsmiljøloven (AML §3-2).
        </ComplianceBanner>

        {settingsError && <WarningBox>{settingsError}</WarningBox>}

        {settingsLoading && settingsTabs.includes(tab) && (
          <p className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Laster innstillinger…
          </p>
        )}

        {/* ── Settings tabs (load from DB) ───────────────────────────────── */}
        {tab === 'generelt'     && !settingsLoading && <DocumentsSettingsGenerelt     {...saveProps} />}
        {tab === 'revisjon'     && !settingsLoading && <DocumentsSettingsRevisjon     {...saveProps} />}
        {tab === 'kvitteringer' && !settingsLoading && <DocumentsSettingsKvitteringer {...saveProps} />}

        {/* ── Standalone tabs (own state / no global settings) ────────────── */}
        {tab === 'maler'   && <DocumentsSettingsMaler />}
        {tab === 'import'  && <DocumentsSettingsImportEksport />}
        {tab === 'tilgang' && <DocumentsSettingsTilgang />}

        {/* ── Arbeidsflyt ─────────────────────────────────────────────────── */}
        {tab === 'arbeidsflyt' && (
          <ModuleSectionCard className="p-5 md:p-6">
            <div className="mb-3 flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-[#1a3d32]" />
              <h2 className="text-lg font-semibold text-neutral-900">Arbeidsflyt</h2>
            </div>
            <p className="mb-1 text-sm text-neutral-600">
              Koble dokumenthendelser til e-postregler og automatisering. Hendelser inkluderer publisering,
              revisjonsfrist, kvitteringsstatus og årsgjennomgang.
            </p>
            <div className="mb-4 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
              <strong className="text-neutral-800">Aktuelle lovkrav:</strong>{' '}
              IK-f §5 nr. 5 (årsgjennomgang) · AML §3-2 (opplæring og informasjon) ·
              Internkontrollforskriften §5 nr. 7 (oppdaterte prosedyrer).
            </div>
            <WorkflowRulesTab
              supabase={supabase}
              module="documents"
              triggerEvents={DOCUMENTS_WORKFLOW_TRIGGER_EVENTS.map((e) => ({ value: e.value, label: e.label }))}
            />
          </ModuleSectionCard>
        )}
      </div>
    </ModulePageShell>
  )
}
