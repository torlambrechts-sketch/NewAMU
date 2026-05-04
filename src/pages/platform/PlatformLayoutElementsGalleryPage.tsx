import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ModuleSectionCard } from '../../components/module'
import { Button } from '../../components/ui/Button'
import {
  LAYOUT_COMPOSER_BLOCKS,
  previewShellStyle,
  renderLayoutComposerBlock,
  type LayoutComposerBlockId,
  type PlatformLayoutPreviewSurface,
} from './PlatformLayoutComposerPage'

function SurfaceToggle({
  value,
  onChange,
}: {
  value: PlatformLayoutPreviewSurface
  onChange: (v: PlatformLayoutPreviewSurface) => void
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Forhåndsvisning bakgrunn">
      <Button
        type="button"
        variant={value === 'cream' ? 'primary' : 'secondary'}
        size="sm"
        onClick={() => onChange('cream')}
        aria-pressed={value === 'cream'}
      >
        Krem arbeidsflate
      </Button>
      <Button
        type="button"
        variant={value === 'white' ? 'primary' : 'secondary'}
        size="sm"
        onClick={() => onChange('white')}
        aria-pressed={value === 'white'}
      >
        Helhvit
      </Button>
    </div>
  )
}

/**
 * One card per layout composer block (same 38 as `/platform-admin/layout` composer).
 * Each preview sits on {@link previewShellStyle} inside {@link ModuleSectionCard} per design system module surfaces.
 */
export function PlatformLayoutElementsGalleryPage() {
  const [surface, setSurface] = useState<PlatformLayoutPreviewSurface>('cream')

  return (
    <div className="space-y-8 text-neutral-100">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-3xl space-y-2">
          <h1 className="text-2xl font-semibold text-white">Layout-elementer (katalog)</h1>
          <p className="text-sm text-neutral-400">
            Alle {LAYOUT_COMPOSER_BLOCKS.length} forhåndsbygde blokkene fra{' '}
            <Link to="/platform-admin/layout#composer" className="text-amber-400/90 hover:underline">
              Layout (arbeidsflate) — komponer
            </Link>
            , vist én per kort. Ytre ramme følger{' '}
            <code className="rounded bg-white/10 px-1 text-xs">ModuleSectionCard</code> (arbeidsflate-modul). Innholdet
            ligger på valgt bakgrunn (krem <code className="rounded bg-white/10 px-1 text-xs">#F9F7F2</code> eller helhvit),
            samme som i komponisten.
          </p>
        </div>
        <SurfaceToggle value={surface} onChange={setSurface} />
      </div>

      <div className="grid gap-6 lg:grid-cols-1 xl:grid-cols-2">
        {LAYOUT_COMPOSER_BLOCKS.map((block) => (
          <LayoutElementGalleryCard key={block.id} blockId={block.id} label={block.label} hint={block.hint} surface={surface} />
        ))}
      </div>
    </div>
  )
}

function LayoutElementGalleryCard({
  blockId,
  label,
  hint,
  surface,
}: {
  blockId: LayoutComposerBlockId
  label: string
  hint: string
  surface: PlatformLayoutPreviewSurface
}) {
  return (
    <ModuleSectionCard className="text-neutral-900" clip="visible">
      <div className="border-b border-neutral-200/90 bg-neutral-50 px-4 py-3 md:px-5">
        <h2 className="text-sm font-semibold text-neutral-900">{label}</h2>
        <p className="mt-1 text-xs leading-relaxed text-neutral-600">{hint}</p>
        <p className="mt-2 font-mono text-[10px] text-neutral-500">id: {blockId}</p>
      </div>
      <div className="p-3 md:p-4">
        <div
          className="overflow-x-auto rounded-lg border border-neutral-200/80 p-3 shadow-inner md:p-4"
          style={previewShellStyle(surface)}
        >
          {renderLayoutComposerBlock(blockId)}
        </div>
      </div>
    </ModuleSectionCard>
  )
}
