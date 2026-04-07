/** Metadata stored on signed records for level-1 (system) signatures — not QES/BankID. */
export type Level1SystemSignatureMeta = {
  userId: string
  documentHashSha256: string
  clientIp: string | null
  recordedAt: string
  algorithm: 'SHA-256'
}
