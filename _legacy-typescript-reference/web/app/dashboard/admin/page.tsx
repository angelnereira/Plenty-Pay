import { auth } from "@core/auth"
import { prisma } from "@core/database"
import { redirect } from "next/navigation"
import { Activity, Users, Building2, AlertOctagon, TrendingUp, Zap } from "lucide-react"
import Link from "next/link"

export default async function AdminDashboardPage() {
  const session = await auth()

  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    redirect("/dashboard")
  }

  // 1. Obtener métricas clave (Real-time snapshots)
  const [
    totalUsers,
    totalClients,
    activeBroadcasts,
    recentErrors
  ] = await Promise.all([
    prisma.user.count(),
    prisma.client.count({ where: { deletedAt: null } }),
    prisma.adminBroadcast.count({ where: { isActive: true } }),
    prisma.errorLog.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } // Últimas 24h
    })
  ])

  // Simulación de "Usuarios Online" (ya que no tenemos WebSocket o polling en server component estático)
  // En producción real, esto vendría de Redis o query a Sessions updated recently
  const activeSessions = await prisma.session.count({
    where: { expires: { gt: new Date() } }
  })

  // Planes distribution (PlentyPay Hero alignment)
  const enterpriseClients = await prisma.client.count({ where: { planType: "ENTERPRISE", deletedAt: null } })
  const proClients = await prisma.client.count({ where: { planType: "PROFESIONAL", deletedAt: null } })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Activity className="h-8 w-8 text-violet-600" />
          Centro de Comando
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Monitoreo global y control del sistema
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Active Sessions */}
        <div className="bg-white dark:bg-white/[0.06] dark:backdrop-blur-2xl rounded-xl p-6 shadow-sm border border-gray-200 dark:border-white/[0.1] relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Zap className="h-24 w-24 text-blue-500" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sesiones Activas</h3>
            </div>
            <p className="text-4xl font-black text-gray-900 dark:text-gray-100">{activeSessions}</p>
            <p className="text-xs text-green-600 mt-1 font-medium">Usuarios conectados ahora</p>
          </div>
        </div>

        {/* Total Clients */}
        <div className="bg-white dark:bg-white/[0.06] dark:backdrop-blur-2xl rounded-xl p-6 shadow-sm border border-gray-200 dark:border-white/[0.1]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Organizaciones</h3>
            <Building2 className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{totalClients}</p>
          <div className="mt-2 text-xs flex gap-2">
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-semibold">{enterpriseClients} Enterprise</span>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold">{proClients} Pro</span>
          </div>
        </div>

        {/* Total Users */}
        <div className="bg-white dark:bg-white/[0.06] dark:backdrop-blur-2xl rounded-xl p-6 shadow-sm border border-gray-200 dark:border-white/[0.1]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Usuarios Totales</h3>
            <Users className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{totalUsers}</p>
          <p className="text-xs text-gray-500 mt-1">Registrados en la plataforma</p>
        </div>

        {/* System Health */}
        <div className="bg-white dark:bg-white/[0.06] dark:backdrop-blur-2xl rounded-xl p-6 shadow-sm border border-gray-200 dark:border-white/[0.1]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Salud del Sistema</h3>
            <AlertOctagon className={`h-5 w-5 ${recentErrors > 0 ? 'text-red-500' : 'text-green-500'}`} />
          </div>
          {recentErrors === 0 ? (
            <div>
              <p className="text-3xl font-bold text-green-500">100%</p>
              <p className="text-xs text-gray-500 mt-1">Operativo sin errores recientes</p>
            </div>
          ) : (
            <div>
              <p className="text-3xl font-bold text-red-500">{recentErrors}</p>
              <p className="text-xs text-red-600 mt-1 font-medium">Errores en últimas 24h</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Shortcuts */}
        <div className="bg-white dark:bg-white/[0.06] dark:backdrop-blur-2xl rounded-xl p-6 shadow-sm border border-gray-200 dark:border-white/[0.1]">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Accesos Directos</h3>
          <div className="flex flex-wrap gap-4">
            <Link href="/dashboard/admin/users" className="flex items-center px-4 py-2 bg-slate-100 dark:bg-white/[0.05] rounded-lg hover:bg-slate-200 dark:hover:bg-white/[0.08] transition-colors text-sm font-medium">
              <Users className="h-4 w-4 mr-2" /> Gestionar Usuarios
            </Link>
            <Link href="/dashboard/admin/crm" className="flex items-center px-4 py-2 bg-slate-100 dark:bg-white/[0.05] rounded-lg hover:bg-slate-200 dark:hover:bg-white/[0.08] transition-colors text-sm font-medium">
              <Zap className="h-4 w-4 mr-2" /> CRM Email
            </Link>
            <Link href="/dashboard/admin/support" className="flex items-center px-4 py-2 bg-slate-100 dark:bg-white/[0.05] rounded-lg hover:bg-slate-200 dark:hover:bg-white/[0.08] transition-colors text-sm font-medium">
              <Activity className="h-4 w-4 mr-2" /> Soporte Técnico
            </Link>
          </div>
        </div>

        {/* Plan Distribution (Mini Chart Placeholder) */}
        <Link href="/dashboard/admin/analytics" className="bg-white dark:bg-white/[0.06] dark:backdrop-blur-2xl rounded-xl p-6 shadow-sm border border-gray-200 dark:border-white/[0.1] flex flex-col justify-center items-center text-center hover:border-violet-500 transition-all group">
          <TrendingUp className="h-10 w-10 text-gray-300 mb-2 group-hover:text-violet-500 transition-colors" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Inteligencia de Negocio</h3>
          <p className="text-sm text-gray-500 mt-1">Ver detalle de MRR y proyecciones</p>
        </Link>
      </div>
    </div>
  )
}
