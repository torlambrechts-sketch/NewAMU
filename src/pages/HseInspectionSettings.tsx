import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, Upload } from 'lucide-react'
import { buildDefaultInspectionConfig } from '../data/hseInspectionDefaults'
import { normalizeInspectionConfig, normalizeTemplate } from '../lib/hseInspectionNormalize'
import { useHse } from '../hooks/useHse'
import type {
  HseInspectionConfig,
  InspectionFieldType,
  InspectionTemplateField,
  HseRoleGroup,
  InspectionPermission,
} from '../types/inspectionModule'

const fieldTypeLabels: Record<InspectionFieldType, string> = {
  yes_no_na: 'Ja / Nei / N/A',
  text: 'Fritekst',
  number: 'Tall',
  photo_required: 'Bilde (obligatorisk)',
  photo_optional: 'Bilde (valgfritt)',
}

const roleLabels: Record<HseRoleGroup, string> = {
  inspector: 'Inspektør',
  verneombud: 'Verneombud',
  management: 'Ledelse',
  hms_coordinator: 'HMS-koordinator',
  employee: 'Medarbeider',
}

const permLabels: Record<InspectionPermission, string> = {
  create: 'Opprette',
  execute: 'Utføre',
  approve: 'Godkjenne',
  delete: 'Slette',
}

export function HseInspectionSettings() {
  const hse = useHse()
  const cfg = hse.inspectionModuleConfig
  const [draft, setDraft] = useState<HseInspectionConfig>(() => structuredClone(cfg))
  const [importErr, setImportErr] = useState<string | null>(null)

  useEffect(() => {
    setDraft(structuredClone(cfg))
  }, [cfg])

  const selectedTplId = draft.templates[0]?.id ?? ''
  const [activeTplId, setActiveTplId] = useState(selectedTplId)
  const activeTpl = draft.templates.find((t) => t.id === activeTplId) ?? draft.templates[0]

  const saveAll = () => {
    hse.replaceInspectionConfig(normalizeInspectionConfig(draft))
  }

  const addTemplate = () => {
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    const t = normalizeTemplate({
      id,
      name: 'Ny mal',
      fields: [],
      createdAt: now,
      updatedAt: now,
    })
    setDraft((d) => ({ ...d, templates: [...d.templates, t] }))
    setActiveTplId(id)
  }

  const addField = (templateId: string) => {
    const f: InspectionTemplateField = {
      id: crypto.randomUUID(),
      order: 999,
      label: 'Nytt punkt',
      fieldType: 'yes_no_na',
      required: true,
    }
    setDraft((d) => ({
      ...d,
      templates: d.templates.map((tpl) =>
        tpl.id === templateId
          ? {
              ...tpl,
              fields: [...tpl.fields, f].map((x, i) => ({ ...x, order: i })),
              updatedAt: new Date().toISOString(),
            }
          : tpl,
      ),
    }))
  }

  const updateField = (templateId: string, fieldId: string, patch: Partial<InspectionTemplateField>) => {
    setDraft((d) => ({
      ...d,
      templates: d.templates.map((tpl) =>
        tpl.id === templateId
          ? {
              ...tpl,
              fields: tpl.fields.map((fld) => (fld.id === fieldId ? { ...fld, ...patch } : fld)),
              updatedAt: new Date().toISOString(),
            }
          : tpl,
      ),
    }))
  }

  const removeField = (templateId: string, fieldId: string) => {
    setDraft((d) => ({
      ...d,
      templates: d.templates.map((tpl) =>
        tpl.id === templateId
          ? {
              ...tpl,
              fields: tpl.fields.filter((x) => x.id !== fieldId).map((x, i) => ({ ...x, order: i })),
              updatedAt: new Date().toISOString(),
            }
          : tpl,
      ),
    }))
  }

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6 md:px-8">
      <nav className="mb-4 text-sm text-neutral-600">
        <Link to="/hse?tab=inspections" className="inline-flex items-center gap-1 text-[#1a3d32] hover:underline">
          <ArrowLeft className="size-4" /> Tilbake til inspeksjoner
        </Link>
      </nav>

      <h1 className="text-2xl font-semibold text-neutral-900">Inspeksjonsmodul — innstillinger</h1>
      <p className="mt-2 text-sm text-neutral-600">
        {cfg.configSourceNote}
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={saveAll}
          className="rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white"
        >
          Lagre konfigurasjon
        </button>
        <button
          type="button"
          onClick={() => {
            const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = `hse-inspection-config-${new Date().toISOString().slice(0, 10)}.json`
            a.click()
            URL.revokeObjectURL(a.href)
          }}
          className="inline-flex items-center gap-1 rounded-full border border-neutral-300 px-4 py-2 text-sm"
        >
          <Download className="size-4" /> Eksporter JSON
        </button>
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-neutral-300 px-4 py-2 text-sm">
          <Upload className="size-4" /> Importer JSON
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              setImportErr(null)
              if (!file) return
              const reader = new FileReader()
              reader.onload = () => {
                try {
                  const parsed = JSON.parse(String(reader.result))
                  setDraft(normalizeInspectionConfig(parsed))
                } catch {
                  setImportErr('Kunne ikke lese JSON')
                }
              }
              reader.readAsText(file)
              e.target.value = ''
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            if (confirm('Tilbakestille til standardmal?')) {
              setDraft(buildDefaultInspectionConfig(new Date().toISOString()))
            }
          }}
          className="text-sm text-amber-800 underline"
        >
          Tilbakestill til standard
        </button>
      </div>
      {importErr ? <p className="mt-2 text-sm text-red-600">{importErr}</p> : null}

      <section className="mt-10 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">Inspeksjonstyper</h2>
        <p className="mt-1 text-xs text-neutral-500">Knyttes til én skjemamal hver.</p>
        <ul className="mt-4 space-y-3">
          {draft.inspectionTypes.map((it) => (
            <li key={it.id} className="rounded-lg border border-neutral-100 bg-[#faf8f4] p-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <input
                  value={it.name}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      inspectionTypes: d.inspectionTypes.map((x) =>
                        x.id === it.id ? { ...x, name: e.target.value } : x,
                      ),
                    }))
                  }
                  className="min-w-[180px] flex-1 rounded border px-2 py-1"
                />
                <select
                  value={it.templateId}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      inspectionTypes: d.inspectionTypes.map((x) =>
                        x.id === it.id ? { ...x, templateId: e.target.value } : x,
                      ),
                    }))
                  }
                  className="rounded border px-2 py-1"
                >
                  {draft.templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={it.active}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        inspectionTypes: d.inspectionTypes.map((x) =>
                          x.id === it.id ? { ...x, active: e.target.checked } : x,
                        ),
                      }))
                    }
                  />
                  Aktiv
                </label>
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-3 text-sm text-[#1a3d32] underline"
          onClick={() => {
            const tpl = draft.templates[0]
            if (!tpl) return
            setDraft((d) => ({
              ...d,
              inspectionTypes: [
                ...d.inspectionTypes,
                {
                  id: crypto.randomUUID(),
                  name: 'Ny inspeksjonstype',
                  templateId: tpl.id,
                  order: d.inspectionTypes.length,
                  active: true,
                },
              ],
            }))
          }}
        >
          + Legg til type
        </button>
      </section>

      <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-neutral-900">Skjemamaler</h2>
          <button type="button" onClick={addTemplate} className="text-sm text-[#1a3d32] underline">
            + Ny mal
          </button>
        </div>
        <select
          value={activeTpl?.id}
          onChange={(e) => setActiveTplId(e.target.value)}
          className="mt-3 w-full max-w-md rounded border px-2 py-2 text-sm"
        >
          {draft.templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {activeTpl ? (
          <div className="mt-4">
            <label className="text-xs text-neutral-500">Malnavn</label>
            <input
              value={activeTpl.name}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  templates: d.templates.map((t) =>
                    t.id === activeTpl.id ? { ...t, name: e.target.value } : t,
                  ),
                }))
              }
              className="mt-1 w-full rounded border px-2 py-1 text-sm"
            />
            <h3 className="mt-4 text-sm font-medium text-neutral-800">Sjekkpunkter</h3>
            <ul className="mt-2 space-y-3">
              {activeTpl.fields.map((fld) => (
                <li key={fld.id} className="rounded border border-neutral-100 p-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      value={fld.label}
                      onChange={(e) => updateField(activeTpl.id, fld.id, { label: e.target.value })}
                      className="rounded border px-2 py-1 text-sm sm:col-span-2"
                    />
                    <select
                      value={fld.fieldType}
                      onChange={(e) =>
                        updateField(activeTpl.id, fld.id, { fieldType: e.target.value as InspectionFieldType })
                      }
                      className="rounded border px-2 py-1 text-xs"
                    >
                      {(Object.keys(fieldTypeLabels) as InspectionFieldType[]).map((k) => (
                        <option key={k} value={k}>
                          {fieldTypeLabels[k]}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={fld.required ?? false}
                        onChange={(e) => updateField(activeTpl.id, fld.id, { required: e.target.checked })}
                      />
                      Obligatorisk
                    </label>
                    {fld.fieldType === 'number' ? (
                      <>
                        <input
                          type="number"
                          placeholder="min"
                          value={fld.min ?? ''}
                          onChange={(e) =>
                            updateField(activeTpl.id, fld.id, {
                              min: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                          className="rounded border px-2 py-1 text-xs"
                        />
                        <input
                          type="number"
                          placeholder="max"
                          value={fld.max ?? ''}
                          onChange={(e) =>
                            updateField(activeTpl.id, fld.id, {
                              max: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                          className="rounded border px-2 py-1 text-xs"
                        />
                      </>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="mt-2 text-xs text-red-600"
                    onClick={() => removeField(activeTpl.id, fld.id)}
                  >
                    Fjern punkt
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-3 text-sm text-[#1a3d32] underline"
              onClick={() => addField(activeTpl.id)}
            >
              + Legg til sjekkpunkt
            </button>
          </div>
        ) : null}
      </section>

      <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">Lokasjoner og objekter</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {draft.locations.map((loc) => (
            <li key={loc.id} className="flex flex-wrap items-center gap-2 rounded bg-neutral-50 px-2 py-1">
              <span className="text-xs uppercase text-neutral-500">{loc.kind}</span>
              <input
                value={loc.name}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    locations: d.locations.map((l) => (l.id === loc.id ? { ...l, name: e.target.value } : l)),
                  }))
                }
                className="flex-1 rounded border px-2 py-1"
              />
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-3 text-sm text-[#1a3d32] underline"
          onClick={() =>
            setDraft((d) => ({
              ...d,
              locations: [
                ...d.locations,
                {
                  id: crypto.randomUUID(),
                  kind: 'room',
                  name: 'Ny lokasjon',
                  order: d.locations.length,
                },
              ],
            }))
          }
        >
          + Legg til lokasjon
        </button>
      </section>

      <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">Roller og rettigheter (konfig)</h2>
        <p className="mt-1 text-xs text-neutral-600">
          I produksjon kobles dette til Firebase Auth / custom claims. Her vises reglene som dokumentasjon og for
          fremtidig håndheving.
        </p>
        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-neutral-500">
              <th className="py-2">Rolle</th>
              <th className="py-2">Rettigheter</th>
            </tr>
          </thead>
          <tbody>
            {draft.roleRules.map((r) => (
              <tr key={r.id} className="border-b border-neutral-50">
                <td className="py-2">{roleLabels[r.roleGroup]}</td>
                <td className="py-2">
                  {r.permissions.map((p) => permLabels[p]).join(', ')}
                  {r.inspectionTypeIds?.length ? (
                    <span className="ml-1 text-xs text-neutral-500">
                      (kun typer: {r.inspectionTypeIds.join(', ')})
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">Arbeidsflyt / statuser</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
          {draft.statusFlow
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((s) => (
              <li key={s.id}>
                {s.label}
                {s.isInitial ? ' (start)' : ''}
                {s.isTerminal ? ' (slutt)' : ''}
              </li>
            ))}
        </ol>
      </section>

      <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">Tidsplaner</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {draft.schedules.map((sch) => (
            <li key={sch.id} className="rounded border border-neutral-100 px-3 py-2">
              <strong>{sch.name}</strong> — hver {sch.intervalValue} {sch.intervalUnit}
              {sch.nextDueAt ? (
                <span className="text-neutral-600"> · neste: {new Date(sch.nextDueAt).toLocaleString('nb-NO')}</span>
              ) : null}
              <label className="ml-2 text-xs">
                <input
                  type="checkbox"
                  checked={sch.active}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      schedules: d.schedules.map((x) =>
                        x.id === sch.id ? { ...x, active: e.target.checked } : x,
                      ),
                    }))
                  }
                />{' '}
                aktiv
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">Avvik — alvorlighetsgrad</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {draft.deviationSeverities
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((d) => (
              <li key={d.id}>
                {d.label} — standard frist {d.defaultDueDays} dager
              </li>
            ))}
        </ul>
      </section>

      <div className="mt-8">
        <button
          type="button"
          onClick={saveAll}
          className="rounded-full bg-[#1a3d32] px-5 py-2.5 text-sm font-medium text-white"
        >
          Lagre alt
        </button>
      </div>
    </div>
  )
}
