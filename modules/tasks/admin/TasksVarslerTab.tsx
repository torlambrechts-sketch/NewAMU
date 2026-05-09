// TasksVarslerTab — notification trigger configuration.
// Controls which events auto-create tasks or fire notifications:
//   - AML § 5-1 auto-notification task for critical avvik
//   - Email digest cadence
//   - Escalation delay past SLA
// All settings live in task_module_settings (same row as TasksSLATab).

import { useCallback, useEffect, useState } from 'react'
import { Mail, AlertTriangle, Clock } from 'lucide-react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { ToggleSwitch } from '../../../src/components/ui/FormToggles'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_ROW_GRID,
} from '../../../src/components/layout/WorkplaceStandardFormPanel'

type Settings = {
  autoArbeidstilsynetTask: boolean
  arbeidstilsynetNotificationHours: number
  escalationHoursAfterSla: number
  emailDigest: 'daily' | 'weekly' | 'none'
}

const DEFAULTS: Settings = {
  autoArbeidstilsynetTask: true,
  arbeidstilsynetNotificationHours: 24,
  escalationHoursAfterSla: 24,
  emailDigest: 'daily',
}

export function TasksVarslerTab() {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    const { data } = await supabase
      .from('task_module_settings')
      .select(
        'auto_arbeidstilsynet_task, arbeidstilsynet_notification_hours, escalation_hours_after_sla, email_digest',
      )
      .eq('organization_id', orgId)
      .maybeSingle()
    setLoading(false)
    if (data) {
      setSettings({
        autoArbeidstilsynetTask: data.auto_arbeidstilsynet_task ?? true,
        arbeidstilsynetNotificationHours: data.arbeidstilsynet_notification_hours ?? 24,
        escalationHoursAfterSla: data.escalation_hours_after_sla ?? 24,
        emailDigest: (data.email_digest ?? 'daily') as Settings['emailDigest'],
      })
    }
  }, [supabase, orgId])

  useEffect(() => { void load() }, [load])

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setSettings((prev) => ({ ...prev, [k]: v }))

  const handleSave = async () => {
    if (!supabase || !orgId) return
    setSaving(true)
    setError(null)
    setSaved(false)
    const { error: upsertErr } = await supabase.from('task_module_settings').upsert(
      {
        organization_id: orgId,
        auto_arbeidstilsynet_task: settings.autoArbeidstilsynetTask,
        arbeidstilsynet_notification_hours: settings.arbeidstilsynetNotificationHours,
        escalation_hours_after_sla: settings.escalationHoursAfterSla,
        email_digest: settings.emailDigest,
      },
      { onConflict: 'organization_id' },
    )
    setSaving(false)
    if (upsertErr) {
      setError(upsertErr.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  if (loading) {
    return <p className="py-12 text-center text-sm text-neutral-500">Laster innstillinger…</p>
  }

  return (
    <div className="space-y-6">
      {/* AML § 5-1 auto-notification */}
      <ModuleSectionCard>
        <div className="border-b border-neutral-200/70 px-5 py-4 md:px-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <h3 className="text-sm font-semibold text-neutral-900">
              AML § 5-1 — Meldeplikt Arbeidstilsynet
            </h3>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Alvorlige hendelser og ulykker skal meldes til Arbeidstilsynet snarest mulig,
            og senest innen fristen. Automatisk oppgaveopprettelse sikrer at meldeplikten
            ikke glemmes.
          </p>
        </div>
        <div className="divide-y divide-neutral-200/60">
          <div className={WPSTD_FORM_ROW_GRID}>
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Automatisk meldingsoppgave</p>
              <p className={`${WPSTD_FORM_LEAD} mt-1`}>
                Opprett automatisk «Meldeplikt Arbeidstilsynet»-oppgave når kritisk avvik
                registreres
              </p>
            </div>
            <div className="flex items-center">
              <ToggleSwitch
                checked={settings.autoArbeidstilsynetTask}
                onChange={(v) => set('autoArbeidstilsynetTask', v)}
                label="Aktiver automatisk meldingsoppgave"
              />
            </div>
          </div>

          {settings.autoArbeidstilsynetTask && (
            <div className={WPSTD_FORM_ROW_GRID}>
              <div>
                <p className={WPSTD_FORM_FIELD_LABEL}>Meldefrist (timer)</p>
                <p className={`${WPSTD_FORM_LEAD} mt-1`}>
                  AML § 5-1 krever varsling «snarest mulig». Standard er 24 timer.
                </p>
              </div>
              <div className="max-w-[140px]">
                <StandardInput
                  type="number"
                  min={1}
                  max={72}
                  value={String(settings.arbeidstilsynetNotificationHours)}
                  onChange={(e) =>
                    set('arbeidstilsynetNotificationHours', Math.max(1, parseInt(e.target.value) || 24))
                  }
                />
                <p className="mt-1 text-xs text-neutral-500">timer fra opprettelse</p>
              </div>
            </div>
          )}
        </div>
      </ModuleSectionCard>

      {/* Escalation */}
      <ModuleSectionCard>
        <div className="border-b border-neutral-200/70 px-5 py-4 md:px-6">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-neutral-900">Eskalering</h3>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Marker oppgaver som eskalert etter angitt tid forbi SLA-fristen.
          </p>
        </div>
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Eskaleringstid etter SLA (timer)</p>
            <p className={`${WPSTD_FORM_LEAD} mt-1`}>
              Antall timer forbi SLA-fristen før oppgaven eskaleres til leder
            </p>
          </div>
          <div className="max-w-[140px]">
            <StandardInput
              type="number"
              min={1}
              max={336}
              value={String(settings.escalationHoursAfterSla)}
              onChange={(e) =>
                set('escalationHoursAfterSla', Math.max(1, parseInt(e.target.value) || 24))
              }
            />
            <p className="mt-1 text-xs text-neutral-500">timer etter SLA-frist</p>
          </div>
        </div>
      </ModuleSectionCard>

      {/* Email digest */}
      <ModuleSectionCard>
        <div className="border-b border-neutral-200/70 px-5 py-4 md:px-6">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-neutral-900">E-postsammendrag</h3>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Regelmessig sammendrag av åpne oppgaver, forfalte frister og eskalerte saker.
          </p>
        </div>
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Frekvens</p>
            <p className={`${WPSTD_FORM_LEAD} mt-1`}>Hvor ofte sendes e-postsammendraget</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['daily', 'weekly', 'none'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => set('emailDigest', v)}
                className={`rounded border px-3 py-1.5 text-sm transition ${
                  settings.emailDigest === v
                    ? 'border-[#c2410c] bg-[#c2410c] text-white'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-[#c2410c]/40'
                }`}
              >
                {v === 'daily' ? 'Daglig' : v === 'weekly' ? 'Ukentlig' : 'Av'}
              </button>
            ))}
          </div>
        </div>
      </ModuleSectionCard>

      {/* Save bar */}
      <div className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white px-5 py-4">
        <div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-green-700">Innstillinger lagret.</p>}
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? 'Lagrer…' : 'Lagre varsler'}
        </Button>
      </div>
    </div>
  )
}
