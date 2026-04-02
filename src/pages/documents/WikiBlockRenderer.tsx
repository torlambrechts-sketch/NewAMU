import { ExternalLink } from 'lucide-react'
import type { ContentBlock } from '../../types/documents'
import { sanitizeLearningHtml } from '../../lib/sanitizeHtml'
import { LiveOrgChart } from './modules/LiveOrgChart'
import { LiveRiskFeed } from './modules/LiveRiskFeed'
import { ActionButton } from './modules/ActionButton'
import { AcknowledgementFooter } from './modules/AcknowledgementFooter'

type Props = {
  blocks: ContentBlock[]
  pageId: string
  pageVersion: number
}

const alertStyles = {
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  danger: 'border-red-200 bg-red-50 text-red-950',
  tip: 'border-emerald-200 bg-emerald-50 text-emerald-950',
}

const alertIcons = { info: 'ℹ️', warning: '⚠️', danger: '🚨', tip: '💡' }

export function WikiBlockRenderer({ blocks, pageId, pageVersion }: Props) {
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'heading': {
            const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3'
            const cls =
              block.level === 1
                ? 'text-2xl font-bold text-neutral-900 mt-6 mb-2'
                : block.level === 2
                  ? 'text-lg font-semibold text-neutral-800 mt-5 mb-1'
                  : 'text-base font-semibold text-neutral-700 mt-4 mb-1'
            return <Tag key={i} className={cls}>{block.text}</Tag>
          }

          case 'text':
            return (
              <div
                key={i}
                className="prose prose-sm max-w-none text-neutral-800 [&_a]:text-[#1a3d32] [&_a]:underline [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-neutral-200 [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-sm [&_th]:border [&_th]:border-neutral-200 [&_th]:bg-neutral-50 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-neutral-500"
                dangerouslySetInnerHTML={{ __html: sanitizeLearningHtml(block.body) }}
              />
            )

          case 'alert':
            return (
              <div key={i} className={`rounded-lg border px-4 py-3 text-sm ${alertStyles[block.variant]}`}>
                {alertIcons[block.variant]} {block.text}
              </div>
            )

          case 'divider':
            return <hr key={i} className="my-4 border-neutral-200" />

          case 'law_ref':
            return (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                <span className="mt-0.5 shrink-0 rounded bg-[#1a3d32]/10 px-1.5 py-0.5 font-mono text-xs text-[#1a3d32]">
                  {block.ref}
                </span>
                <span className="flex-1 text-sm text-neutral-700">{block.description}</span>
                {block.url && (
                  <a
                    href={block.url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-[#1a3d32] hover:underline"
                    title="Åpne på lovdata.no"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                )}
              </div>
            )

          case 'module': {
            const p = block.params ?? {}
            switch (block.moduleName) {
              case 'live_org_chart':
                return (
                  <LiveOrgChart
                    key={i}
                    showAMU={p.showAMU !== false}
                    showVerneombud={p.showVerneombud !== false}
                  />
                )
              case 'live_risk_feed':
                return (
                  <LiveRiskFeed
                    key={i}
                    maxItems={typeof p.maxItems === 'number' ? p.maxItems : 3}
                    showDepartment={p.showDepartment !== false}
                  />
                )
              case 'action_button':
                return (
                  <ActionButton
                    key={i}
                    label={typeof p.label === 'string' ? p.label : undefined}
                    route={typeof p.route === 'string' ? p.route : undefined}
                    variant={
                      p.variant === 'secondary' ? 'secondary'
                      : p.variant === 'danger' ? 'danger'
                      : 'primary'
                    }
                  />
                )
              case 'acknowledgement_footer':
                return (
                  <AcknowledgementFooter
                    key={i}
                    pageId={pageId}
                    pageVersion={pageVersion}
                  />
                )
              default:
                return null
            }
          }

          default:
            return null
        }
      })}
    </div>
  )
}
