'use client'

import { ReactNode } from 'react'
import { ThemeProvider } from '@/components/theme-provider'

export function ThemeProviderWrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
      storageKey="plentypay-theme"
    >
      {children}
    </ThemeProvider>
  )
}
