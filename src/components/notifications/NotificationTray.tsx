import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, BellRing, X } from 'lucide-react'
import { useNotifications } from '../../hooks/useNotifications'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'

type Variant = 'sidebar' | 'topbar'

export function NotificationTray({ variant }: { variant: Variant }) {
  const { user } = useOrgSetupContext()
  const nav = useNavigate()
  const {
    prefs,
    items,
    unreadList,
    unreadCount,
    markRead,
    markAllRead,
    toast,
    dismissToast,
  } = useNotifications()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!user || !prefs.channels.inApp) return null

  const btnBase =
    variant === 'topbar'
      ? 'rounded-lg p-2 transition-colors hover:bg-white/10'
      : 'rounded-lg p-1.5 text-neutral-500 hover:bg-black/5 hover:text-neutral-800'

  return (
    <>
      {toast && prefs.toastEnabled ? (
        <div
          className={`fixed left-1/2 top-16 z-[200] flex w-[min(100%,28rem)] -translate-x-1/2 flex-col gap-2 rounded-none border border-amber-200/90 bg-amber-50 px-4 py-3 shadow-lg md:top-20 ${
            variant === 'topbar' ? 'text-neutral-900' : ''
          }`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-950">{toast.title}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-amber-900/90">{toast.body}</p>
            </div>
            <button
              type="button"
              onClick={dismissToast}
              className="shrink-0 rounded-none p-1 text-amber-800 hover:bg-amber-100"
              aria-label="Lukk"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-none bg-[#1a3d32] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#142e26]"
              onClick={() => {
                markRead(toast.id)
                dismissToast()
                nav(toast.href)
              }}
            >
              Åpne
            </button>
            <button
              type="button"
              className="rounded-none border border-amber-300/80 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100/80"
              onClick={dismissToast}
            >
              Lukk
            </button>
          </div>
        </div>
      ) : null}

      <div className="relative" ref={panelRef}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`relative ${btnBase} ${open ? (variant === 'topbar' ? 'bg-white/15' : 'bg-black/5 ring-1 ring-[#c9a227]/40') : ''}`}
          aria-label={`Varsler${unreadCount ? `, ${unreadCount} uleste` : ''}`}
          aria-expanded={open}
        >
          {unreadCount > 0 ? (
            <BellRing className={variant === 'topbar' ? 'size-5' : 'size-4'} aria-hidden />
          ) : (
            <Bell className={variant === 'topbar' ? 'size-5' : 'size-4'} aria-hidden />
          )}
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c9a227] px-1 text-[10px] font-bold text-[#1a1a1a]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </button>

        {open && (
          <div
            className={`absolute z-[150] mt-2 w-[min(100vw-2rem,22rem)] rounded-none border border-neutral-200 bg-white shadow-xl ${
              variant === 'topbar' ? 'right-0' : 'right-0'
            }`}
          >
            <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
              <span className="text-sm font-semibold text-neutral-900">Varsler</span>
              {items.length > 0 ? (
                <button
                  type="button"
                  className="text-xs font-medium text-[#1a3d32] hover:underline"
                  onClick={() => markAllRead()}
                >
                  Marker alle lest
                </button>
              ) : null}
            </div>
            <ul className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-neutral-500">Ingen varsler akkurat nå.</li>
              ) : (
                items.map((n) => {
                  const unread = unreadList.some((u) => u.id === n.id)
                  return (
                    <li key={n.id} className="border-b border-neutral-100 last:border-b-0">
                      <Link
                        to={n.href}
                        onClick={() => {
                          markRead(n.id)
                          setOpen(false)
                        }}
                        className={`block px-3 py-2.5 text-left transition-colors hover:bg-neutral-50 ${
                          unread ? 'bg-amber-50/40' : ''
                        }`}
                      >
                        <p className="text-xs font-semibold text-neutral-900">{n.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-neutral-600">{n.body}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-neutral-400">
                          {n.category.replace('_', ' ')}
                        </p>
                      </Link>
                    </li>
                  )
                })
              )}
            </ul>
            <div className="border-t border-neutral-200 px-3 py-2">
              <Link
                to="/profile"
                onClick={() => setOpen(false)}
                className="text-xs font-medium text-[#1a3d32] hover:underline"
              >
                Varslingsinnstillinger →
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
