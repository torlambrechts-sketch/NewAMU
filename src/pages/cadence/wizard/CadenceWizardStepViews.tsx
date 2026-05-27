// CadenceWizardStepViews — alle 8 trinn-view-ene som veiviseren renderer.
//
// Hvert trinn er en egen ren komponent som tar inn `useCadenceWizardState`-
// resultatet. Hold all skriv-state utenfor; trinn-komponentene er bare
// presentasjon + onChange-kaller.

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  Search,
} from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Button } from '../../../components/ui/Button'
import { StandardInput } from '../../../components/ui/Input'
import { SearchableSelect } from '../../../components/ui/SearchableSelect'
import {
  fetchAssignableUsers,
  type AssignableUser,
} from '../../../hooks/useAssignableUsers'
import type { UseCadenceWizardStateReturn } from '../useCadenceWizardState'
import {
  AML_CHAPTERS,
  APPROVAL_CHAINS,
  ESCALATION_LADDERS,
  MODULES,
  REGELVERK,
  ROLES,
  chapterSelectionState,
  relevantModules,
  type CadenceModule,
  type CadenceModuleTier,
} from './cadenceWizardData'

// ─── Common bits ────────────────────────────────────────────────────────────

function StepCard({
  title,
  description,
  rightSlot,
  children,
}: {
  title: string
  description?: string
  rightSlot?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:p-7">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-lg font-semibold text-neutral-900 md:text-xl">{title}</h2>
          {description ? (
            <p className="mt-1 max-w-[680px] text-[13.5px] leading-relaxed text-neutral-500">{description}</p>
          ) : null}
        </div>
        {rightSlot}
      </header>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Alert({
  variant = 'info',
  children,
}: {
  variant?: 'info' | 'warn' | 'success'
  children: React.ReactNode
}) {
  const styles = {
    info: 'border-amber-200 bg-amber-50 text-amber-900',
    warn: 'border-amber-300 bg-amber-50 text-amber-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  }[variant]
  const Icon = variant === 'success' ? Check : variant === 'warn' ? AlertTriangle : Info
  return (
    <div className={`flex items-start gap-2.5 rounded-md border px-4 py-3 text-[13px] leading-relaxed ${styles}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function StatusBadge({
  tone,
  children,
}: {
  tone: 'danger' | 'info' | 'warn' | 'neutral' | 'success' | 'forest'
  children: React.ReactNode
}) {
  const tones = {
    danger: 'border-red-200 bg-red-100 text-red-800',
    info: 'border-blue-200 bg-blue-100 text-blue-800',
    warn: 'border-yellow-200 bg-yellow-100 text-yellow-900',
    neutral: 'border-neutral-200 bg-neutral-100 text-neutral-700',
    success: 'border-emerald-200 bg-emerald-100 text-emerald-800',
    forest: 'border-[#c5d3c8] bg-[#e7efe9] text-[#1a3d32]',
  }[tone]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones}`}>
      {children}
    </span>
  )
}

function CheckIcon({
  checked,
  partial,
}: {
  checked: boolean
  partial?: boolean
}) {
  return (
    <span
      aria-hidden
      className={[
        'inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border text-[12px] text-white transition-colors',
        checked || partial
          ? 'border-[#1a3d32] bg-[#1a3d32]'
          : 'border-neutral-300 bg-white',
      ].join(' ')}
    >
      {checked ? <Check className="h-3 w-3" aria-hidden /> : partial ? '—' : null}
    </span>
  )
}

// ─── STEP 1 — Regelverk ─────────────────────────────────────────────────────

export function Step1Regelverk({
  state,
  toggleRegelverk,
}: Pick<UseCadenceWizardStateReturn, 'state' | 'toggleRegelverk'>) {
  return (
    <StepCard
      title="Velg lovverk å bygge cadencen rundt"
      description="Klarert har flere lover og rammeverk forhåndsmappet til oppgavemaler. Du kan starte med ett — eller flere — og legge til mer senere."
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {REGELVERK.map((rv) => {
          const selected = state.regelverk.includes(rv.id)
          const disabled = !!rv.disabled
          return (
            <Button
              key={rv.id}
              variant="ghost"
              type="button"
              onClick={() => !disabled && toggleRegelverk(rv.id)}
              disabled={disabled}
              aria-pressed={selected}
              className={[
                'flex h-auto flex-col items-stretch rounded-lg border-[1.5px] p-4 text-left font-normal normal-case transition-all',
                disabled
                  ? 'cursor-not-allowed border-transparent bg-neutral-50 opacity-55'
                  : selected
                    ? 'border-[#1a3d32] bg-[#e7efe9] hover:bg-[#e7efe9]'
                    : 'border-transparent bg-neutral-50 hover:bg-neutral-100',
              ].join(' ')}
            >
              <div className="mb-2 flex items-start gap-2.5">
                <div
                  className={[
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded text-lg',
                    selected ? 'bg-[#1a3d32] text-white' : 'bg-white text-[#1a3d32]',
                  ].join(' ')}
                  aria-hidden
                >
                  {rv.iconChar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold leading-tight text-neutral-900">{rv.name}</div>
                  <div className="mt-0.5 text-[12px] text-neutral-500">{rv.fullCode}</div>
                </div>
                {rv.status === 'lovpaalagt' && <StatusBadge tone="danger">Lovpålagt</StatusBadge>}
                {rv.status === 'ny' && <StatusBadge tone="warn">Ny 2026</StatusBadge>}
                {rv.status === 'frivillig' && <StatusBadge tone="info">Frivillig</StatusBadge>}
                {rv.status === 'annen-modul' && <StatusBadge tone="neutral">Annen modul</StatusBadge>}
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-neutral-500">{rv.body}</p>
              {!disabled && (
                <div className="mt-2.5 flex flex-wrap gap-3 text-[11px] tabular-nums text-neutral-700">
                  <span><strong className="font-semibold text-neutral-900">{rv.chapters}</strong> kapitler</span>
                  <span><strong className="font-semibold text-neutral-900">{rv.requirements}</strong> krav</span>
                  <span><strong className="font-semibold text-neutral-900">{rv.modules}</strong> moduler</span>
                </div>
              )}
            </Button>
          )
        })}
      </div>

      <div className="mt-6">
        <Alert variant="info">
          <strong>Tips:</strong> Anbefalt grunnoppsett for industri (NACE 28.xxx) er AML + IK-f +
          BHT + psykososial. Disse fire dekker hoveddelen av lovkravene. ISO 45001 legger til
          sertifiseringsverdige krav.
        </Alert>
      </div>
    </StepCard>
  )
}

// ─── STEP 2 — Paragrafer ────────────────────────────────────────────────────

export function Step2Paragrafer({
  state,
  toggleParagraph,
  toggleAllInChapter,
  selectAllRequired,
  clearParagraphs,
}: Pick<UseCadenceWizardStateReturn, 'state' | 'toggleParagraph' | 'toggleAllInChapter' | 'selectAllRequired' | 'clearParagraphs'>) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const selectedSet = useMemo(() => new Set(state.paragraphs), [state.paragraphs])

  const totalParagraphs = AML_CHAPTERS.reduce((s, ch) => s + ch.paragraphs.length, 0)
  const totalChaptersSelected = AML_CHAPTERS.filter((ch) =>
    ch.paragraphs.some((p) => selectedSet.has(p.code)),
  ).length

  const searchLower = search.trim().toLowerCase()
  const filteredChapters = useMemo(() => {
    if (!searchLower) return AML_CHAPTERS
    return AML_CHAPTERS.map((ch) => ({
      ...ch,
      paragraphs: ch.paragraphs.filter(
        (p) =>
          p.code.toLowerCase().includes(searchLower) ||
          p.title.toLowerCase().includes(searchLower) ||
          (p.note ?? '').toLowerCase().includes(searchLower),
      ),
    })).filter((ch) => ch.paragraphs.length > 0)
  }, [searchLower])

  // Auto-expand any chapter when search yields results. Computed on
  // render (not as side effect) so we don't trigger a cascading re-render.
  const effectiveExpanded = useMemo(() => {
    if (!searchLower) return expanded
    return new Set(filteredChapters.map((c) => c.num))
  }, [searchLower, filteredChapters, expanded])

  return (
    <StepCard
      title="Velg kapitler og paragrafer som skal med"
      description="Bygd direkte fra Arbeidsmiljølovens innholdsfortegnelse. Trykk på en kapittel-overskrift for å se enkeltparagrafer. Klarert merker dem som er obligatoriske for din virksomhet."
      rightSlot={
        <div className="flex flex-wrap gap-2 text-[11.5px] tabular-nums text-neutral-500">
          <span className="rounded-md bg-neutral-50 px-2.5 py-1.5">
            <strong className="text-[13px] font-semibold text-neutral-900">{state.paragraphs.length}</strong>
            /<strong className="font-semibold">{totalParagraphs}</strong> paragrafer
          </span>
          <span className="rounded-md bg-neutral-50 px-2.5 py-1.5">
            <strong className="text-[13px] font-semibold text-neutral-900">{totalChaptersSelected}</strong>
            /<strong className="font-semibold">{AML_CHAPTERS.length}</strong> kapitler
          </span>
        </div>
      }
    >
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden />
          <StandardInput
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk i paragrafer eller titler …"
            className="w-full !py-2 pl-9 text-sm"
          />
        </div>
        <Button variant="secondary" size="sm" onClick={selectAllRequired}>
          Velg alle lovpålagte
        </Button>
        <Button variant="ghost" size="sm" onClick={clearParagraphs}>
          Fjern alle
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {filteredChapters.map((ch) => {
          const { selected, total, required } = chapterSelectionState(ch, selectedSet)
          const isExpanded = effectiveExpanded.has(ch.num)
          const allSelected = selected === total
          const partial = selected > 0 && !allSelected
          return (
            <div key={ch.num} className="overflow-hidden rounded-lg bg-neutral-50">
              <div
                className={[
                  'grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-3 transition-colors',
                  isExpanded ? 'border-b border-neutral-200 bg-neutral-100' : 'hover:bg-neutral-100',
                ].join(' ')}
              >
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    setExpanded((prev) => {
                      const next = new Set(prev)
                      if (next.has(ch.num)) next.delete(ch.num)
                      else next.add(ch.num)
                      return next
                    })
                  }}
                  className="h-auto p-1 text-left"
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? 'Skjul' : 'Vis'} paragrafer i ${ch.num}`}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-neutral-500" aria-hidden />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-neutral-500" aria-hidden />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    setExpanded((prev) => {
                      const next = new Set(prev)
                      if (next.has(ch.num)) next.delete(ch.num)
                      else next.add(ch.num)
                      return next
                    })
                  }}
                  className="block h-auto min-w-0 px-1 py-1 text-left font-normal normal-case hover:bg-transparent"
                >
                  <span className="block font-mono text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    {ch.num}
                  </span>
                  <span className="mt-0.5 block text-[14px] font-semibold text-neutral-900">{ch.title}</span>
                </Button>
                <div className="min-w-[90px] text-right text-[11.5px] tabular-nums text-neutral-500">
                  <div>
                    <strong className="font-semibold text-neutral-900">{selected}</strong>/{total} valgt
                  </div>
                  {required > 0 ? (
                    <div className="mt-0.5 text-[10px] text-red-700">{required} lovpålagt</div>
                  ) : (
                    <div className="mt-0.5 text-[10px] text-neutral-400">Valgfritt</div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleAllInChapter(ch.num)
                  }}
                  className="h-auto p-1"
                  aria-label={`Veksle alle paragrafer i ${ch.num}`}
                >
                  <CheckIcon checked={allSelected} partial={partial} />
                </Button>
              </div>
              {isExpanded && (
                <div className="p-2">
                  {ch.paragraphs.map((p) => {
                    const isSelected = selectedSet.has(p.code)
                    return (
                      <Button
                        key={p.code}
                        variant="ghost"
                        type="button"
                        onClick={() => toggleParagraph(p.code)}
                        className="grid h-auto w-full grid-cols-[auto_auto_1fr_auto] items-center gap-3 rounded p-2.5 text-left font-normal normal-case transition-colors hover:bg-neutral-100"
                      >
                        <CheckIcon checked={isSelected} />
                        <span className="rounded bg-[#e7efe9] px-2 py-0.5 text-center font-mono text-[11.5px] font-semibold text-[#1a3d32]">
                          {p.code}
                        </span>
                        <span className="min-w-0 text-[13px] text-neutral-800">
                          {p.title}
                          {p.note ? (
                            <span className="mt-0.5 block text-[11.5px] text-neutral-500">{p.note}</span>
                          ) : null}
                        </span>
                        <span className="flex flex-shrink-0 items-center gap-1.5">
                          {p.required ? (
                            <StatusBadge tone="danger">Lovpålagt</StatusBadge>
                          ) : (
                            <StatusBadge tone="neutral">Valgfri</StatusBadge>
                          )}
                          {p.threshold ? (
                            <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-700">
                              {p.threshold}
                            </span>
                          ) : null}
                        </span>
                      </Button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        {filteredChapters.length === 0 && (
          <Alert variant="info">Ingen paragrafer matcher søket «{search}».</Alert>
        )}
      </div>

      <div className="mt-4 rounded-md bg-neutral-50 px-4 py-2.5 text-[11.5px] text-neutral-500">
        <strong>Lovpålagt:</strong> obligatorisk for alle virksomheter med ansatte.{' '}
        <strong>Terskel:</strong> krav slår inn ved gitt antall ansatte. <strong>Valgfri:</strong>{' '}
        god praksis, ikke lovkrav.
      </div>
    </StepCard>
  )
}

// ─── STEP 3 — Moduler ───────────────────────────────────────────────────────

export function Step3Moduler({
  state,
  toggleModule,
  autoSelectRequiredModules,
  setModuleFilter,
}: Pick<UseCadenceWizardStateReturn, 'state' | 'toggleModule' | 'autoSelectRequiredModules' | 'setModuleFilter'>) {
  const selectedParagraphs = useMemo(() => new Set(state.paragraphs), [state.paragraphs])
  const relevant = useMemo(() => relevantModules(selectedParagraphs), [selectedParagraphs])
  const filtered = useMemo(() => {
    if (state.moduleFilter === 'all') return relevant
    return relevant.filter((m) => m.tier === state.moduleFilter)
  }, [relevant, state.moduleFilter])

  const totalRequired = relevant.filter((m) => m.tier === 'required').length
  const selectedRequired = relevant.filter((m) => m.tier === 'required' && state.modules.includes(m.id)).length
  const coverage = totalRequired === 0 ? 100 : Math.round((selectedRequired / totalRequired) * 100)

  const groups = useMemo(() => {
    const out = new Map<string, CadenceModule[]>()
    for (const m of filtered) {
      const arr = out.get(m.group) ?? []
      arr.push(m)
      out.set(m.group, arr)
    }
    return Array.from(out.entries())
  }, [filtered])

  return (
    <StepCard
      title="Velg moduler — oppgavemalene som genereres"
      description="Hver modul dekker én eller flere paragrafer. Klarert har valgt ut moduler som matcher paragrafene dine. Du kan velge bort moduler du ikke trenger."
      rightSlot={
        <div className="flex flex-wrap gap-2 text-[11.5px] tabular-nums text-neutral-500">
          <span className="rounded-md bg-neutral-50 px-2.5 py-1.5">
            <strong className="text-[13px] font-semibold text-neutral-900">{state.modules.length}</strong>
            /<strong className="font-semibold">{relevant.length}</strong> moduler
          </span>
          <span className="rounded-md bg-neutral-50 px-2.5 py-1.5">
            <strong className="text-[13px] font-semibold text-neutral-900">{coverage}</strong>% dekning
          </span>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex w-fit gap-1 rounded-md bg-neutral-100 p-1">
          {(
            [
              { id: 'all', label: 'Alle' },
              { id: 'required', label: 'Lovpålagt' },
              { id: 'recommended', label: 'Anbefalt' },
              { id: 'optional', label: 'Valgfri' },
            ] as const
          ).map((f) => {
            const isActive = state.moduleFilter === f.id
            return (
              <Button
                key={f.id}
                variant="ghost"
                type="button"
                onClick={() => setModuleFilter(f.id)}
                className={[
                  'h-auto rounded px-3 py-1.5 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-[#1a3d32] text-white hover:bg-[#142e26] hover:text-white'
                    : 'text-neutral-600 hover:bg-transparent hover:text-neutral-900',
                ].join(' ')}
              >
                {f.label}
              </Button>
            )
          })}
        </div>
        <Button variant="secondary" size="sm" onClick={autoSelectRequiredModules}>
          Velg alle lovpålagte moduler
        </Button>
      </div>

      {groups.length === 0 ? (
        <Alert variant="warn">
          Ingen moduler matcher de valgte paragrafene. Gå tilbake og velg flere paragrafer i steg 2.
        </Alert>
      ) : (
        <div className="space-y-4">
          {groups.map(([group, mods]) => (
            <div key={group}>
              <div className="mb-2 flex items-end justify-between border-b border-neutral-100 pb-1.5">
                <h3 className="text-[11.5px] font-semibold uppercase tracking-wide text-neutral-500">{group}</h3>
                <span className="text-[11px] tabular-nums text-neutral-400">
                  {mods.length} modul{mods.length === 1 ? '' : 'er'}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                {mods.map((m) => {
                  const isSelected = state.modules.includes(m.id)
                  return (
                    <Button
                      key={m.id}
                      variant="ghost"
                      type="button"
                      onClick={() => toggleModule(m.id)}
                      aria-pressed={isSelected}
                      className={[
                        'flex h-auto flex-col items-stretch rounded-lg border-[1.5px] p-3.5 text-left font-normal normal-case transition-colors',
                        isSelected
                          ? 'border-[#1a3d32] bg-[#e7efe9] hover:bg-[#e7efe9]'
                          : 'border-transparent bg-neutral-50 hover:bg-neutral-100',
                      ].join(' ')}
                    >
                      <span className="mb-2 flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block text-[14px] font-semibold leading-tight text-neutral-900">{m.name}</span>
                          <span className="mt-0.5 block font-mono text-[11px] tracking-wide text-neutral-500">
                            {m.id} · {m.maps.join(', ')}
                          </span>
                        </span>
                        <CheckIcon checked={isSelected} />
                      </span>
                      <span className="block text-[12px] leading-relaxed text-neutral-500">{m.description}</span>
                      <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <TierBadge tier={m.tier} />
                        <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-[11px] text-neutral-700">
                          {m.volume} oppg./år
                        </span>
                      </span>
                    </Button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {relevant.length > 0 && (
        <div className="mt-6">
          <Alert variant="info">
            Klarert har foreslått <strong>{relevant.length}</strong> moduler basert på dine paragrafer.
            Velg vekk det du ikke trenger.
          </Alert>
        </div>
      )}
    </StepCard>
  )
}

function TierBadge({ tier }: { tier: CadenceModuleTier }) {
  if (tier === 'required') return <StatusBadge tone="danger">Lovpålagt</StatusBadge>
  if (tier === 'recommended') return <StatusBadge tone="info">Anbefalt</StatusBadge>
  return <StatusBadge tone="neutral">Valgfri</StatusBadge>
}

// ─── STEP 4 — Roller ────────────────────────────────────────────────────────

export function Step4Roller({
  state,
  setRolePerson,
  setRoleFallback,
  setRoleNote,
  supabase,
  organizationId,
}: Pick<UseCadenceWizardStateReturn, 'state' | 'setRolePerson' | 'setRoleFallback' | 'setRoleNote'> & {
  supabase: SupabaseClient | null
  organizationId: string | null
}) {
  const [users, setUsers] = useState<AssignableUser[]>([])

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    void fetchAssignableUsers(supabase, organizationId).then((data) => {
      if (cancelled) return
      setUsers(data)
    })
    return () => {
      cancelled = true
    }
  }, [supabase, organizationId])

  const mandatoryRoles = ROLES.filter((r) => r.mandatory)
  const optionalRoles = ROLES.filter((r) => !r.mandatory)

  const allMandatoryFilled = mandatoryRoles.every((r) => state.roles[r.key]?.person?.name)

  return (
    <StepCard
      title="Roller og ansvar"
      description="Definer hvem som har hvilken rolle. Klarert tildeler oppgaver til roller — ikke personer — slik at de overlever utskifting. Du tilordner personer til hver rolle her."
    >
      <h3 className="mb-3 text-[15px] font-semibold text-neutral-900">Lovpålagte roller</h3>
      <div className="flex flex-col gap-2.5">
        {mandatoryRoles.map((role) => (
          <RoleRow
            key={role.key}
            roleKey={role.key}
            label={role.label}
            sub={role.sub}
            lawRef={role.lawRef}
            isExternal={role.isExternal}
            users={users}
            personChoice={state.roles[role.key]?.person ?? null}
            fallbackChoice={state.roles[role.key]?.fallback ?? null}
            note={state.roles[role.key]?.note ?? ''}
            onPerson={(c) => setRolePerson(role.key, c)}
            onFallback={(c) => setRoleFallback(role.key, c)}
            onNote={(n) => setRoleNote(role.key, n)}
          />
        ))}
      </div>

      <h3 className="mb-3 mt-6 text-[15px] font-semibold text-neutral-900">Frivillige roller</h3>
      <div className="flex flex-col gap-2.5">
        {optionalRoles.map((role) => (
          <RoleRow
            key={role.key}
            roleKey={role.key}
            label={role.label}
            sub={role.sub}
            lawRef={role.lawRef}
            users={users}
            personChoice={state.roles[role.key]?.person ?? null}
            fallbackChoice={state.roles[role.key]?.fallback ?? null}
            note={state.roles[role.key]?.note ?? ''}
            onPerson={(c) => setRolePerson(role.key, c)}
            onFallback={(c) => setRoleFallback(role.key, c)}
            onNote={(n) => setRoleNote(role.key, n)}
          />
        ))}
      </div>

      <div className="mt-6">
        {allMandatoryFilled ? (
          <Alert variant="success">
            <strong>Alle lovpålagte roller er besatt.</strong> Klarert verifiserer at AMU er
            minst 4 medlemmer, HVO er valgt, og verneombud er knyttet til avdeling.
          </Alert>
        ) : (
          <Alert variant="warn">
            <strong>Mangler:</strong> Sett inn person på alle lovpålagte roller før iverksettelse.
            Du kan fortsette gjennom veiviseren, men cadencen blokkeres fra aktivering.
          </Alert>
        )}
      </div>
    </StepCard>
  )
}

function RoleRow({
  label,
  sub,
  lawRef,
  isExternal,
  users,
  personChoice,
  fallbackChoice,
  note,
  onPerson,
  onFallback,
  onNote,
}: {
  roleKey: string
  label: string
  sub: string
  lawRef?: string
  isExternal?: boolean
  users: AssignableUser[]
  personChoice: { userId: string | null; name: string } | null
  fallbackChoice: { userId: string | null; name: string } | null
  note: string
  onPerson: (c: { userId: string | null; name: string } | null) => void
  onFallback: (c: { userId: string | null; name: string } | null) => void
  onNote: (n: string) => void
}) {
  const userOptions = useMemo(
    () => [
      { value: '__empty', label: 'Ingen valgt' },
      ...users.map((u) => ({ value: u.id, label: u.displayName })),
    ],
    [users],
  )

  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg bg-neutral-50 p-3.5 md:grid-cols-[1.2fr_1fr_1fr]">
      <div>
        <div className="text-[13.5px] font-semibold text-neutral-900">{label}</div>
        <div className="mt-0.5 text-[11.5px] text-neutral-500">{sub}</div>
        {lawRef && (
          <span className="mt-1.5 inline-block rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-neutral-500">
            {lawRef}
          </span>
        )}
      </div>
      <div>
        <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-neutral-500">
          {isExternal ? 'Leverandør:' : 'Person:'}
        </div>
        {isExternal ? (
          <StandardInput
            value={personChoice?.name ?? ''}
            onChange={(e) => onPerson(e.target.value ? { userId: null, name: e.target.value } : null)}
            placeholder="Leverandørnavn …"
            className="w-full text-[12.5px]"
          />
        ) : (
          <SearchableSelect
            value={personChoice?.userId ?? '__empty'}
            options={userOptions}
            onChange={(v) => {
              if (v === '__empty') {
                onPerson(null)
                return
              }
              const u = users.find((x) => x.id === v)
              if (u) onPerson({ userId: u.id, name: u.displayName })
            }}
            placeholder="Velg person …"
          />
        )}
      </div>
      <div>
        <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-neutral-500">
          {isExternal ? 'Kontakt:' : 'Fallback:'}
        </div>
        {isExternal ? (
          <StandardInput
            value={note}
            onChange={(e) => onNote(e.target.value)}
            placeholder="E-post eller telefon …"
            className="w-full text-[12.5px]"
          />
        ) : (
          <SearchableSelect
            value={fallbackChoice?.userId ?? '__empty'}
            options={userOptions}
            onChange={(v) => {
              if (v === '__empty') {
                onFallback(null)
                return
              }
              const u = users.find((x) => x.id === v)
              if (u) onFallback({ userId: u.id, name: u.displayName })
            }}
            placeholder="Velg stedfortreder …"
          />
        )}
      </div>
    </div>
  )
}

// ─── STEP 5 — Frekvens ──────────────────────────────────────────────────────

export function Step5Frekvens({
  state,
  setFrequency,
}: Pick<UseCadenceWizardStateReturn, 'state' | 'setFrequency'>) {
  const selectedModules = useMemo(
    () => MODULES.filter((m) => state.modules.includes(m.id)),
    [state.modules],
  )

  const grouped = useMemo(() => {
    const m = new Map<string, CadenceModule[]>()
    for (const mod of selectedModules) {
      const arr = m.get(mod.group) ?? []
      arr.push(mod)
      m.set(mod.group, arr)
    }
    return Array.from(m.entries())
  }, [selectedModules])

  const totalVolume = selectedModules.reduce((s, m) => s + m.volume, 0)

  if (selectedModules.length === 0) {
    return (
      <StepCard title="Frekvens per modul">
        <Alert variant="warn">Ingen moduler valgt. Gå tilbake til steg 3 og velg minst én modul.</Alert>
      </StepCard>
    )
  }

  return (
    <StepCard
      title="Frekvens per modul"
      description="Klarert har foreslått en frekvens basert på lovkrav. Du kan justere — vi advarer hvis du går under minstekravet."
    >
      <div className="space-y-6">
        {grouped.map(([group, mods]) => (
          <div key={group}>
            <h3 className="mb-2 text-[15px] font-semibold text-neutral-900">{group}</h3>
            <div className="overflow-hidden rounded-lg bg-neutral-50">
              <div className="grid grid-cols-[1.2fr_1fr_1fr_auto] gap-3 border-b border-neutral-200 bg-white px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-neutral-500">
                <div>Modul</div>
                <div>Foreslått frekvens</div>
                <div>Lovkrav</div>
                <div className="text-right">Volum/år</div>
              </div>
              {mods.map((m) => {
                const current = state.frequencyByModule[m.id] ?? m.frequencyOptions[0]
                const isRequired = m.tier === 'required'
                return (
                  <div
                    key={m.id}
                    className="grid grid-cols-[1.2fr_1fr_1fr_auto] items-center gap-3 border-b border-neutral-200 px-4 py-3 last:border-b-0"
                  >
                    <div>
                      <div className="text-[13px] font-medium text-neutral-900">{m.name}</div>
                      <div className="mt-0.5 text-[11px] text-neutral-500">
                        {m.id} · {m.maps.join(', ')}
                      </div>
                    </div>
                    <div>
                      <SearchableSelect
                        value={current}
                        options={m.frequencyOptions.map((o) => ({ value: o, label: o }))}
                        onChange={(v) => setFrequency(m.id, v)}
                      />
                    </div>
                    <div>
                      <span
                        className={[
                          'rounded px-2 py-0.5 text-center font-mono text-[11px] font-semibold',
                          isRequired ? 'bg-red-100 text-red-700' : 'bg-[#e7efe9] text-[#1a3d32]',
                        ].join(' ')}
                      >
                        {isRequired ? 'Minimum krav' : 'Anbefalt'}
                      </span>
                    </div>
                    <div className="text-right font-mono text-[12px] font-semibold text-neutral-900">
                      {m.volume}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Alert variant="success">
          <strong>Sum: {totalVolume} oppgaver/år</strong> fordelt på {selectedModules.length} moduler.
          Klarert oppretter én task-rad per modul ved iverksettelse — påfølgende cadence-frekvens
          aktiveres når Phase-2-cron rulles ut.
        </Alert>
      </div>
    </StepCard>
  )
}

// ─── STEP 6 — Godkjenningskjeder ────────────────────────────────────────────

export function Step6Godkjenninger() {
  return (
    <StepCard
      title="Godkjenningskjeder"
      description="For dokumenter som krever flere signaturer. Klarert sender hver godkjenner i rekkefølge. Hvert steg logges med tidsstempel og hash for revisjon."
    >
      <div className="space-y-6">
        {APPROVAL_CHAINS.map((chain) => (
          <div key={chain.code}>
            <h3 className="mb-2 text-[15px] font-semibold text-neutral-900">
              {chain.code} · {chain.label}
            </h3>
            <div className="rounded-lg bg-neutral-50 p-4">
              {chain.steps.map((step, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-neutral-200 py-2.5 last:border-b-0"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border-[1.5px] border-neutral-300 bg-white font-serif text-[12px] font-bold text-neutral-700">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="text-[13.5px] font-semibold text-neutral-900">{step.title}</div>
                    <div className="mt-0.5 text-[11.5px] text-neutral-500">{step.meta}</div>
                  </div>
                  <ApprovalKindBadge kind={step.kind} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 text-[12px] text-neutral-500">
        Standard-kjedene G01–G04 brukes som mal. Tilpasninger gjøres i Klarert Admin →
        Arbeidsflyt etter iverksettelse.
      </div>
    </StepCard>
  )
}

function ApprovalKindBadge({ kind }: { kind: 'utforer' | 'qa' | 'sluttsignering' | 'kollegialt' | 'informeres' }) {
  switch (kind) {
    case 'utforer':
      return <StatusBadge tone="info">Utfører</StatusBadge>
    case 'qa':
      return <StatusBadge tone="warn">QA</StatusBadge>
    case 'sluttsignering':
      return <StatusBadge tone="success">Sluttsignering</StatusBadge>
    case 'kollegialt':
      return <StatusBadge tone="warn">Kollegialt vedtak</StatusBadge>
    case 'informeres':
      return <StatusBadge tone="neutral">Informeres</StatusBadge>
  }
}

// ─── STEP 7 — Eskalering ────────────────────────────────────────────────────

export function Step7Eskalering() {
  return (
    <StepCard
      title="Eskalering og varsler"
      description="Hvis ingen reagerer — hva skjer da? Stigen beskriver eskalering fra mild påminnelse til styre-varsel. Tidskolonnen er relativ til oppgavens frist."
    >
      <div className="space-y-6">
        {ESCALATION_LADDERS.map((ladder) => (
          <div key={ladder.code}>
            <h3 className="mb-2 text-[15px] font-semibold text-neutral-900">
              {ladder.code} · {ladder.label}
            </h3>
            <div className="flex flex-col gap-2">
              {ladder.steps.map((step, idx) => {
                const dayLabel =
                  step.relativeDay === 0
                    ? '0 d'
                    : step.relativeDay > 0
                      ? `+${step.relativeDay} d`
                      : `${step.relativeDay} d`
                const rowBg =
                  step.severity === 'kritisk'
                    ? 'bg-red-50'
                    : step.severity === 'streng'
                      ? 'bg-amber-50'
                      : 'bg-neutral-50'
                return (
                  <div
                    key={idx}
                    className={`grid grid-cols-[100px_1fr_1fr_auto] items-center gap-3 rounded-lg p-3.5 ${rowBg}`}
                  >
                    <span className="rounded bg-white px-2 py-1.5 text-center font-mono text-[12.5px] font-bold text-neutral-900">
                      {dayLabel}
                    </span>
                    <div>
                      <div className="text-[13px] font-semibold text-neutral-900">{step.triggerLabel}</div>
                      {step.triggerNote ? (
                        <div className="mt-0.5 text-[11.5px] text-neutral-500">{step.triggerNote}</div>
                      ) : null}
                    </div>
                    <div>
                      <div className="text-[12px] text-neutral-700">{step.actionLabel}</div>
                      {step.actionNote ? (
                        <div className="mt-0.5 text-[11px] text-neutral-500">{step.actionNote}</div>
                      ) : null}
                    </div>
                    <SeverityBadge severity={step.severity} />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Alert variant="info">
          <strong>Eskaleringskart:</strong> E01 brukes for lovbestemte oppgaver (gir streng
          påminnelse + styre-varsel ved gjentakelse). E02 brukes for frivillige rutiner. Velg per
          modul i Klarert Admin etter iverksettelse.
        </Alert>
      </div>
    </StepCard>
  )
}

function SeverityBadge({ severity }: { severity: 'mild' | 'standard' | 'streng' | 'kritisk' | 'stille' }) {
  switch (severity) {
    case 'mild':
      return <StatusBadge tone="info">Mild</StatusBadge>
    case 'standard':
      return <StatusBadge tone="warn">Standard</StatusBadge>
    case 'streng':
      return <StatusBadge tone="warn">Streng</StatusBadge>
    case 'kritisk':
      return <StatusBadge tone="danger">Kritisk</StatusBadge>
    case 'stille':
      return <StatusBadge tone="neutral">Stille</StatusBadge>
  }
}

// ─── STEP 8 — Forhåndsvis ───────────────────────────────────────────────────

export function Step8Preview({
  state,
  activateStatus,
  activateError,
  activatedPlanId,
  tasksCreated,
}: Pick<UseCadenceWizardStateReturn, 'state' | 'activateStatus' | 'activateError'> & {
  activatedPlanId: string | null
  tasksCreated: number
}) {
  const selectedModules = useMemo(
    () => MODULES.filter((m) => state.modules.includes(m.id)),
    [state.modules],
  )
  const totalVolume = selectedModules.reduce((s, m) => s + m.volume, 0)
  const requiredCount = selectedModules.filter((m) => m.tier === 'required').length
  const assignedRoles = Object.values(state.roles).filter((r) => r.person?.name).length
  const totalMandatoryRoles = ROLES.filter((r) => r.mandatory).length
  const conflicts: string[] = []
  if (assignedRoles < totalMandatoryRoles) {
    conflicts.push(`${totalMandatoryRoles - assignedRoles} lovpålagte roller mangler person.`)
  }
  if (state.regelverk.length === 0) {
    conflicts.push('Ingen regelverk valgt.')
  }
  if (selectedModules.length === 0) {
    conflicts.push('Ingen moduler valgt.')
  }

  // Gruppér moduler etter "kategori" for tidslinjen.
  const timelineGroups = useMemo(() => {
    const map = new Map<string, CadenceModule[]>()
    for (const mod of selectedModules) {
      const arr = map.get(mod.group) ?? []
      arr.push(mod)
      map.set(mod.group, arr)
    }
    return Array.from(map.entries())
  }, [selectedModules])

  return (
    <StepCard
      title="Forhåndsvis cadencen"
      description="Slik vil cadencen se ut hvis du iverksetter nå. Klarert oppretter task-rader per modul; eskalering og frekvens-cron rulles ut i påfølgende fase."
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Oppgaver" value={totalVolume.toString()} sub={`på tvers av ${selectedModules.length} moduler`} />
        <StatTile label="Lovbestemte" value={requiredCount.toString()} sub="ingen slakk på disse" />
        <StatTile
          label="Konflikter"
          value={conflicts.length.toString()}
          sub={conflicts.length === 0 ? 'alt er klart' : 'må håndteres'}
          tone={conflicts.length === 0 ? 'success' : 'danger'}
        />
        <StatTile label="Roller besatt" value={`${assignedRoles}/${totalMandatoryRoles}`} sub="lovpålagte" />
      </div>

      {timelineGroups.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-[15px] font-semibold text-neutral-900">Tidslinje 12 mnd — fordeling</h3>
          <CadenceTimeline groups={timelineGroups} />
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="mt-6 space-y-2">
          <h3 className="text-[15px] font-semibold text-neutral-900">Konflikter som krever din vurdering</h3>
          {conflicts.map((c) => (
            <Alert key={c} variant="warn">
              {c}
            </Alert>
          ))}
        </div>
      )}

      <div className="mt-6">
        {activateStatus === 'activated' ? (
          <Alert variant="success">
            <strong>Cadence iverksatt.</strong> Klarert har opprettet {tasksCreated} oppgaver og
            logget audit-spor. Plan-ID: <span className="font-mono">{activatedPlanId}</span>.
          </Alert>
        ) : activateStatus === 'error' && activateError ? (
          <Alert variant="warn">
            <strong>Iverksettelse feilet:</strong> {activateError}
          </Alert>
        ) : conflicts.length === 0 ? (
          <Alert variant="success">
            <strong>Klar til iverksettelse.</strong> Klarert vil opprette {selectedModules.length}{' '}
            oppgaver, snapshotter rolletildelinger og logger første audit-entry.
          </Alert>
        ) : (
          <Alert variant="info">
            Du kan iverksette nå, men løs gjerne konfliktene først. Iverksatte cadenser kan
            justeres etterpå — men hver endring logges.
          </Alert>
        )}
      </div>
    </StepCard>
  )
}

function StatTile({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string
  value: string
  sub: string
  tone?: 'neutral' | 'success' | 'danger'
}) {
  const colour = tone === 'danger' ? 'text-red-700' : tone === 'success' ? 'text-emerald-700' : 'text-neutral-900'
  return (
    <div className="rounded-lg bg-neutral-50 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1.5 text-3xl font-bold tabular-nums leading-none ${colour}`}>{value}</div>
      <div className="mt-1 text-[12px] text-neutral-500">{sub}</div>
    </div>
  )
}

function CadenceTimeline({ groups }: { groups: [string, CadenceModule[]][] }) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des']
  return (
    <div className="overflow-x-auto rounded-lg bg-neutral-50">
      <div className="grid min-w-[700px] grid-cols-[140px_1fr]">
        <div className="border-b border-r border-neutral-200 bg-white px-3 py-2 text-[10.5px] font-bold uppercase tracking-wide text-neutral-500">
          Kategori
        </div>
        <div className="grid grid-cols-12 border-b border-neutral-200 bg-white">
          {months.map((m) => (
            <span
              key={m}
              className="border-r border-neutral-200 px-2 py-2 text-center text-[10.5px] font-bold uppercase tracking-wide text-neutral-500 last:border-r-0"
            >
              {m}
            </span>
          ))}
        </div>
        {groups.map(([group, mods]) => (
          <CadenceTimelineRow key={group} group={group} mods={mods} />
        ))}
      </div>
    </div>
  )
}

function CadenceTimelineRow({ group, mods }: { group: string; mods: CadenceModule[] }) {
  // Lag boks-segmenter for hver modul basert på cadenceHint.
  // Beregner enkle posisjoner — for kvartalsvis fire bokser i Q1/Q2/Q3/Q4, halvårlig to.
  return (
    <>
      <div className="border-b border-r border-neutral-200 px-3 py-2.5 text-[12px] font-medium text-neutral-900">
        {group}
      </div>
      <div className="relative grid grid-cols-12 border-b border-neutral-200" style={{ minHeight: 40 }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="border-r border-neutral-200 last:border-r-0" />
        ))}
        <div className="absolute inset-0 flex flex-col gap-0.5 px-1 py-1.5">
          {mods.flatMap((m) => placementsFor(m).map((pos, idx) => (
            <span
              key={`${m.id}-${idx}`}
              title={`${m.name} — ${m.frequencyOptions[0]}`}
              className={`absolute top-1.5 flex h-5 items-center rounded px-1.5 text-[10px] font-semibold text-white ${barColourFor(m)}`}
              style={{ left: `${pos.leftPct}%`, width: `${pos.widthPct}%` }}
            >
              {labelFor(m, idx)}
            </span>
          )))}
        </div>
      </div>
    </>
  )
}

function placementsFor(m: CadenceModule): { leftPct: number; widthPct: number }[] {
  switch (m.cadenceHint) {
    case 'kvartalsvis':
      return [
        { leftPct: 8, widthPct: 6 },
        { leftPct: 33, widthPct: 6 },
        { leftPct: 58, widthPct: 6 },
        { leftPct: 83, widthPct: 6 },
      ]
    case 'halvarlig':
      return [
        { leftPct: 20, widthPct: 7 },
        { leftPct: 65, widthPct: 7 },
      ]
    case 'manedlig':
      return [{ leftPct: 1, widthPct: 96 }]
    case 'ukentlig':
      return [{ leftPct: 1, widthPct: 96 }]
    case 'arlig':
      // Plassering varierer per modul (Jan / Feb / Nov) — enkel default på februar.
      return [{ leftPct: 8, widthPct: 6 }]
    case 'ad_hoc':
    default:
      return [{ leftPct: 1, widthPct: 96 }]
  }
}

function barColourFor(m: CadenceModule): string {
  if (m.cadenceHint === 'ad_hoc') return 'bg-amber-500'
  if (m.cadenceHint === 'arlig') return 'bg-[#1a3d32]'
  if (m.cadenceHint === 'kvartalsvis') return 'bg-blue-600'
  if (m.cadenceHint === 'halvarlig') return 'bg-amber-600'
  return 'bg-neutral-500'
}

function labelFor(m: CadenceModule, idx: number): string {
  if (m.cadenceHint === 'kvartalsvis') return `Q${idx + 1}`
  if (m.cadenceHint === 'halvarlig') return idx === 0 ? 'Vår' : 'Høst'
  if (m.cadenceHint === 'arlig') return m.id
  if (m.cadenceHint === 'ad_hoc') return 'Ad hoc'
  return ''
}
