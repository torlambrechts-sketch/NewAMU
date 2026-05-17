// ConsequenceCard — large red-bordered banner shown above the workflow
// canvas whenever the active rule contains a "statlig handling" (gov-
// action). The legacy `<Badge variant="warning">Statlig melding</Badge>`
// (CanvasPanel.tsx, pre-_127600) was a tiny cue an editor could miss; UX
// Run 2 spec line 354 called for the audit story to surface here:
//   * what the rule will do, in plain Norwegian, per gov-action-type
//   * which prerequisites the activation guard already enforces
//     (Maskinporten/Altinn link, virksomhetssertifikat, second approver,
//     dry-run)
// The card is read-only — the rows are status mirrors of props the caller
// computed; the rule cannot be flipped to is_active=true until every row
// auto-ticks (already enforced by the activation guard from _120800 /
// _127600). The card pays for itself the first time an operator nearly
// hits "aktiver" without realising what § the rule will trigger.
import { AlertTriangle, CheckCircle2, ShieldAlert, XCircle } from 'lucide-react'
import type { WorkflowRuleRow } from '../../../types/workflow'

type IntegrationStatus = {
  altinn?: 'active' | 'test' | 'missing'
  datatilsynet?: 'active' | 'test' | 'missing'
  regint?: 'active' | 'test' | 'missing'
  nav?: 'active' | 'test' | 'missing'
  helsetilsynet?: 'active' | 'test' | 'missing'
}

export type ConsequenceCardProps = {
  rule: WorkflowRuleRow
  containsGovAction: boolean
  govActionTypes: string[]
  integrationStatus: IntegrationStatus
  /** From workflow_rule_activations — has a different user approved? */
  hasSecondApprover: boolean
  /** From workflow_runs where dry_run=true and status='ok' */
  dryRunSuccessful: boolean
  /** Optional — surface the org's signing cert status (virksomhetssertifikat). */
  certValid?: boolean
  /** Optional — organisation display name, surfaced in the title line. */
  orgName?: string
}

/**
 * Norwegian, audit-grade consequence sentence for one gov-action-type.
 * Surfaces (a) hvem mottakeren er, (b) at meldingen er forvaltningsrettslig
 * bindende, (c) eventuell tidsfrist, slik at en redaktør IKKE kan aktivere
 * en regel uten å se hva som faktisk skjer i staten.
 */
const CONSEQUENCE_BY_TYPE: Record<string, string> = {
  meld_personvernbrudd_datatilsynet:
    'Sender personvernbrudd-melding til Datatilsynet via Altinn. Mottakeren er forvaltningen — meldingen kan ikke trekkes tilbake.',
  rapporter_alvorlig_skade_arbeidstilsynet:
    'Sender §5-2-melding til Arbeidstilsynet. 24-timers-frist begynner å løpe når awarenessAt er satt.',
  meld_helsetilsynet:
    'Sender melding til Statens helsetilsyn via Altinn. Sak opprettes i tilsynsregisteret.',
  nav_sykefravar_oppfolging:
    'Sender §4-6-oppfølging til NAV via DSOP. Mottakeren er forvaltningen.',
  meld_ukom: 'Sender melding til UKOM via Altinn.',
  altinn_send_melding:
    'Sender generisk melding via Altinn. Sjekk hvilken tjeneste/skjema som er valgt.',
}

function consequenceFor(type: string): string {
  return (
    CONSEQUENCE_BY_TYPE[type] ??
    `Sender en statlig melding av type «${type}» til forvaltningen. Verifiser handlingen mot loven før aktivering.`
  )
}

type CheckRowProps = { ok: boolean; label: string; okText: string; failText: string }
function CheckRow({ ok, label, okText, failText }: CheckRowProps) {
  return (
    <li className="flex items-start gap-2 py-0.5">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" aria-hidden />
      )}
      <span className="text-sm">
        <span className="font-medium text-neutral-800">{label}:</span>{' '}
        <span className={ok ? 'text-emerald-800' : 'font-semibold text-rose-700'}>
          {ok ? okText : failText}
        </span>
      </span>
    </li>
  )
}

/**
 * Decide which org_integrations rows the rule's gov actions depend on.
 * One rule can hit several kinds (e.g. a Datatilsynet breach routed via
 * Altinn). We check each kind only when at least one gov-action type
 * referenced it.
 */
function isIntegrationOk(s?: 'active' | 'test' | 'missing'): boolean {
  return s === 'active' || s === 'test'
}

function relevantIntegrationKinds(govActionTypes: string[]): Array<keyof IntegrationStatus> {
  const out = new Set<keyof IntegrationStatus>()
  for (const t of govActionTypes) {
    if (t === 'meld_personvernbrudd_datatilsynet') {
      out.add('datatilsynet')
      out.add('altinn')
    } else if (t === 'rapporter_alvorlig_skade_arbeidstilsynet') {
      out.add('regint')
    } else if (t === 'meld_helsetilsynet' || t === 'meld_ukom') {
      out.add('helsetilsynet')
    } else if (t === 'nav_sykefravar_oppfolging') {
      out.add('nav')
      out.add('altinn')
    } else if (t === 'altinn_send_melding') {
      out.add('altinn')
    }
  }
  // If no gov-action-type hit, fall back to Altinn since most flow through it.
  if (out.size === 0) out.add('altinn')
  return Array.from(out)
}

export function ConsequenceCard({
  rule,
  containsGovAction,
  govActionTypes,
  integrationStatus,
  hasSecondApprover,
  dryRunSuccessful,
  certValid,
  orgName,
}: ConsequenceCardProps) {
  if (!containsGovAction) return null

  const uniqueTypes = Array.from(new Set(govActionTypes))
  const relevantKinds = relevantIntegrationKinds(uniqueTypes)
  const integrationOk = relevantKinds.every((k) => isIntegrationOk(integrationStatus[k]))
  const integrationLabel = relevantKinds
    .map((k) => {
      const s = integrationStatus[k]
      const label =
        k === 'regint'
          ? 'RegInc (Arbeidstilsynet)'
          : k === 'altinn'
            ? 'Altinn'
            : k === 'datatilsynet'
              ? 'Datatilsynet'
              : k === 'nav'
                ? 'NAV (DSOP)'
                : 'Helsetilsynet'
      const stateLbl = s === 'active' ? 'PROD' : s === 'test' ? 'TEST' : 'mangler'
      return `${label}: ${stateLbl}`
    })
    .join(' · ')

  return (
    <div
      className="relative overflow-hidden rounded-xl border-2 border-rose-700 bg-rose-50 shadow-sm"
      role="region"
      aria-label="Juridisk konsekvens — statlig melding"
    >
      {/* Vertical edge label */}
      <div
        className="absolute inset-y-0 left-0 flex w-9 items-center justify-center bg-rose-700"
        aria-hidden
      >
        <span
          className="whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-white"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          ⚖️ Statlig melding — juridisk konsekvens
        </span>
      </div>
      <div className="space-y-3 pb-4 pl-12 pr-4 pt-4">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" aria-hidden />
          <h3 className="text-base font-semibold text-rose-900">
            Denne regelen sender en juridisk bindende melding på vegne av{' '}
            <span className="font-bold">{orgName ?? 'virksomheten'}</span>
          </h3>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-rose-800">
            Konsekvenser når regelen fyrer
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-rose-900">
            {uniqueTypes.map((t) => (
              <li key={t}>
                <code className="rounded bg-white/60 px-1 py-0.5 text-[11px] text-rose-900">
                  {t}
                </code>{' '}
                — {consequenceFor(t)}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-rose-800">
            Krav for å aktivere
          </p>
          <ul className="space-y-0.5">
            <CheckRow
              ok={integrationOk}
              label="Maskinporten / Altinn-tilkobling"
              okText={`Tilkoblet (${integrationLabel})`}
              failText={`IKKE TILKOBLET (${integrationLabel})`}
            />
            <CheckRow
              ok={certValid !== false}
              label="Virksomhetssertifikat"
              okText={certValid === undefined ? 'Antatt gyldig' : 'Gyldig'}
              failText="IKKE GYLDIG"
            />
            <CheckRow
              ok={hasSecondApprover}
              label="Andre godkjenner satt"
              okText="Ja"
              failText="NEI — kreves"
            />
            <CheckRow
              ok={dryRunSuccessful}
              label="Tørrløp gjennomført"
              okText="OK"
              failText="Ikke gjennomført"
            />
          </ul>
        </div>

        {(!integrationOk || !hasSecondApprover || !dryRunSuccessful || certValid === false) && (
          <div className="flex items-start gap-2 rounded-md border border-rose-300 bg-white/70 px-3 py-2 text-xs text-rose-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <p>
              Aktivering er blokkert av activation-guard-trigger fra migrasjon{' '}
              <code>_20260907120800</code> til alle krav over er oppfylt. Fix raden(e) over —
              gå til <em>Admin → Integrasjoner</em> for tilkoblinger og{' '}
              <em>Tørrløp</em>-fanen for verifisering — og prøv på nytt.
            </p>
          </div>
        )}

        {rule.runtime_environment === 'test' && (
          <p className="text-[11px] italic text-rose-700">
            Regelen er pinnet til TEST (sandbox). Selv om integrasjonen er aktiv i produksjon,
            vil edge-funksjonene tvinge TT02-endepunkter inntil regelen er fremmet til
            PRODUKSJON.
          </p>
        )}
      </div>
    </div>
  )
}
