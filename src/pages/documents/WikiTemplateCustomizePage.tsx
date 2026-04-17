import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Loader2, Save, Trash2 } from 'lucide-react'
import { useDocumentTemplates, useWikiSpaces } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { DocumentsModuleLayout } from '../../components/documents/DocumentsModuleLayout'
import { DocumentsSearchBar } from '../../components/documents/DocumentsSearchBar'
import type { Block } from '../../types/documents'
import { WikiBlockEditor } from './wikiBlockEditors'

function cloneBlocks(b: Block[]): Block[] {
  return JSON.parse(JSON.stringify(b)) as Block[]
}

const BTN_PRIMARY =
  'inline-flex items-center gap-2 rounded-none border border-[#1a3d32] bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26] disabled:opacity-50'

export function WikiTemplateCustomizePage() {
  const { templateId } = useParams<{ templateId: string }>()
  const navigate = useNavigate()
  const docs = useDocumentTemplates()
  const wikiSpaces = useWikiSpaces()
  const { organization } = useOrgSetupContext()

  const tpl = useMemo(
    () => (templateId ? docs.systemTemplatesCatalog.find((t) => t.id === templateId) ?? null : null),
    [docs.systemTemplatesCatalog, templateId],
  )
  const setting = useMemo(
    () => (templateId ? docs.orgTemplateSettings.find((s) => s.templateId === templateId) : undefined),
    [docs.orgTemplateSettings, templateId],
  )

  const spaceId = wikiSpaces.spaces[0]?.id ?? ''
  const orgId = organization?.id

  const [blocks, setBlocks] = useState<Block[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!tpl) return
    const custom = setting?.customBlocks
    const baseBlocks = (tpl.pagePayload as { blocks?: Block[] }).blocks ?? []
    setBlocks(cloneBlocks(custom && custom.length > 0 ? custom : baseBlocks))
  }, [tpl, setting?.customBlocks])

  const addKind = useCallback((kind: Block['kind']) => {
    const b: Block =
      kind === 'heading'
        ? { kind: 'heading', level: 2, text: 'Overskrift' }
        : kind === 'text'
          ? { kind: 'text', body: '<p></p>' }
          : kind === 'alert'
            ? { kind: 'alert', variant: 'info', text: '' }
            : kind === 'divider'
              ? { kind: 'divider' }
              : kind === 'law_ref'
                ? { kind: 'law_ref', ref: '', description: '' }
                : kind === 'image'
                  ? { kind: 'image', storagePath: '', caption: '', width: 'medium' }
                  : { kind: 'module', moduleName: 'live_org_chart', params: {} }
    setBlocks((prev) => [...prev, b])
  }, [])

  async function handleSave() {
    if (!templateId) return
    setSaving(true)
    try {
      await docs.saveSystemTemplateCustomBlocks(templateId, blocks)
      navigate('/documents/templates')
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  if (!docs.ready || docs.loading) {
    return (
      <DocumentsModuleLayout headerActions={<DocumentsSearchBar />}>
        <div className="flex min-h-[30vh] items-center justify-center gap-2 text-neutral-600">
          <Loader2 className="size-6 animate-spin" /> Laster…
        </div>
      </DocumentsModuleLayout>
    )
  }

  if (!tpl) {
    return (
      <DocumentsModuleLayout headerActions={<DocumentsSearchBar />}>
        <p className="mt-8 text-neutral-600">Mal ikke funnet.</p>
        <Link to="/documents/templates" className="mt-2 text-[#1a3d32] underline">
          ← Tilbake
        </Link>
      </DocumentsModuleLayout>
    )
  }

  return (
    <DocumentsModuleLayout
      headerActions={<DocumentsSearchBar />}
      subHeader={
        <div className="mt-6 border-b border-neutral-200/80 pb-6">
          <nav className="text-sm text-neutral-600">
            <Link to="/documents/templates" className="text-[#1a3d32] underline">
              ← Maler
            </Link>
            <span className="mx-2 text-neutral-400">→</span>
            <span className="font-medium">Tilpass: {tpl.label}</span>
          </nav>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600">
            Endre standardblokker for denne systemmalen i din organisasjon. Nye sider opprettet fra malen bruker disse blokkene.
          </p>
        </div>
      }
    >
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => addKind('text')} className="rounded-none border border-neutral-200 px-2 py-1 text-xs">
          + Tekst
        </button>
        <button type="button" onClick={() => addKind('heading')} className="rounded-none border border-neutral-200 px-2 py-1 text-xs">
          + Overskrift
        </button>
        <button type="button" onClick={() => addKind('divider')} className="rounded-none border border-neutral-200 px-2 py-1 text-xs">
          + Skillelinje
        </button>
        <button type="button" onClick={() => addKind('alert')} className="rounded-none border border-neutral-200 px-2 py-1 text-xs">
          + Varsel
        </button>
        <button type="button" onClick={() => addKind('law_ref')} className="rounded-none border border-neutral-200 px-2 py-1 text-xs">
          + Lovhenvisning
        </button>
        <button type="button" onClick={() => addKind('module')} className="rounded-none border border-neutral-200 px-2 py-1 text-xs">
          + Modul
        </button>
        <button type="button" onClick={() => addKind('image')} className="rounded-none border border-neutral-200 px-2 py-1 text-xs">
          + Bilde
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {blocks.map((block, idx) => (
          <div key={idx} className="rounded-none border border-neutral-200 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-500">Blokk {idx + 1}</span>
              <button
                type="button"
                onClick={() => setBlocks((b) => b.filter((_, i) => i !== idx))}
                className="text-red-500 hover:text-red-700"
                aria-label="Fjern blokk"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <WikiBlockEditor
              block={block}
              onUpdate={(patch) => setBlocks((prev) => prev.map((bl, i) => (i === idx ? { ...bl, ...patch } as Block : bl)))}
              spaceId={spaceId || 'draft'}
              orgId={orgId}
            />
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" disabled={saving || !spaceId} onClick={() => void handleSave()} className={BTN_PRIMARY}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Lagre tilpasning
        </button>
        {!spaceId ? <p className="text-xs text-amber-700">Opprett minst én mappe for å kunne laste opp bilder i malen.</p> : null}
        <Link to="/documents/templates" className="inline-flex items-center gap-2 rounded-none border border-neutral-200 px-4 py-2 text-sm">
          Avbryt
        </Link>
      </div>
    </DocumentsModuleLayout>
  )
}
