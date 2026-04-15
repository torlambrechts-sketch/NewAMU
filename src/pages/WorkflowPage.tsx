/**
 * WorkflowPage — global view of all automation rules across every module.
 *
 * Shows workflow rules from every module template side-by-side.
 * Each rule card shows: trigger, conditions, actions, active/inactive state.
 * Admins can jump to the module settings to edit a rule.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ListTodo, Mail, Settings, Zap } from 'lucide-react'
import { useModuleTemplate } from '../hooks/useModuleTemplate'
import type { WorkflowRule } from '../types/moduleTemplate'

/* ── Module registry ─────────────────────────────────────────────────────── */

const MODULES = [
  { key: 'hse.inspections', label: 'Inspeksjonsrunder', path: '/hse?tab=inspections', color: '#1a3d32' },
  { key: 'hse.sja',         label: 'SJA',                path: '/hse?tab=sja',        color: '#0891b2' },
  { key: 'hse.vernerunder', label: 'Vernerunder',         path: '/hse?tab=rounds',     color: '#7c3aed' },
  { key: 'hse.incidents',   label: 'Hendelser',           path: '/workplace-reporting/incidents', color: '#dc2626' },
  { key: 'hse.training',    label: 'Opplæring',           path: '/hse?tab=training',   color: '#d97706' },
]

/* ── Trigger label ───────────────────────────────────────────────────────── */

function triggerLabel(rule: WorkflowRule): string {
  const t = rule.trigger
  switch (t.type) {
    case 'on_create':        return 'Ved opprettelse'
    case 'on_status_change': return `Statusendring → ${t.toStatus}`
    case 'on_finding_added': return t.severity ? `Avvik registrert (${t.severity})` : 'Avvik registrert'
    case 'on_overdue':       return `Forfalt med ${t.daysOverdue} dag${t.daysOverdue === 1 ? '' : 'er'}`
    case 'on_field_value':   return `Felt ${t.field} ${t.operator} ${t.value}`
    default:                 return (t as { type: string }).type
  }
}

/* ── Action icon + label ─────────────────────────────────────────────────── */

function ActionChip({ action }: { action: WorkflowRule['actions'][number] }) {
  const type = (action as { type: string }).type
  const Icon = type === 'create_task' ? ListTodo
    : type === 'send_email' ? Mail
    : Zap

  let label: string = type
  if (type === 'create_task') {
    const a = action as Extract<typeof action, { type: 'create_task' }>
    label = `Opprett oppgave → ${a.assigneeRole} (${a.dueDays}d)`
  } else if (type === 'send_email') {
    const a = action as Extract<typeof action, { type: 'send_email' }>
    label = `Send e-post → ${a.toRole}`
  } else if (type === 'notify_role') {
    const a = action as Extract<typeof action, { type: 'notify_role' }>
    label = `Varsle ${a.role}`
  } else if (type === 'set_status') {
    const a = action as Extract<typeof action, { type: 'set_status' }>
    label = `Sett status: ${a.status}`
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-700">
      <Icon className="size-3.5 shrink-0 text-[#1a3d32]" />
      {label}
    </span>
  )
}

/* ── Rule card ───────────────────────────────────────────────────────────── */

function RuleCard({ rule, moduleLabel, moduleColor, modulePath }:
  { rule: WorkflowRule; moduleLabel: string; moduleColor: string; modulePath: string }) {
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm transition ${rule.active ? 'border-neutral-200/80' : 'border-neutral-100 opacity-60'}`}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${moduleColor}18` }}>
            <Zap className="size-3.5" style={{ color: moduleColor }} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900">{rule.name}</p>
            <p className="text-[11px] text-neutral-400">{moduleLabel}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${rule.active ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
          {rule.active ? 'Aktiv' : 'Inaktiv'}
        </span>
      </div>

      {/* Description */}
      {rule.description && (
        <p className="mt-2 text-xs text-neutral-500">{rule.description}</p>
      )}

      {/* Trigger */}
      <div className="mt-3 rounded-lg bg-neutral-50 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Utløser</p>
        <p className="mt-0.5 text-xs font-medium text-neutral-700">{triggerLabel(rule)}</p>
      </div>

      {/* Actions */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {rule.actions.map((a, i) => <ActionChip key={i} action={a} />)}
      </div>

      {/* Edit link */}
      <div className="mt-3 border-t border-neutral-100 pt-2">
        <Link to={`${modulePath}`} className="text-[11px] text-[#1a3d32] hover:underline">
          Åpne innstillinger for {moduleLabel} →
        </Link>
      </div>
    </div>
  )
}

/* ── Module section with its own hook ────────────────────────────────────── */

function ModuleSection({ moduleKey, label, color, path }: { moduleKey: string; label: string; color: string; path: string }) {
  const { template, loading } = useModuleTemplate(moduleKey)

  if (loading) return (
    <div className="col-span-full text-sm text-neutral-400">Laster {label}…</div>
  )

  const rules = template.workflowRules ?? []

  return (
    <>
      {rules.map(rule => (
        <RuleCard
          key={rule.id}
          rule={rule}
          moduleLabel={label}
          moduleColor={color}
          modulePath={path}
        />
      ))}
      {rules.length === 0 && (
        <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-400">
          Ingen regler konfigurert for {label}
        </div>
      )}
    </>
  )
}

/* ── Main page ───────────────────────────────────────────────────────────── */

export function WorkflowPage() {
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [moduleFilter, setModuleFilter] = useState<string>('all')

  return (
    <div className="mx-auto max-w-[1400px] space-y-8 px-4 py-8 md:px-8" style={{ fontFamily: 'Inter, system-ui, sans-serif', color: '#171717' }}>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
            Arbeidsflyt
          </h1>
          <p className="max-w-2xl text-sm text-neutral-600">
            Alle automatiseringsregler på tvers av moduler. Regler utløses automatisk når betingelsene er oppfylt — opprett oppgaver, send e-post eller varsle roller.
          </p>
        </div>
        <Link
          to="/platform-admin/module-templates"
          className="flex shrink-0 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
        >
          <Settings className="size-4" />
          Rediger i platform-admin
        </Link>
      </div>

      {/* Info box */}
      <div className="flex gap-3 rounded-xl border border-sky-200/70 bg-sky-50/80 p-4 text-sm text-sky-800">
        <AlertCircle className="size-5 shrink-0 text-sky-500" />
        <div>
          <p className="font-semibold">Konfigurer regler i modulinnstillinger</p>
          <p className="mt-0.5 text-xs text-sky-700">
            Gå til HSE → Inspeksjoner → tannhjul-ikon → <strong>Arbeidsflyt</strong>-fanen for å aktivere eller deaktivere regler per modul. Eller bruk{' '}
            <Link to="/platform-admin/module-templates" className="underline">platform-admin → Modul-maler</Link>{' '}
            for full redigering.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl border border-neutral-200 bg-white p-1 shadow-sm">
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${filter === f ? 'bg-[#1a3d32] text-white' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700'}`}
            >
              {f === 'all' ? 'Alle' : f === 'active' ? 'Aktive' : 'Inaktive'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-xl border border-neutral-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setModuleFilter('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${moduleFilter === 'all' ? 'bg-[#1a3d32] text-white' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700'}`}
          >
            Alle moduler
          </button>
          {MODULES.map(m => (
            <button
              key={m.key}
              type="button"
              onClick={() => setModuleFilter(m.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${moduleFilter === m.key ? 'text-white' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700'}`}
              style={moduleFilter === m.key ? { backgroundColor: m.color } : {}}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rule grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES
          .filter(m => moduleFilter === 'all' || m.key === moduleFilter)
          .map(m => (
            <ModuleSection
              key={m.key}
              moduleKey={m.key}
              label={m.label}
              color={m.color}
              path={m.path}
            />
          ))}
      </div>
    </div>
  )
}
