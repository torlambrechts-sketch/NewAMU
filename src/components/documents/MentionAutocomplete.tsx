// MentionAutocomplete — textarea + popover for @-mentions of org members.
//
// The component stores plain text body (with literal `@Name` substrings) and a
// parallel list of mentioned user ids. On submit, the caller can build an HTML
// representation (spans with data-user-id) for notifyWikiMentions, while the
// stored body remains readable plain text — kept simple by design.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StandardTextarea } from '../ui/Textarea'

export type MentionUser = { id: string; displayName: string }

type Props = {
  value: string
  onChange: (next: string) => void
  /** Called whenever the set of mentioned user ids in the body changes. */
  onMentionsChange?: (userIds: string[]) => void
  users: MentionUser[]
  placeholder?: string
  rows?: number
  className?: string
  disabled?: boolean
  autoFocus?: boolean
}

type SuggestionState = {
  active: boolean
  query: string
  /** Index of `@` in the value (so we can splice on selection). */
  triggerIndex: number
  focusIndex: number
}

const INITIAL: SuggestionState = { active: false, query: '', triggerIndex: -1, focusIndex: 0 }

function extractMentions(text: string, users: MentionUser[]): string[] {
  if (!text) return []
  // Match @<DisplayName> where DisplayName can contain letters / numbers /
  // spaces / hyphens — we look for the longest leading match against the users
  // list so multi-word names (e.g. "Anne Lise") survive.
  const ids = new Set<string>()
  const sortedByLen = [...users].sort((a, b) => b.displayName.length - a.displayName.length)
  const lower = text.toLowerCase()
  for (const u of sortedByLen) {
    const needle = `@${u.displayName.toLowerCase()}`
    if (lower.includes(needle)) ids.add(u.id)
  }
  return [...ids]
}

export function MentionAutocomplete({
  value,
  onChange,
  onMentionsChange,
  users,
  placeholder,
  rows = 2,
  className,
  disabled,
  autoFocus,
}: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const [state, setState] = useState<SuggestionState>(INITIAL)

  const filtered = useMemo(() => {
    if (!state.active) return []
    const q = state.query.toLowerCase()
    return users
      .filter((u) => u.displayName.toLowerCase().includes(q))
      .slice(0, 6)
  }, [state, users])

  useEffect(() => {
    onMentionsChange?.(extractMentions(value, users))
  }, [value, users, onMentionsChange])

  const closeSuggestions = useCallback(() => setState(INITIAL), [])

  const insertMention = useCallback(
    (user: MentionUser) => {
      const ta = ref.current
      if (!ta || state.triggerIndex < 0) return
      const before = value.slice(0, state.triggerIndex)
      const afterCursor = value.slice(ta.selectionStart)
      const next = `${before}@${user.displayName} ${afterCursor}`
      onChange(next)
      closeSuggestions()
      // Restore caret after the inserted mention.
      requestAnimationFrame(() => {
        const ta2 = ref.current
        if (!ta2) return
        const caret = before.length + user.displayName.length + 2 // '@' + name + space
        ta2.setSelectionRange(caret, caret)
        ta2.focus()
      })
    },
    [value, state.triggerIndex, onChange, closeSuggestions],
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value
      onChange(next)
      const caret = e.target.selectionStart
      // Find the most recent `@` before the caret that is the start of a word.
      const upto = next.slice(0, caret)
      const at = upto.lastIndexOf('@')
      if (at === -1) {
        closeSuggestions()
        return
      }
      const charBefore = at === 0 ? ' ' : upto[at - 1]
      if (charBefore && /[^\s]/.test(charBefore)) {
        closeSuggestions()
        return
      }
      const query = upto.slice(at + 1)
      if (/\s/.test(query)) {
        closeSuggestions()
        return
      }
      setState({ active: true, query, triggerIndex: at, focusIndex: 0 })
    },
    [onChange, closeSuggestions],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!state.active || filtered.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setState((s) => ({ ...s, focusIndex: (s.focusIndex + 1) % filtered.length }))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setState((s) => ({ ...s, focusIndex: (s.focusIndex - 1 + filtered.length) % filtered.length }))
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(filtered[state.focusIndex])
      } else if (e.key === 'Escape') {
        closeSuggestions()
      }
    },
    [state, filtered, insertMention, closeSuggestions],
  )

  return (
    <div className="relative">
      <StandardTextarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={rows}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        autoFocus={autoFocus}
      />
      {state.active && filtered.length > 0 ? (
        <ul
          role="listbox"
          aria-label="Velg person"
          className="absolute left-2 z-30 mt-1 max-h-56 w-64 overflow-auto rounded-md border border-neutral-200 bg-white text-xs shadow-lg"
        >
          {filtered.map((u, idx) => (
            <li
              key={u.id}
              role="option"
              aria-selected={idx === state.focusIndex}
              className={`cursor-pointer px-3 py-1.5 ${
                idx === state.focusIndex ? 'bg-[#e8f4ec] text-neutral-900' : 'text-neutral-700 hover:bg-neutral-50'
              }`}
              onMouseDown={(e) => {
                // mousedown (not click) so we beat blur
                e.preventDefault()
                insertMention(u)
              }}
            >
              {u.displayName}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/* eslint-disable react-refresh/only-export-components -- helper colocated with component used together. */
/** Build an HTML representation of a body with mention spans, for notifyWikiMentions. */
export function bodyToMentionHtml(body: string, users: MentionUser[]): string {
  if (!body) return ''
  const sortedByLen = [...users].sort((a, b) => b.displayName.length - a.displayName.length)
  let html = escapeHtml(body)
  for (const u of sortedByLen) {
    const escapedName = escapeHtml(u.displayName)
    const needle = new RegExp(`@${escapeRegex(escapedName)}\\b`, 'g')
    html = html.replace(
      needle,
      `<span data-mention="true" data-user-id="${u.id}">@${escapedName}</span>`,
    )
  }
  return `<p>${html.replace(/\n/g, '<br />')}</p>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
