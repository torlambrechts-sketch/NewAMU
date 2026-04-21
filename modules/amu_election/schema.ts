import { z } from 'zod'
import type {
  AmuElectionCandidateRow,
  AmuElectionModuleSettings,
  AmuElectionRow,
  AmuElectionVoteRow,
  AmuElectionVoterRow,
} from './types'

export const AmuElectionStatusSchema = z.enum(['draft', 'nomination', 'voting', 'closed'])

export const AmuElectionCandidateStatusSchema = z.enum(['nominated', 'approved'])

export const AmuElectionRowSchema = z
  .object({
    id: z.string().uuid(),
    organization_id: z.string().uuid(),
    title: z.string().min(1),
    status: AmuElectionStatusSchema,
    start_date: z.string(),
    end_date: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict()

export const AmuElectionCandidateRowSchema = z
  .object({
    id: z.string().uuid(),
    election_id: z.string().uuid(),
    organization_id: z.string().uuid(),
    user_id: z.string().uuid(),
    manifesto: z.string(),
    status: AmuElectionCandidateStatusSchema,
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict()

export const AmuElectionVoterRowSchema = z
  .object({
    id: z.string().uuid(),
    election_id: z.string().uuid(),
    organization_id: z.string().uuid(),
    user_id: z.string().uuid(),
    has_voted: z.boolean(),
    voted_at: z.string().nullable(),
    created_at: z.string(),
  })
  .strict()

export const AmuElectionCommitteeMemberSchema = z
  .object({
    user_id: z.string().uuid(),
    role_label: z.string().max(200),
  })
  .strict()

export const AmuElectionModuleSettingsSchema = z
  .object({
    minimum_voting_days: z.number().int().min(1).max(365).default(3),
    election_committee: z.array(AmuElectionCommitteeMemberSchema).default([]),
  })
  .strict()

export function parseAmuElectionModuleSettings(raw: unknown): AmuElectionModuleSettings {
  return AmuElectionModuleSettingsSchema.parse(raw ?? {})
}

export const AmuElectionVoteRowSchema = z
  .object({
    id: z.string().uuid(),
    election_id: z.string().uuid(),
    organization_id: z.string().uuid(),
    candidate_id: z.string().uuid(),
    created_at: z.string(),
  })
  .strict()

export function parseAmuElectionRow(row: unknown): AmuElectionRow {
  return AmuElectionRowSchema.parse(row)
}

export function parseAmuElectionCandidateRow(row: unknown): AmuElectionCandidateRow {
  return AmuElectionCandidateRowSchema.parse(row)
}

export function parseAmuElectionVoterRow(row: unknown): AmuElectionVoterRow {
  return AmuElectionVoterRowSchema.parse(row)
}

export function parseAmuElectionVoteRow(row: unknown): AmuElectionVoteRow {
  return AmuElectionVoteRowSchema.parse(row)
}

export function collectParsedAmuElections(rows: unknown[]): AmuElectionRow[] {
  return rows.map((r) => parseAmuElectionRow(r))
}

export function collectParsedAmuCandidates(rows: unknown[]): AmuElectionCandidateRow[] {
  return rows.map((r) => parseAmuElectionCandidateRow(r))
}

export function collectParsedAmuVoters(rows: unknown[]): AmuElectionVoterRow[] {
  return rows.map((r) => parseAmuElectionVoterRow(r))
}

export function collectParsedAmuVotes(rows: unknown[]): AmuElectionVoteRow[] {
  return rows.map((r) => parseAmuElectionVoteRow(r))
}
