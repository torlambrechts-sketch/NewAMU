import type { ReactNode } from 'react'
import { useDocumentsShellEmbedded } from '../../../modules/documents/DocumentsShellContext'

type Props = {
  children: ReactNode
  /** @deprecated Ignored — innhold flyttet til `ModulePageShell` i `DocumentsModuleShellLayout`. */
  subHeader?: ReactNode
}

/**
 * Thin wrapper for dokument-ruter. Under `DocumentsModuleShellLayout` (innbakt kontekst) rendres kun `children`
 * slik at vi unngår dobbel `ModulePageShell` / dobbel meny (se `docs/UI_PLACEMENT_RULES.md` §1).
 */
export function DocumentsModuleLayout({ children }: Props) {
  const embeddedInModuleShell = useDocumentsShellEmbedded()
  if (embeddedInModuleShell) {
    return <>{children}</>
  }
  return <>{children}</>
}
