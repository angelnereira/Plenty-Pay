import { auth } from "@core/auth"
import { redirect } from "next/navigation"
import type { MotorCreditTier } from "@prisma/client"

export const dynamic = 'force-dynamic'

import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { prismaServer as prisma } from "@core/database"
import { CredentialGuard } from "@shared/ui/organisms/credential-guard"
import { SidebarProvider } from "@/components/dashboard/sidebar-provider"
import { DashboardLayoutContent } from "@/components/dashboard/dashboard-layout-content"
import { SupportModal } from "@/components/dashboard/support-modal"
import Image from "next/image"
import { InvoiceGeneratorProvider } from "@/components/dashboard/invoice-generator-provider"
import { GlobalMobileNav } from "@/components/dashboard/global-mobile-nav"
import { ClientSessionProvider } from "@/components/providers/client-session-provider"
import { SentryUserProvider } from "@/components/providers/sentry-user-provider"
import { SentryReplayManager } from "@/components/providers/sentry-replay-manager"
import { DashboardMobileShell } from "@/components/dashboard/dashboard-mobile-shell"
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect("/")
  }

  // Obtener cliente del usuario con datos de aprobación y onboarding.
  // CRÍTICO: este findUnique se ejecuta en CADA ruta /dashboard/*. Si la BD
  // tirembla (timeout, vista no aplicada, conexión perdida), arrastraba todo
  // el dashboard al error boundary global (digest 3726653047). Try/catch
  // aquí y fallback a flags todos `false` — el sidebar mostrará solo
  // "Inicio" y "Configuración" en vez de bloquear toda la app.
  type ClientData = {
    id: string
    approvalStatus: string
    metadata: unknown
    address: string | null
    facturacionEnabled: boolean
    inventoryEnabled: boolean
    posEnabled: boolean
    paydayEnabled: boolean
    logisticsEnabled: boolean
    creditosEnabled: boolean
    biEnabled: boolean
    biProEnabled: boolean
    motorCreditTier: MotorCreditTier | null
  }
  let clientData: ClientData | null = null
  try {
    clientData = await prisma.client.findUnique({
      where: { id: session.user.clientId },
      select: {
        id: true,
        approvalStatus: true,
        metadata: true,
        address: true,
        facturacionEnabled: true,
        inventoryEnabled: true,
        posEnabled: true,
        paydayEnabled: true,
        logisticsEnabled: true,
        creditosEnabled: true,
        biEnabled: true,
        biProEnabled: true,
        motorCreditTier: true,
      }
    }) as ClientData | null
  } catch (err) {
    console.error("[dashboard/layout] findUnique client failed", err)
    // clientData queda null — los flags caen al fallback de abajo.
  }

  // Módulo de Créditos: visible si el tenant lo tiene activo Y tiene un
  // tier asignado. El gate de la página (requireCreditAccess) usa la
  // misma condición — si solo chequeáramos creditosEnabled aquí, el
  // sidebar mostraría un link que termina en 404.
  // SUPER_ADMIN nunca ve el módulo desde su rol.
  const creditosEnabled =
    session.user.role !== "SUPER_ADMIN" &&
    clientData?.creditosEnabled === true &&
    clientData?.motorCreditTier != null

  // BI: visible si tiene addon `bi` activo, o `biPro` (que incluye Esencial).
  // SUPER_ADMIN nunca ve el módulo desde su rol — usa /admin/analytics.
  const biEnabled =
    session.user.role !== "SUPER_ADMIN" &&
    Boolean(clientData?.biEnabled || clientData?.biProEnabled)

  // Acceso al panel avanzado del Motor (Schema Builder, ajustes manuales,
  // intereses por ciclo, etc.). Reservado a usuarios concretos por el
  // SUPER_ADMIN. NO bloquea el Módulo de Créditos visible — solo expande
  // la UI de configuración para usuarios con MotorUserAccess ACTIVE.
  let motorPanelEnabled = false
  if (session.user.id && session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.motorUserAccess.findUnique({
      where: { userId: session.user.id },
      select: { status: true, clientId: true },
    })
    motorPanelEnabled = access?.status === "ACTIVE" && access.clientId === session.user.clientId
  }

  // Sincronizar la sesión JWT local (en memoria) con los valores reales actuales de la BD.
  // Creamos un nuevo objeto porque la sesión devuelta por NextAuth es inmutable (frozen)
  // y fallaría silenciosamente al intentar reasignar sus propiedades.
  const updatedSession = session && clientData ? {
    ...session,
    user: {
      ...session.user,
      facturacionEnabled: clientData.facturacionEnabled,
      inventoryEnabled: clientData.inventoryEnabled,
      posEnabled: clientData.posEnabled,
      paydayEnabled: clientData.paydayEnabled,
      logisticsEnabled: clientData.logisticsEnabled,
      creditosEnabled: clientData.creditosEnabled,
    }
  } : session;

  // Cargar folios iniciales (Flujo 3)
  const initialFolios = {
    available: 0,
    used: 0,
    total: 0,
    proximoFolio: '',
    ciclo: '',
    fechaCiclo: '',
    porcentajeUso: 0,
    alertaBajo: false
  };

  return (
    <ClientSessionProvider session={updatedSession}>
      <SentryUserProvider user={updatedSession?.user} />
      <SentryReplayManager />
      <CredentialGuard>
        <SidebarProvider>
        <InvoiceGeneratorProvider clientId={session.user.clientId}>
            {/* Mobile Layout - Full screen, no chrome */}
            <div className="md:hidden min-h-screen bg-background pb-20 relative overflow-hidden">
              {/* Mobile Gradient Orbs */}
              <div className="fixed inset-0 pointer-events-none opacity-0 dark:opacity-100 z-0">
                <div className="absolute top-[-10%] left-[-15%] w-[60%] h-[40%] rounded-full bg-violet-600/15 blur-[100px] animate-pulse" style={{ animationDuration: '8s' }} />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px] animate-pulse" style={{ animationDuration: '10s' }} />
              </div>
              <div className="fixed inset-0 pointer-events-none dot-grid opacity-0 dark:opacity-100 z-[1]" />
              <DashboardMobileShell userName={updatedSession.user.name || "Usuario"}>
                {children}
              </DashboardMobileShell>
              <GlobalMobileNav
                userRole={updatedSession.user.role}
                facturacionEnabled={updatedSession.user.facturacionEnabled}
                inventoryEnabled={updatedSession.user.inventoryEnabled}
                posEnabled={updatedSession.user.posEnabled}
                paydayEnabled={updatedSession.user.paydayEnabled}
                logisticsEnabled={updatedSession.user.logisticsEnabled}
                creditosEnabled={creditosEnabled}
              />
            </div>

            {/* Desktop Layout - With header, sidebar, and content wrapper */}
            <div className="hidden md:block min-h-screen bg-background transition-colors overflow-hidden">
              {/* Background Gradient Orbs — Login-style atmospheric effect */}
              <div className="fixed inset-0 pointer-events-none opacity-10 dark:opacity-100">
                <div className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] rounded-full bg-violet-600/20 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
                <div className="absolute bottom-[-20%] right-[-5%] w-[50%] h-[50%] rounded-full bg-indigo-600/15 blur-[140px] animate-pulse" style={{ animationDuration: '10s' }} />
                <div className="absolute top-[30%] left-[40%] w-[35%] h-[35%] rounded-full bg-fuchsia-600/10 blur-[100px] animate-pulse" style={{ animationDuration: '12s' }} />
              </div>

              {/* Dot Grid Texture — Login-style subtle mesh */}
              <div className="fixed inset-0 pointer-events-none dot-grid opacity-0 dark:opacity-100 z-[1]" />

              {/* Header - Desktop only */}
              <DashboardHeader user={updatedSession.user} initialFolios={initialFolios} />

              {/* Sidebar - Desktop only */}
              <DashboardSidebar
                userRole={updatedSession.user.role}
                facturacionEnabled={updatedSession.user.facturacionEnabled}
                inventoryEnabled={updatedSession.user.inventoryEnabled}
                posEnabled={updatedSession.user.posEnabled}
                paydayEnabled={updatedSession.user.paydayEnabled}
                logisticsEnabled={updatedSession.user.logisticsEnabled}
                creditosEnabled={creditosEnabled}
                biEnabled={biEnabled}
                motorPanelEnabled={motorPanelEnabled}
              />

              {/* Main Content con margen dinámico */}
              <DashboardLayoutContent>
                <div className="relative z-10 w-full">
                  {children}
                </div>
              </DashboardLayoutContent>

              {/* Sistema de Soporte Técnico Centralizado */}
              <SupportModal />

              {/* Marca de Agua en el Fondo */}
              <div className="pointer-events-none fixed bottom-[-5%] right-[-5%] z-0 opacity-[0.03] dark:opacity-[0.04] rotate-12 scale-150">
                <Image
                  src="/icons/icon-512.png"
                  alt="Background watermark"
                  width={1000}
                  height={1000}
                  className="w-[60vw] max-w-[1000px] h-auto grayscale transition-all duration-1000"
                />
              </div>
            </div>
        </InvoiceGeneratorProvider>
      </SidebarProvider>
    </CredentialGuard>
    </ClientSessionProvider>
  )
}
