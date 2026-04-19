import { z } from 'zod'
import type { AvvikRow } from './types'

export const AvvikRowSchema: z.ZodType<AvvikRow> = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  source: z.string(),
  source_id: z.string().uuid().nullable(),
  title: z.string(),
  description: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum([
    'open',
    'in_progress',
    'closed',
    'rapportert',
    'under_behandling',
    'tiltak_iverksatt',
    'lukket',
  ]),
  due_at: z.string().nullable(),
  assigned_to: z.string().uuid().nullable().default(null),
  risk_probability: z.number().int().min(1).max(5).nullable().optional(),
  risk_consequence: z.number().int().min(1).max(5).nullable().optional(),
  risk_score: z.number().int().nullable().optional(),
  root_cause_analysis: z.string().nullable().default(null),
  closed_at: z.string().nullable().default(null),
  closed_by: z.string().uuid().nullable().default(null),
  deleted_at: z.string().nullable().default(null),
  created_by: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})
