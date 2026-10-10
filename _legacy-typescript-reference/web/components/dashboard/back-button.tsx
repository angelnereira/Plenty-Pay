'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface BackButtonProps {
  /** If provided, navigates to this href instead of using router.back() */
  href?: string
  /** Custom label text. Defaults to "Volver" */
  label?: string
  /** Additional CSS classes */
  className?: string
}

/**
 * Standardized back button for PlentyPay dashboard pages.
 *
 * Usage:
 *   <BackButton />                           — Uses router.back()
 *   <BackButton href="/dashboard/facturas" /> — Navigates to specific path
 *   <BackButton label="Volver a Nómina" />   — Custom label
 *
 * Note: This replaces all inline back buttons. Each page should have at most ONE
 * back button (either the GlobalBackButton from the layout, or this component).
 */
export function BackButton({ href, label = 'Volver', className }: BackButtonProps) {
  const router = useRouter()

  const buttonClasses = cn(
    'inline-flex items-center gap-1.5 px-3 py-1.5',
    'text-sm font-medium text-muted-foreground hover:text-foreground',
    'bg-background/40 hover:bg-muted/60 backdrop-blur-md',
    'border border-border/50 rounded-lg shadow-sm',
    'transition-all duration-200 ease-in-out',
    'focus:outline-none focus:ring-2 focus:ring-primary/20',
    className
  )

  if (href) {
    return (
      <Link href={href} className={buttonClasses} aria-label={label}>
        <ChevronLeft className="h-4 w-4" />
        <span>{label}</span>
      </Link>
    )
  }

  return (
    <button
      onClick={() => {
        if (window.history.length > 2) {
          router.back()
        } else {
          router.push('/dashboard')
        }
      }}
      className={buttonClasses}
      aria-label={label}
    >
      <ChevronLeft className="h-4 w-4" />
      <span>{label}</span>
    </button>
  )
}
