// SurveyBuilder — 3-column StudioCanvas builder for survey_org_templates.
//
// Left:   list of org's survey overrides
// Center: per-template body editor (JSON for the survey questions)
// Right:  override fields (name, description, law_refs)
//
// Saves write back to survey_org_templates. Mirrors the
// ComplianceBuilder pattern for visual + structural consistency.

import { useCallback, useMemo, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { StudioCanvas, type StudioCanvasAdapter } from '../../../src/components/studio/shell/StudioCanvas'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'

type OrgTemplateRow = {
  id: string
  catalog_id: string | null
  name_override: string | null
  description_override: string | null
  body_override: unknown | null
  pack: string | null
  is_active: boolean
  nav_pinned: boolean
}

export type SurveyBuilderProps = {
  templateId: string
}

export function SurveyBuilder({ templateId }: SurveyBuilderProps) {
  const { supabase, organization } = useOrgSetupContext()
  const [row, setRow] = useState<OrgTemplateRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bodyText, setBodyText] = useState('')
  const [bodyError, setBodyError] = useState<string | null>(null)
  const [loadedFromId, setLoadedFromId] = useState<string | null>(null)
  const [selected, setSelected] = useState<'body' | 'questions'>('body')

  // One-shot load when templateId resolves
  if (!loading && row?.id !== templateId && loadedFromId !== templateId) {
    setLoading(true)
    setLoadedFromId(templateId)
    void (async () => {
      if (!supabase || !organization) {
        setLoading(false)
        return
      }
      const { data, error: e } = await supabase
        .from('survey_org_templates')
        .select('id, catalog_id, name_override, description_override, body_override, pack, is_active, nav_pinned')
        .eq('id', templateId)
        .single()
      if (e) setError(e.message)
      else {
        setRow(data as OrgTemplateRow)
        setBodyText(JSON.stringify((data as OrgTemplateRow).body_override ?? {}, null, 2))
      }
      setLoading(false)
    })()
  }

  const update = useCallback((patch: Partial<OrgTemplateRow>) => {
    setRow((prev) => (prev ? { ...prev, ...patch } : prev))
    setDirty(true)
  }, [])

  const save = useCallback(async () => {
    if (!supabase || !row) return
    setSaving(true)
    setError(null)
    let body: unknown = row.body_override
    if (bodyText) {
      try {
        body = JSON.parse(bodyText)
      } catch (err) {
        setBodyError(err instanceof Error ? err.message : String(err))
        setSaving(false)
        return
      }
    }
    const { error: e } = await supabase
      .from('survey_org_templates')
      .update({
        name_override: row.name_override,
        description_override: row.description_override,
        body_override: body,
        is_active: row.is_active,
        nav_pinned: row.nav_pinned,
      })
      .eq('id', row.id)
    if (e) setError(e.message)
    else setDirty(false)
    setSaving(false)
  }, [supabase, row, bodyText])

  const adapter: StudioCanvasAdapter<'body' | 'questions'> = useMemo(
    () => ({
      items: ['body', 'questions'],
      getItemId: (s) => s,
      selectedId: selected,
      onSelect: (id) => setSelected(id as 'body' | 'questions'),
      renderItemLabel: (s) => (s === 'body' ? 'Spørsmål (JSON-body)' : 'Visningsinnstillinger'),
      renderEditor: (s) => {
        if (!row) return null
        if (s === 'body') {
          return (
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
                Body-override (JSON)
              </label>
              <StandardTextarea
                value={bodyText}
                onChange={(e) => {
                  setBodyText(e.target.value)
                  setDirty(true)
                  try {
                    JSON.parse(e.target.value)
                    setBodyError(null)
                  } catch (err) {
                    setBodyError(err instanceof Error ? err.message : String(err))
                  }
                }}
                className="h-[400px] w-full font-mono text-xs"
                spellCheck={false}
              />
              {bodyError ? <p className="text-xs text-red-700">JSON-feil: {bodyError}</p> : null}
            </div>
          )
        }
        return (
          <div className="space-y-3 text-xs">
            <p className="text-neutral-500">Visningsinnstillinger for organisasjonens overstyring.</p>
            <div className="flex items-center gap-2">
              <StandardInput
                type="checkbox"
                checked={row.is_active}
                onChange={(e) => update({ is_active: e.target.checked })}
                id="sv-active"
                className="h-4 w-4"
              />
              <label htmlFor="sv-active">Aktiv</label>
            </div>
            <div className="flex items-center gap-2">
              <StandardInput
                type="checkbox"
                checked={row.nav_pinned}
                onChange={(e) => update({ nav_pinned: e.target.checked })}
                id="sv-pin"
                className="h-4 w-4"
              />
              <label htmlFor="sv-pin">Festet i sidebar</label>
            </div>
          </div>
        )
      },
      renderProperties: () =>
        row ? (
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
                Navn-override
              </label>
              <StandardInput
                value={row.name_override ?? ''}
                onChange={(e) => update({ name_override: e.target.value || null })}
                placeholder="(overstyr katalog-navnet)"
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
                Beskrivelse-override
              </label>
              <StandardTextarea
                value={row.description_override ?? ''}
                onChange={(e) => update({ description_override: e.target.value || null })}
                className="mt-1 min-h-[80px] text-xs"
              />
            </div>
            <div className="text-[10px] text-neutral-500">
              Pakke: {row.pack ?? '–'} · Katalog-ID: {row.catalog_id ?? '–'}
            </div>
          </div>
        ) : null,
    }),
    [row, selected, bodyText, bodyError, update],
  )

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Laster mal…
      </div>
    )
  }
  if (!row) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Fant ikke mal-overstyring <code>{templateId}</code>.
      </div>
    )
  }

  return (
    <>
      <StudioCanvas
        title={`Undersøkelse · ${row.name_override ?? '(katalog-navn)'}`}
        subtitle={`Pakke ${row.pack ?? '–'} · ${row.is_active ? 'aktiv' : 'inaktiv'}`}
        headerActions={
          <Button variant="primary" size="sm" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {dirty ? 'Lagre' : 'Lagret'}
          </Button>
        }
        adapter={adapter}
      />
      {error ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      ) : null}
    </>
  )
}
