import { createContext } from 'react'
import type { LayoutLabPayload } from '../types/layoutLab'

export type UiThemeContextValue = {
  payload: LayoutLabPayload
  updatedAt: string | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export const UiThemeContext = createContext<UiThemeContextValue | null>(null)
