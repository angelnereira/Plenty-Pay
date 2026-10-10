'use client'

import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'
import { MobileHeader } from '@/components/dashboard/mobile-header'

interface DashboardMobileShellProps {
  userName: string
  avatarUrl?: string
  children: ReactNode
}

const HIDDEN_PREFIXES = ['/dashboard/configuracion', '/dashboard/settings', '/dashboard/onboarding']

export function DashboardMobileShell({ userName, avatarUrl, children }: DashboardMobileShellProps) {
  const pathname = usePathname() ?? ''
  const hidden = HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  if (hidden) {
    return <>{children}</>
  }

  return (
    <>
      <MobileHeader userName={userName} avatarUrl={avatarUrl} />
      {/* Spacer: compensates the fixed header height so content starts below it */}
      <div className="pt-16">{children}</div>
    </>
  )
}
