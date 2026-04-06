import { type CSSProperties, type ReactNode } from 'react'
import {
  layoutCardClass,
  layoutCardStyleObject,
  layoutRadiusClass,
  mergeLayoutPayload,
} from '../../lib/layoutLabTokens'
import { DEFAULT_LAYOUT_LAB, type LayoutLabPayload } from '../../types/layoutLab'
import { useUiThemeOptional } from '../../hooks/useUiTheme'

function usePayload(override?: LayoutLabPayload): LayoutLabPayload {
  const ctx = useUiThemeOptional()
  if (override) return mergeLayoutPayload(override)
  return ctx?.payload ?? DEFAULT_LAYOUT_LAB
}

/** Standard content card — uses Layout Lab cardStyle + radius */
export function AticsCard({
  children,
  className = '',
  payload: payloadOverride,
  style,
}: {
  children: ReactNode
  className?: string
  payload?: LayoutLabPayload
  style?: CSSProperties
}) {
  const payload = usePayload(payloadOverride)
  const card = layoutCardClass(payload)
  const cardStyle = layoutCardStyleObject(payload)
  return (
    <div className={`${card} ${className}`} style={{ ...cardStyle, ...style }}>
      {children}
    </div>
  )
}

type ModalSize = 'md' | 'lg' | 'xl'

const modalMax: Record<ModalSize, string> = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

/** Modal overlay — radius follows Layout Lab */
export function AticsModalFrame({
  open,
  title,
  onClose,
  children,
  size = 'md',
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  size?: ModalSize
}) {
  const payload = usePayload()
  const r = layoutRadiusClass(payload.radius)

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Lukk" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-[201] max-h-[90vh] w-full overflow-y-auto border border-neutral-200 bg-white shadow-2xl ${modalMax[size]} ${r}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"
          >
            Lukk
          </button>
        </div>
        <div className="px-5 py-4 text-sm text-neutral-700">{children}</div>
      </div>
    </div>
  )
}

/** Table wrapper: optional zebra/ruled from Layout Lab */
export function AticsTableShell({
  children,
  className = '',
  payload: payloadOverride,
}: {
  children: ReactNode
  className?: string
  payload?: LayoutLabPayload
}) {
  const payload = usePayload(payloadOverride)
  const r = layoutRadiusClass(payload.radius)
  return (
    <div className={`overflow-x-auto border border-neutral-200/80 bg-white/95 ${r} ${className}`}>
      <table className="w-full min-w-0 text-left text-sm">{children}</table>
    </div>
  )
}

/** Kanban column shell */
export function AticsKanbanColumn({
  title,
  children,
  payload: payloadOverride,
}: {
  title: string
  children: ReactNode
  payload?: LayoutLabPayload
}) {
  const payload = usePayload(payloadOverride)
  const r = layoutRadiusClass(payload.radius)
  const dense = payload.kanbanStyle === 'dense'
  const sharp = payload.kanbanStyle === 'sharp'
  const pad = dense ? 'gap-1 p-2' : 'gap-2 p-3'
  return (
    <div
      className={`flex flex-col ${pad} ${sharp ? 'rounded-none' : r} border border-neutral-200/70 bg-white/90`}
      style={sharp ? { borderRadius: 0 } : undefined}
    >
      <p className="mb-2 text-xs font-semibold text-neutral-600">{title}</p>
      <ul className="space-y-2">{children}</ul>
    </div>
  )
}

export function AticsKanbanCard({
  children,
  payload: payloadOverride,
}: {
  children: ReactNode
  payload?: LayoutLabPayload
}) {
  const payload = usePayload(payloadOverride)
  const sharp = payload.kanbanStyle === 'sharp'
  const dense = payload.kanbanStyle === 'dense'
  return (
    <li
      className={`border border-neutral-200 bg-neutral-50 ${
        sharp ? 'rounded-none' : 'rounded-lg'
      } ${dense ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'}`}
    >
      {children}
    </li>
  )
}
