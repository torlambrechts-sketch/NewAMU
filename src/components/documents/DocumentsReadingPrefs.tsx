import { useEffect, useState } from 'react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'

type FontKey = 'normal' | 'large' | 'xlarge'

export function DocumentsReadingPrefs() {
  const { profile, updateProfileFields } = useOrgSetupContext()
  const [font, setFont] = useState<FontKey>('normal')
  const [highContrast, setHighContrast] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    const f = profile?.doc_font_size
    setFont(f === 'large' || f === 'xlarge' ? f : 'normal')
    setHighContrast(Boolean(profile?.doc_high_contrast))
  }, [profile?.doc_font_size, profile?.doc_high_contrast])

  async function persist(nextFont: FontKey, nextHc: boolean) {
    setSaving(true)
    setMsg(null)
    try {
      await updateProfileFields({ doc_font_size: nextFont, doc_high_contrast: nextHc })
      setMsg('Lagret')
      window.setTimeout(() => setMsg(null), 2500)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Kunne ikke lagre')
    } finally {
      setSaving(false)
    }
  }

  return (
    <details className="mt-4 rounded-none border border-neutral-200/90 bg-white p-3 text-sm shadow-sm">
      <summary className="cursor-pointer font-medium text-neutral-800">Lesekomfort (din profil)</summary>
      <div className="mt-3 space-y-3 text-neutral-700">
        <div>
          <label htmlFor="doc-font-size" className="text-xs font-medium text-neutral-500">
            Tekststørrelse i dokumenter
          </label>
          <select
            id="doc-font-size"
            className="mt-1 w-full rounded-none border border-neutral-200 px-2 py-1.5 text-sm"
            value={font}
            disabled={saving}
            onChange={(e) => {
              const v = e.target.value as FontKey
              setFont(v)
              void persist(v, highContrast)
            }}
          >
            <option value="normal">Normal</option>
            <option value="large">Stor</option>
            <option value="xlarge">Ekstra stor</option>
          </select>
        </div>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={highContrast}
            disabled={saving}
            onChange={(e) => {
              const v = e.target.checked
              setHighContrast(v)
              void persist(font, v)
            }}
            className="size-4 rounded border-neutral-300 text-[#1a3d32]"
          />
          <span>Høy kontrast (hele dokumentmodulen)</span>
        </label>
        <p className="text-xs text-neutral-500">
          Innstillingene lagres på brukerprofilen og gjelder bibliotek, visning og redigering av dokumenter.
        </p>
        {msg ? <p className="text-xs text-emerald-700">{msg}</p> : null}
      </div>
    </details>
  )
}
