// StrategyVisionEditor — inline-redigerbar visjons-/misjonsblokk for
// Arbeidsmiljøstrategi-siden. Klikker man "Rediger" får man en
// kompakt textarea-form. RLS sørger for at lagring kun går gjennom
// for de som har rett tilgang; UI deaktiverer knappen for andre.

import { useState } from 'react'
import { Pencil, Save, X } from 'lucide-react'

export type StrategyVisionEditorProps = {
  visionMd: string | null | undefined
  missionMd: string | null | undefined
  canManage: boolean
  onSave: (next: { vision_md: string | null; mission_md: string | null }) => Promise<void> | void
}

export function StrategyVisionEditor({
  visionMd,
  missionMd,
  canManage,
  onSave,
}: StrategyVisionEditorProps) {
  const [editing, setEditing] = useState(false)
  const [vision, setVision] = useState(visionMd ?? '')
  const [mission, setMission] = useState(missionMd ?? '')
  const [saving, setSaving] = useState(false)

  const startEdit = () => {
    setVision(visionMd ?? '')
    setMission(missionMd ?? '')
    setEditing(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({
        vision_md: vision.trim() ? vision.trim() : null,
        mission_md: mission.trim() ? mission.trim() : null,
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-5">
        <div className="space-y-4">
          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wide text-amber-900">Visjon</span>
            <textarea
              value={vision}
              onChange={(e) => setVision(e.target.value)}
              rows={3}
              placeholder="Hva slags arbeidsmiljø ønsker dere å skape?"
              className="mt-1 w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wide text-amber-900">Misjon</span>
            <textarea
              value={mission}
              onChange={(e) => setMission(e.target.value)}
              rows={3}
              placeholder="Hvordan jobber dere systematisk for å nå dit?"
              className="mt-1 w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-700 disabled:opacity-60"
          >
            <Save className="h-4 w-4" aria-hidden /> Lagre
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            <X className="h-4 w-4" aria-hidden /> Avbryt
          </button>
        </div>
      </div>
    )
  }

  const hasContent = (visionMd && visionMd.trim()) || (missionMd && missionMd.trim())

  return (
    <div className="rounded-lg border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          {hasContent ? (
            <div className="space-y-4">
              {visionMd && visionMd.trim() && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-900">Visjon</h3>
                  <p className="mt-1 whitespace-pre-wrap text-base leading-relaxed text-neutral-900">{visionMd}</p>
                </div>
              )}
              {missionMd && missionMd.trim() && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-900">Misjon</h3>
                  <p className="mt-1 whitespace-pre-wrap text-base leading-relaxed text-neutral-800">{missionMd}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-neutral-600">
              <p className="font-semibold text-neutral-900">Ikke formulert ennå</p>
              <p className="mt-1">
                Sett ord på hvilket arbeidsmiljø dere ønsker å skape. Strategien gjør at AMU,
                ledere og ansatte alle ser hva verktøyene jobber mot.
              </p>
            </div>
          )}
        </div>
        {canManage && (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-semibold text-amber-900 shadow-sm transition-colors hover:bg-amber-50"
          >
            <Pencil className="h-4 w-4" aria-hidden /> Rediger
          </button>
        )}
      </div>
    </div>
  )
}
