// AmlKlarertFeed — mixed-kind feed (lov / klarert / tip) on the AML
// dashboard's right column. Design source:
// ui_kits/aml-compliance/AmlPieces2.jsx KlarertFeed.

import { ChevronRight, Lightbulb, Pin, Scale, Sparkles } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { ModuleSectionCard } from '../module/ModuleSectionCard'
import type { AmlFeedItem, AmlFeedKind } from '../../data/amlComplianceSeed'

const SERIF = "'Libre Baskerville', Georgia, serif"

const FEED_KIND: Record<
  AmlFeedKind,
  {
    icon: ComponentType<SVGProps<SVGSVGElement>>
    label: string
    bg: string
    text: string
    border: string
  }
> = {
  lov: { icon: Scale, label: 'Lovendring', bg: '#e7efe9', text: '#1a3d32', border: '#c5d3c8' },
  klarert: { icon: Sparkles, label: 'Fra Klarert', bg: '#F1ECDF', text: '#854d0e', border: '#fde68a' },
  tip: { icon: Lightbulb, label: 'Tips', bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
}

export function AmlKlarertFeed({ feed }: { feed: AmlFeedItem[] }) {
  return (
    <ModuleSectionCard className="!p-0">
      <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-md"
              style={{ background: '#1a3d32' }}
            >
              <span
                className="text-[14px] font-bold text-white"
                style={{ fontFamily: SERIF }}
              >
                K
              </span>
            </span>
            <h2
              className="text-lg font-semibold tracking-tight text-neutral-900 sm:text-xl"
              style={{ fontFamily: SERIF }}
            >
              Fra Klarert
            </h2>
          </div>
          <p className="mt-1 text-xs text-neutral-600">
            Lovendringer, produktoppdateringer og fagtips — kuratert for AML.
          </p>
        </div>
        <button
          type="button"
          className="text-xs text-neutral-500 hover:text-neutral-800"
        >
          Alle
        </button>
      </div>

      <ul className="divide-y divide-neutral-100">
        {feed.map((it, i) => {
          const k = FEED_KIND[it.kind]
          const Icon = k.icon
          return (
            <li
              key={i}
              className="relative flex items-start gap-3 px-5 py-4 hover:bg-neutral-50/60"
            >
              {it.pinned ? (
                <span
                  aria-hidden
                  className="absolute left-0 top-0 h-full w-0.5 bg-[#c9a227]"
                />
              ) : null}
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border"
                style={{ background: k.bg, color: k.text, borderColor: k.border }}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: k.text }}
                  >
                    {k.label}
                  </span>
                  <span className="text-[11px] text-neutral-500">{it.date}</span>
                  {it.pinned ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#854d0e]">
                      <Pin className="h-3 w-3" /> Festet
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-sm font-semibold text-neutral-900">{it.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-neutral-600">{it.body}</p>
                <button
                  type="button"
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[#1a3d32] hover:underline"
                >
                  {it.cta} <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </ModuleSectionCard>
  )
}
