// Shared building blocks for the Klarert Admin sections.
// Keeps section files focused on their own data and layout.

import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

export function AdminCard({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}
    >
      {children}
    </div>
  )
}

export function AdminInfoBanner({
  icon,
  title,
  description,
  right,
}: {
  icon: ReactNode
  title: string
  description: string
  right?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-[#1a3d32]/20 bg-[#e7efe9]/30 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 text-[#1a3d32]">{icon}</div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
          <p className="mt-0.5 text-[12px] text-neutral-700">{description}</p>
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </div>
  )
}

export function AdminLoading({ label = 'Laster…' }: { label?: string }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-sm text-neutral-500">
      <Loader2 className="h-5 w-5 animate-spin text-[#1a3d32]" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function AdminError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-900">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

export function AdminEmpty({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-neutral-200 px-3 py-6 text-center text-[12px] text-neutral-500">
      {message}
    </div>
  )
}

export function ComplianceCheck({
  label,
  met,
  note,
}: {
  label: string
  met: boolean
  note: string
}) {
  const cls = met
    ? 'border-green-200 bg-green-50/40'
    : 'border-amber-200 bg-amber-50/40'
  const iconCls = met ? 'text-green-700' : 'text-amber-700'
  const textCls = met ? 'text-green-900' : 'text-amber-900'
  const noteCls = met ? 'text-green-800' : 'text-amber-800'
  return (
    <div className={`rounded-md border p-3 ${cls}`}>
      <div className="flex items-center gap-2">
        {met ? (
          <CheckCircle2 className={`h-4 w-4 ${iconCls}`} aria-hidden="true" />
        ) : (
          <AlertCircle className={`h-4 w-4 ${iconCls}`} aria-hidden="true" />
        )}
        <span className={`text-xs font-semibold ${textCls}`}>{label}</span>
      </div>
      <div className={`mt-0.5 text-[10px] ${noteCls}`}>{note}</div>
    </div>
  )
}

/** Small coloured avatar derived from initials of a display name. */
export function Initials({
  name,
  size = 26,
  tone = 'forest',
}: {
  name: string
  size?: number
  tone?: 'forest' | 'cream' | 'sand'
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('')

  const palette: Record<string, { bg: string; fg: string }> = {
    forest: { bg: '#1a3d32', fg: '#ffffff' },
    cream: { bg: '#fbf9f3', fg: '#1a3d32' },
    sand: { bg: '#e7efe9', fg: '#14312a' },
  }
  const { bg, fg } = palette[tone] ?? palette.forest
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center rounded-full font-semibold uppercase"
      style={{
        height: `${size}px`,
        width: `${size}px`,
        background: bg,
        color: fg,
        fontSize: Math.max(10, Math.floor(size * 0.42)),
      }}
    >
      {initials || '·'}
    </span>
  )
}

export const ADMIN_TABLE_TH =
  'whitespace-nowrap px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500'
export const ADMIN_TABLE_TR_BODY =
  'border-t border-neutral-100 hover:bg-neutral-50/60'

export const ADMIN_SERIF = "'Libre Baskerville', Georgia, 'Times New Roman', serif"
