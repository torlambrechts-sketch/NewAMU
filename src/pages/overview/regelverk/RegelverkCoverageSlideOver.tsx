// Drill-down for ett krav: full §-tekst, plikt-grunnlag, dekningsmatrise
// gruppert per modul med direkte lenker. Åpnes fra tabellen.

import { useEffect } from 'react'
import { ExternalLink, X } from 'lucide-react'
import {
  KIND_LABEL,
  MODULE_AXES,
  obligationLabel,
  type RequirementWithCoverage,
} from './regelverkCoverageTypes'
import type { CoverageEntry } from '../../../hooks/useRegelverkCoverage'

const FOREST = '#1a3d32'
const CREAM = '#F9F7F2'
const SERIF = "'Libre Baskerville', Georgia, serif"

// Maps en CoverageEntry til intern route der ressursen kan åpnes.
function entryHref(e: CoverageEntry): string | null {
  switch (e.kind) {
    case 'course_system':
    case 'course_org':
      return `/elearning?course=${e.id}`
    case 'document':
      return `/docs/${e.id}`
    case 'survey':
      return `/surveys?survey=${e.id}`
    case 'checklist_template':
    case 'checklist_item':
      return `/compliance?template=${e.id}`
    case 'ros':
      return `/ros/${e.id}`
    case 'task':
      return `/tasks/management/alle?task=${e.id}`
    case 'meeting_template':
      return `/meetings?template=${e.id}`
    default:
      return null
  }
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null
  return (
    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-700">
      {status}
    </span>
  )
}

export function RegelverkCoverageSlideOver({
  open,
  req,
  onClose,
}: {
  open: boolean
  req: RequirementWithCoverage | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !req) return null

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Lukk"
        onClick={onClose}
        className="absolute inset-0 bg-neutral-900/30"
      />
      <div
        className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-neutral-200 shadow-2xl"
        style={{ backgroundColor: CREAM }}
      >
        <header className="flex items-start justify-between gap-3 border-b border-neutral-200 bg-white px-6 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
              {req.category}
            </p>
            <h2
              className="mt-1 truncate text-2xl font-semibold text-neutral-900"
              style={{ fontFamily: SERIF }}
            >
              {req.lawRef}
            </h2>
            <p className="mt-1 text-sm text-neutral-700">{req.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Lukk"
            className="shrink-0 rounded-md p-2 text-neutral-500 hover:bg-neutral-100"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
                req.obligation === 'mandatory'
                  ? 'bg-red-50 text-red-900 ring-red-200'
                  : req.obligation === 'recommended'
                    ? 'bg-amber-50 text-amber-900 ring-amber-200'
                    : 'bg-neutral-50 text-neutral-700 ring-neutral-200'
              }`}
            >
              {obligationLabel(req.obligation)}
            </span>
            {req.applies ? (
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-700">
                Gjelder: {req.applies}
              </span>
            ) : null}
            {req.alternateRefs?.map((ref) => (
              <span
                key={ref}
                className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200"
              >
                {ref}
              </span>
            ))}
          </div>

          {req.description ? (
            <section className="mb-6 rounded-md border border-neutral-200 bg-white p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                Lovtekst / oppsummering
              </p>
              <p className="mt-2 text-sm leading-relaxed text-neutral-800">{req.description}</p>
            </section>
          ) : null}

          <section>
            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
              Dekkes av ({req.coverage.length})
            </p>
            {req.coverage.length === 0 ? (
              <div className="mt-3 rounded-md border border-dashed border-red-300 bg-red-50/60 p-4 text-sm text-red-900">
                Dette kravet er ikke dekket av noen modul ennå. Vurder å legge til
                et dokument, en sjekkliste, et kurs eller en undersøkelse som
                bærer lovreferansen <code className="rounded bg-white px-1">{req.lawRef}</code>.
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {MODULE_AXES.map((axis) => {
                  const entries = req.coverage.filter((e) => axis.kinds.includes(e.kind))
                  if (entries.length === 0) return null
                  return (
                    <li key={axis.id} className="rounded-md border border-neutral-200 bg-white">
                      <p className="border-b border-neutral-100 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                        {axis.label} · {entries.length}
                      </p>
                      <ul>
                        {entries.map((e) => {
                          const href = entryHref(e)
                          const Inner = (
                            <>
                              <span className="flex min-w-0 flex-1 items-center gap-2">
                                <span className="truncate text-sm text-neutral-900">{e.title}</span>
                                <span className="shrink-0 rounded-sm bg-neutral-100 px-1.5 text-[10px] font-semibold text-neutral-600">
                                  {KIND_LABEL[e.kind]}
                                </span>
                              </span>
                              <span className="flex shrink-0 items-center gap-2">
                                <StatusBadge status={e.status} />
                                {href ? (
                                  <ExternalLink className="size-3.5 text-neutral-400" aria-hidden />
                                ) : null}
                              </span>
                            </>
                          )
                          return (
                            <li
                              key={`${e.kind}:${e.id}`}
                              className="border-b border-neutral-100 last:border-b-0"
                            >
                              {href ? (
                                <a
                                  href={href}
                                  className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50"
                                >
                                  {Inner}
                                </a>
                              ) : (
                                <div className="flex items-center gap-3 px-4 py-3">{Inner}</div>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>

        <footer className="border-t border-neutral-200 bg-white px-6 py-3 text-xs text-neutral-600">
          <p>
            Klikk på en ressurs for å åpne den.{' '}
            <span style={{ color: FOREST }} className="font-semibold">
              ESC
            </span>{' '}
            for å lukke.
          </p>
        </footer>
      </div>
    </div>
  )
}
