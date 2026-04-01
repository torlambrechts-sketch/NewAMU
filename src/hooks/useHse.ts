import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AML_VERNEOMBUD_STRUCTURE,
  DEFAULT_SAFETY_ROUND_CHECKLIST,
  SAFETY_ROUND_TEMPLATE_ID,
} from '../data/hseTemplates'
import type {
  ChecklistItemStatus,
  HseAuditAction,
  HseAuditEntry,
  Incident,
  Inspection,
  SafetyRound,
} from '../types/hse'

const STORAGE_KEY = 'atics-hse-v1'

type HseState = {
  safetyRounds: SafetyRound[]
  inspections: Inspection[]
  incidents: Incident[]
  auditTrail: HseAuditEntry[]
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

function load(): HseState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const sr: SafetyRound = {
        id: 'demo-sr1',
        title: 'Vernerunde — Produksjon (demo)',
        conductedAt: new Date().toISOString().slice(0, 16),
        location: 'Produksjon, hall A',
        conductedBy: 'Verneombud (demo)',
        items: emptyChecklist(),
        notes: 'Eksempelrunde. Erstatt med faktiske observasjoner.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
      }
    }
    const p = JSON.parse(raw) as HseState
    return {
      safetyRounds: Array.isArray(p.safetyRounds) ? p.safetyRounds : [],
      inspections: Array.isArray(p.inspections) ? p.inspections : [],
      incidents: Array.isArray(p.incidents) ? p.incidents : [],
      auditTrail: Array.isArray(p.auditTrail) ? p.auditTrail : [],
    }
  } catch {
    return { safetyRounds: [], inspections: [], incidents: [], auditTrail: [] }
  }
}

function save(state: HseState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function useHse() {
  const [state, setState] = useState<HseState>(() => load())

  useEffect(() => {
    save(state)
  }, [state])

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
    const next = load()
    setState({
      ...next,
      auditTrail: [
        ...next.auditTrail,
        auditEntry(
          'demo_reset',
          'system',
          'hse',
          'Demodata tilbakestilt; revisjonslogg startet på nytt med init-hendelser.',
        ),
      ],
    })
  }, [])

  const checklistTemplate = DEFAULT_SAFETY_ROUND_CHECKLIST
  const amlStructure = AML_VERNEOMBUD_STRUCTURE

  const stats = useMemo(() => {
    return {
      rounds: state.safetyRounds.length,
      inspections: state.inspections.length,
      incidents: state.incidents.filter((i) => i.kind === 'incident').length,
      nearMiss: state.incidents.filter((i) => i.kind === 'near_miss').length,
      openInspections: state.inspections.filter((i) => i.status === 'open').length,
      auditEntries: state.auditTrail.length,
    }
  }, [state])

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
    createIncident,
    updateIncident,
    resetDemo,
  }
}
