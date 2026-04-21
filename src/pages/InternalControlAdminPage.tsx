import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, GitBranch, Loader2, Save, SlidersHorizontal } from 'lucide-react'
import { ModulePageShell } from '../components/module/ModulePageShell'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../components/layout/WorkplaceStandardFormPanel'
import { WorkflowRulesTab } from '../components/workflow/WorkflowRulesTab'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { fetchOrgModulePayload, upsertOrgModulePayload } from '../lib/orgModulePayload'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import { IkAnnualReviewModuleSettingsSchema } from '../modules/ik-annual-review'
import { Button } from '../components/ui/Button'
import { Tabs } from '../components/ui/Tabs'
import { ToggleSwitch } from '../components/ui/FormToggles'
import { WarningBox } from '../components/ui/AlertBox'

const SETTINGS_KEY = 'internkontroll_settings'

type InternkontrollSettingsPayload = {
  annual_review?: {
    require_manager_signature?: boolean
    require_deputy_signature?: boolean
  }
}

type AdminTab = 'generelt' | 'arbeidsflyt'

export function InternalControlAdminPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate()
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id

  const [tab, setTab] = useState<AdminTab>('generelt')
  const [settings, setSettings] = useState(() => IkAnnualReviewModuleSettingsSchema.parse({}))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const raw = await fetchOrgModulePayload<InternkontrollSettingsPayload>(supabase, orgId, SETTINGS_KEY)
      setSettings(IkAnnualReviewModuleSettingsSchema.parse(raw?.annual_review ?? {}))
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId])

  useEffect(() => {
    void load()
  }, [load])

  const save = useCallback(async () => {
    if (!supabase || !orgId) return
    setSaving(true)
    setError(null)
    try {
      const parsed = IkAnnualReviewModuleSettingsSchema.parse(settings)
      await upsertOrgModulePayload(supabase, orgId, SETTINGS_KEY, { annual_review: parsed })
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }, [supabase, orgId, settings])

  const tabsUiItems = useMemo(
    () => [
      { id: 'generelt', label: 'Generelt', icon: SlidersHorizontal },
      { id: 'arbeidsflyt', label: 'Arbeidsflyt', icon: GitBranch },
    ],
    [],
  )

  const tabsNode = (
    <Tabs
      items={tabsUiItems}
      activeId={tab}
      onChange={(id) => setTab(id as AdminTab)}
      overflow="scroll"
    />
  )

  const body = (
    <>
      {error ? <WarningBox>{error}</WarningBox> : null}

      {tab === 'generelt' && (
        <div className="space-y-6">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Laster…
            </p>
          ) : (
            <>
              <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-neutral-900">Årlig gjennomgang — signatur</h3>
                <p className="mt-1 text-xs text-neutral-500">
                  Standard er signatur fra leder og sikkerhetsrepresentant (verneombud/HMS), i tråd med praksis for
                  andre IK-dokumenter.
                </p>
                <div className="mt-6 space-y-6">
                  <div className={WPSTD_FORM_ROW_GRID}>
                    <span className={WPSTD_FORM_FIELD_LABEL}>Krev signatur fra leder</span>
                    <ToggleSwitch
                      checked={settings.require_manager_signature}
                      onChange={(v) => setSettings((s) => ({ ...s, require_manager_signature: v }))}
                      label="Påkrevd"
                    />
                  </div>
                  <div className={WPSTD_FORM_ROW_GRID}>
                    <span className={WPSTD_FORM_FIELD_LABEL}>Krev signatur fra sikkerhetsrepresentant</span>
                    <ToggleSwitch
                      checked={settings.require_deputy_signature}
                      onChange={(v) => setSettings((s) => ({ ...s, require_deputy_signature: v }))}
                      label="Påkrevd"
                    />
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="primary"
                disabled={saving}
                icon={<Save className="h-4 w-4" aria-hidden />}
                onClick={() => void save()}
              >
                {saving ? 'Lagrer…' : 'Lagre innstillinger'}
              </Button>
            </>
          )}
        </div>
      )}
      {tab === 'arbeidsflyt' && <WorkflowRulesTab supabase={supabase} module="internkontroll" />}
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
      breadcrumb={[{ label: 'HMS' }, { label: 'Internkontroll', to: '/internkontroll' }, { label: 'Administrasjon' }]}
      title="Internkontroll — administrasjon"
      description="Konfigurer signaturkrav for årlig gjennomgang og arbeidsflyter som utløses når dokumentet signeres."
      headerActions={
        <Button
          variant="secondary"
          type="button"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate('/internal-control?tab=annual')}
        >
          Tilbake til årsgjennomgang
        </Button>
      }
      tabs={tabsNode}
    >
      {body}
    </ModulePageShell>
  )
}
