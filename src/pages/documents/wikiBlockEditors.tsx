/* eslint-disable react-refresh/only-export-components -- shared block editor helpers live with components */
import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { RichTextEditor, type MarkdownShortcutKind } from '../../components/learning/RichTextEditor'
import type { Block, ModuleBlock } from '../../types/documents'
import { filterLegalRefSuggestions } from '../../data/wikiLegalReferences'
import { getSupabaseBrowserClient } from '../../lib/supabaseClient'

export const MODULE_OPTIONS: { name: ModuleBlock['moduleName']; label: string }[] = [
  { name: 'live_org_chart', label: 'Live organisasjonskart (AMU/Verneombud)' },
  { name: 'live_risk_feed', label: 'Live risikooversikt (ROS)' },
  { name: 'action_button', label: 'Handlingsknapp' },
  { name: 'acknowledgement_footer', label: 'Lest og forstått (signatur)' },
]

export function WikiBlockEditor({
  block,
  onUpdate,
  onSlashPalette,
  onMarkdownShortcut,
  spaceId,
  orgId,
}: {
  block: Block
  onUpdate: (p: Partial<Block>) => void
  onSlashPalette?: () => void
  onMarkdownShortcut?: (k: MarkdownShortcutKind) => void
  spaceId: string
  orgId: string | undefined
}) {
  if (block.kind === 'heading')
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          {([1, 2, 3] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => onUpdate({ level: l } as Partial<Block>)}
              className={`rounded px-2 py-1 text-xs font-bold ${block.level === l ? 'bg-[#1a3d32] text-white' : 'bg-neutral-100 text-neutral-600'}`}
            >
              H{l}
            </button>
          ))}
        </div>
        <input
          value={block.text}
          onChange={(e) => onUpdate({ text: e.target.value } as Partial<Block>)}
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold"
        />
      </div>
    )

  if (block.kind === 'text')
    return (
      <div className="space-y-2">
        <RichTextEditor
          value={block.body}
          onChange={(html) => onUpdate({ body: html } as Partial<Block>)}
          markdownShortcuts={!!onMarkdownShortcut}
          onMarkdownShortcut={onMarkdownShortcut}
          onSlashLine={onSlashPalette}
        />
        {onSlashPalette && (
          <p className="text-[11px] text-neutral-400">
            Tips: Tom linje + <kbd className="rounded border px-1">/</kbd> åpner blokkvelger.{' '}
            <kbd className="rounded border px-1">## </kbd> / <kbd className="rounded border px-1">### </kbd> / <kbd className="rounded border px-1">--- </kbd> / <kbd className="rounded border px-1">! </kbd>
          </p>
        )}
      </div>
    )

  if (block.kind === 'alert')
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          {(['info', 'warning', 'danger', 'tip'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onUpdate({ variant: v } as Partial<Block>)}
              className={`rounded px-2 py-1 text-xs ${block.variant === v ? 'bg-[#1a3d32] text-white' : 'bg-neutral-100 text-neutral-600'}`}
            >
              {v}
            </button>
          ))}
        </div>
        <input
          value={block.text}
          onChange={(e) => onUpdate({ text: e.target.value } as Partial<Block>)}
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        />
      </div>
    )

  if (block.kind === 'divider') return <p className="text-xs text-neutral-400">Visuell skillelinje.</p>

  if (block.kind === 'image') return <WikiImageBlockEditor block={block} onUpdate={onUpdate} spaceId={spaceId} orgId={orgId} />

  if (block.kind === 'law_ref') return <WikiLawRefEditor block={block} onUpdate={onUpdate} />

  if (block.kind === 'module')
    return (
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-neutral-500">Modul</label>
          <select
            value={block.moduleName}
            onChange={(e) => onUpdate({ moduleName: e.target.value as ModuleBlock['moduleName'] } as Partial<Block>)}
            className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
          >
            {MODULE_OPTIONS.map((o) => (
              <option key={o.name} value={o.name}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {block.moduleName === 'action_button' && (
          <div className="space-y-2">
            <input
              value={typeof block.params?.label === 'string' ? block.params.label : ''}
              onChange={(e) => onUpdate({ params: { ...block.params, label: e.target.value } } as Partial<Block>)}
              placeholder="Knappetekst"
              className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
            />
            <input
              value={typeof block.params?.route === 'string' ? block.params.route : ''}
              onChange={(e) => onUpdate({ params: { ...block.params, route: e.target.value } } as Partial<Block>)}
              placeholder="Rute"
              className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
            />
          </div>
        )}
        <div className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          <AlertTriangle className="size-3.5 shrink-0" />
          Modulen er dynamisk ved visning.
        </div>
      </div>
    )

  return null
}

function WikiLawRefEditor({ block, onUpdate }: { block: Extract<Block, { kind: 'law_ref' }>; onUpdate: (p: Partial<Block>) => void }) {
  const [open, setOpen] = useState(false)
  const suggestions = filterLegalRefSuggestions(block.ref, 10)

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          value={block.ref}
          onChange={(e) => {
            onUpdate({ ref: e.target.value } as Partial<Block>)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          placeholder="Hjemmel (f.eks. AML § 3-1)"
          className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-mono"
        />
        {open && suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 text-sm shadow-lg">
            {suggestions.map((s) => (
              <li key={s.ref}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-neutral-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onUpdate({ ref: s.ref, description: s.description } as Partial<Block>)
                    setOpen(false)
                  }}
                >
                  <span className="font-mono text-xs text-[#1a3d32]">{s.ref}</span>
                  <span className="mt-0.5 block text-xs text-neutral-600">{s.description}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <label className="text-xs text-neutral-500">Beskrivende etikett (vises ved siden av hjemmelen)</label>
      <input
        value={block.description}
        onChange={(e) => onUpdate({ description: e.target.value } as Partial<Block>)}
        placeholder="Kort forklaring for lesere"
        className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm"
      />
      <input
        value={block.url ?? ''}
        onChange={(e) => onUpdate({ url: e.target.value } as Partial<Block>)}
        placeholder="URL (valgfritt)"
        className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm"
      />
    </div>
  )
}

function WikiImageBlockEditor({
  block,
  onUpdate,
  spaceId,
  orgId,
}: {
  block: Extract<Block, { kind: 'image' }>
  onUpdate: (p: Partial<Block>) => void
  spaceId: string
  orgId: string | undefined
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onFile(f: File | null) {
    if (!f || !orgId) return
    const sb = getSupabaseBrowserClient()
    if (!sb) {
      setErr('Ingen tilkobling')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const safe = f.name.replace(/[^\w.\-åæøÅÆØ ()[\]]+/g, '_')
      const path = `${orgId}/${spaceId}/page-img/${crypto.randomUUID()}-${safe}`
      const { error: up } = await sb.storage.from('wiki_space_files').upload(path, f, { cacheControl: '3600', upsert: false })
      if (up) throw up
      onUpdate({ storagePath: path } as Partial<Block>)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Opplasting feilet')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <input type="file" accept="image/*" disabled={busy || !orgId} onChange={(e) => void onFile(e.target.files?.[0] ?? null)} className="text-sm" />
      {busy ? <p className="text-xs text-neutral-500">Laster opp…</p> : null}
      {err ? <p className="text-xs text-red-600">{err}</p> : null}
      {block.storagePath ? <p className="break-all text-[10px] text-neutral-400">{block.storagePath}</p> : null}
      <input
        value={block.caption ?? ''}
        onChange={(e) => onUpdate({ caption: e.target.value } as Partial<Block>)}
        placeholder="Bildetekst"
        className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
      />
      <select
        value={block.width}
        onChange={(e) => onUpdate({ width: e.target.value as 'full' | 'wide' | 'medium' } as Partial<Block>)}
        className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
      >
        <option value="medium">Medium bredde</option>
        <option value="wide">Bred</option>
        <option value="full">Full bredde</option>
      </select>
    </div>
  )
}
