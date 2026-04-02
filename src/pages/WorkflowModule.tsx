import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GitBranch, Plus } from 'lucide-react'
import { WORKFLOW_PRESETS } from '../data/workflowPresets'
import { useWorkflows } from '../hooks/useWorkflows'
import type { WorkflowCategory } from '../types/workflow'

const categoryLabel: Record<WorkflowCategory, string> = {
  medvirkning: 'Medvirkning',
  ros_risiko: 'ROS / risiko',
  tiltak_oppfolging: 'Tiltak og oppfølging',
  varsling: 'Varsling',
  annet: 'Annet',
}

export function WorkflowModule() {
  const navigate = useNavigate()
  const { workflows, createFromPreset, createBlank, deleteWorkflow } = useWorkflows()
  const [titleDraft, setTitleDraft] = useState('')
  const [catDraft, setCatDraft] = useState<WorkflowCategory>('tiltak_oppfolging')

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-8">
      <nav className="mb-4 text-sm text-neutral-600">
        <Link to="/" className="text-neutral-500 hover:text-[#1a3d32]">
          Prosjekter
        </Link>
        <span className="mx-2 text-neutral-400">→</span>
        <span className="font-medium text-neutral-800">Arbeidsprosesser</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200/80 pb-6">
        <div>
          <h1
            className="text-2xl font-semibold text-neutral-900 md:text-3xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            Prosessbygger
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600">
            Design egne stegvise arbeidsflyter (medvirkning, ROS, tiltak …). Dette er et <strong>planleggingsverktøy</strong>{' '}
            i appen — det erstatter ikke AMU-møter, BHT eller formelle protokoller. Koble steg til{' '}
            <Link to="/tasks" className="text-[#1a3d32] underline">
              oppgaver
            </Link>{' '}
            og andre moduler der det passer.
          </p>
        </div>
      </div>

      <section className="mt-8 rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">Ny tom prosess</h2>
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!titleDraft.trim()) return
            const w = createBlank(titleDraft, catDraft)
            if (w) navigate(`/workflows/${w.id}`)
          }}
        >
          <label className="min-w-[200px] flex-1 text-sm">
            <span className="text-xs font-medium text-neutral-500">Tittel</span>
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              placeholder="F.eks. Årlig ROS — avdeling Øst"
            />
          </label>
          <label className="text-sm">
            <span className="text-xs font-medium text-neutral-500">Kategori</span>
            <select
              value={catDraft}
              onChange={(e) => setCatDraft(e.target.value as WorkflowCategory)}
              className="mt-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            >
              {(Object.keys(categoryLabel) as WorkflowCategory[]).map((c) => (
                <option key={c} value={c}>
                  {categoryLabel[c]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white"
          >
            <Plus className="size-4" />
            Opprett og rediger
          </button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-neutral-900">Malbibliotek</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Start fra et forslag — du kan endre alle steg etterpå.
        </p>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WORKFLOW_PRESETS.map((p) => (
            <li
              key={p.id}
              className="flex flex-col rounded-2xl border border-neutral-200/90 bg-[#faf8f4] p-4 shadow-sm"
            >
              <div className="flex items-start gap-2">
                <GitBranch className="mt-0.5 size-5 shrink-0 text-[#1a3d32]" />
                <div>
                  <h3 className="font-semibold text-neutral-900">{p.title}</h3>
                  <p className="mt-1 text-xs text-neutral-600">{p.description}</p>
                  <span className="mt-2 inline-block rounded-full bg-white px-2 py-0.5 text-xs text-neutral-600 ring-1 ring-neutral-200">
                    {categoryLabel[p.category]}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="mt-4 w-full rounded-xl border border-neutral-300 bg-white py-2 text-sm font-medium text-[#1a3d32] hover:bg-neutral-50"
                onClick={() => {
                  const w = createFromPreset(p.id)
                  if (w) navigate(`/workflows/${w.id}`)
                }}
              >
                Bruk mal
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-neutral-900">Mine prosesser</h2>
        {workflows.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">Ingen prosesser ennå — opprett fra mal eller tom liste over.</p>
        ) : (
          <ul className="mt-4 divide-y divide-neutral-100 rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
            {workflows.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <Link to={`/workflows/${w.id}`} className="font-medium text-[#1a3d32] hover:underline">
                    {w.title}
                  </Link>
                  <p className="text-xs text-neutral-500">
                    {categoryLabel[w.category]} · {w.steps.length} steg · oppdatert{' '}
                    {new Date(w.updatedAt).toLocaleDateString('nb-NO')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    to={`/workflows/${w.id}`}
                    className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-[#1a3d32]"
                  >
                    Rediger
                  </Link>
                  <button
                    type="button"
                    className="text-sm text-red-600 hover:underline"
                    onClick={() => {
                      if (confirm(`Slette «${w.title}»?`)) deleteWorkflow(w.id)
                    }}
                  >
                    Slett
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
