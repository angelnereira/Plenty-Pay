'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Boxes, ShieldCheck, Zap } from 'lucide-react'
import { ReactNode } from 'react'

type AuthShellProps = {
  title: string
  subtitle?: string
  children: ReactNode
  footerSlot?: ReactNode
  side?: 'branding' | 'minimal'
  backHref?: string
}

const brandingValueProps = [
  {
    icon: Boxes,
    title: 'ERP modular',
    body: 'Activa solo los módulos que tu empresa necesita.',
  },
  {
    icon: ShieldCheck,
    title: 'Datos protegidos',
    body: 'Cifrado de clase bancaria en todas tus operaciones.',
  },
  {
    icon: Zap,
    title: 'Listo en minutos',
    body: 'Sin instalaciones. Accede desde cualquier dispositivo.',
  },
]

export function AuthShell({
  title,
  subtitle,
  children,
  footerSlot,
  side = 'minimal',
  backHref = '/',
}: AuthShellProps) {
  return (
    <div className="relative min-h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-60" aria-hidden />
      <div
        className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl"
        aria-hidden
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 lg:px-10">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/plentypay-logo-light.png"
            alt="PlentyPay"
            width={120}
            height={32}
            priority
            className="h-8 w-auto dark:invert"
          />
        </Link>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio
        </Link>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-8 lg:py-12 overflow-x-hidden">
        <div
          className={`w-full min-w-0 ${
            side === 'branding'
              ? 'max-w-6xl grid lg:grid-cols-2 gap-10 lg:gap-16 items-center'
              : 'max-w-md'
          }`}
        >
          {side === 'branding' && (
            <section className="hidden lg:flex flex-col gap-10">
              <div>
                <p className="text-sm font-medium text-primary mb-4">
                  Plataforma empresarial modular
                </p>
                <h2 className="text-4xl xl:text-5xl font-bold tracking-tight text-foreground leading-[1.1]">
                  El sistema operativo de tu empresa.
                </h2>
                <p className="mt-5 text-lg text-muted-foreground max-w-md">
                  Facturación, inventario, punto de venta, logística y personal
                  — unificados y listos para escalar.
                </p>
              </div>
              <ul className="space-y-5">
                {brandingValueProps.map(({ icon: Icon, title: t, body }) => (
                  <li key={t} className="flex gap-4">
                    <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{t}</p>
                      <p className="text-sm text-muted-foreground">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="min-w-0 overflow-hidden">
            <div className="rounded-2xl border border-border bg-card/90 backdrop-blur-xl p-7 sm:p-9 shadow-sm overflow-hidden">
              <div className="mb-7 text-center lg:text-left">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {title}
                </h1>
                {subtitle && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {subtitle}
                  </p>
                )}
              </div>
              {children}
            </div>
            {footerSlot && (
              <div className="mt-6 text-center text-sm text-muted-foreground">
                {footerSlot}
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="relative z-10 px-6 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} PlentyPay. Todos los derechos reservados.
      </footer>
    </div>
  )
}
