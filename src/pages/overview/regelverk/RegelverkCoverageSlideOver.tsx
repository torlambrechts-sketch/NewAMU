// Drill-down for ett krav: full §-tekst, plikt-grunnlag, dekningsmatrise
// gruppert per modul med direkte lenker. Åpnes fra tabellen.
//
// Etter compliance-officer-revisjon skiller vi tydelig mellom:
//   - INNHOLD: kurs/dokument/sjekkliste/survey/møte — teller som dekning
//   - OPERASJONELT: avvik (task) — registrert brudd, ikke dekning

import { useEffect } from 'react'
import { ExternalLink, X } from 'lucide-react'
import {
  CONTENT_AXES,
  KIND_LABEL,
  OPERATIONAL_AXES,
  obligationLabel,
  type RequirementWithCoverage,
} from './regelverkCoverageTypes'
import type { CoverageEntry } from '../../../hooks/useRegelverkCoverage'

const FOREST = '#1a3d32'
const CREAM = '#F9F7F2'
const SERIF = "'Libre Baskerville', Georgia, serif"

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

function EntryRow({ e }: { e: CoverageEntry }) {
  const href = entryHref(e)
  const inner = (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm text-neutral-900">{e.title}</span>
        <span className="shrink-0 rounded-sm bg-neutral-100 px-1.5 text-[10px] font-semibold text-neutral-600">
          {KIND_LABEL[e.kind]}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <StatusBadge status={e.status} />
        {href ? <ExternalLink className="size-3.5 text-neutral-400" aria-hidden /> : null}
      </span>
    </>
  )
  return (
    <li className="border-b border-neutral-100 last:border-b-0">
      {href ? (
        <a href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50">
          {inner}
        </a>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3">{inner}</div>
      )}
    </li>
  )
}

type AxisLike = ReadonlyArray<{
  id: string
  label: string
  kinds: ReadonlyArray<CoverageEntry['kind']>
}>

function AxisGroup({ axes, entries }: { axes: AxisLike; entries: CoverageEntry[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {axes.map((axis) => {
        const axisEntries = entries.filter((e) => axis.kinds.includes(e.kind))
        if (axisEntries.length === 0) return null
        return (
          <li key={axis.id} className="rounded-md border border-neutral-200 bg-white">
            <p className="border-b border-neutral-100 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
              {axis.label} · {axisEntries.length}
            </p>
            <ul>
              {axisEntries.map((e) => (
                <EntryRow key={`${e.kind}:${e.id}`} e={e} />
              ))}
            </ul>
          </li>
        )
      })}
    </ul>
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

  const contentEntries = req.coverage.filter((e) =>
    CONTENT_AXES.some((a) => a.kinds.includes(e.kind)),
  )
  const operationalEntries = req.coverage.filter((e) =>
    OPERATIONAL_AXES.some((a) => a.kinds.includes(e.kind)),
  )

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
              <p className="mt-2 text-sm leading-relaxed text-neutral-800">
                {req.description}
              </p>
            </section>
          ) : null}

          <section className="mb-6">
            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
              Preventive kontroller ({contentEntries.length})
            </p>
            {req.status === 'partial' ? (
              <div className="mt-3 rounded-md border border-amber-300 bg-amber-50/70 p-4 text-sm text-amber-950">
                <p className="font-semibold">Mangler reell proof</p>
                <p className="mt-1 text-xs text-amber-900/85">
                  Arbeidstilsynet aksepterer ikke en mal som dokumentasjon. Kravet
                  regnes som dekket først når en publisert ressurs (kurs eller
                  policy-dokument) er oppdatert i orgen siste 12 mnd.
                </p>
                <ul className="mt-2 space-y-0.5 text-xs text-amber-900/85">
                  {req.proof.templatesOnly > 0 ? (
                    <li>
                      <span className="font-semibold">{req.proof.templatesOnly}</span>{' '}
                      mal tilgjengelig — aktiver i orgen for å skape proof.
                    </li>
                  ) : null}
                  {req.proof.staleInstances > 0 ? (
                    <li>
                      <span className="font-semibold">{req.proof.staleInstances}</span>{' '}
                      instans foreldet eller utkast — gjennomgå og republiser.
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
            {contentEntries.length === 0 ? (
              <div className="mt-3 rounded-md border border-dashed border-red-300 bg-red-50/60 p-4 text-sm text-red-900">
                Ingen rutine, kurs, sjekkliste, undersøkelse eller møte-mal dekker
                kravet. Tagg en eksisterende ressurs med{' '}
                <code className="rounded bg-white px-1">{req.lawRef}</code> eller seed en ny.
              </div>
            ) : (
              <AxisGroup axes={CONTENT_AXES} entries={contentEntries} />
            )}
          </section>

          {operationalEntries.length > 0 ? (
            <section className="mb-6">
              <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                Operasjonelle signaler ({operationalEntries.length})
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Avvik registrert mot denne §. Teller ikke som dekning — viser at det
                har vært konkrete saker som krever oppfølging.
              </p>
              <AxisGroup axes={OPERATIONAL_AXES} entries={operationalEntries} />
            </section>
          ) : null}
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
