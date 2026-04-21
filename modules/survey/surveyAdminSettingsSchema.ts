import { z } from 'zod'

/** Stored in `org_module_payloads` with `module_key = survey_settings`. */
export const SurveyModuleSettingsSchema = z
  .object({
    intro_html: z.string().max(20000).optional(),
    default_anonymous: z.boolean().optional(),
  })
  .strict()

export type SurveyModuleSettings = z.infer<typeof SurveyModuleSettingsSchema>

export function parseSurveyModuleSettings(raw: unknown): SurveyModuleSettings {
  const p = SurveyModuleSettingsSchema.safeParse(raw)
  return p.success ? p.data : SurveyModuleSettingsSchema.parse({})
}
