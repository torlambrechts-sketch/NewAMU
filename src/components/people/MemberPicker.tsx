// MemberPicker — searchable org-member select that returns BOTH the member's
// auth user id and display name, with a free-text fallback for people tracked
// without a login ("uten brukerkonto"). This is the H1.1 fix: writing
// assignee_user_id/owner_user_id (not just the name string) is what keeps
// "my work", workload and 1:1 features stable across renames.

import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/Button'
import { StandardInput } from '../ui/Input'
import { SearchableSelect } from '../ui/SearchableSelect'
import type { AssignableUser } from '../../hooks/useAssignableUsers'

export type MemberPickerValue = { userId: string | null; name: string }

type Props = {
  value: MemberPickerValue
  onChange: (val: MemberPickerValue) => void
  users: AssignableUser[]
  placeholder?: string
  /** Allow a name without a user account. Default true. */
  allowFreeText?: boolean
}

export function MemberPicker({
  value,
  onChange,
  users,
  placeholder = 'Velg person…',
  allowFreeText = true,
}: Props) {
  // Free-text mode = a name is set but no matching user id (legacy row or a
  // person without a login).
  const startFree = value.userId == null && value.name.trim().length > 0
  const [showingFree, setShowingFree] = useState(startFree)
  const [freeText, setFreeText] = useState(startFree ? value.name : '')
  const freeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showingFree) freeRef.current?.focus()
  }, [showingFree])

  const handleSelect = (v: string) => {
    if (v === '__other__') {
      setShowingFree(true)
      onChange({ userId: null, name: freeText })
      return
    }
    if (v === '') {
      onChange({ userId: null, name: '' })
      return
    }
    const m = users.find((u) => u.id === v)
    onChange({ userId: v, name: m?.displayName ?? value.name })
  }

  if (showingFree) {
    return (
      <div className="flex gap-1.5">
        <StandardInput
          ref={freeRef}
          value={freeText}
          onChange={(e) => {
            setFreeText(e.target.value)
            onChange({ userId: null, name: e.target.value })
          }}
          placeholder="Skriv navn (uten brukerkonto)…"
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setShowingFree(false)
            setFreeText('')
            onChange({ userId: null, name: '' })
          }}
        >
          Tilbake
        </Button>
      </div>
    )
  }

  // If a user id is selected but no longer in the member list (left the org),
  // keep showing the stored name rather than silently blanking the field.
  const known = value.userId != null && users.some((u) => u.id === value.userId)

  return (
    <SearchableSelect
      value={value.userId ?? ''}
      options={[
        { value: '', label: placeholder },
        ...(value.userId != null && !known
          ? [{ value: value.userId, label: value.name || 'Ukjent bruker' }]
          : []),
        ...users.map((u) => ({ value: u.id, label: u.displayName })),
        ...(allowFreeText
          ? [{ value: '__other__', label: 'Uten brukerkonto / skriv inn navn…' }]
          : []),
      ]}
      onChange={handleSelect}
    />
  )
}
