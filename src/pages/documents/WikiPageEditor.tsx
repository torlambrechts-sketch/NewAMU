import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Accessibility,
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  Eye, GripVertical, Loader2, Save, Trash2,
} from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { RichTextEditor } from '../../components/learning/RichTextEditor'
import { DocumentsModuleLayout } from '../../components/documents/DocumentsModuleLayout'
import type { AcknowledgementAudience, ContentBlock, ModuleBlock, WikiPageLang } from '../../types/documents'
import { runWikiWcagHeuristics } from '../../lib/wikiA11yHeuristics'

type AddKind = ContentBlock['kind']

const ADD_BLOCKS: { kind: AddKind; label: string; icon: string }[] = [
  { kind: 'heading', label: 'Overskrift', icon: 'H' },
  { kind: 'text', label: 'Tekst', icon: '¶' },
  { kind: 'alert', label: 'Varselboks', icon: '⚠' },
  { kind: 'divider', label: 'Skillelinje', icon: '—' },
  { kind: 'law_ref', label: 'Lovhenvisning', icon: '§' },
  { kind: 'image', label: 'Bilde', icon: '🖼' },
  { kind: 'module', label: 'Dynamisk widget', icon: '⚡' },
]

const MODULE_OPTIONS: { name: ModuleBlock['moduleName']; label: string }[] = [
  { name: 'live_org_chart', label: 'Live organisasjonskart (AMU/Verneombud)' },
  { name: 'live_risk_feed', label: 'Live risikooversikt (ROS)' },
  { name: 'action_button', label: 'Handlingsknapp' },
  { name: 'acknowledgement_footer', label: 'Lest og forstått (signatur)' },
]

function emptyBlock(kind: AddKind): ContentBlock {
  switch (kind) {
    case 'heading': return { kind: 'heading', level: 2, text: 'Ny overskrift' }
    case 'text': return { kind: 'text', body: '<p>Skriv her…</p>' }
    case 'alert': return { kind: 'alert', variant: 'info', text: 'Tekst her' }
    case 'divider': return { kind: 'divider' }
    case 'law_ref': return { kind: 'law_ref', ref: '', description: '' }
    case 'image': return { kind: 'image', url: '', alt: '', caption: '', width: 'full' }
    case 'module': return { kind: 'module', moduleName: 'live_org_chart', params: {} }
    default: return { kind: 'text', body: '' }
  }
}

export function WikiPageEditor() {
  const { pageId } = useParams<{ pageId: string }>()
  const navigate = useNavigate()
  const docs = useDocuments()
  const { ensurePageLoaded, pageHydrateLoading, pageHydrateError } = docs
  const { departments, supabase, organization } = useOrgSetupContext()

  const original = docs.pages.find((p) => p.id === pageId)
  const space = original ? docs.spaces.find((s) => s.id === original.spaceId) : null

  const hydratedKeyRef = useRef<string | null>(null)

  const [title, setTitle] = useState(() => original?.title ?? '')
  const [summary, setSummary] = useState(() => original?.summary ?? '')
  const [blocks, setBlocks] = useState<ContentBlock[]>(() => original?.blocks ?? [])
  const [legalRefs, setLegalRefs] = useState(() =>
    (Array.isArray(original?.legalRefs) ? original.legalRefs : []).join(', '),
  )
  const [requiresAck, setRequiresAck] = useState(() => original?.requiresAcknowledgement ?? false)
  const [ackAudience, setAckAudience] = useState<AcknowledgementAudience>(
    () => original?.acknowledgementAudience ?? 'all_employees',
  )
  const [ackDeptId, setAckDeptId] = useState(() => original?.acknowledgementDepartmentId ?? '')
  const [revisionMonths, setRevisionMonths] = useState(() => String(original?.revisionIntervalMonths ?? 12))
  const [nextRevision, setNextRevision] = useState(() =>
    original?.nextRevisionDueAt ? original.nextRevisionDueAt.slice(0, 10) : '',
  )
  const [template, setTemplate] = useState<'standard' | 'wide' | 'policy'>(() => original?.template ?? 'standard')
  const [dirty, setDirty] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [pageLang, setPageLang] = useState<WikiPageLang>(() => original?.lang ?? 'nb')
  const [a11yOpen, setA11yOpen] = useState(false)
  const [a11yWarnings, setA11yWarnings] = useState<string[]>([])

  // useState initializers only run once; when `original` loads after the first render (async fetch),
  // we must hydrate form state or the editor stays blank.
  useLayoutEffect(() => {
    if (!pageId || !original) return
    const key = `${pageId}:${original.id}`
    if (hydratedKeyRef.current === key) return
    hydratedKeyRef.current = key
    const o = original
    queueMicrotask(() => {
      setTitle(o.title ?? '')
      setSummary(o.summary ?? '')
      setBlocks(Array.isArray(o.blocks) ? o.blocks : [])
      setLegalRefs((Array.isArray(o.legalRefs) ? o.legalRefs : []).join(', '))
      setRequiresAck(o.requiresAcknowledgement ?? false)
      setAckAudience(o.acknowledgementAudience ?? 'all_employees')
      setAckDeptId(o.acknowledgementDepartmentId ?? '')
      setRevisionMonths(String(o.revisionIntervalMonths ?? 12))
      setNextRevision(o.nextRevisionDueAt ? o.nextRevisionDueAt.slice(0, 10) : '')
      setTemplate(
        o.template === 'wide' || o.template === 'policy' || o.template === 'standard'
          ? o.template
          : 'standard',
      )
      setPageLang(o.lang === 'nn' || o.lang === 'en' ? o.lang : o.lang === 'nb' ? 'nb' : 'nb')
      setDirty(false)
      setSavedMsg(false)
      setSelectedIdx(null)
    })
  }, [pageId, original])

  useEffect(() => {
    void ensurePageLoaded(pageId)
  }, [ensurePageLoaded, pageId])

  if (pageHydrateError && !original) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-12 text-center">
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{pageHydrateError}</p>
        <Link to="/documents" className="mt-4 inline-block text-[#1a3d32] underline">
          ← Tilbake til dokumenter
        </Link>
      </div>
    )
  }

  if ((docs.loading || pageHydrateLoading) && !original) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-neutral-600">
        <Loader2 className="size-8 animate-spin text-[#1a3d32]" aria-hidden />
        <p className="text-sm">Laster redigeringsdata…</p>
      </div>
    )
  }

  if (docs.error && !original) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-12 text-center">
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{docs.error}</p>
        <Link to="/documents" className="mt-4 inline-block text-[#1a3d32] underline">
          ← Tilbake til dokumenter
        </Link>
      </div>
    )
  }

  if (!original) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-12 text-center text-neutral-500">
        Side ikke funnet. <Link to="/documents" className="text-[#1a3d32] underline">← Tilbake</Link>
      </div>
    )
  }

  function markDirty() { setDirty(true); setSavedMsg(false) }

  function updateBlock(idx: number, patch: Partial<ContentBlock>) {
    setBlocks((b) => b.map((bl, i) => i === idx ? { ...bl, ...patch } as ContentBlock : bl))
    markDirty()
  }

  function addBlock(kind: AddKind) {
    const newBlock = emptyBlock(kind)
    setBlocks((b) => [...b, newBlock])
    setSelectedIdx(blocks.length)
    markDirty()
  }

  function removeBlock(idx: number) {
    setBlocks((b) => b.filter((_, i) => i !== idx))
    setSelectedIdx(null)
    markDirty()
  }

  function moveBlock(idx: number, dir: -1 | 1) {
    const next = [...blocks]
    const target = idx + dir
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]]
    setBlocks(next)
    setSelectedIdx(target)
    markDirty()
  }

  async function handleSave() {
    if (!original) return
    const months = Math.max(1, parseInt(revisionMonths, 10) || 12)
    await docs.updatePage(original.id, {
      title: title.trim() || original.title,
      summary,
      blocks,
      legalRefs: legalRefs.split(',').map((s) => s.trim()).filter(Boolean),
      requiresAcknowledgement: requiresAck,
      template,
      acknowledgementAudience: ackAudience,
      acknowledgementDepartmentId: ackAudience === 'department' ? (ackDeptId || null) : null,
      revisionIntervalMonths: months,
      nextRevisionDueAt: nextRevision ? new Date(`${nextRevision}T12:00:00`).toISOString() : null,
      lang: pageLang,
    })
    setDirty(false)
    setSavedMsg(true)
  }

  async function handlePublish() {
    if (!original) return
    const heuristics = runWikiWcagHeuristics(blocks)
    let langMismatchNote = ''
    if (requiresAck && pageLang === 'nb' && supabase && organization?.id) {
      const { data: profs, error } = await supabase
        .from('profiles')
        .select('id, locale')
        .eq('organization_id', organization.id)
      if (!error && profs && profs.length > 0) {
        const nonNo = profs.filter((row: { locale?: string | null }) => {
          const raw = (row.locale ?? '').trim().toLowerCase()
          if (!raw) return false
          const base = raw.split('-')[0] ?? raw
          return base !== 'nb' && base !== 'nn'
        })
        if (nonNo.length > 0) {
          langMismatchNote = `${nonNo.length} medlem(mer) har foretrukket språk i profilen som ikke er bokmål/nynorsk, mens dokumentet er på bokmål og krever bekreftelse. Vurder oversettelse eller språkvalg.`
        }
      }
    }
    const combined = [...heuristics, ...(langMismatchNote ? [langMismatchNote] : [])]
    if (combined.length > 0) {
      const ok = window.confirm(
        'Før publisering — tilgjengelighet og språk:\n\n' +
          combined.map((w, i) => `${i + 1}. ${w}`).join('\n') +
          '\n\nVil du publisere likevel?',
      )
      if (!ok) return
    }
    await handleSave()
    await docs.publishPage(original.id)
    navigate(`/documents/page/${original.id}`)
  }

  function runA11yCheck() {
    setA11yWarnings(runWikiWcagHeuristics(blocks))
    setA11yOpen(true)
  }

  return (
    <DocumentsModuleLayout
      subHeader={
        <nav className="mt-6 flex flex-wrap items-center gap-2 border-b border-neutral-200/80 pb-6 text-sm text-neutral-600">
          <Link to="/documents" className="text-neutral-500 hover:text-[#1a3d32]">
            Bibliotek
          </Link>
          <span className="text-neutral-400">→</span>
          {space && (
            <>
              <Link to={`/documents/space/${space.id}`} className="text-neutral-500 hover:text-[#1a3d32]">
                {space.title}
              </Link>
              <span className="text-neutral-400">→</span>
            </>
          )}
          <span className="font-medium text-neutral-800">{original.title}</span>
          <span className="ml-1 rounded-none border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
            Redigerer
          </span>
        </nav>
      }
    >
      <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-neutral-200 pb-3">
        <button
          type="button"
          onClick={runA11yCheck}
          className="inline-flex items-center gap-1.5 rounded-none border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
        >
          <Accessibility className="size-3.5 shrink-0" aria-hidden />
          Tilgjengelighetssjekk
        </button>
      </div>

      {a11yOpen ? (
        <div
          className="mt-3 rounded-none border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950"
          role="region"
          aria-label="Tilgjengelighet — resultat av heuristisk sjekk"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">Resultat (heuristikk)</p>
            <button type="button" className="text-xs text-amber-900 underline" onClick={() => setA11yOpen(false)}>
              Lukk
            </button>
          </div>
          {a11yWarnings.length === 0 ? (
            <p className="mt-2 text-xs text-amber-900">
              Ingen åpenbare problemer funnet. Kontroller manuelt før publisering.
            </p>
          ) : (
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-amber-950">
              {a11yWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* ── Left: editor ──────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Title + summary */}
          <div className="rounded-none border border-neutral-200/90 bg-white p-5 shadow-sm">
            <label className="text-xs font-medium text-neutral-500">Tittel</label>
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); markDirty() }}
              className="mt-1 w-full rounded-none border border-neutral-200 px-3 py-2 text-base font-semibold focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
            />
            <label className="mt-3 block text-xs font-medium text-neutral-500">Kort beskrivelse</label>
            <input
              value={summary}
              onChange={(e) => { setSummary(e.target.value); markDirty() }}
              className="mt-1 w-full rounded-none border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
              placeholder="Valgfri beskrivelse vist i mappevisningen"
            />
            <div className="mt-3">
              <label htmlFor="wiki-page-lang" className="text-xs font-medium text-neutral-500">
                Dokumentspråk
              </label>
              <select
                id="wiki-page-lang"
                value={pageLang}
                onChange={(e) => {
                  setPageLang(e.target.value as WikiPageLang)
                  markDirty()
                }}
                className="mt-1 w-full rounded-none border border-neutral-200 px-2 py-1.5 text-sm"
              >
                <option value="nb">Bokmål (nb)</option>
                <option value="nn">Nynorsk (nn)</option>
                <option value="en">Engelsk (en)</option>
              </select>
              <p className="mt-1 text-[11px] text-neutral-500">Setter språk på innholdet (WCAG).</p>
            </div>
          </div>

          {/* Block list */}
          <div className="space-y-2">
            {blocks.map((block, idx) => (
              <BlockItem
                key={idx}
                block={block}
                selected={selectedIdx === idx}
                onSelect={() => setSelectedIdx(idx === selectedIdx ? null : idx)}
                onUpdate={(patch) => updateBlock(idx, patch)}
                onRemove={() => removeBlock(idx)}
                onMove={(dir) => moveBlock(idx, dir)}
                isFirst={idx === 0}
                isLast={idx === blocks.length - 1}
              />
            ))}
          </div>

          {/* Add block buttons */}
          <div className="flex flex-wrap gap-2 rounded-none border border-dashed border-neutral-300 bg-white p-3">
            <span className="w-full text-xs font-medium text-neutral-400">Legg til blokk</span>
            {ADD_BLOCKS.map((a) => (
              <button
                key={a.kind}
                type="button"
                onClick={() => addBlock(a.kind)}
                className="inline-flex items-center gap-1.5 rounded-none border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                <span className="font-mono text-neutral-400">{a.icon}</span>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Right: settings + actions ─────────────────────────────────── */}
        <div className="space-y-4">
          <div className="rounded-none border border-neutral-200/90 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-neutral-700">Sidestatus</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-neutral-500">Layout</label>
                <select
                  value={template}
                  onChange={(e) => { setTemplate(e.target.value as typeof template); markDirty() }}
                  className="mt-1 w-full rounded-none border border-neutral-200 px-2 py-1.5 text-sm"
                >
                  <option value="standard">Standard</option>
                  <option value="wide">Bred</option>
                  <option value="policy">Policy (smal)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Lovhenvisninger (kommaseparert)</label>
                <input
                  value={legalRefs}
                  onChange={(e) => { setLegalRefs(e.target.value); markDirty() }}
                  placeholder="IK-f §5 nr. 1a, AML §3-1"
                  className="mt-1 w-full rounded-none border border-neutral-200 px-2 py-1.5 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={requiresAck}
                  onChange={(e) => { setRequiresAck(e.target.checked); markDirty() }}
                  className="size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]"
                />
                Krever «Lest og forstått»-signatur
              </label>
              {requiresAck && (
                <div className="space-y-2 pt-1">
                  <div>
                    <label className="text-xs font-medium text-neutral-500">Hvem skal signere?</label>
                    <select
                      value={ackAudience}
                      onChange={(e) => {
                        setAckAudience(e.target.value as AcknowledgementAudience)
                        markDirty()
                      }}
                      className="mt-1 w-full rounded-none border border-neutral-200 px-2 py-1.5 text-sm"
                    >
                      <option value="all_employees">Alle ansatte</option>
                      <option value="leaders_only">Kun ledere (org.admin)</option>
                      <option value="safety_reps_only">Kun verneombud / HMS-representant</option>
                      <option value="department">Spesifikk avdeling</option>
                    </select>
                  </div>
                  {ackAudience === 'department' && (
                    <div>
                      <label className="text-xs font-medium text-neutral-500">Avdeling</label>
                      <select
                        value={ackDeptId}
                        onChange={(e) => { setAckDeptId(e.target.value); markDirty() }}
                        className="mt-1 w-full rounded-none border border-neutral-200 px-2 py-1.5 text-sm"
                      >
                        <option value="">Velg avdeling…</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
              <div className="pt-2">
                <label className="text-xs font-medium text-neutral-500">Revisjonsintervall (måneder)</label>
                <input
                  type="number"
                  min={1}
                  value={revisionMonths}
                  onChange={(e) => { setRevisionMonths(e.target.value); markDirty() }}
                  className="mt-1 w-full rounded-none border border-neutral-200 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Neste revideringsdato (valgfri)</label>
                <input
                  type="date"
                  value={nextRevision}
                  onChange={(e) => { setNextRevision(e.target.value); markDirty() }}
                  className="mt-1 w-full rounded-none border border-neutral-200 px-2 py-1.5 text-sm"
                />
                <p className="mt-1 text-[11px] text-neutral-400">
                  Ved publisering settes neste frist automatisk ut fra intervall (IK-f §5 — systematisk gjennomgang).
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-none border border-neutral-200/90 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-neutral-700">Versjonshistorikk</h3>
            <p className="text-xs text-neutral-500">
              Hver gang du publiserer, lagres gjeldende versjon som et fryst arkiv før versjonsnummer økes.
            </p>
            {docs.versionsForPage(original.id).length === 0 ? (
              <p className="mt-2 text-xs text-neutral-400">Ingen arkiverte versjoner ennå (første publisering oppretter v1 i arkivet).</p>
            ) : (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-neutral-600">
                {docs.versionsForPage(original.id).map((v) => (
                  <li key={v.id}>
                    v{v.version} · {new Date(v.frozenAt).toLocaleDateString('no-NO')}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!dirty}
              className="flex w-full items-center justify-center gap-2 rounded-none border border-[#1a3d32] bg-[#1a3d32] py-2.5 text-sm font-medium text-white hover:bg-[#142e26] disabled:opacity-40"
            >
              <Save className="size-4" />
              Lagre utkast
            </button>
            <button
              type="button"
              onClick={() => void handlePublish()}
              className="flex w-full items-center justify-center gap-2 rounded-none border border-emerald-600 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
            >
              <CheckCircle2 className="size-4" />
              Lagre og publiser
            </button>
            <Link
              to={`/documents/page/${original.id}`}
              className="flex items-center justify-center gap-2 rounded-none border border-neutral-200 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50"
            >
              <Eye className="size-4" />
              Forhåndsvis
            </Link>
          </div>

          {savedMsg && (
            <div className="flex items-center gap-2 rounded-none border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 className="size-4" /> Lagret
            </div>
          )}
        </div>
      </div>
    </DocumentsModuleLayout>
  )
}

// ─── Block item (editor row) ──────────────────────────────────────────────────

function BlockItem({
  block, selected, onSelect, onUpdate, onRemove, onMove, isFirst, isLast,
}: {
  block: ContentBlock
  selected: boolean
  onSelect: () => void
  onUpdate: (patch: Partial<ContentBlock>) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
  isFirst: boolean
  isLast: boolean
}) {
  const kindLabel: Record<ContentBlock['kind'], string> = {
    heading: 'Overskrift', text: 'Tekst', alert: 'Varselboks',
    divider: 'Skillelinje', law_ref: 'Lovhenvisning', image: 'Bilde', module: 'Dynamisk widget',
  }
  const deleteLabel = `Slett blokk: ${kindLabel[block.kind]}`

  return (
    <div className={`rounded-none border bg-white shadow-sm ${selected ? 'border-[#1a3d32]' : 'border-neutral-200'}`}>
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded text-left focus:outline-none focus:ring-2 focus:ring-[#1a3d32]/40"
          aria-expanded={selected}
        >
          <GripVertical className="size-4 shrink-0 text-neutral-300" aria-hidden />
          <span className="truncate text-xs font-medium text-neutral-500">{kindLabel[block.kind]}</span>
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={isFirst}
            aria-label="Flytt blokk opp"
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"
          >
            <ChevronUp className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={isLast}
            aria-label="Flytt blokk ned"
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"
          >
            <ChevronDown className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={deleteLabel}
            className="rounded p-1 text-red-400 hover:bg-red-50"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>

      {selected && (
        <div className="border-t border-neutral-100 px-3 pb-3 pt-3">
          <BlockEditor block={block} onUpdate={onUpdate} />
        </div>
      )}
    </div>
  )
}

function BlockEditor({ block, onUpdate }: { block: ContentBlock; onUpdate: (p: Partial<ContentBlock>) => void }) {
  if (block.kind === 'heading') return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {([1, 2, 3] as const).map((l) => (
          <button key={l} type="button" onClick={() => onUpdate({ level: l } as Partial<ContentBlock>)}
            className={`rounded px-2 py-1 text-xs font-bold ${block.level === l ? 'bg-[#1a3d32] text-white' : 'bg-neutral-100 text-neutral-600'}`}>
            H{l}
          </button>
        ))}
      </div>
      <input value={block.text} onChange={(e) => onUpdate({ text: e.target.value } as Partial<ContentBlock>)}
        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold" />
    </div>
  )

  if (block.kind === 'text') return (
    <RichTextEditor value={block.body} onChange={(html) => onUpdate({ body: html } as Partial<ContentBlock>)} />
  )

  if (block.kind === 'alert') return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {(['info', 'warning', 'danger', 'tip'] as const).map((v) => (
          <button key={v} type="button" onClick={() => onUpdate({ variant: v } as Partial<ContentBlock>)}
            className={`rounded px-2 py-1 text-xs ${block.variant === v ? 'bg-[#1a3d32] text-white' : 'bg-neutral-100 text-neutral-600'}`}>
            {v}
          </button>
        ))}
      </div>
      <input value={block.text} onChange={(e) => onUpdate({ text: e.target.value } as Partial<ContentBlock>)}
        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
    </div>
  )

  if (block.kind === 'divider') return <p className="text-xs text-neutral-400">Visuell skillelinje — ingen innstillinger.</p>

  if (block.kind === 'image') return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-neutral-500" htmlFor="wiki-img-url">
        Bilde-URL
      </label>
      <input
        id="wiki-img-url"
        value={block.url}
        onChange={(e) => onUpdate({ url: e.target.value } as Partial<ContentBlock>)}
        placeholder="https://…"
        className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm"
      />
      <label className="text-xs font-medium text-neutral-500" htmlFor="wiki-img-alt">
        Alt-tekst
      </label>
      <input
        id="wiki-img-alt"
        value={block.alt ?? ''}
        onChange={(e) => onUpdate({ alt: e.target.value } as Partial<ContentBlock>)}
        placeholder="Beskriv bildet for skjermlesere"
        className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm"
      />
      <label className="text-xs font-medium text-neutral-500" htmlFor="wiki-img-cap">
        Bildetekst (valgfritt)
      </label>
      <input
        id="wiki-img-cap"
        value={block.caption ?? ''}
        onChange={(e) => onUpdate({ caption: e.target.value } as Partial<ContentBlock>)}
        className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm"
      />
      <div>
        <label className="text-xs font-medium text-neutral-500" htmlFor="wiki-img-width">
          Bredde
        </label>
        <select
          id="wiki-img-width"
          value={block.width ?? 'full'}
          onChange={(e) =>
            onUpdate({ width: e.target.value as 'full' | 'wide' | 'medium' } as Partial<ContentBlock>)
          }
          className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
        >
          <option value="full">Full bredde</option>
          <option value="wide">Bred</option>
          <option value="medium">Medium</option>
        </select>
      </div>
    </div>
  )

  if (block.kind === 'law_ref') return (
    <div className="space-y-2">
      <input value={block.ref} onChange={(e) => onUpdate({ ref: e.target.value } as Partial<ContentBlock>)}
        placeholder="Referanse (f.eks. IK-f §5 nr. 1a)"
        className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-mono" />
      <input value={block.description} onChange={(e) => onUpdate({ description: e.target.value } as Partial<ContentBlock>)}
        placeholder="Beskrivelse"
        className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm" />
      <input value={block.url ?? ''} onChange={(e) => onUpdate({ url: e.target.value } as Partial<ContentBlock>)}
        placeholder="URL (valgfritt)"
        className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm" />
    </div>
  )

  if (block.kind === 'module') return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-neutral-500">Modul</label>
        <select
          value={block.moduleName}
          onChange={(e) => onUpdate({ moduleName: e.target.value as ModuleBlock['moduleName'] } as Partial<ContentBlock>)}
          className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
        >
          {MODULE_OPTIONS.map((o) => <option key={o.name} value={o.name}>{o.label}</option>)}
        </select>
      </div>
      {block.moduleName === 'action_button' && (
        <div className="space-y-2">
          <input
            value={typeof block.params?.label === 'string' ? block.params.label : ''}
            onChange={(e) => onUpdate({ params: { ...block.params, label: e.target.value } } as Partial<ContentBlock>)}
            placeholder="Knappetekst"
            className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
          />
          <input
            value={typeof block.params?.route === 'string' ? block.params.route : ''}
            onChange={(e) => onUpdate({ params: { ...block.params, route: e.target.value } } as Partial<ContentBlock>)}
            placeholder="Rute (f.eks. /workplace-reporting/incidents)"
            className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
          />
        </div>
      )}
      <div className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
        <AlertTriangle className="size-3.5 shrink-0" />
        Modulen er dynamisk — den henter live data ved visning.
      </div>
    </div>
  )

  return null
}
