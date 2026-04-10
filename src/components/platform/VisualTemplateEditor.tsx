import { useCallback, useEffect, useMemo, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react'
import {
  ChevronDown,
  Copy,
  GripVertical,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { usePlatformAdmin } from '../../hooks/usePlatformAdmin'
import {
  ADVANCED_PRESET_KEYS,
  PINPOINT_PRESET_KEYS,
  createAdvancedPreset,
  createPinpointPreset,
  newEmptyVisualTemplate,
} from '../../data/visualTemplatePresets'
import {
  deleteTemplate,
  readVisualTemplatePack,
  setActiveTemplate,
  upsertTemplate,
  writeVisualTemplatePack,
} from '../../lib/visualTemplateStorage'
import {
  defaultChildBlock,
  duplicateSubtree,
  getBlockAtPath,
  insertChildAt,
  moveBlock,
  removeAtPath,
  updateBlockAtPath,
} from '../../lib/visualTemplateTree'
import { cloneTemplate, type VisualBlock, type VisualTemplate, type VisualTemplateSource } from '../../types/visualTemplate'

const MIME_BLOCK = 'application/x-klarert-vblock'

type Props = {
  source: VisualTemplateSource
  /** Dark chrome (platform admin) vs light chrome inside cream preview */
  darkChrome?: boolean
  /** Optional title above toolbar */
  title?: string
  /** Extra help text */
  description?: ReactNode
}

function blockStyleObject(b: VisualBlock): CSSProperties {
  const s: CSSProperties = { ...(b.style as CSSProperties) }
  if (b.flexGap) s.gap = b.flexGap
  if (b.gridGap) s.gap = b.gridGap
  if (b.gridTemplateColumns) s.gridTemplateColumns = b.gridTemplateColumns
  if (b.alignItems) s.alignItems = b.alignItems as CSSProperties['alignItems']
  if (b.justifyContent) s.justifyContent = b.justifyContent as CSSProperties['justifyContent']
  if (b.flexDirection === 'row') s.flexDirection = 'row'
  if (b.flexDirection === 'column') s.flexDirection = 'column'
  if (b.flexWrap) s.flexWrap = 'wrap'
  return s
}

function pathKey(path: number[]): string {
  return path.join('.')
}

export function VisualTemplateEditor({ source, darkChrome = true, title, description }: Props) {
  const { userId, isAdmin, loading: authLoading } = usePlatformAdmin()
  const [pack, setPack] = useState(() =>
    userId ? readVisualTemplatePack(userId, source) : { version: 1 as const, templates: [], activeTemplateId: null },
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedPath, setSelectedPath] = useState<number[] | null>(null)
  const [newName, setNewName] = useState('')
  const [presetOpen, setPresetOpen] = useState(false)
  const [addChildOpen, setAddChildOpen] = useState(false)

  useEffect(() => {
    if (!userId) return
    const p = readVisualTemplatePack(userId, source)
    queueMicrotask(() => {
      setPack(p)
      setActiveId(p.activeTemplateId ?? p.templates[0]?.id ?? null)
    })
  }, [userId, source])

  const activeTemplate = useMemo(
    () => pack.templates.find((t) => t.id === activeId) ?? null,
    [pack.templates, activeId],
  )

  const persistPack = useCallback(
    (next: typeof pack) => {
      setPack(next)
      if (userId) writeVisualTemplatePack(userId, source, next)
    },
    [userId, source],
  )

  const saveTemplate = useCallback(
    (t: VisualTemplate) => {
      if (!userId) return
      const updated = { ...t, updatedAt: new Date().toISOString() }
      const next = upsertTemplate(userId, source, updated)
      persistPack(next)
      setActiveId(updated.id)
    },
    [userId, source, persistPack],
  )

  const updateRoot = useCallback(
    (fn: (root: VisualBlock) => VisualBlock) => {
      if (!activeTemplate) return
      saveTemplate({ ...activeTemplate, root: fn(activeTemplate.root) })
    },
    [activeTemplate, saveTemplate],
  )

  const selectedBlock = useMemo(() => {
    if (!activeTemplate || !selectedPath) return null
    return getBlockAtPath(activeTemplate.root, selectedPath)
  }, [activeTemplate, selectedPath])

  const onDragStart = (e: DragEvent, parentPath: number[], index: number) => {
    e.stopPropagation()
    e.dataTransfer?.setData(MIME_BLOCK, JSON.stringify({ parentPath, index }))
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  }

  const onDropOn = (e: DragEvent, toParent: number[], insertIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    const raw = e.dataTransfer.getData(MIME_BLOCK)
    if (!raw || !activeTemplate) return
    try {
      const { parentPath, index } = JSON.parse(raw) as { parentPath: number[]; index: number }
      updateRoot((root) => moveBlock(root, parentPath, index, toParent, insertIndex))
    } catch {
      /* ignore */
    }
  }

  const shellPanel = darkChrome ? 'border-white/10 bg-slate-900/60 text-neutral-100' : 'border-neutral-200 bg-white text-neutral-900'
  const shellMuted = darkChrome ? 'text-neutral-400' : 'text-neutral-600'
  const shellInput = darkChrome
    ? 'rounded-lg border border-white/15 bg-slate-950/80 px-2 py-1.5 text-sm text-white'
    : 'rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm'

  if (authLoading) {
    return (
      <div className={`flex items-center gap-2 ${shellMuted}`}>
        <Loader2 className="size-4 animate-spin" />
        Laster…
      </div>
    )
  }

  if (!userId || !isAdmin) {
    return <p className="text-sm text-amber-200/90">Krever innlogget plattformadmin.</p>
  }

  const renderDropStrip = (parentPath: number[], insertIndex: number) => (
    <div
      role="presentation"
      className={`my-0.5 h-2 rounded ${darkChrome ? 'bg-amber-500/20 hover:bg-amber-500/40' : 'bg-amber-200/60 hover:bg-amber-400/80'}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDropOn(e, parentPath, insertIndex)}
    />
  )

  const layoutClass = (b: VisualBlock): string => {
    if (b.type === 'grid') return 'grid min-w-0'
    if (b.type === 'row') return 'flex min-w-0 flex-row'
    if (b.type === 'column') return 'flex min-w-0 flex-col'
    return 'flex min-w-0 flex-col'
  }

  const renderBlock = (b: VisualBlock, path: number[]): ReactNode => {
    const isSel = selectedPath && pathKey(selectedPath) === pathKey(path)
    const canHaveChildren = ['container', 'row', 'column', 'grid'].includes(b.type)
    const parentPath = path.slice(0, -1)
    const selfIndex = path[path.length - 1] ?? 0

    const outline = isSel
      ? darkChrome
        ? 'ring-2 ring-amber-400/80 ring-offset-2 ring-offset-slate-950'
        : 'ring-2 ring-amber-500 ring-offset-2 ring-offset-white'
      : darkChrome
        ? 'hover:ring-1 hover:ring-white/20'
        : 'hover:ring-1 hover:ring-neutral-300'

    const outerClass = `relative min-w-0 rounded-md pl-7 pt-1 ${outline} ${canHaveChildren ? layoutClass(b) : ''} ${b.className ?? ''}`
      .replace(/\s+/g, ' ')
      .trim()

    return (
      <div
        key={b.id}
        className={outerClass}
        style={canHaveChildren ? blockStyleObject(b) : ({ ...(b.style as CSSProperties) } as CSSProperties)}
        onClick={(e) => {
          e.stopPropagation()
          setSelectedPath(path)
        }}
      >
        <button
          type="button"
          draggable
          onDragStart={(e) => onDragStart(e, parentPath, selfIndex)}
          className={`absolute -left-1 top-1 z-10 cursor-grab rounded p-0.5 opacity-60 hover:opacity-100 ${darkChrome ? 'bg-slate-800 text-neutral-300' : 'bg-neutral-100 text-neutral-600'}`}
          title="Dra for å flytte"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="size-3.5" />
        </button>
        {canHaveChildren ?
          <>
            {(b.children?.length ?? 0) === 0 ?
              <p className={`p-4 text-center text-xs ${shellMuted}`}>Tom — «Legg til barn» i popup</p>
            : null}
            {renderDropStrip(path, 0)}
            {(b.children ?? []).map((child, i) => (
              <div key={child.id} className="min-w-0">
                {renderBlock(child, [...path, i])}
                {renderDropStrip(path, i + 1)}
              </div>
            ))}
          </>
        : (
          renderLeaf(b)
        )}
      </div>
    )
  }

  function renderLeaf(b: VisualBlock): ReactNode {
    switch (b.type) {
      case 'text':
        return <p className={`px-1 py-0.5 text-sm ${b.className ?? ''}`}>{b.text ?? ''}</p>
      case 'heading': {
        const H = `h${b.headingLevel ?? 2}` as 'h1' | 'h2' | 'h3' | 'h4'
        return (
          <H className={`font-semibold ${b.className ?? ''}`} style={{ margin: 0 }}>
            {b.text ?? ''}
          </H>
        )
      }
      case 'button':
        return (
          <button type="button" className={`rounded-md border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-sm ${b.className ?? ''}`}>
            {b.text ?? 'Knapp'}
          </button>
        )
      case 'link':
        return (
          <a href={b.href ?? '#'} className={`text-sm text-sky-700 underline ${b.className ?? ''}`} onClick={(e) => e.preventDefault()}>
            {b.text ?? 'Lenke'}
          </a>
        )
      case 'input':
        return (
          <input
            type={b.inputType === 'search' ? 'search' : b.inputType === 'email' ? 'email' : 'text'}
            placeholder={b.placeholder}
            readOnly
            className={`w-full rounded-md border border-neutral-200 px-3 py-2 text-sm ${b.className ?? ''}`}
          />
        )
      case 'image':
        return <img src={b.src} alt={b.alt ?? ''} className={`max-h-48 w-full object-cover ${b.className ?? ''}`} />
      case 'divider':
        return <hr className="border-neutral-200" />
      default:
        return <span className="text-xs text-red-500">Ukjent type</span>
    }
  }

  /** Root: special wrapper — children only inside root's visual area */
  const renderCanvas = () => {
    if (!activeTemplate) return <p className={shellMuted}>Ingen mal valgt.</p>
    const root = activeTemplate.root
    return (
      <div
        className="min-h-[280px] rounded-lg border border-dashed border-neutral-300/50 p-3"
        onClick={() => setSelectedPath([])}
      >
        {renderDropStrip([], 0)}
        {(root.children ?? []).map((child, i) => (
          <div key={child.id}>
            {renderBlock(child, [i])}
            {renderDropStrip([], i + 1)}
          </div>
        ))}
        {(root.children?.length ?? 0) === 0 ?
          <p className={`py-8 text-center text-sm ${shellMuted}`}>Tom rot — legg til rad, kolonne eller container.</p>
        : null}
      </div>
    )
  }

  const popover = selectedBlock && activeTemplate && (
    <div
      className={`fixed bottom-4 right-4 z-[200] flex max-h-[min(72vh,560px)] w-[min(92vw,360px)] flex-col rounded-xl border shadow-2xl ${
        darkChrome ? 'border-white/15 bg-slate-900 text-neutral-100' : 'border-neutral-200 bg-white text-neutral-900'
      }`}
    >
      <div className={`flex items-center justify-between border-b px-3 py-2 ${darkChrome ? 'border-white/10' : 'border-neutral-200'}`}>
        <span className="text-xs font-semibold uppercase tracking-wide">
          {selectedPath?.length === 0 ? 'Rot' : selectedBlock.type} · rediger
        </span>
        <button
          type="button"
          className="rounded p-1 opacity-70 hover:opacity-100"
          onClick={() => setSelectedPath(null)}
          aria-label="Lukk"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 text-sm">
        {selectedPath && selectedPath.length > 0 ?
          <>
            <label className="mt-1 block text-[10px] uppercase opacity-70">Tekst / innhold</label>
            <textarea
              value={selectedBlock.text ?? ''}
              onChange={(e) =>
                updateRoot((root) => updateBlockAtPath(root, selectedPath, { text: e.target.value }))
              }
              rows={3}
              className={`mt-1 w-full rounded border px-2 py-1 text-sm ${shellInput}`}
            />
            {selectedBlock.type === 'heading' ?
              <label className="mt-2 block">
                <span className="text-[10px] uppercase opacity-70">Nivå</span>
                <select
                  value={String(selectedBlock.headingLevel ?? 2)}
                  onChange={(e) =>
                    updateRoot((root) =>
                      updateBlockAtPath(root, selectedPath, {
                        headingLevel: Number(e.target.value) as 1 | 2 | 3 | 4,
                      }),
                    )
                  }
                  className={`mt-1 w-full rounded border px-2 py-1 ${shellInput}`}
                >
                  <option value="1">H1</option>
                  <option value="2">H2</option>
                  <option value="3">H3</option>
                  <option value="4">H4</option>
                </select>
              </label>
            : null}
            {selectedBlock.type === 'link' ?
              <label className="mt-2 block">
                <span className="text-[10px] uppercase opacity-70">href</span>
                <input
                  value={selectedBlock.href ?? ''}
                  onChange={(e) =>
                    updateRoot((root) => updateBlockAtPath(root, selectedPath, { href: e.target.value }))
                  }
                  className={`mt-1 w-full rounded border px-2 py-1 ${shellInput}`}
                />
              </label>
            : null}
            {selectedBlock.type === 'input' ?
              <>
                <label className="mt-2 block">
                  <span className="text-[10px] uppercase opacity-70">Placeholder</span>
                  <input
                    value={selectedBlock.placeholder ?? ''}
                    onChange={(e) =>
                      updateRoot((root) => updateBlockAtPath(root, selectedPath, { placeholder: e.target.value }))
                    }
                    className={`mt-1 w-full rounded border px-2 py-1 ${shellInput}`}
                  />
                </label>
                <label className="mt-2 block">
                  <span className="text-[10px] uppercase opacity-70">Type</span>
                  <select
                    value={selectedBlock.inputType ?? 'text'}
                    onChange={(e) =>
                      updateRoot((root) =>
                        updateBlockAtPath(root, selectedPath, {
                          inputType: e.target.value as 'text' | 'search' | 'email',
                        }),
                      )
                    }
                    className={`mt-1 w-full rounded border px-2 py-1 ${shellInput}`}
                  >
                    <option value="text">text</option>
                    <option value="search">search</option>
                    <option value="email">email</option>
                  </select>
                </label>
              </>
            : null}
            {selectedBlock.type === 'image' ?
              <>
                <label className="mt-2 block">
                  <span className="text-[10px] uppercase opacity-70">URL</span>
                  <input
                    value={selectedBlock.src ?? ''}
                    onChange={(e) =>
                      updateRoot((root) => updateBlockAtPath(root, selectedPath, { src: e.target.value }))
                    }
                    className={`mt-1 w-full rounded border px-2 py-1 ${shellInput}`}
                  />
                </label>
                <label className="mt-2 block">
                  <span className="text-[10px] uppercase opacity-70">alt</span>
                  <input
                    value={selectedBlock.alt ?? ''}
                    onChange={(e) =>
                      updateRoot((root) => updateBlockAtPath(root, selectedPath, { alt: e.target.value }))
                    }
                    className={`mt-1 w-full rounded border px-2 py-1 ${shellInput}`}
                  />
                </label>
              </>
            : null}
            <label className="mt-2 block">
              <span className="text-[10px] uppercase opacity-70">Tailwind className</span>
              <input
                value={selectedBlock.className ?? ''}
                onChange={(e) =>
                  updateRoot((root) => updateBlockAtPath(root, selectedPath, { className: e.target.value }))
                }
                className={`mt-1 w-full rounded border px-2 py-1 font-mono text-xs ${shellInput}`}
              />
            </label>
            {['row', 'column', 'grid'].includes(selectedBlock.type) ?
              <>
                <label className="mt-2 block">
                  <span className="text-[10px] uppercase opacity-70">gap (CSS)</span>
                  <input
                    value={selectedBlock.flexGap ?? selectedBlock.gridGap ?? ''}
                    onChange={(e) =>
                      updateRoot((root) =>
                        updateBlockAtPath(root, selectedPath, {
                          flexGap: e.target.value,
                          gridGap: e.target.value,
                        }),
                      )
                    }
                    className={`mt-1 w-full rounded border px-2 py-1 ${shellInput}`}
                    placeholder="12px"
                  />
                </label>
                {selectedBlock.type === 'grid' ?
                  <label className="mt-2 block">
                    <span className="text-[10px] uppercase opacity-70">gridTemplateColumns</span>
                    <input
                      value={selectedBlock.gridTemplateColumns ?? ''}
                      onChange={(e) =>
                        updateRoot((root) =>
                          updateBlockAtPath(root, selectedPath, { gridTemplateColumns: e.target.value }),
                        )
                      }
                      className={`mt-1 w-full rounded border px-2 py-1 font-mono text-xs ${shellInput}`}
                    />
                  </label>
                : null}
                {selectedBlock.type === 'row' ?
                  <label className="mt-2 flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedBlock.flexWrap)}
                      onChange={(e) =>
                        updateRoot((root) =>
                          updateBlockAtPath(root, selectedPath, { flexWrap: e.target.checked }),
                        )
                      }
                    />
                    flexWrap
                  </label>
                : null}
              </>
            : null}
            <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAddChildOpen((o) => !o)}
                  className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ${
                    darkChrome ? 'border-white/20 hover:bg-white/10' : 'border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <Plus className="size-3" /> Barn <ChevronDown className="size-3" />
                </button>
                {addChildOpen ?
                  <div
                    className={`absolute bottom-full left-0 z-10 mb-1 max-h-48 min-w-[160px] overflow-y-auto rounded border py-1 shadow-lg ${
                      darkChrome ? 'border-white/15 bg-slate-800' : 'border-neutral-200 bg-white'
                    }`}
                  >
                    {(
                      [
                        'container',
                        'row',
                        'column',
                        'grid',
                        'text',
                        'heading',
                        'button',
                        'link',
                        'input',
                        'image',
                        'divider',
                      ] as VisualBlock['type'][]
                    ).map((t) => (
                      <button
                        key={t}
                        type="button"
                        className="block w-full px-3 py-1.5 text-left text-xs hover:bg-black/10"
                        onClick={() => {
                          const child = defaultChildBlock(t)
                          updateRoot((root) => insertChildAt(root, selectedPath, (selectedBlock.children?.length ?? 0), child))
                          setAddChildOpen(false)
                        }}
                      >
                        + {t}
                      </button>
                    ))}
                  </div>
                : null}
              </div>
              <button
                type="button"
                className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ${
                  darkChrome ? 'border-white/20 hover:bg-white/10' : 'border-neutral-200 hover:bg-neutral-50'
                }`}
                onClick={() => {
                  const dup = duplicateSubtree(selectedBlock)
                  updateRoot((root) => insertChildAt(root, parentPathOf(selectedPath), selfIndexOf(selectedPath) + 1, dup))
                }}
              >
                <Copy className="size-3" /> Kopiér
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded border border-red-500/40 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                onClick={() => {
                  updateRoot((root) => removeAtPath(root, selectedPath))
                  setSelectedPath(null)
                }}
              >
                <Trash2 className="size-3" /> Slett
              </button>
            </div>
          </>
        :
          <p className={`text-xs ${shellMuted}`}>Velg et element i malen. Rot: legg til barn under.</p>}
        {selectedPath?.length === 0 && activeTemplate ?
          <div className="mt-2 space-y-2">
            <p className={`text-xs ${shellMuted}`}>Legg til øverste nivå:</p>
            <div className="flex flex-wrap gap-1">
              {(['row', 'column', 'grid', 'container'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`rounded border px-2 py-1 text-xs ${darkChrome ? 'border-white/20' : 'border-neutral-200'}`}
                  onClick={() => {
                    const child = defaultChildBlock(t)
                    updateRoot((root) => insertChildAt(root, [], root.children?.length ?? 0, child))
                  }}
                >
                  + {t}
                </button>
              ))}
            </div>
          </div>
        : null}
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {title ?
        <h2 className={`text-lg font-semibold ${darkChrome ? 'text-white' : 'text-neutral-900'}`}>{title}</h2>
      : null}
      {description ? <div className={`text-sm ${shellMuted}`}>{description}</div> : null}

      <div className={`rounded-xl border p-4 ${shellPanel}`}>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[160px] flex-1 text-xs">
            <span className={shellMuted}>Aktiv mal</span>
            <select
              value={activeId ?? ''}
              onChange={(e) => {
                const id = e.target.value || null
                setActiveId(id)
                if (userId) persistPack(setActiveTemplate(userId, source, id))
                setSelectedPath(null)
              }}
              className={`mt-1 w-full ${shellInput}`}
            >
              {pack.templates.length === 0 ? <option value="">— Ingen —</option> : null}
              {pack.templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Navn på ny mal"
            className={`mt-5 min-w-[140px] flex-1 ${shellInput}`}
          />
          <button
            type="button"
            className={`rounded-lg border px-3 py-2 text-sm ${darkChrome ? 'border-white/20 hover:bg-white/10' : 'border-neutral-200 hover:bg-neutral-50'}`}
            onClick={() => {
              const name = newName.trim() || `Mal ${pack.templates.length + 1}`
              const t = newEmptyVisualTemplate(source, name)
              saveTemplate(t)
              setNewName('')
            }}
          >
            Ny tom
          </button>
          <div className="relative">
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm ${
                darkChrome ? 'border-amber-500/40 hover:bg-amber-500/10' : 'border-amber-300 hover:bg-amber-50'
              }`}
              onClick={() => setPresetOpen((o) => !o)}
            >
              Fra eksempel <ChevronDown className="size-4" />
            </button>
            {presetOpen ?
              <div
                className={`absolute right-0 top-full z-50 mt-1 max-h-64 w-64 overflow-y-auto rounded-lg border py-1 shadow-xl ${
                  darkChrome ? 'border-white/15 bg-slate-800' : 'border-neutral-200 bg-white'
                }`}
              >
                {source === 'pinpoint' ?
                  PINPOINT_PRESET_KEYS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-black/10"
                      onClick={() => {
                        const t = createPinpointPreset(k)
                        const name = newName.trim() ? newName.trim() : t.name
                        saveTemplate({ ...t, name })
                        setPresetOpen(false)
                        setNewName('')
                      }}
                    >
                      {k}
                    </button>
                  ))
                : ADVANCED_PRESET_KEYS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-black/10"
                      onClick={() => {
                        const t = createAdvancedPreset(k)
                        const name = newName.trim() ? newName.trim() : t.name
                        saveTemplate({ ...t, name })
                        setPresetOpen(false)
                        setNewName('')
                      }}
                    >
                      {k.replace(/_/g, ' ')}
                    </button>
                  ))}
              </div>
            : null}
          </div>
          {activeTemplate ?
            <>
              <button
                type="button"
                className={`rounded-lg border px-3 py-2 text-sm ${darkChrome ? 'border-white/20 hover:bg-white/10' : 'border-neutral-200'}`}
                onClick={() => {
                  const t = cloneTemplate(activeTemplate, `${activeTemplate.name} (kopi)`)
                  saveTemplate(t)
                }}
              >
                Kopiér mal
              </button>
              <button
                type="button"
                className="rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10"
                onClick={() => {
                  if (!userId || !activeId) return
                  if (!window.confirm('Slette denne malen?')) return
                  const next = deleteTemplate(userId, source, activeId)
                  persistPack(next)
                  setActiveId(next.activeTemplateId)
                  setSelectedPath(null)
                }}
              >
                Slett mal
              </button>
            </>
          : null}
        </div>

        {activeTemplate ?
          <label className="mt-3 block text-xs">
            <span className={shellMuted}>Malnavn</span>
            <input
              value={activeTemplate.name}
              onChange={(e) => saveTemplate({ ...activeTemplate, name: e.target.value })}
              className={`mt-1 w-full max-w-md ${shellInput}`}
            />
          </label>
        : null}

        <p className={`mt-3 text-xs ${shellMuted}`}>
          Klikk et element for popup-redigering. Dra <GripVertical className="inline size-3" /> for å flytte i strukturen. Lagres automatisk i nettleseren.
        </p>

        <div className={`mt-4 rounded-lg border p-3 ${darkChrome ? 'border-white/10 bg-slate-950/40' : 'border-neutral-200 bg-neutral-50'}`}>
          {renderCanvas()}
        </div>
      </div>

      {popover}
    </div>
  )
}

function parentPathOf(path: number[]): number[] {
  return path.slice(0, -1)
}

function selfIndexOf(path: number[]): number {
  return path[path.length - 1] ?? 0
}
