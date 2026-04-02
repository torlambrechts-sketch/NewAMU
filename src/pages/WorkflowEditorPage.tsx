import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { useWorkflows } from '../hooks/useWorkflows'
import { buildWorkflowStepTaskQuery } from '../lib/workflowTaskLink'
import type { WorkflowCategory, WorkflowStepLinkType } from '../types/workflow'

const categoryLabel: Record<WorkflowCategory, string> = {
  medvirkning: 'Medvirkning',
  ros_risiko: 'ROS / risiko',
  tiltak_oppfolging: 'Tiltak og oppfølging',
  varsling: 'Varsling',
  annet: 'Annet',
}

const linkTypeOptions: { value: WorkflowStepLinkType; label: string }[] = [
  { value: 'none', label: 'Ingen snarvei' },
  { value: 'tasks', label: 'Oppgaver' },
  { value: 'internal_control', label: 'Internkontroll' },
  { value: 'org_health', label: 'Organisasjonshelse' },
  { value: 'documents', label: 'Dokumentsenter' },
  { value: 'members', label: 'Members / AMU' },
  { value: 'council', label: 'Council' },
  { value: 'hse', label: 'HSE' },
]

export function WorkflowEditorPage() {
  const { workflowId } = useParams<{ workflowId: string }>()
  const navigate = useNavigate()
  const wf = useWorkflows()
  const workflow = wf.workflows.find((w) => w.id === workflowId)

  const [newStep, setNewStep] = useState({
    title: '',
    description: '',
    roleHint: '',
    suggestedDueDays: '',
    linkType: 'tasks' as WorkflowStepLinkType,
    linkPath: '/tasks',
  })

  const sortedSteps = useMemo(() => [...(workflow?.steps ?? [])].sort((a, b) => a.order - b.order), [workflow])

  if (!workflow) {
    return (
      <div className="mx-auto max-w-[800px] px-4 py-8">
        <p className="text-neutral-600">Fant ikke prosessen.</p>
        <Link to="/workflows" className="mt-4 inline-block text-[#1a3d32] underline">
          Tilbake
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6 md:px-8">
      <nav className="mb-4 text-sm text-neutral-600">
        <Link to="/workflows" className="inline-flex items-center gap-1 text-[#1a3d32] hover:underline">
          <ArrowLeft className="size-4" /> Prosessbygger
        </Link>
      </nav>

      <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-neutral-900">Tittel</label>
        <input
          value={workflow.title}
          onChange={(e) => wf.updateWorkflow(workflow.id, { title: e.target.value })}
          className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-lg font-semibold"
        />
        <label className="mt-4 block text-sm font-medium text-neutral-900">Beskrivelse</label>
        <textarea
          value={workflow.description}
          onChange={(e) => wf.updateWorkflow(workflow.id, { description: e.target.value })}
          rows={3}
          className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
        />
        <label className="mt-4 block text-sm font-medium text-neutral-900">Kategori</label>
        <select
          value={workflow.category}
          onChange={(e) => wf.updateWorkflow(workflow.id, { category: e.target.value as WorkflowCategory })}
          className="mt-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm"
        >
          {(Object.keys(categoryLabel) as WorkflowCategory[]).map((c) => (
            <option key={c} value={c}>
              {categoryLabel[c]}
            </option>
          ))}
        </select>
      </div>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900">Steg</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Rekkefølgen viser anbefalt flyt. Bruk «Oppgave fra steg» for å opprette en forhåndsutfylt oppgave med kobling
        til denne prosessen.
      </p>

      <ol className="mt-4 space-y-4">
        {sortedSteps.map((step, idx) => (
          <li key={step.id} className="rounded-2xl border border-neutral-200 bg-[#faf8f4] p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="text-xs font-medium text-neutral-500">
                Steg {idx + 1}
                {step.suggestedDueDays != null ? (
                  <span className="ml-2 text-neutral-400">· ca. dag {step.suggestedDueDays} (veiledende frist)</span>
                ) : null}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label="Flytt opp"
                  className="rounded border border-neutral-200 p-1 hover:bg-white"
                  onClick={() => wf.moveStep(workflow.id, step.id, 'up')}
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Flytt ned"
                  className="rounded border border-neutral-200 p-1 hover:bg-white"
                  onClick={() => wf.moveStep(workflow.id, step.id, 'down')}
                >
                  <ChevronDown className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Slett steg"
                  className="rounded border border-red-200 p-1 text-red-600 hover:bg-red-50"
                  onClick={() => {
                    if (confirm('Slette dette steget?')) wf.removeStep(workflow.id, step.id)
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
            <input
              value={step.title}
              onChange={(e) => wf.updateStep(workflow.id, step.id, { title: e.target.value })}
              className="mt-2 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm font-medium"
            />
            <textarea
              value={step.description}
              onChange={(e) => wf.updateStep(workflow.id, step.id, { description: e.target.value })}
              rows={2}
              className="mt-2 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-xs"
            />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="text-xs">
                Rolle (hint)
                <input
                  value={step.roleHint ?? ''}
                  onChange={(e) => wf.updateStep(workflow.id, step.id, { roleHint: e.target.value })}
                  className="mt-0.5 w-full rounded border border-neutral-200 px-2 py-1 text-xs"
                />
              </label>
              <label className="text-xs">
                Dager etter start (veiledende)
                <input
                  type="number"
                  min={0}
                  value={step.suggestedDueDays ?? ''}
                  onChange={(e) =>
                    wf.updateStep(workflow.id, step.id, {
                      suggestedDueDays: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="mt-0.5 w-full rounded border border-neutral-200 px-2 py-1 text-xs"
                />
              </label>
              <label className="text-xs sm:col-span-2">
                Snarvei-modul
                <select
                  value={step.linkType}
                  onChange={(e) =>
                    wf.updateStep(workflow.id, step.id, { linkType: e.target.value as WorkflowStepLinkType })
                  }
                  className="mt-0.5 w-full rounded border border-neutral-200 px-2 py-1 text-xs"
                >
                  {linkTypeOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs sm:col-span-2">
                Sti i app (valgfritt)
                <input
                  value={step.linkPath ?? ''}
                  onChange={(e) => wf.updateStep(workflow.id, step.id, { linkPath: e.target.value })}
                  placeholder="/internal-control?tab=ros"
                  className="mt-0.5 w-full rounded border border-neutral-200 px-2 py-1 font-mono text-xs"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {step.linkType !== 'none' && step.linkPath ? (
                <Link
                  to={step.linkPath}
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-[#1a3d32]"
                >
                  Åpne modul
                </Link>
              ) : null}
              <Link
                to={`/tasks?${buildWorkflowStepTaskQuery(workflow, step)}`}
                className="rounded-lg bg-[#1a3d32] px-3 py-1.5 text-xs font-medium text-white"
              >
                Oppgave fra steg
              </Link>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-white p-4">
        <h3 className="text-sm font-semibold text-neutral-900">Legg til steg</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            value={newStep.title}
            onChange={(e) => setNewStep((s) => ({ ...s, title: e.target.value }))}
            placeholder="Tittel"
            className="rounded-lg border border-neutral-200 px-2 py-2 text-sm sm:col-span-2"
          />
          <textarea
            value={newStep.description}
            onChange={(e) => setNewStep((s) => ({ ...s, description: e.target.value }))}
            placeholder="Beskrivelse"
            rows={2}
            className="rounded-lg border border-neutral-200 px-2 py-2 text-sm sm:col-span-2"
          />
          <input
            value={newStep.roleHint}
            onChange={(e) => setNewStep((s) => ({ ...s, roleHint: e.target.value }))}
            placeholder="Rolle (hint)"
            className="rounded-lg border border-neutral-200 px-2 py-2 text-xs"
          />
          <input
            type="number"
            value={newStep.suggestedDueDays}
            onChange={(e) => setNewStep((s) => ({ ...s, suggestedDueDays: e.target.value }))}
            placeholder="Dager (valgfritt)"
            className="rounded-lg border border-neutral-200 px-2 py-2 text-xs"
          />
          <select
            value={newStep.linkType}
            onChange={(e) => setNewStep((s) => ({ ...s, linkType: e.target.value as WorkflowStepLinkType }))}
            className="rounded-lg border border-neutral-200 px-2 py-2 text-xs sm:col-span-2"
          >
            {linkTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            value={newStep.linkPath}
            onChange={(e) => setNewStep((s) => ({ ...s, linkPath: e.target.value }))}
            placeholder="/tasks"
            className="rounded-lg border border-neutral-200 px-2 py-2 font-mono text-xs sm:col-span-2"
          />
        </div>
        <button
          type="button"
          className="mt-3 rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white"
          onClick={() => {
            if (!newStep.title.trim()) return
            wf.addStep(workflow.id, {
              title: newStep.title,
              description: newStep.description,
              roleHint: newStep.roleHint || undefined,
              suggestedDueDays: newStep.suggestedDueDays ? Number(newStep.suggestedDueDays) : undefined,
              linkType: newStep.linkType,
              linkPath: newStep.linkPath || undefined,
            })
            setNewStep({
              title: '',
              description: '',
              roleHint: '',
              suggestedDueDays: '',
              linkType: 'tasks',
              linkPath: '/tasks',
            })
          }}
        >
          Legg til steg
        </button>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          className="text-sm text-red-600 hover:underline"
          onClick={() => {
            if (confirm(`Slette prosessen «${workflow.title}»?`)) {
              wf.deleteWorkflow(workflow.id)
              navigate('/workflows')
            }
          }}
        >
          Slett hele prosessen
        </button>
        <Link to="/workflows" className="text-sm text-[#1a3d32] underline">
          Tilbake til oversikt
        </Link>
      </div>
    </div>
  )
}
