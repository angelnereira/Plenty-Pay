import {
    BarChart3,
    Boxes,
    CreditCard,
    FileText,
    ScanFace,
    ShoppingCart,
    Truck,
    type LucideIcon,
} from "lucide-react"

export type ModuleId = "billing" | "inventory" | "pos" | "logistics" | "people" | "bi" | "creditos"

export interface ModuleCatalogEntry {
    id: ModuleId
    title: string
    subtitle: string
    icon: LucideIcon
    color: string
    bgColor: string
    priceMonthly: number
    priceYearly: number
}

export const MODULE_CATALOG: ModuleCatalogEntry[] = [
    {
        id: "billing",
        title: "Facturación Fiscal",
        subtitle: "Emisión certificada DGI en segundos",
        icon: FileText,
        color: "text-yellow-600 dark:text-yellow-400",
        bgColor: "bg-yellow-100 dark:bg-yellow-500/10",
        priceMonthly: 49.99,
        priceYearly: 499.9,
    },
    {
        id: "inventory",
        title: "Inventario Inteligente",
        subtitle: "Stock en tiempo real y multi-bodega",
        icon: Boxes,
        color: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-100 dark:bg-emerald-500/10",
        priceMonthly: 29,
        priceYearly: 290,
    },
    {
        id: "pos",
        title: "Punto de Venta",
        subtitle: "Caja rápida offline-first",
        icon: ShoppingCart,
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-100 dark:bg-blue-500/10",
        priceMonthly: 39,
        priceYearly: 390,
    },
    {
        id: "logistics",
        title: "Logística y Entregas",
        subtitle: "Rutas, conductores y tracking",
        icon: Truck,
        color: "text-orange-600 dark:text-orange-400",
        bgColor: "bg-orange-100 dark:bg-orange-500/10",
        priceMonthly: 35,
        priceYearly: 350,
    },
    {
        id: "people",
        title: "Control de Personal",
        subtitle: "Biometría, turnos y nómina",
        icon: ScanFace,
        color: "text-violet-600 dark:text-violet-400",
        bgColor: "bg-violet-100 dark:bg-violet-500/10",
        priceMonthly: 50,
        priceYearly: 500,
    },
    {
        id: "bi",
        title: "Reportes y BI",
        subtitle: "Decisiones con datos en vivo",
        icon: BarChart3,
        color: "text-rose-600 dark:text-rose-400",
        bgColor: "bg-rose-100 dark:bg-rose-500/10",
        priceMonthly: 25,
        priceYearly: 250,
    },
    {
        id: "creditos",
        title: "Créditos a Clientes",
        subtitle: "Otorga crédito y controla el cobro",
        icon: CreditCard,
        color: "text-fuchsia-600 dark:text-fuchsia-400",
        bgColor: "bg-fuchsia-100 dark:bg-fuchsia-500/10",
        priceMonthly: 49.99,
        priceYearly: 499.9,
    },
]

export const MODULE_IDS: ModuleId[] = MODULE_CATALOG.map((m) => m.id)

export function getModule(id: ModuleId): ModuleCatalogEntry | undefined {
    return MODULE_CATALOG.find((m) => m.id === id)
}

export function isModuleId(value: string): value is ModuleId {
    return (MODULE_IDS as string[]).includes(value)
}
