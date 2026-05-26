// useCadenceWizardState — sentral state-håndtering for Cadence-veiviseren.
//
// Slår sammen tre ansvarsområder:
//   1. Lokal React-state for de åtte stegene (regelverk, paragrafer,
//      moduler, roller, frekvens, godkjenningskjeder, eskaleringer).
//   2. Persistent draft via `compliance_wizard_runs` (samme tabell som
//      Compliance-Studio bruker; wizard_key = 'cadence.builder'). Lar
//      brukeren lukke fanen og fortsette senere uten å miste valg.
//   3. Iverksettelse: skriver til cadence_plans + cadence_plan_*,
//      kaller cadence_plan_activate() som oppretter task_items.
//
// Hooken eksponerer både snapshot-state og setter-funksjoner, samt
// `persistDraft` (manuell save) og `activate` (final commit).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useWizardRun } from '../../hooks/useWizardRun'
import {
  APPROVAL_CHAINS,
  AML_CHAPTERS,
  ESCALATION_LADDERS,
  MODULES,
  REGELVERK_BY_ID,
  ROLES,
  type CadenceModule,
  type CadenceRegelverkId,
  type CadenceRoleDef,
} from './wizard/cadenceWizardData'

export const CADENCE_WIZARD_KEY = 'cadence.builder'

export type CadenceRolePersonChoice = {
  /** auth.users(id) hvis valgt fra org-medlemmer; null hvis kun navn. */
  userId: string | null
  /** Display-navn. Fri-tekst tillatt for eksterne (BHT-leverandør). */
  name: string
}

export type CadenceWizardState = {
  /** 1..8 — current step i UI-et. */
  currentStep: number
  /** Plan-navn (brukes som cadence_plans.name). */
  planName: string
  /** Valgte regelverk-IDer (matcher cadenceWizardData.REGELVERK[].id). */
  regelverk: CadenceRegelverkId[]
  /** Valgte paragraf-koder ('AML § 4-3'). */
  paragraphs: string[]
  /** Valgte modul-IDer ('M01'). */
  modules: string[]
  /** Frekvens-override per modul (key=module_id, value=frekvens-tekst). */
  frequencyByModule: Record<string, string>
  /** Rolle-tildeling per role.key. */
  roles: Record<string, { person: CadenceRolePersonChoice | null; fallback: CadenceRolePersonChoice | null; note?: string }>
  /** Modul-filter i steg 3 ('all', 'required', 'recommended', 'optional'). */
  moduleFilter: 'all' | 'required' | 'recommended' | 'optional'
}

const EMPTY_STATE: CadenceWizardState = {
  currentStep: 1,
  planName: 'HMS-årshjul',
  regelverk: ['aml'],
  paragraphs: [],
  modules: [],
  frequencyByModule: {},
  roles: {},
  moduleFilter: 'all',
}

// Validation: hvilke trinn er åpne (kan navigeres til)?
// step1 alltid åpen, øvrige låses inntil minstekrav i forrige er nådd.
export function unlockedSteps(state: CadenceWizardState): Set<number> {
  const unlocked = new Set<number>([1])
  if (state.regelverk.length > 0) unlocked.add(2)
  if (state.paragraphs.length > 0) unlocked.add(3)
  if (state.modules.length > 0) {
    unlocked.add(4)
    unlocked.add(5)
    unlocked.add(6)
    unlocked.add(7)
    unlocked.add(8)
  }
  return unlocked
}

export function canAdvance(state: CadenceWizardState): boolean {
  switch (state.currentStep) {
    case 1: return state.regelverk.length > 0
    case 2: return state.paragraphs.length > 0
    case 3: return state.modules.length > 0
    case 4:
    case 5:
    case 6:
    case 7:
    case 8:
      return true
    default:
      return false
  }
}

// Persistence-format som lagres i compliance_wizard_runs.payload.
// Stable shape — endre forsiktig.
type PersistedPayload = {
  planName: string
  regelverk: string[]
  paragraphs: string[]
  modules: string[]
  frequencyByModule: Record<string, string>
  roles: Record<string, { personUserId: string | null; personName: string; fallbackUserId: string | null; fallbackName: string; note: string }>
}

function toPayload(state: CadenceWizardState): Record<string, string | boolean> {
  // useWizardRun bruker { [k]: string | boolean }. Vi pakker hele
  // staten som JSON-streng under én nøkkel for å holde APIet enkelt.
  const payload: PersistedPayload = {
    planName: state.planName,
    regelverk: state.regelverk,
    paragraphs: state.paragraphs,
    modules: state.modules,
    frequencyByModule: state.frequencyByModule,
    roles: Object.fromEntries(
      Object.entries(state.roles).map(([key, val]) => [
        key,
        {
          personUserId: val.person?.userId ?? null,
          personName: val.person?.name ?? '',
          fallbackUserId: val.fallback?.userId ?? null,
          fallbackName: val.fallback?.name ?? '',
          note: val.note ?? '',
        },
      ]),
    ),
  }
  return { state: JSON.stringify(payload) }
}

function fromPayload(payload: Record<string, string | boolean> | null | undefined): Partial<CadenceWizardState> {
  if (!payload || typeof payload.state !== 'string') return {}
  try {
    const parsed = JSON.parse(payload.state) as Partial<PersistedPayload>
    return {
      planName: parsed.planName ?? 'HMS-årshjul',
      regelverk: (parsed.regelverk ?? []).filter((id): id is CadenceRegelverkId =>
        id === 'aml' || id === 'ik-f' || id === 'bht' || id === 'psyk' || id === 'iso-45001',
      ),
      paragraphs: parsed.paragraphs ?? [],
      modules: parsed.modules ?? [],
      frequencyByModule: parsed.frequencyByModule ?? {},
      roles: Object.fromEntries(
        Object.entries(parsed.roles ?? {}).map(([k, v]) => [
          k,
          {
            person: v.personName ? { userId: v.personUserId, name: v.personName } : null,
            fallback: v.fallbackName ? { userId: v.fallbackUserId, name: v.fallbackName } : null,
            note: v.note,
          },
        ]),
      ),
    }
  } catch {
    return {}
  }
}

export type UseCadenceWizardStateReturn = {
  state: CadenceWizardState
  setStep: (n: number) => void
  goNext: () => void
  goPrev: () => void
  setPlanName: (name: string) => void
  toggleRegelverk: (id: CadenceRegelverkId) => void
  toggleParagraph: (code: string) => void
  selectAllRequired: () => void
  clearParagraphs: () => void
  toggleAllInChapter: (chapterNum: string) => void
  toggleModule: (id: string) => void
  autoSelectRequiredModules: () => void
  setModuleFilter: (f: CadenceWizardState['moduleFilter']) => void
  setFrequency: (moduleId: string, freq: string) => void
  setRolePerson: (roleKey: string, choice: CadenceRolePersonChoice | null) => void
  setRoleFallback: (roleKey: string, choice: CadenceRolePersonChoice | null) => void
  setRoleNote: (roleKey: string, note: string) => void
  /** Manuell lagring av draft. */
  saveDraft: () => Promise<boolean>
  /** Status for siste lagring. */
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  /** Iverksetter cadencen — oppretter cadence_plans + tasks. Returnerer plan-id eller null. */
  activate: () => Promise<{ planId: string; tasksCreated: number } | null>
  activateStatus: 'idle' | 'activating' | 'activated' | 'error'
  activateError: string | null
  /** True på første render mens draft hentes. */
  loadingDraft: boolean
  /** Slett draft (start fra null). */
  resetDraft: () => Promise<void>
}

export function useCadenceWizardState(): UseCadenceWizardStateReturn {
  const { supabase, organization } = useOrgSetupContext()
  const wizardRun = useWizardRun(CADENCE_WIZARD_KEY)
  const [state, setState] = useState<CadenceWizardState>(EMPTY_STATE)
  const [hydrated, setHydrated] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [activateStatus, setActivateStatus] = useState<'idle' | 'activating' | 'activated' | 'error'>('idle')
  const [activateError, setActivateError] = useState<string | null>(null)
  const lastSavedHash = useRef<string>('')

  // Hydrer state fra draft når wizardRun har lastet ferdig.
  useEffect(() => {
    if (hydrated) return
    if (wizardRun.loading) return
    if (wizardRun.run) {
      const restored = fromPayload(wizardRun.run.payload)
      setState((prev) => ({
        ...prev,
        ...restored,
        // currentStep tas fra run, ikke fra payload.
        currentStep: Math.max(1, Math.min(8, wizardRun.run?.current_step ?? 1)),
      }))
    }
    setHydrated(true)
  }, [hydrated, wizardRun.loading, wizardRun.run])

  // Auto-save 800ms etter siste state-endring.
  useEffect(() => {
    if (!hydrated) return
    const payload = toPayload(state)
    const hash = JSON.stringify(payload) + ':' + state.currentStep
    if (hash === lastSavedHash.current) return

    const handle = window.setTimeout(async () => {
      setSaveStatus('saving')
      const saved = await wizardRun.save({
        currentStep: state.currentStep,
        payload,
      })
      if (saved) {
        lastSavedHash.current = hash
        setSaveStatus('saved')
        // Tilbake til idle etter 1,8s slik at "Lagret"-pillen ikke
        // henger fast på skjermen.
        window.setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 1800)
      } else {
        setSaveStatus('error')
      }
    }, 800)
    return () => window.clearTimeout(handle)
  }, [hydrated, state, wizardRun])

  // ─── Setters ──────────────────────────────────────────────────────

  // Auto-velg lovpålagte moduler første gang brukeren går inn i steg 3.
  // Replikerer HTML-versjonens setTimeout-trick i en ren oppdaterer.
  const applyStepEntryDefaults = (s: CadenceWizardState, nextStep: number): CadenceWizardState => {
    if (nextStep !== 3) return s
    if (s.modules.length > 0) return s
    const selectedParagraphs = new Set(s.paragraphs)
    const required = MODULES.filter(
      (m) => m.tier === 'required' && m.maps.some((code) => selectedParagraphs.has(code)),
    ).map((m) => m.id)
    if (required.length === 0) return s
    return { ...s, modules: required }
  }

  const setStep = useCallback((n: number) => {
    if (n < 1 || n > 8) return
    setState((s) => {
      const allowed = unlockedSteps(s)
      if (!allowed.has(n)) return s
      return applyStepEntryDefaults({ ...s, currentStep: n }, n)
    })
  }, [])

  const goNext = useCallback(() => {
    setState((s) => {
      if (!canAdvance(s)) return s
      const next = Math.min(8, s.currentStep + 1)
      return applyStepEntryDefaults({ ...s, currentStep: next }, next)
    })
  }, [])

  const goPrev = useCallback(() => {
    setState((s) => ({ ...s, currentStep: Math.max(1, s.currentStep - 1) }))
  }, [])

  const setPlanName = useCallback((name: string) => {
    setState((s) => ({ ...s, planName: name }))
  }, [])

  const toggleRegelverk = useCallback((id: CadenceRegelverkId) => {
    const def = REGELVERK_BY_ID[id]
    if (def?.disabled) return
    setState((s) => ({
      ...s,
      regelverk: s.regelverk.includes(id)
        ? s.regelverk.filter((r) => r !== id)
        : [...s.regelverk, id],
    }))
  }, [])

  const toggleParagraph = useCallback((code: string) => {
    setState((s) => ({
      ...s,
      paragraphs: s.paragraphs.includes(code)
        ? s.paragraphs.filter((p) => p !== code)
        : [...s.paragraphs, code],
    }))
  }, [])

  const selectAllRequired = useCallback(() => {
    const requiredCodes: string[] = []
    for (const ch of AML_CHAPTERS) {
      for (const p of ch.paragraphs) {
        if (p.required) requiredCodes.push(p.code)
      }
    }
    setState((s) => {
      const set = new Set(s.paragraphs)
      requiredCodes.forEach((c) => set.add(c))
      return { ...s, paragraphs: Array.from(set) }
    })
  }, [])

  const clearParagraphs = useCallback(() => {
    setState((s) => ({ ...s, paragraphs: [] }))
  }, [])

  const toggleAllInChapter = useCallback((chapterNum: string) => {
    const chapter = AML_CHAPTERS.find((c) => c.num === chapterNum)
    if (!chapter) return
    const codes = chapter.paragraphs.map((p) => p.code)
    setState((s) => {
      const set = new Set(s.paragraphs)
      const allSelected = codes.every((c) => set.has(c))
      if (allSelected) codes.forEach((c) => set.delete(c))
      else codes.forEach((c) => set.add(c))
      return { ...s, paragraphs: Array.from(set) }
    })
  }, [])

  const toggleModule = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      modules: s.modules.includes(id) ? s.modules.filter((m) => m !== id) : [...s.modules, id],
    }))
  }, [])

  const autoSelectRequiredModules = useCallback(() => {
    setState((s) => {
      const selectedSet = new Set(s.paragraphs)
      const relevant = MODULES.filter((m) => m.maps.some((code) => selectedSet.has(code)))
      const required = relevant.filter((m) => m.tier === 'required').map((m) => m.id)
      const set = new Set(s.modules)
      required.forEach((id) => set.add(id))
      return { ...s, modules: Array.from(set) }
    })
  }, [])

  const setModuleFilter = useCallback((f: CadenceWizardState['moduleFilter']) => {
    setState((s) => ({ ...s, moduleFilter: f }))
  }, [])

  const setFrequency = useCallback((moduleId: string, freq: string) => {
    setState((s) => ({
      ...s,
      frequencyByModule: { ...s.frequencyByModule, [moduleId]: freq },
    }))
  }, [])

  const setRolePerson = useCallback((roleKey: string, choice: CadenceRolePersonChoice | null) => {
    setState((s) => ({
      ...s,
      roles: {
        ...s.roles,
        [roleKey]: { ...(s.roles[roleKey] ?? {}), person: choice, fallback: s.roles[roleKey]?.fallback ?? null, note: s.roles[roleKey]?.note },
      },
    }))
  }, [])

  const setRoleFallback = useCallback((roleKey: string, choice: CadenceRolePersonChoice | null) => {
    setState((s) => ({
      ...s,
      roles: {
        ...s.roles,
        [roleKey]: { ...(s.roles[roleKey] ?? {}), person: s.roles[roleKey]?.person ?? null, fallback: choice, note: s.roles[roleKey]?.note },
      },
    }))
  }, [])

  const setRoleNote = useCallback((roleKey: string, note: string) => {
    setState((s) => ({
      ...s,
      roles: {
        ...s.roles,
        [roleKey]: { ...(s.roles[roleKey] ?? {}), person: s.roles[roleKey]?.person ?? null, fallback: s.roles[roleKey]?.fallback ?? null, note },
      },
    }))
  }, [])

  const saveDraft = useCallback(async (): Promise<boolean> => {
    setSaveStatus('saving')
    const saved = await wizardRun.save({
      currentStep: state.currentStep,
      payload: toPayload(state),
    })
    if (saved) {
      lastSavedHash.current = JSON.stringify(toPayload(state)) + ':' + state.currentStep
      setSaveStatus('saved')
      window.setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 1800)
      return true
    }
    setSaveStatus('error')
    return false
  }, [state, wizardRun])

  const resetDraft = useCallback(async () => {
    await wizardRun.reset()
    setState(EMPTY_STATE)
    lastSavedHash.current = ''
  }, [wizardRun])

  const activate = useCallback(async (): Promise<{ planId: string; tasksCreated: number } | null> => {
    if (!supabase || !organization?.id) {
      setActivateError('Mangler organisasjonskontekst.')
      setActivateStatus('error')
      return null
    }
    setActivateStatus('activating')
    setActivateError(null)

    try {
      // 1. Opprett cadence_plans-raden.
      const headcount = (organization as { employee_count?: number | null } | null)?.employee_count ?? null
      const nace = (organization as { nace_code?: string | null } | null)?.nace_code ?? null
      const { data: planRow, error: planErr } = await supabase
        .from('cadence_plans')
        .insert({
          name: state.planName || 'HMS-årshjul',
          regelverk: state.regelverk,
          wizard_step: 8,
          status: 'draft',
          snapshot_headcount: headcount,
          snapshot_nace: nace,
        })
        .select('id')
        .single()
      if (planErr || !planRow) {
        throw new Error(planErr?.message ?? 'Kunne ikke opprette cadence-plan')
      }
      const planId = String(planRow.id)

      // 2. Skriv paragrafer.
      if (state.paragraphs.length > 0) {
        const paragraphRows = state.paragraphs.map((code) => {
          const chapter = AML_CHAPTERS.find((c) => c.paragraphs.some((p) => p.code === code))
          const paragraph = chapter?.paragraphs.find((p) => p.code === code)
          return {
            cadence_plan_id: planId,
            law_ref: code,
            chapter: chapter?.title ?? null,
            title: paragraph?.title ?? null,
            required: paragraph?.required ?? false,
            threshold: paragraph?.threshold ?? null,
          }
        })
        const { error: paraErr } = await supabase
          .from('cadence_plan_paragraphs')
          .insert(paragraphRows)
        if (paraErr) throw new Error(`Paragrafer: ${paraErr.message}`)
      }

      // 3. Skriv moduler.
      const selectedModules: CadenceModule[] = MODULES.filter((m) => state.modules.includes(m.id))
      if (selectedModules.length > 0) {
        const moduleRows = selectedModules.map((m) => ({
          cadence_plan_id: planId,
          module_id: m.id,
          name: m.name,
          group_label: m.group,
          tier: m.tier,
          law_refs: m.maps,
          volume: m.volume,
          frequency: state.frequencyByModule[m.id] ?? m.frequencyOptions[0] ?? null,
          cadence_hint: m.cadenceHint,
          description: m.description,
        }))
        const { error: modErr } = await supabase
          .from('cadence_plan_modules')
          .insert(moduleRows)
        if (modErr) throw new Error(`Moduler: ${modErr.message}`)
      }

      // 4. Skriv roller.
      const roleEntries: Array<[CadenceRoleDef, { person: CadenceRolePersonChoice | null; fallback: CadenceRolePersonChoice | null; note?: string }]> = []
      for (const role of ROLES) {
        const assignment = state.roles[role.key]
        if (!assignment) continue
        if (!assignment.person?.name) continue
        roleEntries.push([role, assignment])
      }
      if (roleEntries.length > 0) {
        const roleRows = roleEntries.map(([role, assignment]) => ({
          cadence_plan_id: planId,
          role_key: role.key,
          role_label: role.label,
          law_ref: role.lawRef ?? null,
          person_user_id: assignment.person?.userId ?? null,
          person_name: assignment.person?.name ?? null,
          fallback_user_id: assignment.fallback?.userId ?? null,
          fallback_name: assignment.fallback?.name ?? null,
          is_mandatory: role.mandatory,
          note: assignment.note ?? null,
        }))
        const { error: roleErr } = await supabase
          .from('cadence_plan_roles')
          .insert(roleRows)
        if (roleErr) throw new Error(`Roller: ${roleErr.message}`)
      }

      // 5. Skriv godkjenningskjeder (snapshotter alle 4 default-kjedene).
      const approvalRows = APPROVAL_CHAINS.flatMap((chain) =>
        chain.steps.map((step, idx) => ({
          cadence_plan_id: planId,
          chain_code: chain.code,
          chain_label: chain.label,
          step_order: idx + 1,
          step_title: step.title,
          step_meta: step.meta,
          step_kind: step.kind,
          sla_days: step.slaDays ?? null,
        })),
      )
      const { error: appErr } = await supabase
        .from('cadence_plan_approvals')
        .insert(approvalRows)
      if (appErr) throw new Error(`Godkjenningskjeder: ${appErr.message}`)

      // 6. Skriv eskaleringsstiger.
      const escRows = ESCALATION_LADDERS.flatMap((ladder) =>
        ladder.steps.map((step, idx) => ({
          cadence_plan_id: planId,
          ladder_code: ladder.code,
          ladder_label: ladder.label,
          step_order: idx + 1,
          relative_day: step.relativeDay,
          trigger_label: step.triggerLabel,
          trigger_note: step.triggerNote ?? null,
          action_label: step.actionLabel,
          action_note: step.actionNote ?? null,
          severity: step.severity,
        })),
      )
      const { error: escErr } = await supabase
        .from('cadence_plan_escalations')
        .insert(escRows)
      if (escErr) throw new Error(`Eskaleringer: ${escErr.message}`)

      // 7. Iverksett — kaller RPC som setter status='active' og oppretter
      //    task_items per modul.
      const { data: activateData, error: activateErr } = await supabase.rpc('cadence_plan_activate', {
        p_plan_id: planId,
      })
      if (activateErr) throw new Error(`Iverksettelse: ${activateErr.message}`)
      const tasksCreated = selectedModules.length // RPC oppretter 1 task per modul (idempotent).
      void activateData

      // 8. Marker draften som fullført slik at fortsett-knappen forsvinner.
      await wizardRun.complete(toPayload(state))

      setActivateStatus('activated')
      return { planId, tasksCreated }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Iverksettelse feilet'
      setActivateError(msg)
      setActivateStatus('error')
      return null
    }
  }, [state, supabase, organization, wizardRun])

  return useMemo(
    () => ({
      state,
      setStep,
      goNext,
      goPrev,
      setPlanName,
      toggleRegelverk,
      toggleParagraph,
      selectAllRequired,
      clearParagraphs,
      toggleAllInChapter,
      toggleModule,
      autoSelectRequiredModules,
      setModuleFilter,
      setFrequency,
      setRolePerson,
      setRoleFallback,
      setRoleNote,
      saveDraft,
      saveStatus,
      activate,
      activateStatus,
      activateError,
      loadingDraft: !hydrated,
      resetDraft,
    }),
    [
      state,
      setStep,
      goNext,
      goPrev,
      setPlanName,
      toggleRegelverk,
      toggleParagraph,
      selectAllRequired,
      clearParagraphs,
      toggleAllInChapter,
      toggleModule,
      autoSelectRequiredModules,
      setModuleFilter,
      setFrequency,
      setRolePerson,
      setRoleFallback,
      setRoleNote,
      saveDraft,
      saveStatus,
      activate,
      activateStatus,
      activateError,
      hydrated,
      resetDraft,
    ],
  )
}
