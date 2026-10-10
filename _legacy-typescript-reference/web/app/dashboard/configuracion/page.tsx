import { auth } from "@core/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, Package, Store, Users, ChevronRight, Settings, Sparkles, Database, Truck, Clock, Workflow, Building2, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { prismaServer as prisma } from "@core/database";

/**
 * Módulo que habilita cada sección. `undefined` = siempre visible (transversal).
 * El gating usa los mismos flags del `Client` que el sidebar (ver dashboard/layout).
 */
type RequiredModule = "facturacion" | "inventory" | "pos" | "payday" | "logistics";

interface ConfigSection {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: string;
  bgColor: string;
  borderColor: string;
  featured?: boolean;
  requiredModule?: RequiredModule;
}

const configSections: ConfigSection[] = [
  {
    title: "Mi Perfil",
    description: "Datos personales, foto de perfil o logo, y cambio de contraseña.",
    icon: UserCircle,
    href: "/dashboard/configuracion/perfil",
    color: "text-indigo-500",
    bgColor: "bg-indigo-500/10",
    borderColor: "border-indigo-500/20"
  },
  {
    title: "Mi Suscripción",
    description: "Plan actual, módulos contratados y opciones de upgrade.",
    icon: Sparkles,
    href: "/dashboard/configuracion/suscripcion",
    color: "text-violet-500",
    bgColor: "bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20",
    borderColor: "border-violet-500/30",
    featured: true
  },
  {
    title: "Organización",
    description: "RUC, dígito verificador (DV), tipo de contribuyente y datos de contacto de la empresa.",
    icon: Building2,
    href: "/dashboard/configuracion/organizacion",
    color: "text-indigo-500",
    bgColor: "bg-indigo-500/10",
    borderColor: "border-indigo-500/20"
  },
  {
    title: "Facturación",
    description: "Credenciales HKA, numeración de facturas y configuración de emisión.",
    icon: FileText,
    href: "/dashboard/facturas/config",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    requiredModule: "facturacion"
  },
  {
    title: "Inventario",
    description: "Control de stock, alertas de mínimos y gestión de almacenes.",
    icon: Package,
    href: "/dashboard/inventory/config",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    requiredModule: "inventory"
  },
  {
    title: "Punto de Venta",
    description: "Configuración de cajas, impresoras y métodos de pago.",
    icon: Store,
    href: "/dashboard/pos/config",
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/20",
    requiredModule: "pos"
  },
  {
    title: "Nómina y Planilla",
    description: "Periodicidad de pago, deducciones legales, beneficios y décimo tercer mes.",
    icon: Clock,
    href: "/dashboard/configuracion/nomina",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    requiredModule: "payday"
  },
  {
    title: "Logística y Envíos",
    description: "Transportistas, conductores y configuración de entregas.",
    icon: Truck,
    href: "/dashboard/logistics/config",
    color: "text-rose-500",
    bgColor: "bg-rose-500/10",
    borderColor: "border-rose-500/20",
    requiredModule: "logistics"
  },
  {
    title: "Usuarios y Permisos",
    description: "Gestiona roles, permisos granulares y el acceso de tu equipo.",
    icon: Users,
    href: "/dashboard/configuracion/usuarios",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20"
  },
  {
    title: "Flujos y Automatización",
    description: "Configura flujos de aprobación, automatizaciones y valores predeterminados.",
    icon: Workflow,
    href: "/dashboard/configuracion/flujos",
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/20"
  },
  {
    title: "Datos / Respaldos",
    description: "Exporta, importa, programa respaldos y audita los datos de tu organización (Soberanía de Datos).",
    icon: Database,
    href: "/dashboard/datos",
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/20"
  }
];

export default async function ConfigurationHubPage() {
  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    redirect("/");
  }

  // Gating por módulo: solo se muestran configs de módulos habilitados para el
  // tenant. Mismos flags que el sidebar. SUPER_ADMIN ve todo. Si la BD falla,
  // fallback seguro: solo secciones transversales (sin requiredModule).
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  let flags: Record<RequiredModule, boolean> = {
    facturacion: false, inventory: false, pos: false, payday: false, logistics: false,
  };
  if (session.user.clientId) {
    try {
      const client = await prisma.client.findUnique({
        where: { id: session.user.clientId },
        select: {
          facturacionEnabled: true,
          inventoryEnabled: true,
          posEnabled: true,
          paydayEnabled: true,
          logisticsEnabled: true,
        },
      });
      if (client) {
        flags = {
          facturacion: client.facturacionEnabled,
          inventory: client.inventoryEnabled,
          pos: client.posEnabled,
          payday: client.paydayEnabled,
          logistics: client.logisticsEnabled,
        };
      }
    } catch (err) {
      console.error("[configuracion] findUnique client failed", err);
    }
  }

  const visibleSections = configSections.filter((s) => {
    if (!s.requiredModule) return true;
    if (isSuperAdmin) return true;
    return flags[s.requiredModule];
  });

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-transparent px-4 pt-4 md:px-8 md:pt-8 pb-12">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter uppercase flex items-center gap-3">
            <Settings className="h-8 w-8 text-slate-400" />
            Configuración
          </h1>
          <p className="text-gray-500 dark:text-gray-400 max-w-2xl text-lg">
            Centro de control de PlentyPay. Selecciona el módulo que deseas configurar.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visibleSections.map((section) => (
            <Link
              key={section.title}
              href={section.href}
              className={cn(
                "group relative overflow-hidden p-6 rounded-2xl transition-all duration-300",
                "bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800",
                "hover:shadow-xl hover:border-violet-500/30 dark:hover:border-violet-500/30",
                "hover:-translate-y-1",
                section.featured && "md:col-span-2 ring-2 ring-violet-500/20"
              )}
            >
              {section.featured && (
                <div className="absolute top-4 right-4">
                  <span className="px-3 py-1 text-xs font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-full shadow-lg">
                    Gestionar Plan
                  </span>
                </div>
              )}

              <div className="flex items-start justify-between mb-4">
                <div className={cn("p-4 rounded-xl transition-all duration-300 group-hover:scale-110", section.bgColor)}>
                  <section.icon className={cn("h-8 w-8", section.color)} />
                </div>
                {!section.featured && (
                  <div className="p-2 rounded-full bg-gray-50 dark:bg-slate-800 text-gray-400 group-hover:text-violet-500 transition-colors">
                    <ChevronRight className="h-5 w-5" />
                  </div>
                )}
              </div>

              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                {section.title}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                {section.description}
              </p>

              {section.featured && (
                <div className="mt-4 flex items-center gap-2 text-sm text-violet-600 dark:text-violet-400 font-medium">
                  Ver plan actual y opciones de upgrade
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
