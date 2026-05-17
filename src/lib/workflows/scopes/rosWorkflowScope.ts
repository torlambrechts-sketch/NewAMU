// ROS workflow scope — risikovurdering-modulen.
//
// "Gamle moduler" UI is gone, but the DB-trigger surface in
// archive/20260724000000_ros_settings_and_workflow.sql (lines 141+) still
// emits ON_ROS_CREATED / ON_ROS_APPROVED / ON_ROS_CRITICAL_RISK via
// workflow_dispatch_db_event(org, 'ros', …). This scope file makes the
// events visible to the unified builder so admins can author rules
// against them.

import { registerWorkflowScope } from '../workflowRegistry'

declare module '../workflowTypes' {
  interface WorkflowEventMap {
    'ros.ON_ROS_CREATED': RosPayload
    'ros.ON_ROS_APPROVED': RosPayload
    'ros.ON_ROS_CRITICAL_RISK': RosCriticalRiskPayload
  }
}

type RosPayload = {
  rowId: string
  title: string
  templateSlug?: string
  status: 'draft' | 'in_review' | 'approved' | 'archived'
  approvedAt?: string
  ownerUserId?: string
}

type RosCriticalRiskPayload = RosPayload & {
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  residualScore?: number
  riskTitle?: string
}

registerWorkflowScope({
  scopeId: 'ros',
  label: 'Risikovurdering (ROS)',
  accent: '#9f1239',
  description:
    'Risiko- og sårbarhetsanalyser: opprettelse, godkjenning og kritiske risikoer.',

  events: [
    {
      name: 'ros.ON_ROS_CREATED',
      label: 'ROS opprettet',
      description: 'Ny risikovurdering registrert (utkast).',
      lawRefs: ['AML § 3-1', 'AML § 4-1'],
      severity: 'info',
      samplePayload: {
        rowId: '00000000-0000-0000-0000-000000000000',
        title: 'ROS — kjemikaliebruk i produksjon',
        status: 'draft',
      },
    },
    {
      name: 'ros.ON_ROS_APPROVED',
      label: 'ROS godkjent',
      description: 'ROS-en er signert og godkjent av ansvarlig.',
      lawRefs: ['AML § 4-1', 'IK-f § 5 nr. 6'],
      severity: 'info',
    },
    {
      name: 'ros.ON_ROS_CRITICAL_RISK',
      label: 'Kritisk risiko identifisert',
      description: 'En risiko-rad i ROS-en har fått alvorlighet «kritisk».',
      lawRefs: ['AML § 4-1', 'AML § 5-2'],
      severity: 'critical',
      samplePayload: {
        rowId: '00000000-0000-0000-0000-000000000000',
        title: 'ROS — kjemikaliebruk',
        status: 'in_review',
        riskLevel: 'critical',
        residualScore: 20,
      },
    },
  ],

  actions: [],

  conditionFields: [
    {
      path: 'riskLevel',
      label: 'Risikonivå',
      valueType: 'enum',
      enumValues: [
        { value: 'critical', label: 'Kritisk' },
        { value: 'high', label: 'Høy' },
        { value: 'medium', label: 'Middels' },
        { value: 'low', label: 'Lav' },
      ],
    },
    { path: 'residualScore', label: 'Restrisiko-score', valueType: 'number' },
    { path: 'templateSlug', label: 'Mal-slug', valueType: 'string' },
    {
      path: 'status',
      label: 'ROS-status',
      valueType: 'enum',
      enumValues: [
        { value: 'draft', label: 'Utkast' },
        { value: 'in_review', label: 'Under vurdering' },
        { value: 'approved', label: 'Godkjent' },
        { value: 'archived', label: 'Arkivert' },
      ],
    },
  ],

  presets: [],

  lawRefs: [
    {
      ref: 'AML § 4-1',
      framework: 'Arbeidsmiljøloven',
      coverage: 'Generelle krav til arbeidsmiljøet — ROS dokumenterer risikovurderingen.',
    },
    {
      ref: 'IK-f § 5 nr. 6',
      framework: 'Internkontrollforskriften',
      coverage: 'Kartlegging av farer og problemer — ROS er det formelle verktøyet.',
    },
  ],
})
