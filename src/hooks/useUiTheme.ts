import { useContext } from 'react'
import { UiThemeContext, type UiThemeContextValue } from '../context/uiThemeContext'

export function useUiTheme(): UiThemeContextValue {
  const ctx = useContext(UiThemeContext)
  if (!ctx) {
    throw new Error('useUiTheme must be used within UiThemeProvider')
  }
  return ctx
}

export function useUiThemeOptional(): UiThemeContextValue | null {
  return useContext(UiThemeContext)
}
