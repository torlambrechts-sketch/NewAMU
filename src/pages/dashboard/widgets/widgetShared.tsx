// Delte små-komponenter brukt av flere widgets.
//
// Vi gjenbruker /internkontroll-mønstre der vi kan (ModulePageShell
// rundt /dashboard-siden gjør all topp-chrome), men hver widget rendrer
// sin egen card-overskrift, KPI-tall, statusbadger og tabeller.
// Disse hjelperne er små for å holde widget-filene lesbare.

import type { ReactNode } from 'react'
import { type LucideIcon } from 'lucide-react'

// ── Card chrome ─────────────────────────────────────────────────────────────

export function WidgetCard({
  title,
  subtitle,
  rightSlot,
  children,
  bodyPad = true,
}: {
  title: string
  subtitle?: ReactNode
  rightSlot?: ReactNode
  children: ReactNode
  bodyPad?: boolean
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-100 px-5 py-3.5">
        <div className="min-w-0">
          <h3 className="font-serif text-base font-semibold leading-tight text-neutral-900">{title}</h3>
          {subtitle ? <div className="mt-0.5 text-[12px] text-neutral-500">{subtitle}</div> : null}
        </div>
        {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
      </header>
      <div className={bodyPad ? 'p-5' : ''}>{children}</div>
    </section>
  )
}

// ── KPI strip ───────────────────────────────────────────────────────────────

export function KpiStrip({ items }: { items: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'default' | 'dark' | 'success' | 'warn' | 'danger' }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((it, i) => {
        const dark = it.tone === 'dark'
        return (
          <div
            key={i}
            className={[
              'rounded-lg border px-4 py-3',
              dark ? 'border-[#1e2a3b] bg-[#0A1628] text-white' : 'border-neutral-200 bg-white',
            ].join(' ')}
          >
            <div className={['text-[10px] font-bold uppercase tracking-wider', dark ? 'text-neutral-400' : 'text-neutral-500'].join(' ')}>
              {it.label}
            </div>
            <div className={[
              'mt-1 font-serif text-2xl font-medium leading-none tabular-nums',
              it.tone === 'success' ? 'text-[#3F6B4F]' : it.tone === 'warn' ? 'text-[#B8761F]' : it.tone === 'danger' ? 'text-[#A03826]' : dark ? 'text-white' : 'text-neutral-900',
            ].join(' ')}>
              {it.value}
            </div>
            {it.sub ? (
              <div className={['mt-1.5 font-mono text-[11px]', dark ? 'text-neutral-300' : 'text-neutral-500'].join(' ')}>
                {it.sub}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

// ── Chips / badges ──────────────────────────────────────────────────────────

export function Chip({
  tone = 'paper',
  children,
}: {
  tone?: 'paper' | 'moss' | 'amber' | 'rust' | 'ink' | 'accent' | 'plum' | 'norge' | 'teal' | 'success' | 'warn' | 'danger' | 'info' | 'neutral'
  children: ReactNode
}) {
  const palette: Record<string, string> = {
    paper: 'bg-neutral-100 text-neutral-700 border-neutral-200',
    moss: 'bg-[#E4ECDF] text-[#3F6B4F] border-[#cad9c2]',
    amber: 'bg-[#F4E8D2] text-[#B8761F] border-[#e6cf99]',
    rust: 'bg-[#F0D9D2] text-[#A03826] border-[#e3b4a8]',
    ink: 'bg-neutral-100 text-neutral-700 border-neutral-200',
    accent: 'bg-[#E1E7F7] text-[#1F3A99] border-[#c7d3f4]',
    plum: 'bg-[#E8DDEE] text-[#5A2F6F] border-[#d4c4dc]',
    norge: 'bg-[#BA0C2F] text-white border-transparent',
    teal: 'bg-[#D7E5E5] text-[#266B6B] border-[#b4cbcb]',
    success: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    warn: 'bg-amber-100 text-amber-800 border-amber-200',
    danger: 'bg-red-100 text-red-800 border-red-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
    neutral: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${palette[tone]}`}>
      {children}
    </span>
  )
}

// ── Lawref tag ──────────────────────────────────────────────────────────────

export function LawRef({ code }: { code: string }) {
  return (
    <span className="inline-block rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10.5px] text-neutral-700">
      {code}
    </span>
  )
}

// ── Avatar ──────────────────────────────────────────────────────────────────

const AV_PALETTE = ['ink', 'norge', 'moss', 'plum', 'accent', 'teal']
function hashColour(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return AV_PALETTE[Math.abs(h) % AV_PALETTE.length]
}

export function Avatar({ name, userId, size = 'md' }: { name: string | null | undefined; userId?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const safe = (name && name.trim().length > 0) ? name : '?'
  const initials = (() => {
    const parts = safe.split(/\s+/).filter(Boolean)
    if (parts.length === 0) return '?'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  })()
  const colour = hashColour(userId ?? safe)
  const colourClass: Record<string, string> = {
    ink: 'bg-neutral-700 text-white',
    norge: 'bg-[#BA0C2F] text-white',
    moss: 'bg-[#3F6B4F] text-white',
    plum: 'bg-[#5A2F6F] text-white',
    accent: 'bg-[#3B5BDB] text-white',
    teal: 'bg-[#266B6B] text-white',
  }
  const sizeClass = size === 'sm' ? 'h-5 w-5 text-[9px]' : size === 'lg' ? 'h-8 w-8 text-[12px]' : 'h-6 w-6 text-[10px]'
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-white ${sizeClass} ${colourClass[colour]}`}
      title={safe}
    >
      {initials}
    </span>
  )
}

// ── Empty state ─────────────────────────────────────────────────────────────

export function EmptyState({ Icon, title, body }: { Icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
      <Icon className="mx-auto h-8 w-8 text-neutral-400" aria-hidden />
      <div className="mt-2 font-serif text-base font-medium text-neutral-700">{title}</div>
      <div className="mt-1 text-[12.5px] text-neutral-500">{body}</div>
    </div>
  )
}

// ── Pipe-separated facts list ───────────────────────────────────────────────

export function FactsRow({ items }: { items: ReactNode[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-neutral-500">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-3">
          {it}
          {i < items.length - 1 ? <span className="text-neutral-300">·</span> : null}
        </span>
      ))}
    </div>
  )
}
