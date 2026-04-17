import { Fragment, memo, type RefObject } from 'react'
import { ExternalLink } from 'lucide-react'
import type { Block, HeadingBlock, TextBlock, AlertBlock, ImageBlock, LawRefBlock, ModuleBlock } from '../../types/documents'
import { sanitizeLearningHtml } from '../../lib/sanitizeHtml'
import { LiveOrgChart } from './modules/LiveOrgChart'
import { LiveRiskFeed } from './modules/LiveRiskFeed'
import { ActionButton } from './modules/ActionButton'
import { AcknowledgementFooter } from './modules/AcknowledgementFooter'
import { WikiImageBlock } from './WikiImageBlock'
import { wikiHeadingDomId } from '../../lib/wikiPageContent'

type Props = {
  blocks: Block[]
  pageId: string
  pageVersion: number
  /** When set, the acknowledgement module wrapper receives this ref (e.g. for scroll-into-view). */
  acknowledgementAnchorRef?: RefObject<HTMLDivElement | null>
}

const alertStyles = {
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  danger: 'border-red-200 bg-red-50 text-red-950',
  tip: 'border-emerald-200 bg-emerald-50 text-emerald-950',
}

const alertIcons = { info: 'ℹ️', warning: '⚠️', danger: '🚨', tip: '💡' }

function isAlertVariant(v: unknown): v is keyof typeof alertStyles {
  return v === 'info' || v === 'warning' || v === 'danger' || v === 'tip'
}

type HeadingProps = { block: HeadingBlock; domId: string }
export const WikiHeadingBlockView = memo(function WikiHeadingBlockView({ block, domId }: HeadingProps) {
  const level = block.level === 1 || block.level === 2 || block.level === 3 ? block.level : 2
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3'
  const text = typeof block.text === 'string' ? block.text : ''
  const cls =
    level === 1
      ? 'scroll-mt-24 text-2xl font-bold text-neutral-900 mt-6 mb-2'
      : level === 2
        ? 'scroll-mt-24 text-lg font-semibold text-neutral-800 mt-5 mb-1'
        : 'scroll-mt-24 text-base font-semibold text-neutral-700 mt-4 mb-1'
  return (
    <Tag id={domId} className={cls}>
      {text}
    </Tag>
  )
})

type TextProps = { block: TextBlock }
export const WikiTextBlockView = memo(function WikiTextBlockView({ block }: TextProps) {
  const html = sanitizeLearningHtml(typeof block.body === 'string' ? block.body : '')
  return (
    <div
      className="prose prose-sm max-w-none text-neutral-800 [&_a]:text-[#1a3d32] [&_a]:underline [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-neutral-200 [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-sm [&_th]:border [&_th]:border-neutral-200 [&_th]:bg-neutral-50 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-neutral-500"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
})

type AlertProps = { block: AlertBlock }
export const WikiAlertBlockView = memo(function WikiAlertBlockView({ block }: AlertProps) {
  const variant = isAlertVariant(block.variant) ? block.variant : 'info'
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${alertStyles[variant]}`}>
      {alertIcons[variant]} {typeof block.text === 'string' ? block.text : ''}
    </div>
  )
})

export const WikiDividerBlockView = memo(function WikiDividerBlockView() {
  return <hr className="my-4 border-neutral-200" />
})

type ImageProps = { block: ImageBlock }
export const WikiImageBlockView = memo(function WikiImageBlockView({ block }: ImageProps) {
  const path = typeof block.storagePath === 'string' ? block.storagePath : ''
  if (!path) {
    return <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Bilde mangler lagringssti.</p>
  }
  const w = block.width === 'wide' || block.width === 'medium' || block.width === 'full' ? block.width : 'medium'
  return <WikiImageBlock storagePath={path} caption={typeof block.caption === 'string' ? block.caption : undefined} width={w} />
})

type LawRefProps = { block: LawRefBlock }
export const WikiLawRefBlockView = memo(function WikiLawRefBlockView({ block }: LawRefProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
      <span className="mt-0.5 shrink-0 rounded bg-[#1a3d32]/10 px-1.5 py-0.5 font-mono text-xs text-[#1a3d32]">{block.ref}</span>
      <span className="flex-1 text-sm text-neutral-700">{block.description}</span>
      {block.url && (
        <a href={block.url} target="_blank" rel="noreferrer" className="shrink-0 text-[#1a3d32] hover:underline" title="Åpne på lovdata.no">
          <ExternalLink className="size-4" />
        </a>
      )}
    </div>
  )
})

type ModuleOrgChartProps = { params: Record<string, string | number | boolean> }
const WikiModuleOrgChartView = memo(function WikiModuleOrgChartView({ params: p }: ModuleOrgChartProps) {
  return <LiveOrgChart showAMU={p.showAMU !== false} showVerneombud={p.showVerneombud !== false} />
})

type ModuleRiskProps = { params: Record<string, string | number | boolean> }
const WikiModuleRiskFeedView = memo(function WikiModuleRiskFeedView({ params: p }: ModuleRiskProps) {
  return <LiveRiskFeed maxItems={typeof p.maxItems === 'number' ? p.maxItems : 3} showDepartment={p.showDepartment !== false} />
})

type ModuleActionProps = { params: Record<string, string | number | boolean> }
const WikiModuleActionButtonView = memo(function WikiModuleActionButtonView({ params: p }: ModuleActionProps) {
  return (
    <ActionButton
      label={typeof p.label === 'string' ? p.label : undefined}
      route={typeof p.route === 'string' ? p.route : undefined}
      variant={p.variant === 'secondary' ? 'secondary' : p.variant === 'danger' ? 'danger' : 'primary'}
    />
  )
})

type ModuleAckProps = {
  pageId: string
  pageVersion: number
  acknowledgementAnchorRef?: RefObject<HTMLDivElement | null>
}
const WikiModuleAckFooterView = memo(function WikiModuleAckFooterView({
  pageId,
  pageVersion,
  acknowledgementAnchorRef,
}: ModuleAckProps) {
  const footer = <AcknowledgementFooter pageId={pageId} pageVersion={pageVersion} />
  if (acknowledgementAnchorRef) {
    return (
      <div ref={acknowledgementAnchorRef} id="wiki-page-acknowledgement" className="wiki-ack-anchor scroll-mt-28">
        {footer}
      </div>
    )
  }
  return <Fragment>{footer}</Fragment>
})

type ModuleUnknownProps = { moduleName: string }
const WikiModuleUnknownView = memo(function WikiModuleUnknownView({ moduleName }: ModuleUnknownProps) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      Ukjent dynamisk modul: <code className="rounded bg-white px-1 font-mono text-xs">{moduleName}</code>
    </div>
  )
})

type ModuleBlockProps = {
  block: ModuleBlock
  pageId: string
  pageVersion: number
  acknowledgementAnchorRef?: RefObject<HTMLDivElement | null>
}
export const WikiModuleBlockView = memo(function WikiModuleBlockView({
  block,
  pageId,
  pageVersion,
  acknowledgementAnchorRef,
}: ModuleBlockProps) {
  const p = block.params ?? {}
  switch (block.moduleName) {
    case 'live_org_chart':
      return <WikiModuleOrgChartView params={p} />
    case 'live_risk_feed':
      return <WikiModuleRiskFeedView params={p} />
    case 'action_button':
      return <WikiModuleActionButtonView params={p} />
    case 'acknowledgement_footer':
      return (
        <WikiModuleAckFooterView
          pageId={pageId}
          pageVersion={pageVersion}
          acknowledgementAnchorRef={acknowledgementAnchorRef}
        />
      )
    default:
      return <WikiModuleUnknownView moduleName={typeof block.moduleName === 'string' ? block.moduleName : '(mangler navn)'} />
  }
})

type UnknownKindProps = { kind: string }
const WikiUnknownBlockView = memo(function WikiUnknownBlockView({ kind }: UnknownKindProps) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      Ukjent blokktype: <code className="rounded bg-white px-1 font-mono text-xs">{kind}</code>
    </div>
  )
})

const WikiInvalidBlockView = memo(function WikiInvalidBlockView() {
  return <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Ugyldig innholdsblokk (mangler type).</p>
})

export function WikiBlockRenderer({ blocks, pageId, pageVersion, acknowledgementAnchorRef }: Props) {
  const headingDomIds: (string | null)[] = []
  let headingOrd = 0
  for (const block of blocks) {
    if (block.kind !== 'heading') {
      headingDomIds.push(null)
      continue
    }
    const text = typeof block.text === 'string' ? block.text : ''
    headingDomIds.push(wikiHeadingDomId(headingOrd, text))
    headingOrd += 1
  }
  return (
    <div className="wiki-block-renderer space-y-4">
      {blocks.map((block, i) => {
        if (!block || typeof block !== 'object' || !('kind' in block)) {
          return <WikiInvalidBlockView key={i} />
        }
        switch (block.kind) {
          case 'heading': {
            const text = typeof block.text === 'string' ? block.text : ''
            const hid = headingDomIds[i] ?? wikiHeadingDomId(0, text)
            return <WikiHeadingBlockView key={i} block={block} domId={hid} />
          }
          case 'text':
            return <WikiTextBlockView key={i} block={block} />
          case 'alert':
            return <WikiAlertBlockView key={i} block={block} />
          case 'divider':
            return <WikiDividerBlockView key={i} />
          case 'image':
            return <WikiImageBlockView key={i} block={block} />
          case 'law_ref':
            return <WikiLawRefBlockView key={i} block={block} />
          case 'module':
            return (
              <WikiModuleBlockView
                key={i}
                block={block}
                pageId={pageId}
                pageVersion={pageVersion}
                acknowledgementAnchorRef={acknowledgementAnchorRef}
              />
            )
          default:
            return <WikiUnknownBlockView key={i} kind={String((block as { kind?: unknown }).kind)} />
        }
      })}
    </div>
  )
}
