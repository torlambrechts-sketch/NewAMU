import type { ReactNode } from 'react'
import { OrgSetupContext } from './orgSetupContext'
import { useOrgSetup } from '../hooks/useOrgSetup'

export function OrgSetupProvider({ children }: { children: ReactNode }) {
  const value = useOrgSetup()
  return <OrgSetupContext.Provider value={value}>{children}</OrgSetupContext.Provider>
}
