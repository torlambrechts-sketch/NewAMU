// Registers workflow scope — registre (kjemikalier, maskiner, lovkrav, …).

import { registerWorkflowScope } from '../../../lib/workflows/workflowRegistry'

declare module '../../../lib/workflows/workflowTypes' {
  interface WorkflowEventMap {
    'registers.ON_REGISTER_RECORD_CREATED': RegisterPayload
    'registers.ON_REGISTER_RECORD_UPDATED': RegisterUpdatedPayload
  }
}

type RegisterPayload = {
  rowId: string
  registerType: string
  registerName: string
  regulationIds?: string[]
  amlParagraphs?: string[]
}
type RegisterUpdatedPayload = RegisterPayload & { changedFields: string[] }

registerWorkflowScope({
  scopeId: 'registers',
  label: 'Registre',
  description: 'Lovkrav-registre, kjemikalieregister, maskinregister og andre regulatoriske registre.',
  events: [
    { name: 'registers.ON_REGISTER_RECORD_CREATED', label: 'Registerrad opprettet', severity: 'info' },
    { name: 'registers.ON_REGISTER_RECORD_UPDATED', label: 'Registerrad oppdatert', severity: 'medium' },
  ],
  actions: [],
  conditionFields: [
    { path: 'registerType', label: 'Register-type', valueType: 'string' },
    { path: 'regulationIds', label: 'Regulering-IDer', valueType: 'string' },
    { path: 'amlParagraphs', label: 'AML §§', valueType: 'string' },
  ],
  presets: [
    {
      slug: 'registers.new_regulation_owner_task',
      nameI18n: { nb: 'Nytt regulatorisk krav → oppgave til ansvarlig' },
      triggerEvent: 'registers.ON_REGISTER_RECORD_CREATED',
      condition: { match: 'field_equals', path: 'registerType', value: 'lovkrav' },
      actions: [
        {
          type: 'create_task',
          title: 'Avklar tiltak for nytt lovkrav: {{event.registerName}}',
          assignee: 'HMS-leder',
          ownerRole: 'HMS',
          dueInDays: 14,
          module: 'registers',
          sourceType: 'regulation',
        },
      ],
      lawRefs: ['IK-f § 5 nr. 1'],
      frameworks: ['aml-amu', 'iso-45001'],
      pack: 'aml-amu',
      cadenceHint: 'ad_hoc',
    },
    {
      slug: 'registers.chemical_change_ros',
      nameI18n: { nb: 'Endring i kjemikalieregister → ROS-revisjon' },
      triggerEvent: 'registers.ON_REGISTER_RECORD_UPDATED',
      condition: { match: 'field_equals', path: 'registerType', value: 'kjemikalier' },
      actions: [{ type: 'create_ros_draft', template: 'kjemisk eksponering', linkSource: true }],
      lawRefs: ['Kjemikalieforskriften', 'AML § 4-5'],
      frameworks: ['aml-amu'],
      pack: 'aml-amu',
      cadenceHint: 'ad_hoc',
    },
  ],
  lawRefs: [
    { ref: 'IK-f § 5 nr. 1', framework: 'Internkontrollforskriften', coverage: 'Oversikt over relevante lover og forskrifter.' },
  ],
})
