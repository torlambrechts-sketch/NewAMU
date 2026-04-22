import { useCallback, useMemo, useState } from 'react'
import type { Editor } from '@tiptap/core'
import {
  AlertTriangle,
  Calendar,
  CheckSquare,
  CircleDot,
  ClipboardSignature,
  FileText,
  GraduationCap,
  LayoutTemplate,
  Megaphone,
  PenLine,
  Plus,
  Scale,
  Scissors,
  Shield,
  Type,
  User,
} from 'lucide-react'
import { ModuleLegalBanner } from '../module/ModuleLegalBanner'
import { ModulePageShell } from '../module/ModulePageShell'
import { ModuleSectionCard } from '../module/ModuleSectionCard'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { SearchableSelect, type SelectOption } from '../ui/SearchableSelect'
import { StandardInput } from '../ui/Input'
import { TipTapRichTextEditor } from './TipTapRichTextEditor'
import { DOCUMENT_EDITOR_SECTIONS, type DocumentEditorSectionId } from './documentEditorSections'

const INITIAL_HTML = `<h2>Arbeidsavtale / HMS-dokument (utkast)</h2><p>Rediger dokumentet direkte på siden. Bruk <strong>Innhold</strong> til høyre for å sette inn standardseksjoner knyttet til arbeidsmiljøloven og internkontrollforskriften.</p><p></p>`

type SidebarMode = 'content' | 'recipients'

const RECIPIENT_OPTIONS: SelectOption[] = [
  { value: 'employee', label: 'Arbeidstaker (du)' },
  { value: 'employer', label: 'Arbeidsgiver' },
]

const FIELD_TILES: { id: string; label: string; icon: typeof Type }[] = [
  { id: 'text', label: 'Tekstfelt', icon: Type },
  { id: 'signature', label: 'Signatur', icon: PenLine },
  { id: 'initials', label: 'Initialer', icon: ClipboardSignature },
  { id: 'date', label: 'Dato', icon: Calendar },
  { id: 'checkbox', label: 'Avkryssing', icon: CheckSquare },
  { id: 'radio', label: 'Valgknapper', icon: CircleDot },
]

const SECTION_ICONS: Record<DocumentEditorSectionId, typeof FileText> = {
  welcome: FileText,
  arbeidsmiljolov: Scale,
  internkontroll: Shield,
  risikovurdering: AlertTriangle,
  opplaering: GraduationCap,
  arbeidstid: LayoutTemplate,
  varsling: Megaphone,
  signaturblokk: PenLine,
  pagebreak: Scissors,
}

/**
 * Standalone PandaDoc-style document editor shell for prototyping the documents module.
 * Uses `ModulePageShell`, `ModuleSectionCard`, `ModuleLegalBanner`, and UI primitives per docs/UI_PLACEMENT_RULES.md.
 * No backend integration — local state only.
 */
export function DocumentEditorWorkbench() {
  const [html, setHtml] = useState(INITIAL_HTML)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('content')
  const [recipient, setRecipient] = useState('employee')
  const [fieldPreview, setFieldPreview] = useState<Record<string, string>>({})

  const insertSectionHtml = useCallback(
    (fragment: string) => {
      if (editor) {
        editor.chain().focus().insertContent(fragment + '<p></p>').run()
        return
      }
      setHtml((prev) => `${prev}<p></p>${fragment}`)
    },
    [editor],
  )

  const recipientOptionsWithDot = useMemo(
    () =>
      RECIPIENT_OPTIONS.map((o) => ({
        ...o,
        suffix: o.value === recipient ? (
          <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-orange-500" aria-hidden />
        ) : undefined,
      })),
    [recipient],
  )

  const body = (
    <>
      <ModuleLegalBanner
        collapsible
        defaultCollapsed
        eyebrow="Lovgrunnlag"
        title="Dokumentredigering"
        intro="Denne prototypen viser hvordan samsvarstekster for arbeidsmiljø og internkontroll kan settes inn i ett sammenhengende dokument."
        references={[
          {
            code: 'Arbeidsmiljøloven',
            text: 'Systematisk vernearbeid, arbeidstid, varsling og grunnleggende plikter for arbeidsgiver og arbeidstaker.',
          },
          {
            code: 'Internkontrollforskriften § 5',
            text: 'Kartlegging av farer, risikovurdering, tiltak og dokumentasjon av det systematiske HMS-arbeidet.',
          },
        ]}
      />

      <ModuleSectionCard className="overflow-hidden p-0">
        <div className="flex min-h-[min(720px,calc(100vh-220px))] flex-col lg:flex-row">
          {/* Canvas column */}
          <div className="flex min-h-0 flex-1 flex-col bg-[#eef2f0]">
            <div className="flex items-center justify-between border-b border-neutral-200/80 bg-white/90 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Side 1</span>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="icon" aria-label="Legg til side">
                  <Plus className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label="Flere handlinger">
                  <span className="text-lg leading-none text-neutral-500">⋯</span>
                </Button>
              </div>
            </div>

            <div className="flex flex-1 flex-col overflow-auto p-4 md:p-8">
              <div className="mx-auto w-full max-w-[720px] flex-1 rounded-sm border border-neutral-200/90 bg-white shadow-md">
                <div className="border-b border-neutral-100 px-1">
                  <TipTapRichTextEditor
                    value={html}
                    onChange={setHtml}
                    toolbar="minimal"
                    onEditorReady={setEditor}
                    placeholder="Skriv eller lim inn dokumenttekst…"
                    className="rounded-none border-0 shadow-none [&_.tiptap-editor-root]:min-h-[480px] [&_.tiptap-editor-root]:px-6 [&_.tiptap-editor-root]:py-8 md:[&_.tiptap-editor-root]:min-h-[560px]"
                  />
                </div>
                <div className="flex justify-center border-t border-dashed border-neutral-200 py-4">
                  <Button type="button" variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />}>
                    Sett inn blokk
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="flex w-full shrink-0 border-t border-neutral-200/80 bg-neutral-50 lg:w-[340px] lg:border-l lg:border-t-0">
            <div
              className="flex w-12 flex-col items-center gap-1 border-r border-neutral-200/80 py-3"
              role="tablist"
              aria-label="Sidepanel"
            >
              <Button
                type="button"
                variant={sidebarMode === 'content' ? 'primary' : 'ghost'}
                size="icon"
                className="rounded-full"
                aria-pressed={sidebarMode === 'content'}
                onClick={() => setSidebarMode('content')}
                aria-label="Innhold"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={sidebarMode === 'recipients' ? 'primary' : 'ghost'}
                size="icon"
                aria-pressed={sidebarMode === 'recipients'}
                onClick={() => setSidebarMode('recipients')}
                aria-label="Mottakere"
              >
                <User className="h-4 w-4" />
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {sidebarMode === 'content' ? (
                <>
                  <h2 className="text-sm font-semibold text-neutral-900">Innhold</h2>
                  <p className="mt-1 text-xs text-neutral-500">Dra eller klikk for å sette inn seksjoner i dokumentet.</p>

                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Blokker</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {DOCUMENT_EDITOR_SECTIONS.map((sec) => {
                      const Icon = SECTION_ICONS[sec.id]
                      return (
                        <Button
                          key={sec.id}
                          type="button"
                          variant="secondary"
                          className="h-auto flex-col gap-1.5 py-3 text-center"
                          onClick={() => insertSectionHtml(sec.html)}
                          title={sec.description}
                        >
                          <Icon className="h-4 w-4 text-neutral-600" />
                          <span className="w-full text-[11px] font-medium leading-tight text-neutral-800">
                            {sec.shortLabel}
                          </span>
                        </Button>
                      )
                    })}
                  </div>

                  <p className="mt-6 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    Utfyllbare felt for
                  </p>
                  <div className="mt-2">
                    <SearchableSelect
                      value={recipient}
                      options={recipientOptionsWithDot}
                      onChange={setRecipient}
                      placeholder="Velg mottaker"
                      triggerClassName="py-2 text-xs"
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {FIELD_TILES.map((f) => {
                      const Icon = f.icon
                      return (
                        <Button
                          key={f.id}
                          type="button"
                          variant="secondary"
                          className="h-auto flex-col gap-1 border border-orange-100 bg-orange-50/80 py-2.5 hover:bg-orange-50"
                        >
                          <Icon className="h-4 w-4 text-orange-800/90" />
                          <span className="text-[11px] font-medium text-neutral-800">{f.label}</span>
                        </Button>
                      )
                    })}
                  </div>
                  <p className="mt-2 text-xs text-neutral-500">
                    Feltene er kun visuelle i denne testen — ingen lagring eller PDF ennå.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-sm font-semibold text-neutral-900">Mottakere</h2>
                  <p className="mt-1 text-xs text-neutral-500">Velg hvem felt i dokumentet tilhører (utkast).</p>
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-neutral-700" htmlFor="demo-recipient-name">
                        Navn
                      </label>
                      <StandardInput
                        id="demo-recipient-name"
                        className="mt-1"
                        value={fieldPreview.name ?? ''}
                        onChange={(e) => setFieldPreview((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Ola Nordmann"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-neutral-700" htmlFor="demo-recipient-email">
                        E-post
                      </label>
                      <StandardInput
                        id="demo-recipient-email"
                        className="mt-1"
                        type="email"
                        value={fieldPreview.email ?? ''}
                        onChange={(e) => setFieldPreview((p) => ({ ...p, email: e.target.value }))}
                        placeholder="ola@eksempel.no"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </ModuleSectionCard>
    </>
  )

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'HMS' }, { label: 'Dokumenter' }, { label: 'Redaktør (test)' }]}
      title="Dokumentredaktør — UI-test"
      description="PandaDoc-inspirert arbeidsflate med rik tekst og innsetting av samsvarseksjoner (arbeidsmiljøloven og internkontrollforskriften). Kun lokalt utkast — ingen integrasjon."
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="draft">Utkast</Badge>
          <Button variant="secondary" size="sm">
            Forhåndsvisning
          </Button>
          <Button variant="primary" size="sm" icon={<FileText className="h-4 w-4" />}>
            Send (demo)
          </Button>
        </div>
      }
    >
      {body}
    </ModulePageShell>
  )
}
