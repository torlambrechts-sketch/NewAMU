import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AML_VERNEOMBUD_STRUCTURE,
  DEFAULT_SAFETY_ROUND_CHECKLIST,
  SAFETY_ROUND_TEMPLATE_ID,
} from '../data/hseTemplates'
import { buildDefaultInspectionConfig } from '../data/hseInspectionDefaults'
import {
  emptyAnswersForTemplate,
  normalizeInspectionConfig,
  normalizeRun,
  validatePhotoDataUrl,
} from '../lib/hseInspectionNormalize'
import type {
  HseInspectionConfig,
  InspectionDeviation,
  InspectionFieldAnswer,
  InspectionRun,
  InspectionScheduleRule,
} from '../types/inspectionModule'
import type {
  ChecklistItemStatus,
  HseAuditAction,
  HseAuditEntry,
  HseProtocolSignature,
  Incident,
  Inspection,
  SafetyRound,
} from '../types/hse'

const STORAGE_KEY = 'atics-hse-v2'
const LEGACY_STORAGE_KEY = 'atics-hse-v1'

type HseState = {
  safetyRounds: SafetyRound[]
  inspections: Inspection[]
  incidents: Incident[]
  auditTrail: HseAuditEntry[]
  inspectionModuleConfig: HseInspectionConfig
  inspectionRuns: InspectionRun[]
}

function auditEntry(
  action: HseAuditAction,
  entityType: HseAuditEntry['entityType'],
  entityId: string,
  summary: string,
  detail?: Record<string, string | number | boolean | null>,
  performedBy?: string,
): HseAuditEntry {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    action,
    entityType,
    entityId,
    summary,
    detail,
    performedBy,
  }
}

const emptyChecklist = (): Record<string, ChecklistItemStatus> => {
  const m: Record<string, ChecklistItemStatus> = {}
  for (const it of DEFAULT_SAFETY_ROUND_CHECKLIST) {
    m[it.id] = 'na'
  }
  return m
}

function initialInspectionConfig(): HseInspectionConfig {
  return buildDefaultInspectionConfig(new Date().toISOString())
}

function migrateFromLegacy(): HseState {
  const now = new Date().toISOString()
  const sr: SafetyRound = {
    id: 'demo-sr1',
    title: 'Vernerunde — Produksjon (demo)',
    conductedAt: now.slice(0, 16),
    location: 'Produksjon, hall A',
    conductedBy: 'Verneombud (demo)',
    items: emptyChecklist(),
    notes: 'Eksempelrunde. Erstatt med faktiske observasjoner.',
    createdAt: now,
    updatedAt: now,
  }
  const initialAudit: HseAuditEntry[] = [
    auditEntry(
      'module_init',
      'system',
      'hse',
      'HSE-modul initialisert med demonstrasjonsdata og sjekkliste.',
      { templateVersion: SAFETY_ROUND_TEMPLATE_ID },
    ),
    auditEntry(
      'safety_round_created',
      'safety_round',
      sr.id,
      `Vernerunde opprettet: «${sr.title}»`,
      { location: sr.location, conductedBy: sr.conductedBy },
    ),
  ]
  return {
    safetyRounds: [sr],
    inspections: [],
    incidents: [],
    auditTrail: initialAudit,
    inspectionModuleConfig: initialInspectionConfig(),
    inspectionRuns: [],
  }
}

function load(): HseState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
      if (legacy) {
        try {
          const p = JSON.parse(legacy) as Record<string, unknown>
          const migrated: HseState = {
            safetyRounds: Array.isArray(p.safetyRounds) ? (p.safetyRounds as SafetyRound[]) : [],
            inspections: Array.isArray(p.inspections) ? (p.inspections as Inspection[]) : [],
            incidents: Array.isArray(p.incidents) ? (p.incidents as Incident[]) : [],
            auditTrail: Array.isArray(p.auditTrail) ? (p.auditTrail as HseAuditEntry[]) : [],
            inspectionModuleConfig: initialInspectionConfig(),
            inspectionRuns: [],
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
          localStorage.removeItem(LEGACY_STORAGE_KEY)
          return migrated
        } catch {
          /* fall through */
        }
      }
      return migrateFromLegacy()
    }
    const p = JSON.parse(raw) as Record<string, unknown>
    const base: HseState = {
      safetyRounds: Array.isArray(p.safetyRounds) ? (p.safetyRounds as SafetyRound[]) : [],
      inspections: Array.isArray(p.inspections) ? (p.inspections as Inspection[]) : [],
      incidents: Array.isArray(p.incidents) ? (p.incidents as Incident[]) : [],
      auditTrail: Array.isArray(p.auditTrail) ? (p.auditTrail as HseAuditEntry[]) : [],
      inspectionModuleConfig: normalizeInspectionConfig(p.inspectionModuleConfig),
      inspectionRuns: Array.isArray(p.inspectionRuns)
        ? (p.inspectionRuns as InspectionRun[]).map((r) => normalizeRun(r))
        : [],
    }
    if (!p.inspectionModuleConfig) {
      base.inspectionModuleConfig = initialInspectionConfig()
    }
    return base
  } catch {
    return migrateFromLegacy()
  }
}

function save(state: HseState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function addMs(iso: string, value: number, unit: InspectionScheduleRule['intervalUnit']): string {
  const d = new Date(iso)
  const v = value
  switch (unit) {
    case 'day':
      d.setUTCDate(d.getUTCDate() + v)
      break
    case 'week':
      d.setUTCDate(d.getUTCDate() + v * 7)
      break
    case 'month':
      d.setUTCMonth(d.getUTCMonth() + v)
      break
    case 'quarter':
      d.setUTCMonth(d.getUTCMonth() + v * 3)
      break
    case 'year':
      d.setUTCFullYear(d.getUTCFullYear() + v)
      break
    default:
      d.setUTCMonth(d.getUTCMonth() + v)
  }
  return d.toISOString()
}

export function useHse() {
  const [state, setState] = useState<HseState>(() => load())

  useEffect(() => {
    save(state)
  }, [state])

  const replaceInspectionConfig = useCallback((config: HseInspectionConfig) => {
    const normalized = normalizeInspectionConfig(config)
    setState((s) => ({
      ...s,
      inspectionModuleConfig: normalized,
      auditTrail: [
        ...s.auditTrail,
        auditEntry(
          'inspection_config_updated',
          'inspection_config',
          'config',
          'Inspeksjonsmodul konfigurasjon oppdatert',
          { version: normalized.version },
        ),
      ],
    }))
  }, [])

  const createInspectionRun = useCallback(
    (input: {
      inspectionTypeId: string
      title: string
      conductedBy: string
      conductedAt: string
      locationId?: string
      objectLabel?: string
      statusId?: string
    }) => {
      let created: InspectionRun | null = null
      setState((s) => {
        const cfg = s.inspectionModuleConfig
        const type = cfg.inspectionTypes.find((t) => t.id === input.inspectionTypeId && t.active)
        if (!type) return s
        const tpl = cfg.templates.find((t) => t.id === type.templateId)
        if (!tpl) return s
        const initialStatus =
          input.statusId ??
          cfg.statusFlow.find((st) => st.isInitial)?.id ??
          cfg.statusFlow[0]?.id ??
          'st-planned'
        const now = new Date().toISOString()
        const run: InspectionRun = {
          id: crypto.randomUUID(),
          inspectionTypeId: type.id,
          templateId: tpl.id,
          templateSnapshotVersion: cfg.version,
          title: input.title.trim(),
          statusId: initialStatus,
          locationId: input.locationId,
          objectLabel: input.objectLabel?.trim() || undefined,
          conductedAt: input.conductedAt,
          conductedBy: input.conductedBy.trim() || '—',
          answers: emptyAnswersForTemplate(tpl),
          deviations: [],
          notes: '',
          createdAt: now,
          updatedAt: now,
        }
        created = run
        return {
          ...s,
          inspectionRuns: [run, ...s.inspectionRuns],
          auditTrail: [
            ...s.auditTrail,
            auditEntry('inspection_run_created', 'inspection_run', run.id, `Inspeksjon opprettet: «${run.title}»`, {
              typeId: type.id,
              templateId: tpl.id,
            }),
          ],
        }
      })
      return created
    },
    [],
  )

  const updateInspectionRun = useCallback((id: string, patch: Partial<InspectionRun>) => {
    setState((s) => {
      const now = new Date().toISOString()
      return {
        ...s,
        inspectionRuns: s.inspectionRuns.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: now } : r)),
        auditTrail: [
          ...s.auditTrail,
          auditEntry('inspection_run_updated', 'inspection_run', id, 'Inspeksjonskjøring oppdatert', {}),
        ],
      }
    })
  }, [])

  const setInspectionRunAnswer = useCallback((runId: string, fieldId: string, answer: InspectionFieldAnswer) => {
    setState((s) => {
      const run = s.inspectionRuns.find((r) => r.id === runId)
      if (!run) return s
      if (answer.type === 'photo_required' || answer.type === 'photo_optional') {
        if (answer.dataUrl) {
          const v = validatePhotoDataUrl(answer.dataUrl)
          if (!v.ok) return s
        }
      }
      const now = new Date().toISOString()
      const answers = { ...run.answers, [fieldId]: answer }
      return {
        ...s,
        inspectionRuns: s.inspectionRuns.map((r) =>
          r.id === runId ? { ...r, answers, updatedAt: now } : r,
        ),
        auditTrail: [
          ...s.auditTrail,
          auditEntry('inspection_run_updated', 'inspection_run', runId, 'Svar oppdatert', { fieldId }),
        ],
      }
    })
  }, [])

  const addInspectionDeviation = useCallback(
    (runId: string, partial: Omit<InspectionDeviation, 'id' | 'createdAt'>) => {
      const dev: InspectionDeviation = {
        ...partial,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      }
      setState((s) => ({
        ...s,
        inspectionRuns: s.inspectionRuns.map((r) =>
          r.id === runId
            ? { ...r, deviations: [...r.deviations, dev], updatedAt: new Date().toISOString() }
            : r,
        ),
        auditTrail: [
          ...s.auditTrail,
          auditEntry('inspection_run_updated', 'inspection_run', runId, `Avvik registrert: ${partial.fieldLabel}`, {
            severityId: partial.severityId,
          }),
        ],
      }))
    },
    [],
  )

  const generateScheduledInspectionRuns = useCallback(() => {
    const now = new Date().toISOString()
    setState((s) => {
      const cfg = s.inspectionModuleConfig
      let runs = [...s.inspectionRuns]
      const newSchedules = cfg.schedules.map((sch) => ({ ...sch }))
      let changed = false

      for (let i = 0; i < newSchedules.length; i++) {
        const sch = newSchedules[i]
        if (!sch.active || !sch.nextDueAt) continue
        if (new Date(sch.nextDueAt).getTime() > new Date().getTime()) continue

        const type = cfg.inspectionTypes.find((t) => t.id === sch.inspectionTypeId)
        const tpl = cfg.templates.find((t) => t.id === sch.templateId)
        if (!type || !tpl) continue

        const initialStatus = cfg.statusFlow.find((st) => st.isInitial)?.id ?? cfg.statusFlow[0]?.id ?? 'st-planned'
        const run: InspectionRun = {
          id: crypto.randomUUID(),
          inspectionTypeId: type.id,
          templateId: tpl.id,
          title: `${sch.name} (${new Date(sch.nextDueAt).toLocaleDateString('nb-NO')})`,
          statusId: initialStatus,
          locationId: sch.defaultLocationId,
          conductedAt: sch.nextDueAt,
          conductedBy: 'Planlagt (system)',
          answers: emptyAnswersForTemplate(tpl),
          deviations: [],
          notes: `Generert fra tidsplan «${sch.name}».`,
          createdAt: now,
          updatedAt: now,
        }
        runs = [run, ...runs]
        newSchedules[i] = {
          ...sch,
          lastGeneratedAt: now,
          nextDueAt: addMs(sch.nextDueAt, sch.intervalValue, sch.intervalUnit),
        }
        changed = true
      }

      if (!changed) return s

      const nextCfg = { ...cfg, schedules: newSchedules }
      return {
        ...s,
        inspectionRuns: runs,
        inspectionModuleConfig: nextCfg,
        auditTrail: [
          ...s.auditTrail,
          auditEntry(
            'inspection_run_created',
            'system',
            'hse',
            'Planlagte inspeksjoner generert fra tidsplaner',
            { schedules: newSchedules.length },
          ),
        ],
      }
    })
  }, [])

  const createSafetyRound = useCallback(
    (partial: Omit<SafetyRound, 'id' | 'createdAt' | 'updatedAt' | 'items'>) => {
      const now = new Date().toISOString()
      const sr: SafetyRound = {
        ...partial,
        id: crypto.randomUUID(),
        items: emptyChecklist(),
        createdAt: now,
        updatedAt: now,
      }
      const entry = auditEntry(
        'safety_round_created',
        'safety_round',
        sr.id,
        `Vernerunde opprettet: «${sr.title}»`,
        {
          location: sr.location,
          conductedBy: sr.conductedBy,
          conductedAt: sr.conductedAt,
          templateId: SAFETY_ROUND_TEMPLATE_ID,
        },
      )
      setState((s) => ({
        ...s,
        safetyRounds: [sr, ...s.safetyRounds],
        auditTrail: [...s.auditTrail, entry],
      }))
      return sr
    },
    [],
  )

  const updateSafetyRound = useCallback(
    (id: string, patch: Partial<SafetyRound>) => {
      setState((s) => {
        const prev = s.safetyRounds.find((x) => x.id === id)
        if (!prev) return s
        const now = new Date().toISOString()
        const merged = { ...prev, ...patch, updatedAt: now }
        const nextRounds = s.safetyRounds.map((x) => (x.id === id ? merged : x))
        const entry = auditEntry(
          'safety_round_updated',
          'safety_round',
          id,
          `Vernerunde oppdatert: «${merged.title}»`,
          {
            notesLen: merged.notes.length,
            itemsChecked: Object.values(merged.items).filter((v) => v !== 'na').length,
          },
        )
        return { ...s, safetyRounds: nextRounds, auditTrail: [...s.auditTrail, entry] }
      })
    },
    [],
  )

  const setChecklistStatus = useCallback(
    (roundId: string, itemId: string, status: ChecklistItemStatus) => {
      setState((s) => {
        const sr = s.safetyRounds.find((x) => x.id === roundId)
        if (!sr) return s
        const now = new Date().toISOString()
        const items = { ...sr.items, [itemId]: status }
        const next = s.safetyRounds.map((x) =>
          x.id === roundId ? { ...x, items, updatedAt: now } : x,
        )
        const entry = auditEntry(
          'safety_round_updated',
          'safety_round',
          roundId,
          `Sjekklistepunkt oppdatert`,
          { itemId, status, previousStatus: sr.items[itemId] ?? 'na' },
        )
        return { ...s, safetyRounds: next, auditTrail: [...s.auditTrail, entry] }
      })
    },
    [],
  )

  const createInspection = useCallback(
    (partial: Omit<Inspection, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString()
      const ins: Inspection = {
        ...partial,
        protocolSignatures: partial.protocolSignatures ?? [],
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      }
      const entry = auditEntry(
        'inspection_created',
        'inspection',
        ins.id,
        `Inspeksjon registrert: «${ins.title}» (${ins.kind})`,
        { scope: ins.scope.slice(0, 200), status: ins.status },
      )
      setState((s) => ({
        ...s,
        inspections: [ins, ...s.inspections],
        auditTrail: [...s.auditTrail, entry],
      }))
      return ins
    },
    [],
  )

  const signInspectionProtocol = useCallback(
    (inspectionId: string, signerName: string, role: HseProtocolSignature['role']) => {
      const name = signerName.trim()
      if (!name) return false
      const sig: HseProtocolSignature = {
        signerName: name,
        signedAt: new Date().toISOString(),
        role,
      }
      setState((s) => {
        const entry = auditEntry(
          'inspection_updated',
          'inspection',
          inspectionId,
          `Inspeksjonsprotokoll signert (${role}): ${name}`,
          { role },
        )
        return {
          ...s,
          inspections: s.inspections.map((x) =>
            x.id === inspectionId
              ? {
                  ...x,
                  protocolSignatures: [...(x.protocolSignatures ?? []), sig],
                  updatedAt: new Date().toISOString(),
                }
              : x,
          ),
          auditTrail: [...s.auditTrail, entry],
        }
      })
      return true
    },
    [],
  )

  const updateInspection = useCallback((id: string, patch: Partial<Inspection>) => {
    setState((s) => {
      const now = new Date().toISOString()
      const entry = auditEntry('inspection_updated', 'inspection', id, 'Inspeksjon oppdatert', {
        status: patch.status ?? null,
      })
      return {
        ...s,
        inspections: s.inspections.map((x) =>
          x.id === id ? { ...x, ...patch, updatedAt: now } : x,
        ),
        auditTrail: [...s.auditTrail, entry],
      }
    })
  }, [])

  const createIncident = useCallback(
    (partial: Omit<Incident, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString()
      const inc: Incident = {
        ...partial,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      }
      const entry = auditEntry(
        'incident_created',
        'incident',
        inc.id,
        `${inc.kind === 'near_miss' ? 'Nestenulykke' : 'Hendelse'} registrert`,
        {
          severity: inc.severity,
          occurredAt: inc.occurredAt,
          location: inc.location.slice(0, 120),
        },
      )
      setState((s) => ({
        ...s,
        incidents: [inc, ...s.incidents],
        auditTrail: [...s.auditTrail, entry],
      }))
      return inc
    },
    [],
  )

  const updateIncident = useCallback((id: string, patch: Partial<Incident>) => {
    setState((s) => {
      const now = new Date().toISOString()
      const entry = auditEntry(
        'incident_updated',
        'incident',
        id,
        'Hendelse/nestenulykke oppdatert',
        { status: patch.status ?? null },
      )
      return {
        ...s,
        incidents: s.incidents.map((x) =>
          x.id === id ? { ...x, ...patch, updatedAt: now } : x,
        ),
        auditTrail: [...s.auditTrail, entry],
      }
    })
  }, [])

  const resetDemo = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    const next = migrateFromLegacy()
    setState({
      ...next,
      auditTrail: [
        ...next.auditTrail,
        auditEntry(
          'demo_reset',
          'system',
          'hse',
          'Demodata tilbakestilt; inspeksjonsmodul og revisjonslogg regenerert.',
        ),
      ],
    })
  }, [])

  const checklistTemplate = DEFAULT_SAFETY_ROUND_CHECKLIST
  const amlStructure = AML_VERNEOMBUD_STRUCTURE

  const inspectionStats = useMemo(() => {
    const cfg = state.inspectionModuleConfig
    const terminalIds = new Set(cfg.statusFlow.filter((s) => s.isTerminal).map((s) => s.id))
    const runs = state.inspectionRuns
    const open = runs.filter((r) => !terminalIds.has(r.statusId)).length
    return {
      runsTotal: runs.length,
      runsOpen: open,
      typesActive: state.inspectionModuleConfig.inspectionTypes.filter((t) => t.active).length,
      templates: state.inspectionModuleConfig.templates.length,
      schedulesActive: state.inspectionModuleConfig.schedules.filter((s) => s.active).length,
    }
  }, [state.inspectionModuleConfig, state.inspectionRuns])

  const stats = useMemo(() => {
    return {
      rounds: state.safetyRounds.length,
      inspections: state.inspections.length,
      incidents: state.incidents.filter((i) => i.kind === 'incident').length,
      nearMiss: state.incidents.filter((i) => i.kind === 'near_miss').length,
      openInspections: state.inspections.filter((i) => i.status === 'open').length,
      auditEntries: state.auditTrail.length,
      ...inspectionStats,
    }
  }, [state, inspectionStats])

  return {
    ...state,
    checklistTemplate,
    amlStructure,
    stats,
    createSafetyRound,
    updateSafetyRound,
    setChecklistStatus,
    createInspection,
    updateInspection,
    signInspectionProtocol,
    createIncident,
    updateIncident,
    resetDemo,
    replaceInspectionConfig,
    createInspectionRun,
    updateInspectionRun,
    setInspectionRunAnswer,
    addInspectionDeviation,
    generateScheduledInspectionRuns,
  }
}
