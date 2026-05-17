/**
 * Diff modal — shows a learner what changed between the version they started
 * and the currently-published version. Driven by the LearnerVersionDiff
 * payload from learning_compute_learner_diff. Three lists (added, removed,
 * unchanged-but-major) plus a CTA bar for "Fullfør bare endringene" /
 * "Start på nytt".
 */
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import type { LearnerVersionDiff, CourseModule } from '../../types/learning'

export type LearningVersionDiffModalProps = {
  diff: Extract<LearnerVersionDiff, { hasDiff: true }>
  modules: CourseModule[]
  changeNotesMd?: string | null
  publishedAt?: string | null
  onClose: () => void
  onTakeDelta: () => void
  onRetakeFull: () => void
}

function fmtVersion(v: { major: number; minor: number }) {
  return `v${v.major}.${v.minor}`
}

function fmtDate(iso?: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function LearningVersionDiffModal({
  diff,
  modules,
  changeNotesMd,
  publishedAt,
  onClose,
  onTakeDelta,
  onRetakeFull,
}: LearningVersionDiffModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const moduleById = new Map(modules.map((m) => [m.id, m]))
  const added = diff.addedModuleIds
    .map((id) => moduleById.get(id))
    .filter((m): m is CourseModule => Boolean(m))
  const removedIds = diff.removedModuleIds

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="learning-version-diff-title"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-6 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
              Ny versjon tilgjengelig
            </p>
            <h2 id="learning-version-diff-title" className="mt-1 text-lg font-semibold text-neutral-900">
              {fmtVersion(diff.fromVersion)} → {fmtVersion(diff.toVersion)}
            </h2>
            {publishedAt ? (
              <p className="mt-0.5 text-xs text-neutral-500">Publisert {fmtDate(publishedAt)}</p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-7 w-7 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
            aria-label="Lukk"
          >
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="space-y-6 px-6 py-5 text-sm">
          {changeNotesMd ? (
            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-600">
                Endringsnotater
              </h3>
              <pre className="mt-2 whitespace-pre-wrap rounded-md bg-neutral-50 p-3 font-sans text-sm leading-relaxed text-neutral-800">
                {changeNotesMd}
              </pre>
            </section>
          ) : null}

          {added.length > 0 ? (
            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Nye moduler ({added.length})
              </h3>
              <ul className="mt-2 space-y-2">
                {added.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-md border border-emerald-100 bg-emerald-50/50 px-3 py-2"
                  >
                    <p className="text-sm font-medium text-neutral-900">{m.title}</p>
                    <p className="mt-0.5 text-xs text-neutral-600">
                      {m.kind} · ~{m.durationMinutes} min
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {removedIds.length > 0 ? (
            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                Fjernede moduler ({removedIds.length})
              </h3>
              <p className="mt-1 text-xs text-neutral-500">
                Disse var en del av {fmtVersion(diff.fromVersion)} og er ikke lenger påkrevd.
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {removedIds.map((id) => (
                  <li
                    key={id}
                    className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-mono text-neutral-600"
                  >
                    {id}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-100 bg-neutral-50/50 px-6 py-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Lukk
          </Button>
          <Button type="button" variant="secondary" onClick={onRetakeFull}>
            Start på nytt
          </Button>
          <Button type="button" onClick={onTakeDelta}>
            Fullfør bare endringene
          </Button>
        </footer>
      </div>
    </div>
  )
}
