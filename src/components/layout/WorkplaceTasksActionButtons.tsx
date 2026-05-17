import { ChevronDown, type LucideIcon, Plus } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import {
  WORKPLACE_TASKS_PRIMARY_BUTTON_CLASS,
  workplaceTasksPrimaryButtonStyle,
} from './workplaceTasksActionButtonKit'
import { Button } from '../ui/Button'

export type WorkplaceTasksSplitOption = {
  id: string
  label: string
  onSelect?: () => void
}

export type WorkplaceTasksPrimaryButtonProps = {
  label: string
  onClick?: () => void
  icon?: LucideIcon
  className?: string
}

/** Enkelt primærknapp — samme stil som «+ Ny oppgave» på Tasks */
export function WorkplaceTasksPrimaryButton({
  label,
  onClick,
  icon: Icon = Plus,
  className = '',
}: WorkplaceTasksPrimaryButtonProps) {
  return (
    <Button
      variant="primary"
      onClick={onClick}
      className={`${WORKPLACE_TASKS_PRIMARY_BUTTON_CLASS} ${className}`.trim()}
      style={workplaceTasksPrimaryButtonStyle()}
    >
      <Icon className="size-4 shrink-0" strokeWidth={2.5} />
      {label}
    </Button>
  )
}

export type WorkplaceTasksSplitButtonProps = {
  label: string
  options: WorkplaceTasksSplitOption[]
  onMainClick?: () => void
  icon?: LucideIcon
  className?: string
  /** Plassering av nedtrekksmeny */
  alignMenu?: 'start' | 'end'
}

/**
 * Primærknapp + chevron med nedtrekk — samme grunnstil som Tasks-primær,
 * delt visuelt (hovedhandling / flere valg).
 */
export function WorkplaceTasksSplitButton({
  label,
  options,
  onMainClick,
  icon: Icon = Plus,
  className = '',
  alignMenu = 'start',
}: WorkplaceTasksSplitButtonProps) {
  const menuId = useId()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  return (
    <div ref={wrapRef} className={`relative inline-flex ${className}`.trim()}>
      <div
        className="inline-flex overflow-hidden rounded-lg shadow-sm"
        style={workplaceTasksPrimaryButtonStyle()}
      >
        <Button
          variant="primary"
          onClick={onMainClick}
          className={`${WORKPLACE_TASKS_PRIMARY_BUTTON_CLASS} rounded-none shadow-none !px-4`}
        >
          <Icon className="size-4 shrink-0" strokeWidth={2.5} />
          {label}
        </Button>
        <Button
          variant="primary"
          size="icon"
          className="inline-flex h-auto w-10 shrink-0 items-center justify-center rounded-none border-l border-white/25 bg-transparent text-white"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-controls={menuId}
          onClick={() => setOpen((v) => !v)}
          aria-label="Flere valg"
        >
          <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </Button>
      </div>
      {open ? (
        <ul
          id={menuId}
          role="menu"
          className={`absolute top-[calc(100%+4px)] z-20 min-w-[12rem] rounded-lg border border-neutral-200 bg-white py-1 shadow-lg ${
            alignMenu === 'end' ? 'right-0' : 'left-0'
          }`}
        >
          {options.map((opt) => (
            <li key={opt.id} role="none">
              <Button
                variant="ghost"
                role="menuitem"
                className="w-full justify-start rounded-none px-3 py-2 text-left text-sm font-normal text-neutral-800 hover:bg-neutral-50"
                onClick={() => {
                  opt.onSelect?.()
                  close()
                }}
              >
                {opt.label}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export type WorkplaceTasksActionButtonsRowProps = {
  /** Innhold uten egen bakgrunn (typisk primær + split) */
  children: ReactNode
  className?: string
}

/** Rad med gjennomsiktig bakgrunn — for bruk på krem/hvit flate i layout eller sider */
export function WorkplaceTasksActionButtonsRow({ children, className = '' }: WorkplaceTasksActionButtonsRowProps) {
  return (
    <div className={`flex flex-wrap items-center gap-3 bg-transparent p-0 ${className}`.trim()}>{children}</div>
  )
}
