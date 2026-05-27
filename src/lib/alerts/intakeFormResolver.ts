// intakeFormResolver — resolve the active alert_intake_form_version for a
// (org, template) pair. Falls back to the system template definition's
// publicFormFields when no version row exists (legacy orgs not yet
// backfilled).

import type { SupabaseClient } from '@supabase/supabase-js'

export type IntakeFieldKind = 'text' | 'longtext' | 'select' | 'date_text' | 'attachment' | 'voice'

export type IntakeField = {
  key: string
  label: string
  kind: IntakeFieldKind
  required: boolean
  options?: string[]
  helpText?: string
  piiHint?: 'low' | 'medium' | 'high'
}

export type ResolvedIntakeForm = {
  versionId: string | null
  version: number
  fields: IntakeField[]
  privacyNoticeNb: string | null
  privacyNoticeEn: string | null
}

const DEFAULT_FIELDS: IntakeField[] = [
  {
    key: 'title',
    label: 'Kort tittel på forholdet',
    kind: 'text',
    required: true,
    helpText: 'En setning som beskriver hva varselet gjelder.',
    piiHint: 'low',
  },
  {
    key: 'description',
    label: 'Beskriv hva som har skjedd',
    kind: 'longtext',
    required: true,
    helpText:
      'Vi anbefaler å unngå navn på enkeltpersoner her, med mindre det er strengt nødvendig.',
    piiHint: 'high',
  },
  {
    key: 'occurred_at_text',
    label: 'Når skjedde det?',
    kind: 'text',
    required: false,
    helpText: 'F.eks. «forrige uke», «i fjor», en spesifikk dato.',
  },
]

export async function resolveIntakeForm(
  supabase: SupabaseClient,
  orgSlug: string,
  systemTemplateId: string,
): Promise<ResolvedIntakeForm | null> {
  // 1. Look up the org id via the public-slug.
  const { data: orgRow } = await supabase
    .from('organizations')
    .select('id')
    .eq('alerts_public_slug', orgSlug)
    .maybeSingle()
  if (!orgRow) return null

  // 2. Fetch the active intake form version for this (org, template).
  const { data: versionRow } = await supabase
    .from('alert_intake_form_version')
    .select('id, version, schema, privacy_notice_nb, privacy_notice_en')
    .eq('organization_id', (orgRow as { id: string }).id)
    .eq('system_template_id', systemTemplateId)
    .eq('active', true)
    .maybeSingle()

  if (versionRow) {
    const row = versionRow as {
      id: string
      version: number
      schema: unknown
      privacy_notice_nb: string | null
      privacy_notice_en: string | null
    }
    const fields = normaliseSchema(row.schema)
    return {
      versionId: row.id,
      version: row.version,
      fields: fields.length > 0 ? fields : DEFAULT_FIELDS,
      privacyNoticeNb: row.privacy_notice_nb,
      privacyNoticeEn: row.privacy_notice_en,
    }
  }

  // 3. Fallback: read the system template's definition.publicFormFields.
  const { data: tplRow } = await supabase
    .from('alert_system_templates')
    .select('definition')
    .eq('id', systemTemplateId)
    .maybeSingle()
  if (tplRow) {
    const definition = (tplRow as { definition: unknown }).definition
    const fields = normaliseSchema(
      typeof definition === 'object' && definition !== null
        ? (definition as { publicFormFields?: unknown }).publicFormFields ?? []
        : [],
    )
    return {
      versionId: null,
      version: 0,
      fields: fields.length > 0 ? fields : DEFAULT_FIELDS,
      privacyNoticeNb: null,
      privacyNoticeEn: null,
    }
  }

  return { versionId: null, version: 0, fields: DEFAULT_FIELDS, privacyNoticeNb: null, privacyNoticeEn: null }
}

function normaliseSchema(raw: unknown): IntakeField[] {
  const arr =
    Array.isArray(raw)
      ? raw
      : typeof raw === 'object' && raw !== null && Array.isArray((raw as { fields?: unknown }).fields)
        ? ((raw as { fields: unknown[] }).fields)
        : []
  const out: IntakeField[] = []
  for (const entry of arr) {
    if (!entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>
    const key = typeof e.key === 'string' ? e.key : null
    const label = typeof e.label === 'string' ? e.label : null
    const kind = typeof e.kind === 'string' ? e.kind : null
    if (!key || !label || !kind) continue
    if (!['text', 'longtext', 'select', 'date_text', 'attachment', 'voice'].includes(kind)) continue
    out.push({
      key,
      label,
      kind: kind as IntakeFieldKind,
      required: e.required === true,
      options: Array.isArray(e.options) ? e.options.filter((o): o is string => typeof o === 'string') : undefined,
      helpText: typeof e.helpText === 'string' ? e.helpText : undefined,
      piiHint: e.piiHint === 'low' || e.piiHint === 'medium' || e.piiHint === 'high' ? e.piiHint : undefined,
    })
  }
  return out
}
