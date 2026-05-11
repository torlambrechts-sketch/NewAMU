// Avatar stack showing every user currently editing the page.
// Tooltip lists their currently-focused block when available.

import type { PresenceUser } from '../../hooks/useDocumentPresence'
import { initialsFromDisplayName } from '../../lib/presenceColor'

type Props = {
  users: PresenceUser[]
  currentUserId: string | undefined
  max?: number
}

export function DocumentPresenceStack({ users, currentUserId, max = 5 }: Props) {
  if (users.length === 0) return null
  const visible = users.slice(0, max)
  const overflow = Math.max(0, users.length - visible.length)
  return (
    <div className="flex items-center" aria-label="Aktive medredaktører">
      <ul className="flex -space-x-1.5">
        {visible.map((u) => {
          const isMe = u.userId === currentUserId
          const title = `${u.displayName}${isMe ? ' (deg)' : ''}`
          return (
            <li key={u.userId}>
              <span
                title={title}
                aria-label={title}
                className="inline-flex size-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold shadow-sm ring-1"
                style={{
                  backgroundColor: u.color.soft,
                  color: u.color.text,
                  ['--tw-ring-color' as string]: u.color.ring,
                }}
              >
                {initialsFromDisplayName(u.displayName)}
              </span>
            </li>
          )
        })}
        {overflow > 0 ? (
          <li>
            <span
              title={`${overflow} flere`}
              className="inline-flex size-7 items-center justify-center rounded-full border-2 border-white bg-neutral-200 text-[10px] font-semibold text-neutral-700 shadow-sm"
            >
              +{overflow}
            </span>
          </li>
        ) : null}
      </ul>
      <span className="ml-2 text-[11px] text-neutral-500">{users.length} aktiv{users.length === 1 ? '' : 'e'}</span>
    </div>
  )
}
