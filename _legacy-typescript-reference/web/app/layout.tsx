import type { Metadata, Viewport } from "next"
import { IBM_Plex_Sans } from "next/font/google"
import "./globals.css"
import { ThemeProviderWrapper } from "./theme-provider-wrapper"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Toaster } from "sonner"
// Validar variables de entorno al inicio (server-side only)
import "@/lib/server-init"
import QueryProvider from "@/components/providers/query-provider"
import { NetworkStatus } from "@shared/ui/network-status"
import { ThemeColorManager } from "@/components/providers/theme-color-manager"
import { EnvironmentBadge } from "@/components/ui/environment-badge"
import { ClientSessionProvider } from "@/components/providers/client-session-provider"
import { auth } from "@core/auth"

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
})

export const metadata: Metadata = {
  title: "PlentyPay - Plataforma de Facturación Electrónica",
  description: "Sistema Multi-Tenant de Facturación Electrónica para Panamá",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PlentyPay',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      {
        url: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      }
    ],
    apple: [
      {
        url: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      }
    ],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f9fafb' }, // gray-50
    { media: '(prefers-color-scheme: dark)', color: '#020617' }, // slate-950
  ],
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${ibmPlexSans.variable} font-sans`} suppressHydrationWarning>
        <ClientSessionProvider session={session}>
          <ThemeProviderWrapper>
            <ThemeColorManager />
            <QueryProvider>
              {children}
              <NetworkStatus />
            </QueryProvider>
            <Toaster richColors closeButton position="top-center" />
          </ThemeProviderWrapper>
        </ClientSessionProvider>
        <EnvironmentBadge />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}