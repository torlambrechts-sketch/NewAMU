// Paragraph Inspector — slide-over for an internkontroll gap-matrix cell.
//
// Opens when the user clicks a cell in the gap-analysis heatmap. Shows:
//   1. Paragraph header (law-ref, framework + chapter)
//   2. Covering artefacts per module column (sjekkliste, undersøkelse,
//      dokument, register, læring) with direct links into each module
//      filtered by ?law_ref=
//   3. Plan items for this paragraph (Phase 3) — CRUD form + status pills
//
// The inspector reads from the parent's already-computed coverage map
// + register rows, so it doesn't trigger any new network requests for
// the artefact list. Plan items have their own hook.

import { useEffect, useMemo } from 'react'
import { ExternalLink, X } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import type { CoverageEntry } from '../../../hooks/useRegelverkCoverage'
import {
  FRAMEWORKS,
  GAP_MODULE_COLUMNS,
  type FrameworkId,
} from './frameworkParagraphs'
import type { RegisterCoverageMatch } from './useInternkontrollDatasets'
import {
  PlanItemsSection,
  type CompliancePlanItem,
} from './CompliancePlanItemsSection'

const CREAM = '#F9F7F2'
const BURGUNDY = '#7F1D1D'
const SERIF = "'Libre Baskerville', Georgia, serif"

const KIND_LABEL: Record<CoverageEntry['kind'], string> = {
  course_system: 'Systemkurs',
  course_org: 'Org-kurs',
  document: 'Dokument',
  document_template: 'Dokumentmal',
  survey: 'Undersøkelse',
  checklist_template: 'Sjekklistemal',
  checklist_item: 'Sjekklisteelement',
  ros: 'ROS',
  task: 'Oppgave',
  meeting_template: 'Møtemal',
}

function entryHref(e: CoverageEntry, lawRef: string): string {
  const enc = encodeURIComponent(lawRef)
  switch (e.kind) {
    case 'course_system':
    case 'course_org':
      return `/learning/analyse?law_ref=${enc}&course=${e.id}`
    case 'document':
      return `/documents/analyse?law_ref=${enc}&page=${e.id}`
    case 'document_template':
      return `/documents/analyse?law_ref=${enc}&template=${e.id}`
    case 'survey':
      return `/survey/analyse?law_ref=${enc}&survey=${e.id}`
    case 'checklist_template':
    case 'checklist_item':
      return `/compliance/checklists?law_ref=${enc}&template=${e.id}`
    case 'ros':
      return `/risk/register?ros=${e.id}`
    case 'task':
      return `/tasks/management/alle?task=${e.id}`
    case 'meeting_template':
      return `/meetings?template=${e.id}`
  }
}

function ArtefactRow({
  e,
  lawRef,
}: {
  e: CoverageEntry
  lawRef: string
}) {
  const href = entryHref(e, lawRef)
  return (
    <li className="border-b border-neutral-100 last:border-b-0">
      <a
        href={href}
        className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-neutral-50"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-sm text-neutral-900">{e.title}</span>
          <span className="shrink-0 rounded-sm bg-neutral-100 px-1.5 text-[10px] font-semibold text-neutral-600">
            {KIND_LABEL[e.kind]}
          </span>
          {e.source === 'template' ? (
            <span className="shrink-0 rounded-sm bg-amber-50 px-1.5 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
              Mal
            </span>
          ) : (
            <span className="shrink-0 rounded-sm bg-emerald-50 px-1.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
              Publisert
            </span>
          )}
        </span>
        <ExternalLink className="size-3.5 shrink-0 text-neutral-400" aria-hidden />
      </a>
    </li>
  )
}

function RegisterRow({
  match,
  lawRef,
}: {
  match: RegisterCoverageMatch
  lawRef: string
}) {
  const href = `/registers/analyse?law_ref=${encodeURIComponent(lawRef)}&type=${match.id}`
  return (
    <li className="border-b border-neutral-100 last:border-b-0">
      <a
        href={href}
        className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-neutral-50"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-sm text-neutral-900">{match.label}</span>
          <span className="shrink-0 rounded-sm bg-neutral-100 px-1.5 text-[10px] font-semibold text-neutral-600">
            Registertype
          </span>
        </span>
        <ExternalLink className="size-3.5 shrink-0 text-neutral-400" aria-hidden />
      </a>
    </li>
  )
}

export function ParagraphInspectorPanel({
  open,
  framework,
  lawRef,
  entries,
  registerMatches,
  planItems,
  onClose,
  onCreatePlanItem,
  onUpdatePlanItem,
  onDeletePlanItem,
}: {
  open: boolean
  framework: FrameworkId
  lawRef: string | null
  entries: CoverageEntry[]
  registerMatches: RegisterCoverageMatch[]
  planItems: CompliancePlanItem[]
  onClose: () => void
  onCreatePlanItem: (input: { title: string; description: string; status: CompliancePlanItem['status']; dueAt: string | null }) => Promise<void>
  onUpdatePlanItem: (id: string, patch: Partial<Pick<CompliancePlanItem, 'title' | 'description' | 'status' | 'due_at'>>) => Promise<void>
  onDeletePlanItem: (id: string) => Promise<void>
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const def = FRAMEWORKS[framework]
  const paragraphMeta = useMemo(
    () => def.paragraphs.find((p) => p.code === lawRef),
    [def, lawRef],
  )

  // Group entries by module column.
  const entriesByModule = useMemo(() => {
    const out = new Map<string, CoverageEntry[]>()
    for (const col of GAP_MODULE_COLUMNS) {
      if (col.id === 'registers') continue
      out.set(col.label, entries.filter((e) => col.kinds.includes(e.kind)))
    }
    return out
  }, [entries])

  if (!open || !lawRef) return null

  const totalArtefacts = entries.length + registerMatches.length

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 cursor-pointer bg-neutral-900/30"
      />
      <div
        className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-neutral-200 shadow-2xl"
        style={{ backgroundColor: CREAM }}
      >
        <header className="flex items-start justify-between gap-3 border-b border-neutral-200 bg-white px-6 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
              {def.shortLabel} · {paragraphMeta?.chapter ?? 'Paragraf'}
            </p>
            <h2
              className="mt-1 truncate text-2xl font-semibold text-neutral-900"
              style={{ fontFamily: SERIF }}
            >
              {lawRef}
            </h2>
            {paragraphMeta?.title ? (
              <p className="mt-1 text-sm text-neutral-700">{paragraphMeta.title}</p>
            ) : (
              <p className="mt-1 text-sm text-neutral-500">
                {def.fullLabel}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Lukk"
            className="h-auto w-auto shrink-0 rounded-md p-2 text-neutral-500 hover:bg-neutral-100"
          >
            <X className="size-5" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Status summary */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
                totalArtefacts === 0
                  ? 'bg-red-50 text-red-900 ring-red-200'
                  : 'bg-emerald-50 text-emerald-900 ring-emerald-200'
              }`}
            >
              {totalArtefacts === 0
                ? 'Udekket'
                : `${totalArtefacts} dekkende ressurs${totalArtefacts === 1 ? '' : 'er'}`}
            </span>
            {planItems.length > 0 ? (
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-900 ring-1 ring-inset ring-blue-200">
                {planItems.length === 1
                  ? '1 planlagt tiltak'
                  : `${planItems.length} planlagte tiltak`}
              </span>
            ) : null}
          </div>

          {/* Coverage per module */}
          <section className="mb-6">
            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
              Dekkende ressurser
            </p>
            {totalArtefacts === 0 ? (
              <div className="mt-3 rounded-md border border-dashed border-red-300 bg-red-50/60 p-4 text-sm text-red-900">
                Ingen sjekkliste, undersøkelse, dokument, register eller læringskurs
                refererer til <code className="rounded bg-white px-1">{lawRef}</code>. Tagg en
                eksisterende ressurs eller seed en mal — eller legg til et planlagt tiltak
                under.
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {[...entriesByModule.entries()].map(([label, list]) =>
                  list.length === 0 ? null : (
                    <div
                      key={label}
                      className="overflow-hidden rounded-md border border-neutral-200 bg-white"
                    >
                      <p className="border-b border-neutral-100 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                        {label} · {list.length}
                      </p>
                      <ul>
                        {list.map((e) => (
                          <ArtefactRow key={`${e.kind}:${e.id}`} e={e} lawRef={lawRef} />
                        ))}
                      </ul>
                    </div>
                  ),
                )}
                {registerMatches.length > 0 ? (
                  <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
                    <p className="border-b border-neutral-100 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                      Register · {registerMatches.length}
                    </p>
                    <ul>
                      {registerMatches.map((m) => (
                        <RegisterRow key={m.id} match={m} lawRef={lawRef} />
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </section>

          {/* Plan items (Phase 3) */}
          <PlanItemsSection
            items={planItems}
            onCreate={onCreatePlanItem}
            onUpdate={onUpdatePlanItem}
            onDelete={onDeletePlanItem}
          />
        </div>

        <footer className="border-t border-neutral-200 bg-white px-6 py-3 text-xs text-neutral-600">
          <p>
            Klikk en ressurs for å åpne den i modulen.{' '}
            <span style={{ color: BURGUNDY }} className="font-semibold">
              ESC
            </span>{' '}
            for å lukke.
          </p>
        </footer>
      </div>
    </div>
  )
}
