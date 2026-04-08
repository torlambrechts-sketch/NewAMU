/**
 * Pre-built wizard definitions for all major data entry points.
 *
 * Each wizard factory takes the relevant hook's create function
 * and returns a WizardDef that the WizardButton renders.
 */

import type { WizardDef } from './types'

// ─── 1. Hendelse (Incident) ───────────────────────────────────────────────────

export function makeIncidentWizard(
  onCreate: (data: Record<string, string | boolean>) => void,
): WizardDef {
  return {
    id: 'incident',
    title: 'Registrer hendelse',
    description: 'Hendelsen er registrert og sendt til ansvarlig leder.',
    colour: 'red',
    steps: [
      {
        id: 'type',
        title: 'Hva skjedde?',
        subtitle: 'Velg hendelsestype og alvorlighetsgrad.',
        icon: '⚠️',
        fields: [
          {
            id: 'formTemplate',
            label: 'Skjemamal',
            kind: 'radio-cards',
            required: true,
            options: [
              { value: 'standard',        label: 'Standard hendelse',              icon: '📋', description: 'Ulykke, nestenulykke, avvik fra prosedyre' },
              { value: 'violence_school', label: 'Vold/trusler — skole',           icon: '🏫', description: 'Vold og trusler i skolemiljø' },
              { value: 'violence_health', label: 'Vold/trusler — helse/omsorg',   icon: '🏥', description: 'Vold og trusler i helsesektoren' },
              { value: 'deviation',       label: 'Avvik fra internrutine',         icon: '📎', description: 'Brudd på etablerte prosedyrer' },
            ],
          },
          {
            id: 'severity',
            label: 'Alvorlighetsgrad',
            kind: 'severity',
            required: true,
          },
        ],
      },
      {
        id: 'detail',
        title: 'Detaljer',
        subtitle: 'Beskriv hva som skjedde.',
        icon: '📝',
        fields: [
          {
            id: 'occurredAt',
            label: 'Tidspunkt',
            kind: 'datetime-local',
            hint: 'Når skjedde hendelsen? La stå tomt for "nå".',
          },
          {
            id: 'location',
            label: 'Sted',
            kind: 'text',
            placeholder: 'f.eks. Lager B, 2. etasje',
            required: true,
          },
          {
            id: 'department',
            label: 'Avdeling',
            kind: 'text',
            placeholder: 'f.eks. Produksjon',
          },
          {
            id: 'description',
            label: 'Hva skjedde?',
            kind: 'textarea',
            placeholder: 'Beskriv hendelsen så detaljert som mulig…',
            required: true,
            hint: 'Fakta, ikke tolkninger. Hvem, hva, hvor, hvordan?',
          },
          {
            id: 'experienceDetail',
            label: 'Hva opplevde den berørte? (beskriv atferd)',
            kind: 'textarea',
            placeholder: 'Relevant for vold/trusler-maler…',
            showWhen: (v) => v.formTemplate === 'violence_school' || v.formTemplate === 'violence_health',
          },
          {
            id: 'injuredPerson',
            label: 'Berørt person',
            kind: 'text',
            placeholder: 'Navn / initialer',
            showWhen: (v) => v.formTemplate === 'violence_school' || v.formTemplate === 'violence_health',
          },
        ],
        validate: (v) => v.description ? null : 'Beskrivelse er påkrevd.',
      },
      {
        id: 'actions',
        title: 'Tiltak og ruting',
        subtitle: 'Umiddelbare tiltak og hvem varsles.',
        icon: '🔔',
        fields: [
          {
            id: 'immediateActions',
            label: 'Umiddelbare tiltak iverksatt',
            kind: 'textarea',
            placeholder: 'Hva ble gjort på stedet?',
            hint: 'Disse lagres på hendelsen og vises i Hendelse-loggen.',
          },
          {
            id: 'reportedBy',
            label: 'Meldt av',
            kind: 'text',
            placeholder: 'Ditt navn / rolle',
            required: true,
          },
          {
            id: 'routeManager',
            label: 'Varsle nærmeste leder',
            kind: 'text',
            placeholder: 'Navn på nærmeste leder',
            hint: 'Leder får en oppfølgingsoppgave automatisk.',
          },
          {
            id: 'routeVerneombud',
            label: 'Varsle verneombud',
            kind: 'checkbox',
            hint: 'Anbefalt ved alvorlige hendelser',
          },
          {
            id: 'routeAMU',
            label: 'Opprett AMU-sak',
            kind: 'checkbox',
          },
          {
            id: 'arbeidstilsynetNotified',
            label: 'Meldt til Arbeidstilsynet (AML §5-2)',
            kind: 'checkbox',
            hint: 'Kun ved kritiske hendelser',
            showWhen: (v) => v.severity === 'critical',
          },
        ],
      },
      {
        id: 'confirm',
        title: 'Bekreft og send',
        subtitle: 'Gjennomgå og lagre hendelsen.',
        icon: '✅',
        fields: [
          {
            id: '_summary',
            label: '',
            kind: 'info',
            infoBody: `<strong>Hendelsen registreres</strong> i avviksloggen og tildeles status <em>Meldt</em>. Ruting og tiltak lagres på saken. Du kan legge til korrigerende tiltak i Hendelse-fanen etterpå.`,
          },
          {
            id: 'status',
            label: 'Innledende status',
            kind: 'select',
            required: true,
            options: [
              { value: 'reported',     label: 'Meldt' },
              { value: 'investigating', label: 'Under utredning' },
            ],
          },
        ],
      },
    ],
    onSubmit: (v) => {
      const ft = String(v.formTemplate ?? 'standard')
      const kind =
        ft === 'deviation'
          ? 'deviation'
          : ft === 'violence_school' || ft === 'violence_health'
            ? 'violence'
            : 'incident'
      const payload: Record<string, string | boolean> = {
        kind,
        category: 'physical_injury',
        formTemplate: (v.formTemplate ?? 'standard') as string,
        severity: String(v.severity ?? 'medium'),
        occurredAt: v.occurredAt ? new Date(String(v.occurredAt)).toISOString() : new Date().toISOString(),
        location: String(v.location ?? '—'),
        department: String(v.department ?? ''),
        description: String(v.description ?? ''),
        immediateActions: String(v.immediateActions ?? ''),
        reportedBy: String(v.reportedBy ?? '—'),
        status: String(v.status ?? 'reported'),
        routeManager: String(v.routeManager ?? ''),
        routeVerneombud: Boolean(v.routeVerneombud),
        routeAMU: Boolean(v.routeAMU),
        arbeidstilsynetNotified: Boolean(v.arbeidstilsynetNotified),
      }
      if (v.experienceDetail != null && String(v.experienceDetail).trim()) {
        payload.experienceDetail = String(v.experienceDetail)
      }
      if (v.injuredPerson != null && String(v.injuredPerson).trim()) {
        payload.injuredPerson = String(v.injuredPerson)
      }
      onCreate(payload)
    },
  }
}

// ─── 2. Sykefraværssak ────────────────────────────────────────────────────────

export function makeSickLeaveWizard(
  onCreate: (data: Record<string, string | boolean>) => void,
): WizardDef {
  return {
    id: 'sick-leave',
    title: 'Ny sykefraværssak',
    description: 'Saken er opprettet og lovpålagte frister er generert automatisk.',
    colour: 'amber',
    steps: [
      {
        id: 'employee',
        title: 'Ansatt og kontekst',
        subtitle: 'Hvem gjelder saken?',
        icon: '👤',
        fields: [
          {
            id: '_gdpr',
            label: '',
            kind: 'info',
            infoBody: '<strong>Taushetsbelagt sone.</strong> Sykefraværsdata lagres separat fra avviksregistreringen og er kun tilgjengelig for autorisert personell (AML §4-6, GDPR).',
          },
          {
            id: 'employeeName',
            label: 'Ansatt navn',
            kind: 'text',
            placeholder: 'Fullt navn',
            required: true,
          },
          {
            id: 'department',
            label: 'Avdeling',
            kind: 'text',
            placeholder: 'Avdeling / team',
          },
          {
            id: 'managerName',
            label: 'Nærmeste leder',
            kind: 'text',
            placeholder: 'Navn på ansvarlig leder',
            required: true,
            hint: 'Leder er ansvarlig for oppfølging etter AML §4-6.',
          },
        ],
        validate: (v) =>
          (!v.employeeName || !v.managerName) ? 'Ansatt og leder er påkrevd.' : null,
      },
      {
        id: 'absence',
        title: 'Fraværsdetaljer',
        subtitle: 'Dato og grad',
        icon: '📅',
        fields: [
          {
            id: 'sickFrom',
            label: 'Sykemeldt fra (dato)',
            kind: 'date',
            required: true,
            hint: 'NAV-frister beregnes automatisk fra denne datoen.',
          },
          {
            id: 'sicknessDegree',
            label: 'Sykmeldingsgrad (%)',
            kind: 'select',
            required: true,
            options: [
              { value: '100', label: '100% — fullt sykmeldt' },
              { value: '80',  label: '80% — gradert' },
              { value: '60',  label: '60% — gradert' },
              { value: '50',  label: '50% — gradert' },
              { value: '40',  label: '40% — gradert' },
              { value: '20',  label: '20% — gradert' },
            ],
          },
          {
            id: 'status',
            label: 'Status',
            kind: 'radio-cards',
            required: true,
            options: [
              { value: 'active',   label: 'Sykemeldt (100%)',   icon: '🔴', description: 'Fullt sykmeldt fra arbeid' },
              { value: 'partial',  label: 'Gradert sykemeldt',  icon: '🟡', description: 'Delvis i arbeid' },
              { value: 'returning', label: 'I retur',           icon: '🟢', description: 'På vei tilbake til full stilling' },
            ],
          },
        ],
        validate: (v) => !v.sickFrom ? 'Startdato er påkrevd.' : null,
      },
      {
        id: 'consent',
        title: 'Samtykke og bekreftelse',
        subtitle: 'Personvern og GDPR',
        icon: '🔒',
        fields: [
          {
            id: '_info',
            label: '',
            kind: 'info',
            infoBody: `
              <strong>Lovpålagte frister genereres automatisk:</strong><br>
              • Dag 4 — Kontakt med ansatt<br>
              • 4 uker — Oppfølgingsplan (AML §4-6 nr. 1)<br>
              • 7 uker — Dialogmøte 1 (AML §4-6 nr. 2)<br>
              • 9 uker — Melding til NAV<br>
              • 26 uker — Dialogmøte 2
            `,
          },
          {
            id: 'consentRecorded',
            label: 'Samtykke til behandling av personopplysninger er registrert',
            kind: 'checkbox',
            hint: 'Krev skriftlig samtykke fra ansatt (GDPR art. 9).',
          },
        ],
      },
    ],
    onSubmit: (v) => {
      onCreate({
        employeeName: v.employeeName ?? '',
        department:   v.department ?? '',
        managerName:  v.managerName ?? '',
        sickFrom:     v.sickFrom ?? '',
        sicknessDegree: v.sicknessDegree ?? '100',
        status:       v.status ?? 'active',
        consentRecorded: v.consentRecorded ?? false,
      })
    },
  }
}

// ─── 3. SJA (Safe Job Analysis) ──────────────────────────────────────────────

export function makeSjaWizard(
  onCreate: (data: Record<string, string | boolean>) => void,
): WizardDef {
  return {
    id: 'sja',
    title: 'Ny SJA',
    description: 'SJA-analysen er opprettet. Legg til fareidentifikasjonssteg i analysen.',
    colour: 'purple',
    steps: [
      {
        id: 'context',
        title: 'Jobbbeskrivelse',
        subtitle: 'Hva skal gjøres og hvor?',
        icon: '🔧',
        fields: [
          {
            id: '_info',
            label: '',
            kind: 'info',
            infoBody: '<strong>Sikker Jobb Analyse</strong> gjennomføres FØR ikke-rutinepregede og høyrisikooperasjoner (IK-f §5 nr. 2, AML §3-1). Alle berørte arbeidstakere deltar.',
          },
          {
            id: 'title',
            label: 'Operasjon / tittel',
            kind: 'text',
            placeholder: 'f.eks. Takarbeid — skifte takplater',
            required: true,
            hint: 'Kort, beskrivende tittel for arbeidsoperasjonen.',
          },
          {
            id: 'jobDescription',
            label: 'Detaljert beskrivelse av jobben',
            kind: 'textarea',
            placeholder: 'Beskriv arbeidet som skal utføres…',
            required: true,
          },
          {
            id: 'location',
            label: 'Sted / lokasjon',
            kind: 'text',
            placeholder: 'f.eks. Tak på bygg B, adresse',
            required: true,
          },
          {
            id: 'department',
            label: 'Avdeling',
            kind: 'text',
          },
        ],
        validate: (v) =>
          (!v.title || !v.jobDescription || !v.location)
            ? 'Tittel, beskrivelse og sted er påkrevd.'
            : null,
      },
      {
        id: 'team',
        title: 'Team og tidsplan',
        subtitle: 'Hvem deltar og når?',
        icon: '👥',
        fields: [
          {
            id: 'plannedAt',
            label: 'Planlagt dato og tid',
            kind: 'datetime-local',
            required: true,
          },
          {
            id: 'conductedBy',
            label: 'Arbeidsleder / ansvarlig',
            kind: 'text',
            placeholder: 'Navn på arbeidsleder',
            required: true,
          },
          {
            id: 'participants',
            label: 'Deltakere (kommaseparert)',
            kind: 'text',
            placeholder: 'Ole Nordmann, Kari Hansen, …',
            hint: 'Alle som utfører arbeidet skal delta i SJA-en.',
          },
        ],
        validate: (v) =>
          (!v.plannedAt || !v.conductedBy) ? 'Dato og arbeidsleder er påkrevd.' : null,
      },
      {
        id: 'confirm',
        title: 'Klar til analyse',
        icon: '📋',
        fields: [
          {
            id: '_confirm',
            label: '',
            kind: 'info',
            infoBody: `
              SJA-analysen opprettes med status <em>Utkast</em>.<br><br>
              <strong>Neste steg:</strong> Gå til SJA-fanen, åpne analysen og legg til fareidentifikasjonssteg rad for rad.
              Alle deltakere signerer før arbeidet starter.
            `,
          },
        ],
      },
    ],
    onSubmit: (v) => {
      onCreate({
        title:          v.title ?? '',
        jobDescription: v.jobDescription ?? '',
        location:       v.location ?? '',
        department:     v.department ?? '',
        plannedAt:      v.plannedAt ?? new Date().toISOString(),
        conductedBy:    v.conductedBy ?? '',
        participants:   v.participants ?? '',
        status:         'draft',
        conclusion:     '',
      })
    },
  }
}

// ─── 4. ROS-vurdering ────────────────────────────────────────────────────────

export function makeRosWizard(
  onCreate: (data: Record<string, string | boolean>) => void,
): WizardDef {
  return {
    id: 'ros',
    title: 'Ny ROS-vurdering',
    description: 'ROS-vurderingen opprettes med forslagsrader tilpasset arbeidsområdet. Juster og signer når dere er enige.',
    colour: 'amber',
    steps: [
      {
        id: 'scope',
        title: 'Omfang og kontekst',
        subtitle: 'Hva kartlegges?',
        icon: '🗺️',
        fields: [
          {
            id: '_info',
            label: '',
            kind: 'info',
            infoBody: '<strong>Risikovurdering (ROS)</strong> er lovpålagt etter AML §3-1 og IK-forskriften §5 nr. 2. Gjøres i samarbeid med verneombudet. Dokumenter restrisiko etter tiltak.',
          },
          {
            id: 'title',
            label: 'Tittel / navn på ROS',
            kind: 'text',
            placeholder: 'f.eks. ROS — Lager og logistikk 2026',
            required: true,
          },
          {
            id: 'rosLegalCategory',
            label: 'Type ROS (juridisk)',
            kind: 'select',
            required: true,
            hint: 'O-ROS (organisatorisk endring) får egne forhåndsutfylte farer og krever AMU/VO-signatur i HR før låsing.',
            options: [
              { value: 'general', label: 'Generell ROS' },
              { value: 'organizational_change', label: 'Organisatorisk endring (O-ROS)' },
            ],
          },
          {
            id: 'department',
            label: 'Avdeling / område',
            kind: 'text',
            placeholder: 'f.eks. Produksjon, hal A',
          },
          {
            id: 'assessor',
            label: 'Vurdert av',
            kind: 'text',
            placeholder: 'Navn på HMS-ansvarlig / leder',
            required: true,
            hint: 'Verneombudet skal signere til slutt (§3-1 medvirkning).',
          },
        ],
        validate: (v) =>
          (!v.title || !v.assessor || !v.rosLegalCategory) ? 'Tittel, type og ansvarlig er påkrevd.' : null,
      },
      {
        id: 'hazards',
        title: 'Vanlige farer',
        subtitle: 'Tilpass listen',
        icon: '⚗️',
        fields: [
          {
            id: '_oRosInfo',
            label: '',
            kind: 'info',
            showWhen: (v) => v.rosLegalCategory === 'organizational_change',
            infoBody:
              'O-ROS opprettes med <strong>forhåndsutfylte farer</strong> knyttet til omorganisering. Velg AMU og verneombud i skjemaet etter opprettelse, og fullfør HR-signatur før dokumentet låses.',
          },
          {
            id: 'workspaceCategory',
            label: 'Arbeidsområde (forslagsrader)',
            kind: 'select',
            required: true,
            showWhen: (v) => v.rosLegalCategory !== 'organizational_change',
            hint: 'Typiske farer for valgt område legges inn. Du kan slette eller endre rader etterpå.',
            options: [
              { value: 'general', label: 'Generelt' },
              { value: 'production', label: 'Produksjon' },
              { value: 'office', label: 'Kontor' },
              { value: 'warehouse', label: 'Lager / logistikk' },
              { value: 'construction', label: 'Bygg / anlegg' },
              { value: 'healthcare', label: 'Helse / omsorg' },
            ],
          },
          {
            id: 'chemicalsYes',
            label: 'Jobber dere med kjemikalier eller farlige stoffer?',
            kind: 'radio-cards',
            required: true,
            showWhen: (v) =>
              v.rosLegalCategory !== 'organizational_change' &&
              (v.workspaceCategory === 'production' || v.workspaceCategory === 'warehouse'),
            options: [
              { value: 'yes', label: 'Ja', icon: '✓', description: 'Legger inn en ekstra rad om kjemikaliehåndtering' },
              { value: 'no', label: 'Nei', icon: '—', description: 'Ingen ekstra kjemikalierad' },
            ],
          },
          {
            id: '_chemInfo',
            label: '',
            kind: 'info',
            showWhen: (v) =>
              v.rosLegalCategory !== 'organizational_change' &&
              (v.workspaceCategory === 'production' || v.workspaceCategory === 'warehouse') &&
              v.chemicalsYes === 'yes',
            infoBody:
              'En rad om <strong>kjemikaliehåndtering</strong> legges automatisk inn i tabellen under (kan redigeres).',
          },
          {
            id: '_presetInfo',
            label: '',
            kind: 'info',
            showWhen: (v) =>
              v.rosLegalCategory !== 'organizational_change' &&
              v.workspaceCategory !== 'production' &&
              v.workspaceCategory !== 'warehouse',
            infoBody:
              'Neste steg oppretter ROS med ca. <strong>10 forslagsrader</strong> for valgt arbeidsområde. Du kan legge til, fjerne og endre alt før signering.',
          },
        ],
        validate: (v) => {
          if (v.rosLegalCategory === 'organizational_change') return null
          if (!v.workspaceCategory) return 'Velg arbeidsområde.'
          if (
            (v.workspaceCategory === 'production' || v.workspaceCategory === 'warehouse') &&
            v.chemicalsYes !== 'yes' &&
            v.chemicalsYes !== 'no'
          ) {
            return 'Svar på spørsmålet om kjemikalier.'
          }
          return null
        },
      },
      {
        id: 'trigger',
        title: 'Hva utløste vurderingen?',
        subtitle: 'Bakgrunn for ROS-en',
        icon: '🔍',
        fields: [
          {
            id: 'trigger',
            label: 'Bakgrunn / utløser',
            kind: 'radio-cards',
            required: true,
            options: [
              { value: 'periodic',    label: 'Periodisk revisjon',           icon: '📅', description: 'Planmessig gjennomgang (hvert 2–3 år)' },
              { value: 'change',      label: 'Vesentlig endring',            icon: '🔄', description: 'Ny teknologi, omorganisering, nytt utstyr' },
              { value: 'incident',    label: 'Etter hendelse/avvik',         icon: '⚠️', description: 'Utløst av ulykke eller nestenulykke' },
              { value: 'new_activity', label: 'Ny aktivitet/arbeidsoppgave', icon: '🆕', description: 'Nye prosesser eller arbeidsoperasjoner' },
            ],
          },
        ],
      },
      {
        id: 'confirm',
        title: 'Opprett og start',
        icon: '✅',
        fields: [
          {
            id: '_confirm',
            label: '',
            kind: 'info',
            infoBody: `
              ROS-analysen opprettes med én startrad (aktivitet/fare). <br><br>
              <strong>Neste steg:</strong> Gå til ROS-fanen og fyll ut:<br>
              • Fare og eksisterende tiltak<br>
              • Alvorlighetsgrad (1–5) og sannsynlighet (1–5) → bruttoscore<br>
              • Foreslåtte tiltak og ansvarlig<br>
              • Restrisiko (ny alv. × ny sanns.) etter tiltak<br>
              • Send til leder og verneombud for signering
            `,
          },
        ],
      },
    ],
    onSubmit: (v) => {
      onCreate({
        title:              v.title ?? '',
        department:         v.department ?? '',
        assessor:           v.assessor ?? '',
        rosLegalCategory:   String(v.rosLegalCategory ?? 'general'),
        workspaceCategory:  String(v.workspaceCategory ?? 'general'),
        chemicalsYes:       v.chemicalsYes === 'yes',
        trigger:            v.trigger ?? '',
      })
    },
  }
}

// ─── 5. Oppgave (Task) ────────────────────────────────────────────────────────

export function makeTaskWizard(
  onCreate: (data: Record<string, string | boolean>) => void,
): WizardDef {
  return {
    id: 'task',
    title: 'Ny oppgave',
    description: 'Oppgaven er opprettet og lagt til i oppgavelisten.',
    colour: 'sky',
    steps: [
      {
        id: 'basics',
        title: 'Hva skal gjøres?',
        subtitle: 'Tittel og beskrivelse',
        icon: '📌',
        fields: [
          {
            id: 'title',
            label: 'Oppgavetittel',
            kind: 'text',
            placeholder: 'f.eks. Følg opp sikkerhetsavvik — lager B',
            required: true,
          },
          {
            id: 'description',
            label: 'Beskrivelse / kontekst',
            kind: 'textarea',
            placeholder: 'Hva må gjøres, og hvorfor?',
          },
          {
            id: 'module',
            label: 'Modul / område',
            kind: 'select',
            required: true,
            options: [
              { value: 'general',    label: 'Generelt' },
              { value: 'hse',        label: 'HMS' },
              { value: 'council',    label: 'Arbeidsmiljøråd' },
              { value: 'org_health', label: 'Organisasjonshelse' },
              { value: 'hrm',        label: 'Personal / HRM' },
              { value: 'learning',   label: 'Læring' },
              { value: 'members',    label: 'Representasjon' },
            ],
          },
        ],
        validate: (v) => !v.title ? 'Tittel er påkrevd.' : null,
      },
      {
        id: 'assignment',
        title: 'Hvem og når?',
        subtitle: 'Tildeling og frist',
        icon: '👤',
        fields: [
          {
            id: 'assignee',
            label: 'Tildelt til',
            kind: 'text',
            placeholder: 'Navn / rolle',
            hint: 'Hvem er ansvarlig for å utføre oppgaven?',
          },
          {
            id: 'ownerRole',
            label: 'Rolle / ansvarstype',
            kind: 'text',
            placeholder: 'f.eks. Verneombud, Leder, HMS-ansvarlig',
          },
          {
            id: 'dueDate',
            label: 'Frist',
            kind: 'date',
            hint: 'Anbefalt: sett alltid en frist.',
          },
          {
            id: 'requiresManagementSignOff',
            label: 'Krever ledelsesgodkjenning',
            kind: 'checkbox',
            hint: 'Aktiverer digital ledelsessignatur på oppgaven.',
          },
        ],
      },
      {
        id: 'confirm',
        title: 'Bekreft og opprett',
        icon: '✅',
        fields: [
          {
            id: '_confirm',
            label: '',
            kind: 'info',
            infoBody: 'Oppgaven opprettes med status <em>Å gjøre</em> og legges til i oppgavelisten og Global Action Board.',
          },
        ],
      },
    ],
    onSubmit: (v) => {
      onCreate({
        title:       v.title ?? '',
        description: v.description ?? '',
        module:      v.module ?? 'general',
        assignee:    v.assignee ?? '',
        ownerRole:   v.ownerRole ?? 'Ansvarlig',
        dueDate:     v.dueDate ?? '',
        requiresManagementSignOff: v.requiresManagementSignOff ?? false,
        sourceType:  'manual',
        status:      'todo',
      })
    },
  }
}

// ─── 6. Vernerunde ────────────────────────────────────────────────────────────

export function makeSafetyRoundWizard(
  onCreate: (data: Record<string, string | boolean>) => void,
  templateOptions: { value: string; label: string }[],
): WizardDef {
  return {
    id: 'safety-round',
    title: 'Ny vernerunde',
    description: 'Vernerunden er opprettet. Åpne den og fyll ut sjekklisten.',
    colour: 'emerald',
    steps: [
      {
        id: 'setup',
        title: 'Grunnopplysninger',
        subtitle: 'Hvem, når og hvor?',
        icon: '📋',
        fields: [
          {
            id: 'title',
            label: 'Tittel på runden',
            kind: 'text',
            placeholder: 'f.eks. Vernerunde — Lager Q2 2026',
            required: true,
          },
          {
            id: 'conductedAt',
            label: 'Gjennomføringsdato og -tid',
            kind: 'datetime-local',
            required: true,
          },
          {
            id: 'location',
            label: 'Område / lokasjon',
            kind: 'text',
            placeholder: 'f.eks. Produksjonshall A',
            required: true,
          },
          {
            id: 'department',
            label: 'Avdeling',
            kind: 'text',
            placeholder: 'Hvilken avdeling tilhører området?',
          },
        ],
        validate: (v) =>
          (!v.title || !v.conductedAt || !v.location) ? 'Tittel, dato og sted er påkrevd.' : null,
      },
      {
        id: 'team',
        title: 'Mal og notater',
        subtitle: 'Velg sjekkliste — signering skjer senere med innlogget bruker.',
        icon: '👥',
        fields: [
          {
            id: 'templateId',
            label: 'Sjekklistemal',
            kind: 'select',
            required: true,
            options: templateOptions.length ? templateOptions : [{ value: 'tpl-standard', label: 'Standard vernerunde' }],
            hint: 'Velg avdelingsspesifikk mal for mest relevante sjekkpunkter.',
          },
          {
            id: 'notes',
            label: 'Forberedende notater (valgfritt)',
            kind: 'textarea',
            placeholder: 'Spesielle forhold å undersøke, kjente problemområder…',
          },
        ],
        validate: () => null,
      },
      {
        id: 'confirm',
        title: 'Klar til gjennomføring',
        icon: '🚀',
        fields: [
          {
            id: '_confirm',
            label: '',
            kind: 'info',
            infoBody: `
              Vernerunden opprettes med status <em>Pågår</em>.<br><br>
              <strong>Neste steg:</strong><br>
              1. Gå gjennom sjekklisten — <strong>OK</strong> eller <strong>Registrer avvik</strong> (beskrivelse + bilde)<br>
              2. Klikk «Send til signering» når listen er ferdig<br>
              3. <strong>Leder</strong> og <strong>verneombud</strong> signerer hver for seg (innlogget bruker, nivå 1)<br>
              4. Ved begge signaturer låses runden og åpne avvik blir oppgaver på Kanban
            `,
          },
        ],
      },
    ],
    onSubmit: (v) => {
      onCreate({
        title:       v.title ?? '',
        conductedAt: v.conductedAt ?? new Date().toISOString(),
        location:    v.location ?? '',
        department:  v.department ?? '',
        templateId:  v.templateId ?? 'tpl-standard',
        notes:       v.notes ?? '',
      })
    },
  }
}
