import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Accessibility,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  RotateCcw,
  Save,
  Settings,
  Trash2,
} from 'lucide-react'
import { useDirtyGuard } from '../../hooks/useDirtyGuard'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { TipTapRichTextEditor } from '../../components/documents/TipTapRichTextEditor'
import {
  ModuleLegalBanner,
  ModulePageShell,
  ModuleSectionCard,
} from '../../components/module'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import { SearchableSelect, type SelectOption } from '../../components/ui/SearchableSelect'
import { Badge } from '../../components/ui/Badge'
import { WarningBox } from '../../components/ui/AlertBox'
import { Tabs } from '../../components/ui/Tabs'
import { DOCUMENTS_MODULE_TITLE } from '../../data/documentsNav'
import type { AcknowledgementAudience, ContentBlock, ModuleBlock, WikiPageLang } from '../../types/documents'
import {
  GDPR_ART6_SUGGESTIONS,
  GDPR_ART9_SUGGESTIONS,
  PII_CATEGORY_OPTIONS,
} from '../../data/wikiPiiLegalBasisSuggestions'
import { runWikiWcagHeuristics } from '../../lib/wikiA11yHeuristics'
import { getSupabaseErrorMessage } from '../../lib/supabaseError'
import { ToggleSwitch } from '../../components/ui/FormToggles'

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
  { name: 'emergency_stop_procedure', label: 'Stansingsrett — verneombud (AML §6-3)' },
]

const MODULE_SELECT_OPTIONS: SelectOption[] = MODULE_OPTIONS.map((o) => ({ value: o.name, label: o.label }))

const PAGE_LANG_OPTIONS: SelectOption[] = [
  { value: 'nb', label: 'Bokmål (nb)' },
  { value: 'nn', label: 'Nynorsk (nn)' },
  { value: 'en', label: 'Engelsk (en)' },
]

const TEMPLATE_OPTIONS: SelectOption[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'wide', label: 'Bred' },
  { value: 'policy', label: 'Policy (smal)' },
]

const ACK_AUDIENCE_OPTIONS: SelectOption[] = [
  { value: 'all_employees', label: 'Alle ansatte' },
  { value: 'leaders_only', label: 'Kun ledere (org.admin)' },
  { value: 'safety_reps_only', label: 'Kun verneombud / HMS-representant' },
  { value: 'department', label: 'Spesifikk avdeling' },
]

const IMAGE_WIDTH_OPTIONS: SelectOption[] = [
  { value: 'full', label: 'Full bredde' },
  { value: 'wide', label: 'Bred' },
  { value: 'medium', label: 'Medium' },
]

type EditTab = 'innhold' | 'innstillinger'

function editorStatusBadgeVariant(s: 'draft' | 'published' | 'archived'): 'draft' | 'success' | 'neutral' {
  if (s === 'published') return 'success'
  if (s === 'draft') return 'draft'
  return 'neutral'
}

const EDITOR_STATUS_LABEL: Record<'draft' | 'published' | 'archived', string> = {
  published: 'Publisert',
  draft: 'Utkast',
  archived: 'Arkivert',
}

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
  const { ensurePageLoaded, pageHydrateLoading, pageHydrateError, documentsCatalogHydrated } = docs
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
  const [containsPii, setContainsPii] = useState(() => original?.containsPii ?? false)
  const [piiCategories, setPiiCategories] = useState<string[]>(() =>
    Array.isArray(original?.piiCategories) ? [...original.piiCategories] : [],
  )
  const [piiLegalBasis, setPiiLegalBasis] = useState(() => original?.piiLegalBasis ?? '')
  const [piiRetentionNote, setPiiRetentionNote] = useState(() => original?.piiRetentionNote ?? '')
  const [retentionSlug, setRetentionSlug] = useState(() => original?.retentionCategory ?? '')
  const [retainMinYearsStr, setRetainMinYearsStr] = useState(() =>
    original?.retainMinimumYears != null ? String(original.retainMinimumYears) : '',
  )
  const [retainMaxYearsStr, setRetainMaxYearsStr] = useState(() =>
    original?.retainMaximumYears != null ? String(original.retainMaximumYears) : '',
  )
  const [retentionAutoFilled, setRetentionAutoFilled] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const saveErrorRef = useRef<HTMLDivElement>(null)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [pageLang, setPageLang] = useState<WikiPageLang>(() => original?.lang ?? 'nb')
  const [a11yOpen, setA11yOpen] = useState(false)
  const [a11yWarnings, setA11yWarnings] = useState<string[]>([])
  const [editTab, setEditTab] = useState<EditTab>('innhold')

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
      setContainsPii(o.containsPii ?? false)
      setPiiCategories(Array.isArray(o.piiCategories) ? [...o.piiCategories] : [])
      setPiiLegalBasis(o.piiLegalBasis ?? '')
      setPiiRetentionNote(o.piiRetentionNote ?? '')
      setRetentionSlug(o.retentionCategory ?? '')
      setRetainMinYearsStr(o.retainMinimumYears != null ? String(o.retainMinimumYears) : '')
      setRetainMaxYearsStr(o.retainMaximumYears != null ? String(o.retainMaximumYears) : '')
      setPageLang(o.lang === 'nn' || o.lang === 'en' ? o.lang : o.lang === 'nb' ? 'nb' : 'nb')
      setDirty(false)
      setSavedMsg(false)
      setSelectedIdx(null)
    })
  }, [pageId, original])

  useEffect(() => {
    void ensurePageLoaded(pageId)
  }, [ensurePageLoaded, pageId])

  const selectedRetention = useMemo(
    () => docs.wikiRetentionCategories.find((c) => c.slug === retentionSlug) ?? null,
    [docs.wikiRetentionCategories, retentionSlug],
  )

  const retentionSelectOptions = useMemo((): SelectOption[] => {
    return [
      { value: '', label: '— Velg —' },
      ...docs.wikiRetentionCategories.map((c) => ({ value: c.slug, label: c.label })),
    ]
  }, [docs.wikiRetentionCategories])

  const deptOptions = useMemo((): SelectOption[] => {
    return [{ value: '', label: 'Velg avdeling…' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]
  }, [departments])

  useDirtyGuard(dirty)

  if (pageHydrateError && !original) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: DOCUMENTS_MODULE_TITLE, to: '/documents' }]}
        title="Rediger dokument"
      >
        <WarningBox>{pageHydrateError}</WarningBox>
        <Button type="button" variant="secondary" className="mt-4" onClick={() => navigate('/documents')}>
          Tilbake til bibliotek
        </Button>
      </ModulePageShell>
    )
  }

  if ((pageHydrateLoading || (!original && !documentsCatalogHydrated)) && !original) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: DOCUMENTS_MODULE_TITLE, to: '/documents' }]}
        title="Laster redigering…"
        loading
        loadingLabel="Laster redigeringsdata…"
      >
        {null}
      </ModulePageShell>
    )
  }

  if (docs.error && !original) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: DOCUMENTS_MODULE_TITLE, to: '/documents' }]}
        title="Rediger dokument"
      >
        <WarningBox>{docs.error}</WarningBox>
        <Button type="button" variant="secondary" className="mt-4" onClick={() => navigate('/documents')}>
          Tilbake til bibliotek
        </Button>
      </ModulePageShell>
    )
  }

  if (!original) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: DOCUMENTS_MODULE_TITLE, to: '/documents' }]}
        title="Rediger dokument"
        notFound={{
          title: 'Side ikke funnet',
          backLabel: '← Tilbake til bibliotek',
          onBack: () => navigate('/documents'),
        }}
      >
        {null}
      </ModulePageShell>
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

  async function handleSave(): Promise<boolean> {
    if (!original) return false
    setSaveError(null)
    setSaving(true)
    const months = Math.max(1, parseInt(revisionMonths, 10) || 12)
    try {
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
        containsPii,
        piiCategories: containsPii ? piiCategories : [],
        piiLegalBasis: containsPii ? (piiLegalBasis.trim() || null) : null,
        piiRetentionNote: containsPii ? (piiRetentionNote.trim() || null) : null,
        retentionCategory: retentionSlug.trim() || null,
        retainMinimumYears: retainMinYearsStr.trim()
          ? Math.max(0, parseInt(retainMinYearsStr, 10) || 0) || null
          : null,
        retainMaximumYears: retainMaxYearsStr.trim()
          ? Math.max(0, parseInt(retainMaxYearsStr, 10) || 0) || null
          : null,
        lang: pageLang,
      })
      setDirty(false)
      setSavedMsg(true)
      return true
    } catch (e) {
      const msg = getSupabaseErrorMessage(e)
      setSaveError(msg)
      queueMicrotask(() => saveErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      return false
    } finally {
      setSaving(false)
    }
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
    try {
      const saved = await handleSave()
      if (!saved) return
      await docs.publishPage(original.id)
      navigate(`/documents/page/${original.id}`)
    } catch (e) {
      setSaveError(getSupabaseErrorMessage(e))
    }
  }

  function runA11yCheck() {
    setA11yWarnings(runWikiWcagHeuristics(blocks))
    setA11yOpen(true)
  }

  const editTabItems = [
    { id: 'innhold', label: 'Innhold', icon: FileText },
    { id: 'innstillinger', label: 'Innstillinger', icon: Settings },
  ]

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'HMS' },
        { label: DOCUMENTS_MODULE_TITLE, to: '/documents' },
        ...(space ? [{ label: space.title, to: `/documents/space/${space.id}` }] : []),
        { label: original.title, to: `/documents/page/${original.id}` },
        { label: 'Rediger' },
      ]}
      title={`Rediger: ${original.title}`}
      description={
        <p className="max-w-3xl text-sm text-neutral-600">
          Utkast og publisering følger internkontrollforskriften § 5 — dokumentasjon skal være tilgjengelig, oppdatert og
          revidert etter behov.
        </p>
      }
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={editorStatusBadgeVariant(original.status)} className="text-xs">
            {EDITOR_STATUS_LABEL[original.status]}
          </Badge>
          <Button type="button" variant="secondary" disabled={saving} icon={<Eye className="h-4 w-4" />} onClick={() => navigate(`/documents/page/${original.id}`)}>
            Forhåndsvis
          </Button>
          <Button type="button" variant="secondary" disabled={saving || !dirty} icon={<Save className="h-4 w-4" />} onClick={() => void handleSave()}>
            {saving ? 'Lagrer…' : 'Lagre utkast'}
          </Button>
          <Button type="button" variant="primary" disabled={saving} icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => void handlePublish()}>
            {saving ? 'Lagrer…' : 'Lagre og publiser'}
          </Button>
        </div>
      }
      tabs={<Tabs items={editTabItems} activeId={editTab} onChange={(id) => setEditTab(id as EditTab)} />}
    >
      <ModuleLegalBanner
        title="Dokumentasjon og revisjon"
        references={[
          {
            code: 'IK-forskriften § 5',
            text: (
              <>
                Virksomheten skal systematisk sikre at lover og forskrifter blir fulgt — dokumentert, tilgjengelig og
                revidert etter behov.
              </>
            ),
          },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 pb-3">
        <Button type="button" variant="secondary" size="sm" icon={<Accessibility className="h-4 w-4" />} onClick={runA11yCheck}>
          Tilgjengelighetssjekk
        </Button>
      </div>

      {a11yOpen ? (
        <div
          className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="region"
          aria-label="Tilgjengelighet — resultat av heuristisk sjekk"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">Resultat (heuristikk)</p>
            <Button type="button" variant="ghost" size="sm" className="text-amber-900" onClick={() => setA11yOpen(false)}>
              Lukk
            </Button>
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

      {savedMsg ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          Lagret
        </div>
      ) : null}

      {saveError ? (
        <div ref={saveErrorRef} className="mt-3">
          <WarningBox>
            <div className="flex items-start justify-between gap-3">
              <span>{saveError}</span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<RotateCcw className="size-3" aria-hidden />}
                onClick={() => void handleSave()}
                className="shrink-0 border-amber-400 text-amber-900 hover:bg-amber-50"
              >
                Prøv igjen
              </Button>
            </div>
          </WarningBox>
        </div>
      ) : null}

      {editTab === 'innhold' ? (
      <div className="mt-6 space-y-4">
        <ModuleSectionCard>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="wiki-editor-title">
                Tittel
              </label>
              <StandardInput
                id="wiki-editor-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  markDirty()
                }}
                className="text-base font-semibold"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="wiki-editor-summary">
                Kort beskrivelse
              </label>
              <StandardInput
                id="wiki-editor-summary"
                value={summary}
                onChange={(e) => {
                  setSummary(e.target.value)
                  markDirty()
                }}
                placeholder="Valgfri beskrivelse vist i mappevisningen"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="wiki-page-lang">
                Dokumentspråk
              </label>
              <SearchableSelect
                value={pageLang}
                options={PAGE_LANG_OPTIONS}
                onChange={(v) => {
                  setPageLang(v as WikiPageLang)
                  markDirty()
                }}
              />
              <p className="mt-1 text-[11px] text-neutral-500">Setter språk på innholdet (WCAG).</p>
            </div>
          </div>
        </ModuleSectionCard>

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

        <div className="flex flex-wrap gap-2 rounded-lg border border-dashed border-neutral-300 bg-white p-3">
          <span className="w-full text-xs font-medium text-neutral-400">Legg til blokk</span>
          {ADD_BLOCKS.map((a) => (
            <Button key={a.kind} type="button" variant="secondary" size="sm" onClick={() => addBlock(a.kind)}>
              <span className="mr-1 font-mono text-neutral-400">{a.icon}</span>
              {a.label}
            </Button>
          ))}
        </div>
      </div>
      ) : (
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* ── Presentasjon ── */}
          <ModuleSectionCard>
            <h3 className="mb-4 border-b border-neutral-100 pb-2 text-sm font-semibold text-neutral-900">Presentasjon</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-500">Layout</label>
                <SearchableSelect
                  value={template}
                  options={TEMPLATE_OPTIONS}
                  onChange={(v) => {
                    setTemplate(v as typeof template)
                    markDirty()
                  }}
                />
              </div>
            </div>
          </ModuleSectionCard>

          {/* ── Signatur og bekreftelse ── */}
          <ModuleSectionCard>
            <h3 className="mb-4 border-b border-neutral-100 pb-2 text-sm font-semibold text-neutral-900">Signatur og bekreftelse</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-neutral-700">Krever «Lest og forstått»-signatur</span>
                <ToggleSwitch
                  checked={requiresAck}
                  onChange={(v) => {
                    setRequiresAck(v)
                    markDirty()
                  }}
                  label="Krever «Lest og forstått»-signatur"
                />
              </div>
              <div className={`space-y-3 border-t border-neutral-100 pt-3 transition-opacity ${requiresAck ? '' : 'pointer-events-none opacity-40'}`}>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500">Hvem skal signere?</label>
                  <SearchableSelect
                    value={ackAudience}
                    options={ACK_AUDIENCE_OPTIONS}
                    onChange={(v) => {
                      setAckAudience(v as AcknowledgementAudience)
                      markDirty()
                    }}
                  />
                </div>
                <div className={`transition-opacity ${ackAudience === 'department' ? '' : 'pointer-events-none opacity-40'}`}>
                  <label className="mb-1 block text-xs font-medium text-neutral-500">Avdeling</label>
                  <SearchableSelect
                    value={ackDeptId}
                    options={deptOptions}
                    onChange={(v) => {
                      setAckDeptId(v)
                      markDirty()
                    }}
                  />
                </div>
              </div>
            </div>
          </ModuleSectionCard>

          {/* ── Revisjon og hjemler ── */}
          <ModuleSectionCard>
            <h3 className="mb-4 border-b border-neutral-100 pb-2 text-sm font-semibold text-neutral-900">Revisjon og hjemler</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="wiki-legal-refs">
                  Lovhenvisninger (kommaseparert)
                </label>
                <StandardInput
                  id="wiki-legal-refs"
                  value={legalRefs}
                  onChange={(e) => {
                    setLegalRefs(e.target.value)
                    markDirty()
                  }}
                  placeholder="IK-f §5 nr. 1a, AML §3-1"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="wiki-revision-months">
                  Revisjonsintervall (måneder)
                </label>
                <StandardInput
                  id="wiki-revision-months"
                  type="number"
                  min={1}
                  value={revisionMonths}
                  onChange={(e) => {
                    setRevisionMonths(e.target.value)
                    markDirty()
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="wiki-next-revision">
                  Neste revideringsdato (valgfri)
                </label>
                <StandardInput
                  id="wiki-next-revision"
                  type="date"
                  value={nextRevision}
                  onChange={(e) => {
                    setNextRevision(e.target.value)
                    markDirty()
                  }}
                />
                <p className="mt-1 text-[11px] text-neutral-400">
                  Ved publisering settes neste frist automatisk ut fra intervall (IK-f §5 — systematisk gjennomgang).
                </p>
              </div>
            </div>
          </ModuleSectionCard>

          <ModuleSectionCard>
            <h3 className="mb-4 border-b border-neutral-100 pb-2 text-sm font-semibold text-neutral-900">
              Dokumentklassifisering
            </h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="wiki-retention-cat">
                  Oppbevaringskategori
                </label>
                <SearchableSelect
                  value={retentionSlug}
                  options={retentionSelectOptions}
                  onChange={(v) => {
                    setRetentionSlug(v)
                    const row = docs.wikiRetentionCategories.find((c) => c.slug === v)
                    if (row) {
                      setRetainMinYearsStr(String(row.minYears))
                      setRetainMaxYearsStr(row.maxYears != null ? String(row.maxYears) : '')
                      setRetentionAutoFilled(true)
                    } else {
                      setRetainMinYearsStr('')
                      setRetainMaxYearsStr('')
                      setRetentionAutoFilled(false)
                    }
                    markDirty()
                  }}
                />
              </div>
              {selectedRetention ? (
                <p className="text-xs leading-relaxed text-neutral-600">
                  Basert på{' '}
                  <span className="font-mono text-[11px] text-neutral-800">
                    {selectedRetention.legalRefs.length ? selectedRetention.legalRefs.join(', ') : 'ingen spesifikk hjemmel'}
                  </span>
                  , skal dette dokumentet oppbevares minimum <strong>{selectedRetention.minYears}</strong> år
                  {selectedRetention.maxYears != null ? (
                    <>
                      {' '}
                      (maks. <strong>{selectedRetention.maxYears}</strong> år der satt)
                    </>
                  ) : null}
                  .
                </p>
              ) : null}
              {selectedRetention?.description ? (
                <p className="text-[11px] text-neutral-500">{selectedRetention.description}</p>
              ) : null}
              {retentionAutoFilled ? (
                <p className="rounded-md bg-blue-50 px-2 py-1.5 text-xs text-blue-800">
                  Verdiene er oppdatert fra kategori. Juster manuelt om nødvendig.
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="wiki-retain-min">
                    Minimum (år)
                  </label>
                  <StandardInput
                    id="wiki-retain-min"
                    type="number"
                    min={0}
                    value={retainMinYearsStr}
                    onChange={(e) => {
                      setRetainMinYearsStr(e.target.value)
                      setRetentionAutoFilled(false)
                      markDirty()
                    }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="wiki-retain-max">
                    Maksimum (år)
                  </label>
                  <StandardInput
                    id="wiki-retain-max"
                    type="number"
                    min={0}
                    placeholder="Tom = ingen planlagt sletting"
                    value={retainMaxYearsStr}
                    onChange={(e) => {
                      setRetainMaxYearsStr(e.target.value)
                      setRetentionAutoFilled(false)
                      markDirty()
                    }}
                  />
                </div>
              </div>
              <p className="text-[11px] text-neutral-500">
                Planlagt slettedato beregnes når dokumentet er <strong>arkivert</strong> og maks. år er satt.
              </p>
            </div>
          </ModuleSectionCard>
        </div>

        <div className="space-y-4">
          <ModuleSectionCard>
            <h3 className="mb-4 border-b border-neutral-100 pb-2 text-sm font-semibold text-neutral-900">
              Personopplysninger
            </h3>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-neutral-700">Inneholder personopplysninger</span>
              <ToggleSwitch
                checked={containsPii}
                onChange={(v) => {
                  setContainsPii(v)
                  if (!v) setPiiCategories([])
                  markDirty()
                }}
                label="Inneholder personopplysninger"
              />
            </div>
            <div className={`mt-3 space-y-3 border-t border-neutral-100 pt-3 transition-opacity ${containsPii ? '' : 'pointer-events-none opacity-40'}`}>
                <div>
                  <span className="text-xs font-medium text-neutral-500">Kategorier</span>
                  <ul className="mt-2 space-y-2">
                    {PII_CATEGORY_OPTIONS.map((opt) => (
                      <li key={opt.value}>
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-800">
                          <input
                            type="checkbox"
                            checked={piiCategories.includes(opt.value)}
                            onChange={(ev) => {
                              setPiiCategories((prev) =>
                                ev.target.checked ? [...prev, opt.value] : prev.filter((x) => x !== opt.value),
                              )
                              markDirty()
                            }}
                            className="size-4 rounded border-neutral-300 text-[#1a3d32]"
                          />
                          {opt.label}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
                {(piiCategories.includes('helse') ||
                  piiCategories.includes('fagforeningsmedlemskap') ||
                  piiCategories.includes('etnisitet')) && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                    Dokument med særlige kategorier (f.eks. helse) er kun lesbart for brukere med tilgangen{' '}
                    <strong>hr.sensitive</strong> eller administrator.
                  </p>
                )}
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="wiki-pii-legal-basis">
                    Behandlingsgrunnlag
                  </label>
                  <StandardInput
                    id="wiki-pii-legal-basis"
                    list="wiki-pii-legal-basis-list"
                    value={piiLegalBasis}
                    onChange={(e) => {
                      setPiiLegalBasis(e.target.value)
                      markDirty()
                    }}
                    placeholder="f.eks. GDPR art. 6 nr. 1 bokstav b — kontraktsforhold"
                  />
                  <datalist id="wiki-pii-legal-basis-list">
                    {[...GDPR_ART6_SUGGESTIONS, ...GDPR_ART9_SUGGESTIONS].map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="wiki-pii-retention">
                    Lagringstid / notat
                  </label>
                  <StandardTextarea
                    id="wiki-pii-retention"
                    rows={2}
                    value={piiRetentionNote}
                    onChange={(e) => {
                      setPiiRetentionNote(e.target.value)
                      markDirty()
                    }}
                    placeholder="f.eks. Slettes 5 år etter avsluttet arbeidsforhold"
                  />
                </div>
                <p className="text-xs text-amber-800">
                  Husk å oppdatere behandlingsprotokollen ved endring av behandlingen.
                </p>
            </div>
          </ModuleSectionCard>

          <ModuleSectionCard>
            <h3 className="mb-4 border-b border-neutral-100 pb-2 text-sm font-semibold text-neutral-900">
              Versjonshistorikk
            </h3>
            <p className="text-xs text-neutral-500">
              Hver gang du publiserer, lagres gjeldende versjon som et fryst arkiv før versjonsnummer økes.
            </p>
            {docs.versionsForPage(original.id).length === 0 ? (
              <p className="mt-2 text-xs text-neutral-400">
                Ingen arkiverte versjoner ennå (første publisering oppretter v1 i arkivet).
              </p>
            ) : (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-neutral-600">
                {docs.versionsForPage(original.id).map((v) => (
                  <li key={v.id}>
                    v{v.version} · {new Date(v.frozenAt).toLocaleDateString('no-NO')}
                  </li>
                ))}
              </ul>
            )}
          </ModuleSectionCard>
        </div>
      </div>
      )}
    </ModulePageShell>
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
          <span className="size-1.5 shrink-0 rounded-full bg-neutral-300" aria-hidden />
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
          <Button
            key={l}
            type="button"
            variant={block.level === l ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => onUpdate({ level: l } as Partial<ContentBlock>)}
          >
            H{l}
          </Button>
        ))}
      </div>
      <StandardInput
        value={block.text}
        onChange={(e) => onUpdate({ text: e.target.value } as Partial<ContentBlock>)}
        className="font-semibold"
      />
    </div>
  )

  if (block.kind === 'text') return (
    <TipTapRichTextEditor value={block.body} onChange={(html) => onUpdate({ body: html } as Partial<ContentBlock>)} />
  )

  if (block.kind === 'alert') return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {(['info', 'warning', 'danger', 'tip'] as const).map((v) => (
          <Button
            key={v}
            type="button"
            variant={block.variant === v ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => onUpdate({ variant: v } as Partial<ContentBlock>)}
          >
            {v}
          </Button>
        ))}
      </div>
      <StandardInput
        value={block.text}
        onChange={(e) => onUpdate({ text: e.target.value } as Partial<ContentBlock>)}
      />
    </div>
  )

  if (block.kind === 'divider') return <p className="text-xs text-neutral-400">Visuell skillelinje — ingen innstillinger.</p>

  if (block.kind === 'image') return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-neutral-500" htmlFor="wiki-img-url">
        Bilde-URL
      </label>
      <StandardInput
        id="wiki-img-url"
        value={block.url}
        onChange={(e) => onUpdate({ url: e.target.value } as Partial<ContentBlock>)}
        placeholder="https://…"
      />
      <label className="text-xs font-medium text-neutral-500" htmlFor="wiki-img-alt">
        Alt-tekst
      </label>
      <StandardInput
        id="wiki-img-alt"
        value={block.alt ?? ''}
        onChange={(e) => onUpdate({ alt: e.target.value } as Partial<ContentBlock>)}
        placeholder="Beskriv bildet for skjermlesere"
      />
      <label className="text-xs font-medium text-neutral-500" htmlFor="wiki-img-cap">
        Bildetekst (valgfritt)
      </label>
      <StandardInput
        id="wiki-img-cap"
        value={block.caption ?? ''}
        onChange={(e) => onUpdate({ caption: e.target.value } as Partial<ContentBlock>)}
      />
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="wiki-img-width">
          Bredde
        </label>
        <SearchableSelect
          value={block.width ?? 'full'}
          options={IMAGE_WIDTH_OPTIONS}
          onChange={(v) => onUpdate({ width: v as 'full' | 'wide' | 'medium' } as Partial<ContentBlock>)}
        />
      </div>
    </div>
  )

  if (block.kind === 'law_ref') return (
    <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">§ Lovhenvisning</p>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-500">Referanse</label>
        <StandardInput
          value={block.ref}
          onChange={(e) => onUpdate({ ref: e.target.value } as Partial<ContentBlock>)}
          placeholder="f.eks. IK-f §5 nr. 1a"
          className="font-mono"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-500">Beskrivelse</label>
        <StandardInput
          value={block.description}
          onChange={(e) => onUpdate({ description: e.target.value } as Partial<ContentBlock>)}
          placeholder="Beskriv hva bestemmelsen krever"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-500">Lenke (valgfritt)</label>
        <StandardInput
          value={block.url ?? ''}
          onChange={(e) => onUpdate({ url: e.target.value } as Partial<ContentBlock>)}
          placeholder="https://lovdata.no/…"
        />
      </div>
    </div>
  )

  if (block.kind === 'module') return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-500">Modul</label>
        <SearchableSelect
          value={block.moduleName}
          options={MODULE_SELECT_OPTIONS}
          onChange={(v) => onUpdate({ moduleName: v as ModuleBlock['moduleName'] } as Partial<ContentBlock>)}
        />
      </div>
      {block.moduleName === 'action_button' && (
        <div className="space-y-2">
          <StandardInput
            value={typeof block.params?.label === 'string' ? block.params.label : ''}
            onChange={(e) => onUpdate({ params: { ...block.params, label: e.target.value } } as Partial<ContentBlock>)}
            placeholder="Knappetekst"
          />
          <StandardInput
            value={typeof block.params?.route === 'string' ? block.params.route : ''}
            onChange={(e) => onUpdate({ params: { ...block.params, route: e.target.value } } as Partial<ContentBlock>)}
            placeholder="Rute (f.eks. /workplace-reporting/incidents)"
          />
        </div>
      )}
      {block.moduleName === 'emergency_stop_procedure' && (
        <p className="text-xs text-neutral-600">
          Viser stansingsrett og kontakt til verneombud fra representantregisteret og medlemslisten (e-post).
        </p>
      )}
      <div className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
        <AlertTriangle className="size-3.5 shrink-0" />
        Modulen er dynamisk — den henter live data ved visning.
      </div>
    </div>
  )

  return null
}
