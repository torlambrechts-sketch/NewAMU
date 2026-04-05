import { createContext } from 'react'
import type { useOrgSetup } from '../hooks/useOrgSetup'

export type OrgSetupValue = ReturnType<typeof useOrgSetup>

export const OrgSetupContext = createContext<OrgSetupValue | null>(null)
