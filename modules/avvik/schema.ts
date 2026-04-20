import { z } from 'zod'
import type { AvvikRow } from './types'

// Lenient schema — UUID fields use plain string so rows are never silently
// dropped due to format mismatches. Nullable fields with default(null) handle
// columns that may be absent from the DB response.
export const AvvikRowSchema: z.ZodType<AvvikRow> = z.object({
  id: z.string(),
  organization_id: z.string(),
  source: z.string().default(''),
  source_id: z.string().nullable().default(null),
  title: z.string().default(''),
  description: z.string().default(''),
  severity: z.enum(['low', 'medium', 'high', 'critical']).catch('medium' as const),
  status: z
    .enum(['open', 'in_progress', 'closed', 'rapportert', 'under_behandling', 'tiltak_iverksatt', 'lukket'])
    .catch('rapportert' as const),
  due_at: z.string().nullable().default(null),
  assigned_to: z.string().nullable().default(null),
  risk_probability: z.number().int().min(1).max(5).nullable().optional(),
  risk_consequence: z.number().int().min(1).max(5).nullable().optional(),
  risk_score: z.number().int().nullable().optional(),
  root_cause_analysis: z.string().nullable().default(null),
  closed_at: z.string().nullable().default(null),
  closed_by: z.string().nullable().default(null),
  deleted_at: z.string().nullable().default(null),
  created_by: z.string().nullable().default(null),
  created_at: z.string().default(''),
  updated_at: z.string().default(''),
}) as z.ZodType<AvvikRow>
