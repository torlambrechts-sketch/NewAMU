// Survey workflow scope — undersøkelser-modulen.
//
// Events come from the survey enterprise trigger
// (archive/2026081…_survey_workflow.sql) which dispatches via
// workflow_dispatch_db_event(org, 'survey', '<EVENT>', payload). Keep
// trigger names verbatim so the engine actually matches.

import { registerWorkflowScope } from '../../../lib/workflows/workflowRegistry'

declare module '../../../lib/workflows/workflowTypes' {
  interface WorkflowEventMap {
    'survey.ON_SURVEY_PUBLISHED': SurveyPublishedPayload
    'survey.ON_SURVEY_CLOSED': SurveyClosedPayload
    'survey.ON_SURVEY_RESPONSE_SUBMITTED': SurveyResponsePayload
    'survey.ON_SURVEY_ALL_INVITATIONS_COMPLETED': SurveyClosedPayload
    'survey.ON_SURVEY_RESPONSE_RATE_THRESHOLD': SurveyThresholdPayload
  }
}

type SurveyPublishedPayload = { rowId: string; surveySlug: string; title: string; templateSlug?: string; lawRefs?: string[] }
type SurveyClosedPayload = { rowId: string; surveySlug: string; closedAt: string; totalResponses: number }
type SurveyResponsePayload = { rowId: string; surveySlug: string; respondentUserId?: string; isAnonymous: boolean; score?: number }
type SurveyThresholdPayload = { rowId: string; surveySlug: string; threshold: number; currentRate: number }

registerWorkflowScope({
  scopeId: 'survey',
  label: 'Undersøkelser',
  accent: '#7c3aed',
  description: 'Publisering, svar og lukking av undersøkelser, inkludert terskler for svarandel.',
  events: [
    {
      name: 'survey.ON_SURVEY_PUBLISHED',
      label: 'Undersøkelse publisert',
      description: 'Undersøkelsen er gjort tilgjengelig for respondentene.',
      lawRefs: ['AML § 7-2'],
      severity: 'info',
    },
    { name: 'survey.ON_SURVEY_CLOSED', label: 'Undersøkelse lukket', severity: 'info' },
    {
      name: 'survey.ON_SURVEY_RESPONSE_SUBMITTED',
      label: 'Svar innsendt',
      description: 'Respondenten sender inn et svar. Anonyme svar utløser konfidensiell håndtering.',
      severity: 'info',
    },
    { name: 'survey.ON_SURVEY_ALL_INVITATIONS_COMPLETED', label: 'Alle invitasjoner besvart', severity: 'info' },
    {
      name: 'survey.ON_SURVEY_RESPONSE_RATE_THRESHOLD',
      label: 'Svarandel nådd terskel',
      description: 'Svarandelen har krysset en konfigurert terskel.',
      severity: 'low',
    },
  ],
  actions: [
    {
      type: 'create_ros_draft',
      label: 'Opprett ROS-utkast',
      description: 'Bruker undersøkelsen som inputkilde til risikovurdering.',
      category: 'ROS',
      defaults: () => ({ type: 'create_ros_draft', template: 'standard 5×5', linkSource: true }),
    },
    {
      type: 'add_amu_agenda_item',
      label: 'AMU-sak fra undersøkelse',
      category: 'AMU & vedtak',
      defaults: () => ({ type: 'add_amu_agenda_item', agendaItem: 'Funn fra undersøkelse', priority: 'normal' }),
    },
  ],
  conditionFields: [
    { path: 'surveySlug', label: 'Mal-slug', valueType: 'string' },
    { path: 'totalResponses', label: 'Antall svar', valueType: 'number' },
    { path: 'score', label: 'Score', valueType: 'number' },
    { path: 'isAnonymous', label: 'Anonymt svar', valueType: 'boolean' },
  ],
  presets: [
    {
      slug: 'survey.amu_election_followup',
      nameI18n: { nb: 'AMU-valg avsluttet → påminnelse om neste valg (12 mnd)' },
      triggerEvent: 'survey.ON_SURVEY_CLOSED',
      condition: { match: 'field_equals', path: 'surveySlug', value: 'amu-valg' },
      actions: [
        { type: 'wait_until', delay: { amount: 50, unit: 'weeks' } },
        {
          type: 'create_task',
          title: 'Forbered neste AMU-valg',
          assignee: 'HMS-leder',
          ownerRole: 'HMS',
          dueInDays: 14,
          module: 'survey',
          sourceType: 'survey_response',
        },
      ],
      lawRefs: ['AML § 6-1', 'AML § 7-2'],
      frameworks: ['aml-amu'],
      pack: 'aml-amu',
      cadenceHint: 'arlig',
    },
    {
      slug: 'survey.low_response_reminder',
      nameI18n: { nb: 'Lav svarandel → påminnelse til respondenter' },
      triggerEvent: 'survey.ON_SURVEY_RESPONSE_RATE_THRESHOLD',
      actions: [
        {
          type: 'send_notification',
          title: 'Påminnelse: undersøkelsen er aktiv',
          body: 'Vi mangler ditt svar på {{event.surveySlug}}.',
          category: 'survey',
        },
      ],
      lawRefs: ['AML § 3-1'],
      frameworks: ['aml-amu'],
      cadenceHint: 'ad_hoc',
    },
    {
      slug: 'survey.whistleblower_response',
      nameI18n: { nb: 'Varslersak → konfidensiell triage' },
      descriptionI18n: { nb: 'Anonyme svar til varslingsutvalget håndteres konfidensielt (AML § 2A-7 (5)).' },
      triggerEvent: 'survey.ON_SURVEY_RESPONSE_SUBMITTED',
      condition: {
        match: 'and',
        conditions: [
          { match: 'field_equals', path: 'surveySlug', value: 'varslingsutvalg' },
          { match: 'field_equals', path: 'isAnonymous', value: 'true' },
        ],
      },
      actions: [
        {
          type: 'create_task',
          title: 'Triage varslersak',
          assignee: 'Varslingsmottak',
          ownerRole: 'HMS',
          dueInDays: 1,
          module: 'survey',
          sourceType: 'survey_response',
        },
      ],
      lawRefs: ['AML § 2A-7 (5)'],
      frameworks: ['aml-amu'],
      pack: 'aml-amu',
      confidentialityLevel: 'confidential',
      cadenceHint: 'ad_hoc',
    },
  ],
  lawRefs: [
    { ref: 'AML § 7-2', framework: 'Arbeidsmiljøloven', coverage: 'AMU-undersøkelser og høringer.' },
    { ref: 'AML § 2A-7 (5)', framework: 'Arbeidsmiljøloven', coverage: 'Varslingsutvalg — konfidensiell håndtering.' },
  ],
})
