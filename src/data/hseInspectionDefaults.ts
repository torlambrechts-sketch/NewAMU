import { DEFAULT_SAFETY_ROUND_CHECKLIST, SAFETY_ROUND_TEMPLATE_ID } from './hseTemplates'
import type {
  HseInspectionConfig,
  InspectionTemplate,
  InspectionTemplateField,
  InspectionTypeDef,
} from '../types/inspectionModule'

function newId() {
  return crypto.randomUUID()
}

function fieldsFromLegacyChecklist(): InspectionTemplateField[] {
  return DEFAULT_SAFETY_ROUND_CHECKLIST.map((it, i) => ({
    id: it.id,
    order: i,
    label: it.label,
    lawRef: it.lawRef,
    fieldType: 'yes_no_na' as const,
    required: true,
  }))
}

export const DEFAULT_INSPECTION_CONFIG_VERSION = 1

export function buildDefaultInspectionConfig(nowIso: string): HseInspectionConfig {
  const tplVernerunde: InspectionTemplate = {
    id: 'tpl-vernerunde',
    name: 'HMS-vernerunde (standard)',
    description: 'Basert på standard sjekkliste — tilpass felter under innstillinger.',
    fields: fieldsFromLegacyChecklist(),
    createdAt: nowIso,
    updatedAt: nowIso,
  }

  const tplVehicle: InspectionTemplate = {
    id: 'tpl-kjoretoy',
    name: 'Kjøretøykontroll',
    description: 'Dekk, lys, førerkort, dokumentasjon.',
    fields: [
      { id: 'kv1', order: 0, label: 'Dekktrykk og mønster OK', fieldType: 'yes_no_na', required: true },
      { id: 'kv2', order: 1, label: 'Alle lys fungerer', fieldType: 'yes_no_na', required: true },
      { id: 'kv3', order: 2, label: 'Servicestempler / EU-kontroll', fieldType: 'text', required: false },
      { id: 'kv4', order: 3, label: 'Kilometerstand', fieldType: 'number', min: 0, required: false },
      { id: 'kv5', order: 4, label: 'Bilde av eventuelle skader', fieldType: 'photo_optional', required: false },
    ],
    createdAt: nowIso,
    updatedAt: nowIso,
  }

  const tplEquipment: InspectionTemplate = {
    id: 'tpl-utstyr',
    name: 'Utstyrssjekk',
    description: 'Maskin/utstyr før bruk.',
    fields: [
      { id: 'ut1', order: 0, label: 'Verneutstyr på plass', fieldType: 'yes_no_na', required: true },
      { id: 'ut2', order: 1, label: 'Nødstopp testet', fieldType: 'yes_no_na', required: true },
      { id: 'ut3', order: 2, label: 'Kommentar / avvik', fieldType: 'text', required: false },
      { id: 'ut4', order: 3, label: 'Dokumentasjonsbilde (ID-plate)', fieldType: 'photo_required', required: true },
    ],
    createdAt: nowIso,
    updatedAt: nowIso,
  }

  const tplCleaning: InspectionTemplate = {
    id: 'tpl-renhold',
    name: 'Renholdsinspeksjon',
    fields: [
      { id: 'rn1', order: 0, label: 'Toaletter rengjort', fieldType: 'yes_no_na', required: true },
      { id: 'rn2', order: 1, label: 'Avfall tømt', fieldType: 'yes_no_na', required: true },
      { id: 'rn3', order: 2, label: 'Score renhold (1–5)', fieldType: 'number', min: 1, max: 5, required: true },
    ],
    createdAt: nowIso,
    updatedAt: nowIso,
  }

  const types: InspectionTypeDef[] = [
    {
      id: 'type-hms-runde',
      name: 'HMS-runde / vernerunde',
      description: 'Generell HMS-runde etter mal.',
      templateId: tplVernerunde.id,
      order: 0,
      active: true,
    },
    {
      id: 'type-kjoretoy',
      name: 'Kjøretøykontroll',
      templateId: tplVehicle.id,
      order: 1,
      active: true,
    },
    {
      id: 'type-utstyr',
      name: 'Utstyrssjekk',
      templateId: tplEquipment.id,
      order: 2,
      active: true,
    },
    {
      id: 'type-renhold',
      name: 'Renholdsinspeksjon',
      templateId: tplCleaning.id,
      order: 3,
      active: true,
    },
  ]

  const locations = [
    { id: 'loc-dept-prod', kind: 'department' as const, name: 'Produksjon', code: 'PROD', order: 0 },
    { id: 'loc-bld-a', kind: 'building' as const, name: 'Bygg A', parentId: 'loc-dept-prod', order: 0 },
    { id: 'loc-room-a1', kind: 'room' as const, name: 'Hall A1', parentId: 'loc-bld-a', order: 0 },
    { id: 'loc-eq-fork', kind: 'equipment' as const, name: 'Truck #12', parentId: 'loc-room-a1', order: 0 },
    { id: 'loc-kontor', kind: 'department' as const, name: 'Kontor', code: 'ADM', order: 1 },
  ]

  return {
    version: DEFAULT_INSPECTION_CONFIG_VERSION,
    configSourceNote:
      'Demo: konfigurasjon lagres i nettleser. Produksjon: synkroniser med Firebase `modules/hseInspections/config` og tilhørende /templates.',
    inspectionTypes: types,
    templates: [tplVernerunde, tplVehicle, tplEquipment, tplCleaning],
    locations,
    roleRules: [
      {
        id: newId(),
        roleGroup: 'hms_coordinator',
        permissions: ['create', 'execute', 'approve', 'delete'],
      },
      {
        id: newId(),
        roleGroup: 'inspector',
        permissions: ['create', 'execute'],
      },
      {
        id: newId(),
        roleGroup: 'verneombud',
        permissions: ['create', 'execute', 'approve'],
      },
      {
        id: newId(),
        roleGroup: 'management',
        permissions: ['approve', 'delete'],
        inspectionTypeIds: ['type-kjoretoy', 'type-utstyr'],
      },
      { id: newId(), roleGroup: 'employee', permissions: ['execute'] },
    ],
    statusFlow: [
      { id: 'st-planned', label: 'Planlagt', order: 0, isInitial: true },
      { id: 'st-started', label: 'Påbegynt', order: 1 },
      { id: 'st-approval', label: 'Til godkjenning', order: 2 },
      { id: 'st-done', label: 'Fullført', order: 3, isTerminal: true },
    ],
    schedules: [
      {
        id: newId(),
        name: 'Månedlig HMS-runde Produksjon',
        inspectionTypeId: 'type-hms-runde',
        templateId: tplVernerunde.id,
        defaultLocationId: 'loc-room-a1',
        intervalValue: 1,
        intervalUnit: 'month',
        active: true,
        nextDueAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      },
    ],
    deviationSeverities: [
      { id: 'dev-low', label: 'Lav', order: 0, defaultDueDays: 30, color: 'low' },
      { id: 'dev-med', label: 'Middels', order: 1, defaultDueDays: 14, color: 'medium' },
      { id: 'dev-high', label: 'Høy', order: 2, defaultDueDays: 7, color: 'high' },
      { id: 'dev-crit', label: 'Kritisk', order: 3, defaultDueDays: 1, color: 'critical' },
    ],
  }
}

/** Legacy vernerunde-mal-referanse (sikkerhetsrunde i gammel tabell) */
export { SAFETY_ROUND_TEMPLATE_ID as LEGACY_SAFETY_TEMPLATE_REF }
