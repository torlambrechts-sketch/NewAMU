// LocationSelect — select from org locations + "Annet" free-text fallback.

import { useEffect, useRef, useState } from 'react'

type Props = {
  value: string
  onChange: (val: string) => void
  locationNames: string[]
  placeholder?: string
}

export function LocationSelect({ value, onChange, locationNames, placeholder = 'Velg sted…' }: Props) {
  const isKnown = value === '' || locationNames.includes(value)
  const [freeText, setFreeText] = useState(!isKnown ? value : '')
  const [showingFree, setShowingFree] = useState(!isKnown && value !== '')
  const freeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showingFree) freeRef.current?.focus()
  }, [showingFree])

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value
    if (v === '__other__') {
      setShowingFree(true)
      onChange(freeText)
    } else {
      setShowingFree(false)
      onChange(v)
    }
  }

  if (showingFree) {
    return (
      <div className="flex gap-1.5">
        <input
          ref={freeRef}
          type="text"
          value={freeText}
          onChange={(e) => { setFreeText(e.target.value); onChange(e.target.value) }}
          placeholder="Beskriv stedet…"
          className="flex-1 rounded border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#c2410c] focus:outline-none focus:ring-1 focus:ring-[#c2410c]/20"
        />
        <button
          type="button"
          onClick={() => { setShowingFree(false); onChange(''); setFreeText('') }}
          className="rounded border border-neutral-200 px-2.5 py-1 text-xs text-neutral-500 hover:bg-neutral-50"
        >
          Tilbake
        </button>
      </div>
    )
  }

  return (
    <select
      value={value}
      onChange={handleSelect}
      className="w-full rounded border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:border-[#c2410c] focus:outline-none focus:ring-1 focus:ring-[#c2410c]/20"
    >
      <option value="">{placeholder}</option>
      {locationNames.map((loc) => (
        <option key={loc} value={loc}>{loc}</option>
      ))}
      <option value="__other__">Annet sted / skriv inn…</option>
    </select>
  )
}
