// TasksSLATab — SLA hours per priority, avvik closure gate, VO consultation
// requirement, and escalation rules. All stored in task_module_settings.

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Clock, Shield } from 'lucide-react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { ToggleSwitch } from '../../../src/components/ui/FormToggles'
import { WarningBox } from '../../../src/components/ui/AlertBox'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_ROW_GRID,
} from '../../../src/components/layout/WorkplaceStandardFormPanel'

type Settings = {
  slaCriticalHours: number
  slaHighHours: number
  slaMediumHours: number
  slaLowHours: number
  avvikClosureGate: 'hard' | 'soft' | 'none'
  risikoRequiresVoConsultation: boolean
  requiresIndependentReview: boolean
  escalationHoursAfterSla: number
  effectivenessReviewDays: number
  enableRecurringTasks: boolean
  emailDigest: 'daily' | 'weekly' | 'none'
}

const DEFAULTS: Settings = {
  slaCriticalHours: 24,
  slaHighHours: 168,
  slaMediumHours: 720,
  slaLowHours: 2160,
  avvikClosureGate: 'hard',
  risikoRequiresVoConsultation: true,
  requiresIndependentReview: true,
  escalationHoursAfterSla: 24,
  effectivenessReviewDays: 30,
  enableRecurringTasks: false,
  emailDigest: 'daily',
}

function hoursLabel(h: number) {
  if (h < 24) return `${h} timer`
  const d = Math.round(h / 24)
  return `${d} dag${d !== 1 ? 'er' : ''}`
}

export function TasksSLATab() {
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
      .select('*')
      .eq('organization_id', orgId)
      .maybeSingle()
    setLoading(false)
    if (data) {
      setSettings({
        slaCriticalHours: Number(data.sla_critical_hours ?? DEFAULTS.slaCriticalHours),
        slaHighHours: Number(data.sla_high_hours ?? DEFAULTS.slaHighHours),
        slaMediumHours: Number(data.sla_medium_hours ?? DEFAULTS.slaMediumHours),
        slaLowHours: Number(data.sla_low_hours ?? DEFAULTS.slaLowHours),
        avvikClosureGate: (data.avvik_closure_gate ?? 'hard') as Settings['avvikClosureGate'],
        risikoRequiresVoConsultation: Boolean(data.risiko_requires_vo_consultation ?? true),
        requiresIndependentReview: Boolean(data.requires_independent_review ?? true),
        escalationHoursAfterSla: Number(data.escalation_hours_after_sla ?? 24),
        effectivenessReviewDays: Number(data.effectiveness_review_days ?? 30),
        enableRecurringTasks: Boolean(data.enable_recurring_tasks ?? false),
        emailDigest: (data.email_digest ?? 'daily') as Settings['emailDigest'],
      })
    }
  }, [supabase, orgId])

  useEffect(() => { void load() }, [load])

  const set = <K extends keyof Settings>(key: K, val: Settings[K]) =>
    setSettings((s) => ({ ...s, [key]: val }))

  const save = async () => {
    if (!supabase || !orgId) return
    setSaving(true)
    setSaved(false)
    const payload = {
      organization_id: orgId,
      sla_critical_hours: settings.slaCriticalHours,
      sla_high_hours: settings.slaHighHours,
      sla_medium_hours: settings.slaMediumHours,
      sla_low_hours: settings.slaLowHours,
      avvik_closure_gate: settings.avvikClosureGate,
      risiko_requires_vo_consultation: settings.risikoRequiresVoConsultation,
      requires_independent_review: settings.requiresIndependentReview,
      escalation_hours_after_sla: settings.escalationHoursAfterSla,
      effectiveness_review_days: settings.effectivenessReviewDays,
      enable_recurring_tasks: settings.enableRecurringTasks,
      email_digest: settings.emailDigest,
    }
    const { error: e } = await supabase
      .from('task_module_settings')
      .upsert(payload, { onConflict: 'organization_id' })
    setSaving(false)
    if (e) { setError(e.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <p className="py-8 text-sm text-neutral-500">Laster innstillinger…</p>

  return (
    <div className="space-y-6">
      {error && <WarningBox>{error}</WarningBox>}

      {/* SLA hours */}
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-[#c2410c]" aria-hidden />
          <h2 className="text-base font-semibold text-neutral-900">SLA-frister per prioritet</h2>
        </div>
        <div className="divide-y divide-neutral-200/60">
          {(
            [
              { key: 'slaCriticalHours', label: 'Kritisk', hint: 'Arbeidstilsynet-meldepliktig hendelse' },
              { key: 'slaHighHours', label: 'Høy', hint: 'Alvorlig avvik eller personskade' },
              { key: 'slaMediumHours', label: 'Middels', hint: 'Standard oppfølgingssak' },
              { key: 'slaLowHours', label: 'Lav', hint: 'Generell forbedring' },
            ] as const
          ).map(({ key, label, hint }) => (
            <div key={key} className={WPSTD_FORM_ROW_GRID}>
              <div>
                <p className={WPSTD_FORM_FIELD_LABEL}>{label}</p>
                <p className={`${WPSTD_FORM_LEAD} mt-1`}>{hint}</p>
              </div>
              <div className="flex items-center gap-3">
                <StandardInput
                  type="number"
                  min={1}
                  value={settings[key]}
                  onChange={(e) => set(key, Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-sm text-neutral-500">
                  timer = {hoursLabel(settings[key])}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ModuleSectionCard>

      {/* Closure gate */}
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-[#c2410c]" aria-hidden />
          <h2 className="text-base font-semibold text-neutral-900">Avvik-lukkeport</h2>
        </div>
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Krav for å lukke avvik</p>
            <p className={`${WPSTD_FORM_LEAD} mt-1`}>
              Hard-sperre blokkerer lukking inntil tiltak er implementert og verifisert.
              Myk-advarsel lar saksbehandler overstyre med begrunnelse.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {(
              [
                { v: 'hard', label: 'Hard sperre', desc: 'Kan ikke lukkes uten verifisert tiltak (anbefalt)' },
                { v: 'soft', label: 'Myk advarsel', desc: 'Advarsel vises, men kan overstyres' },
                { v: 'none', label: 'Ingen sperre', desc: 'Fri lukking til enhver tid' },
              ] as const
            ).map(({ v, label, desc }) => (
              <label
                key={v}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                  settings.avvikClosureGate === v
                    ? 'border-[#c2410c]/30 bg-orange-50'
                    : 'border-neutral-200 bg-white hover:border-neutral-300'
                }`}
              >
                <input
                  type="radio"
                  name="avvik_closure_gate"
                  value={v}
                  checked={settings.avvikClosureGate === v}
                  onChange={() => set('avvikClosureGate', v)}
                  className="mt-0.5 text-[#c2410c]"
                />
                <div>
                  <p className="text-sm font-medium text-neutral-900">{label}</p>
                  <p className="text-xs text-neutral-500">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </ModuleSectionCard>

      {/* Compliance toggles */}
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-[#c2410c]" aria-hidden />
          <h2 className="text-base font-semibold text-neutral-900">Compliance-krav</h2>
        </div>
        <div className="divide-y divide-neutral-200/60">
          <div className={WPSTD_FORM_ROW_GRID}>
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Verneombud-konsultasjon for risiko</p>
              <p className={`${WPSTD_FORM_LEAD} mt-1`}>
                Krever at verneombud er konsultert før risikovurdering kan lukkes (AML § 6-2)
              </p>
            </div>
            <div className="flex items-center">
              <ToggleSwitch
                checked={settings.risikoRequiresVoConsultation}
                onChange={(v) => set('risikoRequiresVoConsultation', v)}
                label={settings.risikoRequiresVoConsultation ? 'Påkrevd' : 'Valgfritt'}
              />
            </div>
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Uavhengig gjennomgang (avvik/risiko)</p>
              <p className={`${WPSTD_FORM_LEAD} mt-1`}>
                Ansvarlig ≠ gjennomgåer — segregation of duty (ISO 45001 § 10.2)
              </p>
            </div>
            <div className="flex items-center">
              <ToggleSwitch
                checked={settings.requiresIndependentReview}
                onChange={(v) => set('requiresIndependentReview', v)}
                label={settings.requiresIndependentReview ? 'Påkrevd' : 'Valgfritt'}
              />
            </div>
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Gjentakende oppgaver</p>
              <p className={`${WPSTD_FORM_LEAD} mt-1`}>
                Aktiver støtte for periodisk gjentakelse av oppgaver (cadence-felt)
              </p>
            </div>
            <div className="flex items-center">
              <ToggleSwitch
                checked={settings.enableRecurringTasks}
                onChange={(v) => set('enableRecurringTasks', v)}
                label={settings.enableRecurringTasks ? 'Aktivert' : 'Deaktivert'}
              />
            </div>
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Effektverifisering (dager etter lukking)</p>
              <p className={`${WPSTD_FORM_LEAD} mt-1`}>
                Antall dager etter lukking før effektverifisering forfaller (ISO 45001 § 10.2)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StandardInput
                type="number"
                min={1}
                value={settings.effectivenessReviewDays}
                onChange={(e) => set('effectivenessReviewDays', Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm text-neutral-500">dager</span>
            </div>
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>E-post-digest</p>
              <p className={`${WPSTD_FORM_LEAD} mt-1`}>
                Frekvens for sammendrag av åpne oppgaver og SLA-utløp per e-post
              </p>
            </div>
            <div>
              <select
                value={settings.emailDigest}
                onChange={(e) => set('emailDigest', e.target.value as Settings['emailDigest'])}
                className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-[#c2410c] focus:outline-none"
              >
                <option value="daily">Daglig</option>
                <option value="weekly">Ukentlig</option>
                <option value="none">Deaktivert</option>
              </select>
            </div>
          </div>
        </div>
      </ModuleSectionCard>

      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="text-sm text-green-700">Lagret.</span>
        )}
        <Button
          variant="primary"
          onClick={() => void save()}
          disabled={saving}
        >
          {saving ? 'Lagrer…' : 'Lagre innstillinger'}
        </Button>
      </div>
    </div>
  )
}
