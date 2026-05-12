// Wizard-factories for de tre «må»-wizardene i Compliance Studio.
//
// Hver factory tar inn alt den trenger for å:
//   - lese eksisterende dekning (CoverageMap) og bygge module_picker-options
//   - kjøre provisjonerings-RPC i «Aktivere»-trinnet
//   - vise et meningsfullt sammendrag i «Verifisere»-trinnet
//
// Wizardene er tilsiktet kortere enn typiske admin-skjemaer:
//   intro → org-fakta → velg innhold → tilordne ansvar → aktivere → verifisere.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { SelectOption, WizardDef, WizardStepAdvanceResult } from '../../../components/wizard/types'
import type { CoverageEntry, CoverageMap } from '../../../hooks/useRegelverkCoverage'

const AXIS_BY_KIND: Record<CoverageEntry['kind'], string> = {
  course_system: 'Kurs',
  course_org: 'Kurs',
  document: 'Dokument',
  document_template: 'Dokument-mal',
  survey: 'Undersøkelse',
  checklist_template: 'Sjekkliste',
  checklist_item: 'Sjekkliste',
  ros: 'ROS',
  task: 'Avvik',
  meeting_template: 'Møte',
}

export type StudioWizardDeps = {
  supabase: SupabaseClient | null
  organizationId: string | undefined
  coverage: CoverageMap
  /** Antall ansatte — pre-utfylt fra org-context. */
  employeeCount: number
  /** Kalles når wizardens siste trinn er fullført. */
  onCompleted: (values: Record<string, string | boolean>) => void
}

// Slår sammen alle TEMPLATE-treff for et sett lawRefs til SelectOption[]-grupper
// klare til module_picker. Org-instanser er allerede aktiv dekning og
// hører hjemme i Regelverk-dekning-dashbordet, ikke i wizardens picker —
// wizardens jobb er å aktivere maler som ennå ikke er instansiert.
function buildPickerOptions(coverage: CoverageMap, lawRefs: string[]): SelectOption[] {
  const seen = new Set<string>()
  const opts: SelectOption[] = []
  for (const ref of lawRefs) {
    const entries = coverage.get(ref) ?? []
    for (const e of entries) {
      if (e.source !== 'template') continue
      const key = `${e.kind}:${e.id}`
      if (seen.has(key)) continue
      seen.add(key)
      opts.push({
        value: key,
        label: e.title,
        group: AXIS_BY_KIND[e.kind] ?? 'Annet',
        badge: e.status ?? undefined,
      })
    }
  }
  return opts
}

async function provisionWithErrorHandling(
  fn: () => PromiseLike<{ error: { message: string } | null }>,
): Promise<WizardStepAdvanceResult> {
  try {
    const { error } = await fn()
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Provisjonering feilet.' }
  }
}

// ─── 1. HMS-grunnmuren ───────────────────────────────────────────────────────

export function makeHmsGrunnmurWizard(deps: StudioWizardDeps): WizardDef {
  const lawRefs = [
    'AML § 3-1',
    'AML § 3-2',
    'AML § 3-5',
    'IK-f § 5 nr. 1a',
    'IK-f § 5 nr. 1b',
    'IK-f § 5 nr. 1c',
    'IK-f § 5 nr. 2',
    'IK-f § 5 nr. 3',
  ]
  const pickerOptions = buildPickerOptions(deps.coverage, lawRefs)

  return {
    id: 'hms_grunnmur',
    title: 'HMS-grunnmuren',
    description:
      'Systematisk HMS-arbeid er etablert. Dokumenter og sjekklister er provisjonert.',
    colour: 'emerald',
    steps: [
      {
        id: 'intro',
        title: 'Hvorfor dette?',
        icon: '🏛️',
        fields: [
          {
            id: '_intro',
            label: '',
            kind: 'info',
            infoBody:
              '<strong>AML § 3-1</strong> krever at arbeidsgiver driver systematisk HMS-arbeid. ' +
              'Dette betyr skriftlige mål, organisering, opplæring, kartlegging, risikovurdering og avviksbehandling. ' +
              'Når dette er på plass har Arbeidstilsynet langt færre grunnlag for pålegg.',
          },
        ],
      },
      {
        id: 'org',
        title: 'Org-fakta',
        subtitle: 'Bekreft det vi vet om dere fra onboarding.',
        icon: '🏢',
        fields: [
          {
            id: 'employeeCount',
            label: 'Antall ansatte',
            prompt: 'Hvor mange ansatte har dere totalt? Tallet styrer hvilke plikter som er aktuelle.',
            kind: 'number',
            min: 1,
            required: true,
            hint: 'Inkludert deltid og innleide.',
          },
          {
            id: 'hasBht',
            label: 'Bedriftshelsetjeneste',
            prompt: 'Er dere tilknyttet en bedriftshelsetjeneste (BHT)?',
            kind: 'checkbox',
            hint: 'Pliktig for risikoutsatte bransjer (jf. AML § 3-3).',
          },
        ],
      },
      {
        id: 'content',
        title: 'Velg innhold',
        subtitle: 'Eksisterende ressurser som dekker §-ene. Forhåndsvalgt = ta i bruk.',
        icon: '📚',
        fields:
          pickerOptions.length > 0
            ? [
                {
                  id: 'selectedResources',
                  label: 'Ressurser å aktivere',
                  kind: 'module_picker',
                  options: pickerOptions,
                  hint: 'Du kan også opprette egne ressurser etterpå.',
                },
              ]
            : [
                {
                  id: '_noContent',
                  label: '',
                  kind: 'info',
                  infoBody:
                    'Ingen forhåndsdefinerte ressurser dekker disse §-ene ennå. ' +
                    'Neste trinn provisjonerer baseline-pakken for dere — da blir det innhold å velge fra.',
                },
              ],
      },
      {
        id: 'ownership',
        title: 'Tilordne ansvar',
        subtitle: 'Hvem eier dette HMS-systemet?',
        icon: '👤',
        fields: [
          {
            id: 'ownerName',
            label: 'Hovedansvarlig',
            prompt: 'Hvem er hovedansvarlig for HMS-systemet?',
            kind: 'text',
            placeholder: 'F.eks. Daglig leder',
            required: true,
          },
          {
            id: 'cadence',
            label: 'Gjennomgangs-kadens',
            prompt: 'Hvor ofte skal HMS-systemet gjennomgås?',
            kind: 'select',
            required: true,
            options: [
              { value: 'arlig', label: 'Årlig' },
              { value: 'halvarlig', label: 'Halvårlig' },
              { value: 'kvartalsvis', label: 'Kvartalsvis' },
            ],
          },
        ],
      },
      {
        id: 'activate',
        title: 'Aktivere',
        subtitle: 'Vi provisjonerer baseline-dokumenter og sjekklister nå.',
        icon: '⚡',
        advancingLabel: 'Provisjonerer …',
        fields: [
          {
            id: '_activateInfo',
            label: '',
            kind: 'info',
            infoBody:
              'Klikk <strong>Neste</strong> for å:<br/>• Opprette HMS-baseline-dokumenter i Wiki' +
              '<br/>• Seede compliance-sjekklister (AML/AMU-pakken)' +
              '<br/>• Tagge alt med relevante §-er slik at dekningsmålet oppdateres',
          },
        ],
        onAdvance: async (): Promise<WizardStepAdvanceResult> => {
          if (!deps.supabase || !deps.organizationId)
            return { ok: false, error: 'Mangler organisasjons-kontekst.' }
          // Idempotent: kan kjøres flere ganger uten duplisering.
          const docs = await provisionWithErrorHandling(() =>
            deps.supabase!.rpc('provision_documents_baseline_for_org', {
              p_org_id: deps.organizationId!,
            }),
          )
          if (!docs.ok) return docs
          const checklists = await provisionWithErrorHandling(() =>
            deps.supabase!.rpc('provision_compliance_baseline_for_org', {
              p_org_id: deps.organizationId!,
              p_pack: 'aml-amu',
            }),
          )
          return checklists
        },
      },
      {
        id: 'confirm',
        title: 'Verifisere',
        icon: '✅',
        fields: [
          {
            id: '_summary',
            label: '',
            kind: 'info',
            infoBody:
              'Du har nå dekket <strong>' +
              lawRefs.join(', ') +
              '</strong>.<br/><br/>Gå til <a href="/overview/regelverk" class="underline">Regelverk-dekning</a> for å se status, eller fortsett med flere wizards.',
          },
        ],
      },
    ],
    onSubmit: deps.onCompleted,
  }
}

// ─── 2. Varsling ─────────────────────────────────────────────────────────────

export function makeVarslingWizard(deps: StudioWizardDeps): WizardDef {
  const lawRefs = ['AML § 2A-1', 'AML § 2A-2', 'AML § 2A-3', 'AML § 2A-4', 'AML § 2A-6']
  const pickerOptions = buildPickerOptions(deps.coverage, lawRefs)
  const writtenRoutineRequired = deps.employeeCount >= 5

  return {
    id: 'varsling',
    title: 'Varsling — rutine og kanal',
    description: 'Skriftlig varslingsrutine er etablert.',
    colour: 'amber',
    steps: [
      {
        id: 'intro',
        title: 'Hvorfor dette?',
        icon: '📣',
        fields: [
          {
            id: '_intro',
            label: '',
            kind: 'info',
            infoBody:
              '<strong>AML § 2A-2</strong> krever skriftlig varslingsrutine ved <strong>≥5 ansatte</strong>. ' +
              'Anbefales også for mindre virksomheter. Rutinen skal beskrive: hva som kan varsles, hvordan, hvem som mottar, ' +
              'taushetsplikt og vern mot gjengjeldelse.',
          },
        ],
      },
      {
        id: 'org',
        title: 'Org-fakta',
        icon: '🏢',
        fields: [
          {
            id: 'employeeCount',
            label: 'Antall ansatte',
            kind: 'number',
            min: 1,
            required: true,
            hint: writtenRoutineRequired
              ? 'Skriftlig rutine er pliktig for dere.'
              : 'Skriftlig rutine er anbefalt selv om dere har <5 ansatte.',
          },
        ],
      },
      {
        id: 'channel',
        title: 'Mottaker og kanal',
        icon: '📬',
        fields: [
          {
            id: 'primaryRecipient',
            label: 'Hvem mottar varsler primært?',
            kind: 'radio-cards',
            required: true,
            options: [
              {
                value: 'manager',
                label: 'Nærmeste leder',
                description: 'Standard kanal. Krever klart definert eskalering.',
              },
              {
                value: 'hr',
                label: 'HR / personalansvarlig',
                description: 'Anbefalt hvis varslet gjelder leder.',
              },
              {
                value: 'external',
                label: 'Ekstern instans (advokat/varslertjeneste)',
                description: 'Anbefalt for større virksomheter eller sensitive saker.',
              },
            ],
          },
          {
            id: 'recipientName',
            label: 'Navn / e-post på primær mottaker',
            kind: 'text',
            placeholder: 'F.eks. hms@selskap.no',
            required: true,
          },
        ],
      },
      {
        id: 'content',
        title: 'Velg innhold',
        subtitle: 'Eksisterende dokumenter og kurs som dekker varsling.',
        icon: '📚',
        fields:
          pickerOptions.length > 0
            ? [
                {
                  id: 'selectedResources',
                  label: 'Ressurser å aktivere',
                  kind: 'module_picker',
                  options: pickerOptions,
                },
              ]
            : [
                {
                  id: '_noContent',
                  label: '',
                  kind: 'info',
                  infoBody:
                    'Ingen ressurser dekker varsling-§-ene ennå. Neste trinn provisjonerer baseline-dokumentene.',
                },
              ],
      },
      {
        id: 'activate',
        title: 'Aktivere',
        icon: '⚡',
        advancingLabel: 'Provisjonerer …',
        fields: [
          {
            id: '_activateInfo',
            label: '',
            kind: 'info',
            infoBody:
              'Vi oppretter varslings-mal-dokument og tilhørende kurs, ' +
              'tagget med §-ene 2A-1 til 2A-6.',
          },
        ],
        onAdvance: async (): Promise<WizardStepAdvanceResult> => {
          if (!deps.supabase || !deps.organizationId)
            return { ok: false, error: 'Mangler organisasjons-kontekst.' }
          return provisionWithErrorHandling(() =>
            deps.supabase!.rpc('provision_documents_baseline_for_org', {
              p_org_id: deps.organizationId!,
            }),
          )
        },
      },
      {
        id: 'confirm',
        title: 'Verifisere',
        icon: '✅',
        fields: [
          {
            id: '_summary',
            label: '',
            kind: 'info',
            infoBody:
              'Varslingsrutinen er aktivert. Husk å:<br/>' +
              '• Kommunisere rutinen til alle ansatte<br/>' +
              '• Tildele varslings-opplæring til ledere<br/>' +
              '• Avtale med ekstern varslertjeneste hvis valgt',
          },
        ],
      },
    ],
    onSubmit: deps.onCompleted,
  }
}

// ─── 3. AMU-etablering ───────────────────────────────────────────────────────

export function makeAmuEtableringWizard(deps: StudioWizardDeps): WizardDef {
  const lawRefs = ['AML § 7-1', 'AML § 7-2', 'AML § 7-3', 'AML § 7-4']
  const pickerOptions = buildPickerOptions(deps.coverage, lawRefs)
  const amuMandatory = deps.employeeCount >= 30
  const amuByAgreement = deps.employeeCount >= 10 && deps.employeeCount < 30

  return {
    id: 'amu_etablering',
    title: 'AMU — etablering',
    description: 'Arbeidsmiljøutvalget er etablert med møteplan og rutiner.',
    colour: 'sky',
    steps: [
      {
        id: 'intro',
        title: 'Hvorfor dette?',
        icon: '🤝',
        fields: [
          {
            id: '_intro',
            label: '',
            kind: 'info',
            infoBody:
              '<strong>AML § 7-1</strong> krever Arbeidsmiljøutvalg (AMU) ved <strong>≥30 ansatte</strong>. ' +
              'Mellom 10 og 30 kan AMU etableres etter avtale med ansatte. ' +
              'AMU har vedtaksrett i visse saker (§ 7-2) og må behandle årsrapport (§ 7-4).',
          },
        ],
      },
      {
        id: 'org',
        title: 'Vurder plikt',
        icon: '⚖️',
        fields: [
          {
            id: 'employeeCount',
            label: 'Antall ansatte',
            kind: 'number',
            min: 1,
            required: true,
            hint: amuMandatory
              ? 'AMU er pliktig for dere.'
              : amuByAgreement
                ? 'AMU er valgfri (kan etableres etter avtale).'
                : 'AMU er ikke pliktig — du kan likevel fortsette.',
          },
        ],
      },
      {
        id: 'composition',
        title: 'Sammensetning',
        subtitle: 'Likt antall fra arbeidsgiver- og arbeidstaker-siden.',
        icon: '👥',
        fields: [
          {
            id: 'membersPerSide',
            label: 'Antall medlemmer per side',
            kind: 'select',
            required: true,
            options: [
              { value: '2', label: '2 + 2 (totalt 4)' },
              { value: '3', label: '3 + 3 (totalt 6)' },
              { value: '4', label: '4 + 4 (totalt 8)' },
            ],
          },
          {
            id: 'amuLeader',
            label: 'AMU-leder (navn)',
            kind: 'text',
            required: true,
            hint: 'Vervet roterer årlig mellom partene.',
          },
          {
            id: 'amuSecretary',
            label: 'Sekretær (navn)',
            kind: 'text',
            placeholder: 'Valgfritt',
          },
        ],
      },
      {
        id: 'content',
        title: 'Velg innhold',
        subtitle: 'Møtemaler og dokumenter som allerede finnes for AMU.',
        icon: '📚',
        fields:
          pickerOptions.length > 0
            ? [
                {
                  id: 'selectedResources',
                  label: 'Ressurser å aktivere',
                  kind: 'module_picker',
                  options: pickerOptions,
                },
              ]
            : [
                {
                  id: '_noContent',
                  label: '',
                  kind: 'info',
                  infoBody:
                    'Ingen ressurser dekker AMU-§-ene ennå. Neste trinn provisjonerer baseline.',
                },
              ],
      },
      {
        id: 'activate',
        title: 'Aktivere',
        icon: '⚡',
        advancingLabel: 'Provisjonerer …',
        fields: [
          {
            id: '_activateInfo',
            label: '',
            kind: 'info',
            infoBody:
              'Vi oppretter AMU-møte-mal med årshjul (kvartalsvis), dokumenter og sjekkliste, ' +
              'alt tagget med §-ene 7-1 til 7-4.',
          },
        ],
        onAdvance: async (): Promise<WizardStepAdvanceResult> => {
          if (!deps.supabase || !deps.organizationId)
            return { ok: false, error: 'Mangler organisasjons-kontekst.' }
          const docs = await provisionWithErrorHandling(() =>
            deps.supabase!.rpc('provision_documents_baseline_for_org', {
              p_org_id: deps.organizationId!,
            }),
          )
          if (!docs.ok) return docs
          return provisionWithErrorHandling(() =>
            deps.supabase!.rpc('provision_compliance_baseline_for_org', {
              p_org_id: deps.organizationId!,
              p_pack: 'aml-amu',
            }),
          )
        },
      },
      {
        id: 'confirm',
        title: 'Verifisere',
        icon: '✅',
        fields: [
          {
            id: '_summary',
            label: '',
            kind: 'info',
            infoBody:
              'AMU er etablert i systemet. Neste skritt:<br/>' +
              '• Send møteinnkalling fra Møter-modulen<br/>' +
              '• Tildel verneombud-opplæring (40 timer)<br/>' +
              '• Sjekk dekning i Regelverk-dekning',
          },
        ],
      },
    ],
    onSubmit: deps.onCompleted,
  }
}
