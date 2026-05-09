import { useState, type ReactNode } from 'react'
import {
  AlertOctagon,
  Bell,
  Globe,
  Mail,
  Settings as SettingsIcon,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { ModuleSectionCard } from '../../../src/components/module'
import { Tabs, type TabItem } from '../../../src/components/ui/Tabs'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { YesNoToggle } from '../../../src/components/ui/FormToggles'
import { InfoBox } from '../../../src/components/ui/AlertBox'
import { WPSTD_FORM_ROW_GRID } from '../../../src/components/layout/WorkplaceStandardFormPanel'
import { TASK_OWNER_ROLE_OPTIONS } from '../../../src/lib/taskFormOptions'
import {
  EMAIL_DIGEST_OPTIONS,
  TASK_AUDIT_RETENTION_OPTIONS,
  type TaskModuleSettings,
} from '../taskModuleSettings'
import { TASK_PRIORITY_OPTIONS } from '../types'
import type { UseTaskModuleSettings } from '../useTaskModuleSettings'

type SettingsSubTab =
  | 'generelt'
  | 'varslinger'
  | 'epost'
  | 'integrasjoner'
  | 'avvik'
  | 'varsling'
  | 'anonym'
  | 'etterlevelse'

const SUB_TABS: TabItem[] = [
  { id: 'generelt',      label: 'Generelt',     icon: SettingsIcon },
  { id: 'varslinger',    label: 'Varslinger',   icon: Bell },
  { id: 'epost',         label: 'E-post',       icon: Mail },
  { id: 'integrasjoner', label: 'Integrasjoner', icon: Globe },
  { id: 'avvik',         label: 'Avvik',        icon: AlertOctagon },
  { id: 'varsling',      label: 'Varsling',     icon: ShieldAlert },
  { id: 'anonym',        label: 'Anonym AML',   icon: Shield },
  { id: 'etterlevelse',  label: 'Etterlevelse', icon: ShieldCheck },
]

type Props = {
  settings: UseTaskModuleSettings
}

export function TasksSettingsTab({ settings }: Props) {
  const [tab, setTab] = useState<SettingsSubTab>('generelt')

  return (
    <div className="space-y-4">
      <ModuleSectionCard className="p-3">
        <Tabs
          overflow="scroll"
          items={SUB_TABS}
          activeId={tab}
          onChange={(id) => setTab(id as SettingsSubTab)}
        />
      </ModuleSectionCard>

      {tab === 'generelt'      && <GeneraltSection settings={settings} />}
      {tab === 'varslinger'    && <NotificationsSection settings={settings} />}
      {tab === 'epost'         && <EmailSection settings={settings} />}
      {tab === 'integrasjoner' && <IntegrationsSection settings={settings} />}
      {tab === 'avvik'         && <AvvikSection settings={settings} />}
      {tab === 'varsling'      && <VarslingSection settings={settings} />}
      {tab === 'anonym'        && <AnonymSection settings={settings} />}
      {tab === 'etterlevelse'  && <ComplianceSection settings={settings} />}
    </div>
  )
}

// ── shared layout helpers ────────────────────────────────────────────────────

function SettingsCard({
  title,
  children,
  resetLabel,
  onReset,
}: {
  title: string
  children: ReactNode
  resetLabel?: string
  onReset?: () => void
}) {
  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        {onReset ? (
          <Button type="button" variant="secondary" size="sm" onClick={onReset}>
            {resetLabel ?? 'Tilbakestill'}
          </Button>
        ) : null}
      </header>
      <div className="mt-6">{children}</div>
    </ModuleSectionCard>
  )
}

function FormRow({
  label,
  hint,
  children,
}: {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div className={WPSTD_FORM_ROW_GRID}>
      <div>
        <p className="text-sm font-medium text-neutral-800">{label}</p>
        {hint ? <p className="mt-1 text-sm text-neutral-600">{hint}</p> : null}
      </div>
      <div>{children}</div>
    </div>
  )
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: ReactNode
  hint?: ReactNode
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <FormRow label={label} hint={hint}>
      <div className="max-w-xs">
        <YesNoToggle value={value} onChange={onChange} />
      </div>
    </FormRow>
  )
}

// ── Generelt ────────────────────────────────────────────────────────────────

function GeneraltSection({ settings: s }: Props) {
  const { settings, update, reset } = s
  return (
    <SettingsCard
      title="Generelle innstillinger"
      onReset={() => reset('defaults')}
    >
      <FormRow label="Standard prioritet" hint="Gjelder nye oppgaver opprettet manuelt eller fra arbeidsflyt.">
        <SearchableSelect
          value={settings.defaults.priority}
          options={TASK_PRIORITY_OPTIONS.map((p) => ({ value: p.value, label: p.label }))}
          onChange={(v) => update('defaults', { priority: v as TaskModuleSettings['defaults']['priority'] })}
        />
      </FormRow>
      <FormRow label="Standard rolle">
        <SearchableSelect
          value={settings.defaults.ownerRole}
          options={TASK_OWNER_ROLE_OPTIONS.map((r) => ({ value: r, label: r }))}
          onChange={(v) => update('defaults', { ownerRole: v })}
        />
      </FormRow>
      <FormRow
        label="Standard frist (dager)"
        hint="Brukes når frist ikke er satt manuelt. Sett 0 for å la oppgaver være uten frist."
      >
        <div className="max-w-[140px]">
          <StandardInput
            type="number"
            min={0}
            max={365}
            value={settings.defaults.dueOffsetDays}
            onChange={(e) => update('defaults', { dueOffsetDays: Number(e.target.value) })}
          />
        </div>
      </FormRow>
      <FormRow
        label="Standard WIP-grense"
        hint="Brukes som default «Pågår»-grense når et nytt prosjekt opprettes."
      >
        <div className="max-w-[140px]">
          <StandardInput
            type="number"
            min={0}
            max={50}
            value={settings.defaults.defaultWipInProgress}
            onChange={(e) => update('defaults', { defaultWipInProgress: Number(e.target.value) })}
          />
        </div>
      </FormRow>
      <ToggleRow
        label="Krev ledersignatur for HMS-oppgaver"
        hint="AML § 4-1: ledelsen verifiserer risikoreduserende tiltak før de kan lukkes."
        value={settings.defaults.autoRequireMgmtSignOffForHse}
        onChange={(v) => update('defaults', { autoRequireMgmtSignOffForHse: v })}
      />
    </SettingsCard>
  )
}

// ── Varslinger ──────────────────────────────────────────────────────────────

function NotificationsSection({ settings: s }: Props) {
  const { settings, update, reset } = s
  return (
    <SettingsCard
      title="Varslinger"
      onReset={() => reset('notifications')}
    >
      <ToggleRow
        label="Aktiver varslinger"
        hint="Når av sendes ingen e-post / push uavhengig av valg under."
        value={settings.notifications.enabled}
        onChange={(v) => update('notifications', { enabled: v })}
      />
      <FormRow
        label="Varslings-e-post (samle-mottaker)"
        hint="Brukes for systemvarsler i tillegg til oppgavens egen ansvarlig."
      >
        <StandardInput
          type="email"
          value={settings.notifications.notificationEmail}
          onChange={(e) => update('notifications', { notificationEmail: e.target.value })}
          placeholder="hms@dittfirma.no"
        />
      </FormRow>
      <ToggleRow
        label="Varsle ved tildeling"
        value={settings.notifications.notifyOnAssignment}
        onChange={(v) => update('notifications', { notifyOnAssignment: v })}
      />
      <ToggleRow
        label="Varsle på ny kommentar"
        value={settings.notifications.notifyOnComment}
        onChange={(v) => update('notifications', { notifyOnComment: v })}
      />
      <ToggleRow
        label="Varsle på statusendring"
        value={settings.notifications.notifyOnStatusChange}
        onChange={(v) => update('notifications', { notifyOnStatusChange: v })}
      />
      <ToggleRow
        label="Varsle ved forfall"
        value={settings.notifications.notifyOnOverdue}
        onChange={(v) => update('notifications', { notifyOnOverdue: v })}
      />
      <FormRow label="Påminnelse 1 (dager før frist)" hint="0 = av">
        <div className="max-w-[140px]">
          <StandardInput
            type="number"
            min={0}
            max={60}
            value={settings.notifications.reminderDaysBefore}
            onChange={(e) => update('notifications', { reminderDaysBefore: Number(e.target.value) })}
          />
        </div>
      </FormRow>
      <FormRow label="Påminnelse 2 (dager før frist)" hint="0 = av">
        <div className="max-w-[140px]">
          <StandardInput
            type="number"
            min={0}
            max={60}
            value={settings.notifications.secondReminderDaysBefore}
            onChange={(e) => update('notifications', { secondReminderDaysBefore: Number(e.target.value) })}
          />
        </div>
      </FormRow>
      <FormRow
        label="Eskalér til leder"
        hint="Antall dager etter forfall før oppgaven sendes til leder med kopi til verneombud."
      >
        <div className="max-w-[140px]">
          <StandardInput
            type="number"
            min={0}
            max={60}
            value={settings.notifications.escalateAfterOverdueDays}
            onChange={(e) => update('notifications', { escalateAfterOverdueDays: Number(e.target.value) })}
          />
        </div>
      </FormRow>
      <FormRow label="Sammendrag (digest)">
        <SearchableSelect
          value={settings.notifications.digestFrequency}
          options={EMAIL_DIGEST_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(v) => update('notifications', { digestFrequency: v as TaskModuleSettings['notifications']['digestFrequency'] })}
        />
      </FormRow>
      <FormRow label="Sendetidspunkt (lokal time)" hint="0–23. Brukes for digest og daglige påminnelser.">
        <div className="max-w-[140px]">
          <StandardInput
            type="number"
            min={0}
            max={23}
            value={settings.notifications.digestSendHourLocal}
            onChange={(e) => update('notifications', { digestSendHourLocal: Number(e.target.value) })}
          />
        </div>
      </FormRow>
    </SettingsCard>
  )
}

// ── E-post ──────────────────────────────────────────────────────────────────

function EmailSection({ settings: s }: Props) {
  const { settings, update, reset } = s
  return (
    <SettingsCard
      title="E-postmaler"
      onReset={() => reset('email')}
    >
      <InfoBox>
        Variabler er trygge — ukjente felter rendres som tom streng. Ingen HTML-innjeksjon ettersom utdata
        sanitises før sending.
      </InfoBox>

      <div className="mt-6">
        <FormRow label="Avsendernavn">
          <StandardInput
            value={settings.email.fromName}
            onChange={(e) => update('email', { fromName: e.target.value })}
          />
        </FormRow>
        <FormRow label="Avsender-e-post" hint="Domenet bør være satt opp i e-postleverandøren (SPF/DKIM).">
          <StandardInput
            type="email"
            value={settings.email.fromEmail}
            onChange={(e) => update('email', { fromEmail: e.target.value })}
            placeholder="ingen-svar@dittfirma.no"
          />
        </FormRow>

        <FormRow label="Tildeling — emne">
          <StandardInput
            value={settings.email.assignmentSubject}
            onChange={(e) => update('email', { assignmentSubject: e.target.value })}
          />
        </FormRow>
        <FormRow label="Tildeling — innhold">
          <StandardTextarea
            rows={4}
            value={settings.email.assignmentBody}
            onChange={(e) => update('email', { assignmentBody: e.target.value })}
          />
        </FormRow>

        <FormRow label="Påminnelse — emne">
          <StandardInput
            value={settings.email.reminderSubject}
            onChange={(e) => update('email', { reminderSubject: e.target.value })}
          />
        </FormRow>
        <FormRow label="Påminnelse — innhold">
          <StandardTextarea
            rows={4}
            value={settings.email.reminderBody}
            onChange={(e) => update('email', { reminderBody: e.target.value })}
          />
        </FormRow>

        <FormRow label="Forfall — emne">
          <StandardInput
            value={settings.email.overdueSubject}
            onChange={(e) => update('email', { overdueSubject: e.target.value })}
          />
        </FormRow>
        <FormRow label="Forfall — innhold">
          <StandardTextarea
            rows={4}
            value={settings.email.overdueBody}
            onChange={(e) => update('email', { overdueBody: e.target.value })}
          />
        </FormRow>
      </div>
    </SettingsCard>
  )
}

// ── Integrasjoner ───────────────────────────────────────────────────────────

function IntegrationsSection({ settings: s }: Props) {
  const { settings, update, reset } = s
  return (
    <SettingsCard
      title="Integrasjoner"
      onReset={() => reset('integrations')}
    >
      <ToggleRow
        label="iCal-eksport"
        hint="Lar brukere abonnere på sine oppgaver i Outlook / Google Kalender."
        value={settings.integrations.icalExportEnabled}
        onChange={(v) => update('integrations', { icalExportEnabled: v })}
      />
      <FormRow label="iCal token" hint="Roteres separat. Token vises kun én gang ved opprettelse.">
        <StandardInput
          value={settings.integrations.icalExportToken}
          onChange={(e) => update('integrations', { icalExportToken: e.target.value })}
          placeholder="••••••••"
        />
      </FormRow>
      <FormRow label="Slack webhook URL">
        <StandardInput
          type="url"
          value={settings.integrations.slackWebhookUrl}
          onChange={(e) => update('integrations', { slackWebhookUrl: e.target.value })}
          placeholder="https://hooks.slack.com/services/…"
        />
      </FormRow>
      <FormRow label="Microsoft Teams webhook URL">
        <StandardInput
          type="url"
          value={settings.integrations.teamsWebhookUrl}
          onChange={(e) => update('integrations', { teamsWebhookUrl: e.target.value })}
          placeholder="https://outlook.office.com/webhook/…"
        />
      </FormRow>
      <FormRow label="Generisk webhook URL" hint="Mottar JSON-payload på alle valgte hendelser.">
        <StandardInput
          type="url"
          value={settings.integrations.genericWebhookUrl}
          onChange={(e) => update('integrations', { genericWebhookUrl: e.target.value })}
          placeholder="https://..."
        />
      </FormRow>
      <FormRow label="Send hendelser" hint="Velg hvilke hendelser som videreformidles.">
        <div className="space-y-2">
          {(
            [
              ['taskCreated', 'Oppgave opprettet'],
              ['taskCompleted', 'Oppgave fullført'],
              ['taskOverdue', 'Oppgave forfalt'],
              ['avvikCreated', 'Avvik opprettet'],
              ['varslingCreated', 'Varslingssak mottatt'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-neutral-800">
              <input
                type="checkbox"
                checked={settings.integrations.webhookEvents[key]}
                onChange={(e) =>
                  update('integrations', {
                    webhookEvents: { ...settings.integrations.webhookEvents, [key]: e.target.checked },
                  })
                }
                className="h-4 w-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-[#1a3d32]"
              />
              {label}
            </label>
          ))}
        </div>
      </FormRow>
    </SettingsCard>
  )
}

// ── Avvik ───────────────────────────────────────────────────────────────────

function AvvikSection({ settings: s }: Props) {
  const { settings, update, reset } = s
  return (
    <SettingsCard
      title="Avvik"
      onReset={() => reset('avvik')}
    >
      <FormRow label="Standard alvorlighet">
        <SearchableSelect
          value={settings.avvik.defaultSeverity}
          options={[
            { value: 'low', label: 'Lav' },
            { value: 'medium', label: 'Middels' },
            { value: 'high', label: 'Høy' },
            { value: 'critical', label: 'Kritisk' },
          ]}
          onChange={(v) =>
            update('avvik', { defaultSeverity: v as TaskModuleSettings['avvik']['defaultSeverity'] })
          }
        />
      </FormRow>
      <ToggleRow
        label="Auto-opprett oppgave ved kritisk avvik"
        hint="Hver gang et nytt avvik registreres som kritisk, opprettes en sporbar oppfølgingsoppgave."
        value={settings.avvik.autoCreateTaskOnCritical}
        onChange={(v) => update('avvik', { autoCreateTaskOnCritical: v })}
      />
      <ToggleRow
        label="Varsle ledelse ved kritisk avvik"
        hint="Send e-post til varslings-mottakeren over."
        value={settings.avvik.notifyManagementOnCritical}
        onChange={(v) => update('avvik', { notifyManagementOnCritical: v })}
      />
      <FormRow label="Lukkefrist (dager)" hint="Maks tid før et avvik bør være lukket. 0 = ingen frist.">
        <div className="max-w-[140px]">
          <StandardInput
            type="number"
            min={0}
            max={365}
            value={settings.avvik.closureSlaDays}
            onChange={(e) => update('avvik', { closureSlaDays: Number(e.target.value) })}
          />
        </div>
      </FormRow>
      <ToggleRow
        label="Krev rotårsaksanalyse ved lukking"
        hint="IK-forskriften § 5 nr. 7 — dokumentasjon av årsak."
        value={settings.avvik.requireRootCauseOnClosure}
        onChange={(v) => update('avvik', { requireRootCauseOnClosure: v })}
      />
    </SettingsCard>
  )
}

// ── Varsling ────────────────────────────────────────────────────────────────

function VarslingSection({ settings: s }: Props) {
  const { settings, update, reset } = s
  return (
    <SettingsCard
      title="Varsling (whistleblowing)"
      onReset={() => reset('varsling')}
    >
      <FormRow
        label="Bekreftelsesfrist (dager)"
        hint="Maksimalt antall dager før varsleren får skriftlig bekreftelse. AML § 2 A-3."
      >
        <div className="max-w-[140px]">
          <StandardInput
            type="number"
            min={1}
            max={30}
            value={settings.varsling.acknowledgementDays}
            onChange={(e) => update('varsling', { acknowledgementDays: Number(e.target.value) })}
          />
        </div>
      </FormRow>
      <FormRow label="Mål for behandlingstid (dager)" hint="Tidsmål før saken bør være avsluttet med konklusjon.">
        <div className="max-w-[140px]">
          <StandardInput
            type="number"
            min={1}
            max={365}
            value={settings.varsling.targetClosureDays}
            onChange={(e) => update('varsling', { targetClosureDays: Number(e.target.value) })}
          />
        </div>
      </FormRow>
      <ToggleRow
        label="Varsle komitéen ved ny sak"
        value={settings.varsling.notifyCommitteeOnNewCase}
        onChange={(v) => update('varsling', { notifyCommitteeOnNewCase: v })}
      />
      <FormRow label="Offentlig URL" hint="Slik ser den offentlige varslingsiden ut.">
        <div className="space-y-1">
          <StandardInput
            value={settings.varsling.publicFormSlug}
            onChange={(e) => update('varsling', { publicFormSlug: e.target.value.replace(/[^a-z0-9-]/gi, '').toLowerCase() })}
            placeholder="varsle"
          />
          <p className="text-xs text-neutral-500">Forhåndsvisning: <code>/{settings.varsling.publicFormSlug || 'varsle'}</code></p>
        </div>
      </FormRow>
      <ToggleRow
        label="Krev innenfor arbeidstid"
        hint="Avviser innsendinger utenom arbeidstid og henviser til akuttkanaler."
        value={settings.varsling.requireBusinessHours}
        onChange={(v) => update('varsling', { requireBusinessHours: v })}
      />
    </SettingsCard>
  )
}

// ── Anonym AML ──────────────────────────────────────────────────────────────

function AnonymSection({ settings: s }: Props) {
  const { settings, update, reset } = s
  return (
    <SettingsCard
      title="Anonym AML-rapportering"
      onReset={() => reset('anonymAml')}
    >
      <ToggleRow
        label="Aktiver kanal"
        value={settings.anonymAml.enabled}
        onChange={(v) => update('anonymAml', { enabled: v })}
      />
      <FormRow label="URL-suffiks" hint="Bestemmer adressen til skjemaet.">
        <div className="space-y-1">
          <StandardInput
            value={settings.anonymAml.pageSlug}
            onChange={(e) => update('anonymAml', { pageSlug: e.target.value.replace(/[^a-z0-9-]/gi, '').toLowerCase() })}
            placeholder="anonym-aml"
          />
          <p className="text-xs text-neutral-500">Forhåndsvisning: <code>/anonym-aml/{settings.anonymAml.pageSlug || 'anonym-aml'}</code></p>
        </div>
      </FormRow>
      <FormRow label="Sidetittel">
        <StandardInput
          value={settings.anonymAml.pageTitle}
          onChange={(e) => update('anonymAml', { pageTitle: e.target.value })}
        />
      </FormRow>
      <FormRow label="Ingress" hint="Vises øverst på den offentlige siden.">
        <StandardTextarea
          rows={3}
          value={settings.anonymAml.leadParagraph}
          onChange={(e) => update('anonymAml', { leadParagraph: e.target.value })}
        />
      </FormRow>
      <FormRow label="Bunntekst" hint="F.eks. lenke til akuttnummer eller ekstern varslingskanal.">
        <StandardTextarea
          rows={2}
          value={settings.anonymAml.footerNote}
          onChange={(e) => update('anonymAml', { footerNote: e.target.value })}
        />
      </FormRow>
    </SettingsCard>
  )
}

// ── Etterlevelse ───────────────────────────────────────────────────────────

function ComplianceSection({ settings: s }: Props) {
  const { settings, update, reset } = s
  return (
    <SettingsCard
      title="Etterlevelse"
      onReset={() => reset('compliance')}
    >
      <ToggleRow
        label="Krev signatur ved lukking"
        hint="Oppgaver kan ikke flyttes til Fullført uten digital signatur fra ansvarlig."
        value={settings.compliance.requireSignatureOnClosure}
        onChange={(v) => update('compliance', { requireSignatureOnClosure: v })}
      />
      <ToggleRow
        label="Krev ledelses-signatur for kritisk prioritet"
        hint="Pålegger AML § 4-1-medsignatur når oppgavens prioritet er Kritisk."
        value={settings.compliance.requireMgmtSignatureForCritical}
        onChange={(v) => update('compliance', { requireMgmtSignatureForCritical: v })}
      />
      <FormRow label="Lagringstid for revisjonslogg">
        <SearchableSelect
          value={settings.compliance.auditRetention}
          options={TASK_AUDIT_RETENTION_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(v) =>
            update('compliance', { auditRetention: v as TaskModuleSettings['compliance']['auditRetention'] })
          }
        />
      </FormRow>
      <FormRow
        label="Anonymisér PII (dager)"
        hint="Etter N dager fjernes navn og e-post fra eldre kommentarer. 0 = aldri."
      >
        <div className="max-w-[140px]">
          <StandardInput
            type="number"
            min={0}
            max={3650}
            value={settings.compliance.autoMinimizePiiAfterDays}
            onChange={(e) => update('compliance', { autoMinimizePiiAfterDays: Number(e.target.value) })}
          />
        </div>
      </FormRow>
      <FormRow label="Arkivér fullførte etter (dager)" hint="Skjuler dem fra standardvisninger uten å slette.">
        <div className="max-w-[140px]">
          <StandardInput
            type="number"
            min={0}
            max={365}
            value={settings.compliance.archiveDoneAfterDays}
            onChange={(e) => update('compliance', { archiveDoneAfterDays: Number(e.target.value) })}
          />
        </div>
      </FormRow>
    </SettingsCard>
  )
}
