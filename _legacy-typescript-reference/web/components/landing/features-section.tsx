"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
    BarChart3,
    Boxes,
    CreditCard,
    FileText,
    ScanFace,
    ShoppingCart,
    Truck,
    ArrowRight,
    Check,
    Plus,
    Info,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { FeatureDetailModal, FeatureDetailData } from "./feature-detail-modal"

type ModuleCardData = FeatureDetailData & {
    id: string
    image: string
    priceMonthly: number
    priceYearly: number
    hoverBorder: string
}

const modulesData: ModuleCardData[] = [
    {
        id: "billing",
        icon: FileText,
        title: "Facturación Fiscal",
        subtitle: "Emisión certificada en segundos",
        description: "Emite, envía y reporta facturas electrónicas certificadas por la DGI en menos de 3 segundos, con integración directa al PAC HKA. Sin instalaciones, sin fricción.",
        color: "text-yellow-600 dark:text-yellow-400",
        bgColor: "bg-yellow-100 dark:bg-yellow-500/10",
        hoverBorder: "hover:border-yellow-500/40",
        image: "/assets/landing/feature_billing_doc.png",
        priceMonthly: 49.99,
        priceYearly: 499.9,
        keyBenefits: [
            "Emisión ilimitada de facturas electrónicas certificadas",
            "Certificación DGI en menos de 3 segundos",
            "Notas de crédito y débito automatizadas",
            "Facturas de exportación e importación",
            "Validación automática de RUC en tiempo real",
            "Envío automático por email al cliente",
            "Exportación en PDF, Excel y XML firmado",
            "Control de folios con alertas preventivas",
        ],
        technicalSpecs: [
            { label: "Integración HKA", value: "100% operativa" },
            { label: "Tiempo de emisión", value: "< 3 segundos" },
            { label: "Tipos de documento", value: "7" },
            { label: "Validación RUC", value: "Tiempo real" },
            { label: "Cumplimiento", value: "Resolución 201-6299" },
        ],
        useCases: [
            { title: "Comercios al detal", description: "Facturación rápida con alto volumen diario e integración al inventario." },
            { title: "Servicios profesionales", description: "Facturas detalladas para consultores, abogados y contadores con PDF pro." },
            { title: "Distribuidoras", description: "Miles de facturas al mes vía API para sistemas ERP externos." },
            { title: "Empresas con contratos de gobierno", description: "Soporte para códigos CPBS y cumplimiento fiscal estricto." },
        ],
        pricingInfo: { plan: "Facturación Fiscal", description: "Módulo base de cumplimiento fiscal. Se combina libremente con el resto." },
    },
    {
        id: "inventory",
        icon: Boxes,
        title: "Inventario Inteligente",
        subtitle: "Stock en tiempo real, cero sorpresas",
        description: "Control total de tu inventario con stock en vivo, múltiples bodegas, lotes, vencimientos y alertas automáticas. Nunca más te quedes corto ni sobrestockeado.",
        color: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-100 dark:bg-emerald-500/10",
        hoverBorder: "hover:border-emerald-500/40",
        image: "/assets/landing/feature_inventory_boxes.png",
        priceMonthly: 29,
        priceYearly: 290,
        keyBenefits: [
            "Stock en tiempo real en múltiples bodegas",
            "Alertas automáticas de stock bajo por producto",
            "Gestión de lotes con fechas de vencimiento",
            "Fotos por producto para identificación visual",
            "Historial completo de movimientos auditables",
            "Valoración automática FIFO / PEPS",
            "Códigos de barras nativos para escaneo",
            "Reportes de rotación y productos estrella",
        ],
        technicalSpecs: [
            { label: "Bodegas", value: "Ilimitadas" },
            { label: "Valoración", value: "FIFO / PEPS" },
            { label: "Códigos de barras", value: "Integrado" },
            { label: "Fotos por SKU", value: "Múltiples" },
            { label: "Trazabilidad", value: "100%" },
        ],
        useCases: [
            { title: "Farmacias", description: "Control estricto de vencimientos y lotes con alertas automáticas." },
            { title: "Supermercados", description: "Miles de SKUs con rotación rápida y múltiples ubicaciones." },
            { title: "Distribuidoras", description: "Stock multi-bodega con trazabilidad completa por lote." },
            { title: "Restaurantes", description: "Seguimiento de ingredientes y control de mermas." },
        ],
        pricingInfo: { plan: "Inventario Inteligente", description: "Se integra de forma nativa con Facturación y Punto de Venta." },
    },
    {
        id: "pos",
        icon: ShoppingCart,
        title: "Punto de Venta",
        subtitle: "Caja rápida, offline-first",
        description: "Vende desde mostrador, tableta o móvil. Interfaz táctil optimizada, lectores de código de barras y modo offline que sincroniza automáticamente cuando vuelve la señal.",
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-100 dark:bg-blue-500/10",
        hoverBorder: "hover:border-blue-500/40",
        image: "/assets/landing/feature_pos_tablet.png",
        priceMonthly: 39,
        priceYearly: 390,
        keyBenefits: [
            "Interfaz táctil optimizada para minimizar clicks",
            "Soporte nativo para lectores de código de barras",
            "Pantalla dual cajero/cliente",
            "Modo offline-first con sincronización automática",
            "Facturación instantánea al cerrar la venta",
            "Checkout completo en menos de 5 segundos",
            "Compatible con hardware estándar del mercado",
            "Control de turnos y arqueo de caja",
        ],
        technicalSpecs: [
            { label: "Tiempo de checkout", value: "< 5 segundos" },
            { label: "Modo offline", value: "Sí, nativo" },
            { label: "Lectores de barras", value: "Soportados" },
            { label: "Pantallas duales", value: "Sí" },
            { label: "Sincronización", value: "Automática" },
        ],
        useCases: [
            { title: "Retail de alto volumen", description: "Supermercados y tiendas con cientos de transacciones diarias." },
            { title: "Cafeterías y restaurantes", description: "Órdenes rápidas con pantalla para el cliente." },
            { title: "Tiendas de conveniencia", description: "Checkout ultrarrápido para máxima rotación." },
            { title: "Ferreterías", description: "Búsqueda por código con información de stock en vivo." },
        ],
        pricingInfo: { plan: "Punto de Venta", description: "El precio base incluye una caja concurrente. Añade más desde la gestión de suscripción." },
    },
    {
        id: "logistics",
        icon: Truck,
        title: "Logística y Entregas",
        subtitle: "De la factura a la puerta del cliente",
        description: "Asigna rutas, rastrea entregas en vivo y confirma con firma digital desde el celular del repartidor. Órdenes creadas desde cero o directamente desde una factura.",
        color: "text-orange-600 dark:text-orange-400",
        bgColor: "bg-orange-100 dark:bg-orange-500/10",
        hoverBorder: "hover:border-orange-500/40",
        image: "/assets/landing/feature_logistics_map.png",
        priceMonthly: 35,
        priceYearly: 350,
        keyBenefits: [
            "Ciclo de vida completo: borrador → entregado",
            "Creación directa o desde facturas existentes",
            "Deducción automática de inventario al despachar",
            "Asignación de transportistas, conductores y vehículos",
            "PDF profesional con código QR por orden",
            "Firma digital en el celular del repartidor",
            "Rastreo en vivo con historial auditado",
            "Soporte para condiciones especiales de envío",
        ],
        technicalSpecs: [
            { label: "Estados de entrega", value: "7 fases" },
            { label: "Origen", value: "Directo / Factura" },
            { label: "Trazabilidad", value: "QR + audit trail" },
            { label: "Inventario", value: "Auto-deducción" },
            { label: "Documentos", value: "PDF profesional" },
        ],
        useCases: [
            { title: "Distribuidoras", description: "Rutas con múltiples conductores y vehículos." },
            { title: "E-commerce", description: "Seguimiento del pedido desde la factura hasta la puerta." },
            { title: "Mayoristas", description: "Órdenes masivas con inventario integrado." },
            { title: "Manufactura", description: "Despacho con condiciones especiales (temperatura, peligrosos)." },
        ],
        pricingInfo: { plan: "Logística y Entregas", description: "Se activa solo o junto a Facturación e Inventario." },
    },
    {
        id: "people",
        icon: ScanFace,
        title: "Control de Personal",
        subtitle: "Biometría, turnos y nómina legal",
        description: "Asistencia con reconocimiento facial, gestión de turnos y cálculo legal de nómina bajo la normativa panameña. Cero hojas de cálculo, cero errores.",
        color: "text-violet-600 dark:text-violet-400",
        bgColor: "bg-violet-100 dark:bg-violet-500/10",
        hoverBorder: "hover:border-violet-500/40",
        image: "/assets/landing/module_nomina_3d.png",
        priceMonthly: 50,
        priceYearly: 500,
        keyBenefits: [
            "Asistencia biométrica con reconocimiento facial",
            "Modo kiosk para entrada y salida por sucursal",
            "Gestión de turnos, horarios rotativos y descansos",
            "Cálculo legal de nómina para Panamá",
            "Décimo tercer mes, vacaciones y liquidaciones",
            "Recibos de pago electrónicos firmados",
            "Reportes a la Caja de Seguro Social y MITRADEL",
            "Control de horas extras y ausencias",
        ],
        technicalSpecs: [
            { label: "Biometría", value: "Reconocimiento facial" },
            { label: "Modo kiosk", value: "Sí" },
            { label: "Cálculo legal", value: "Normativa panameña" },
            { label: "Empleados", value: "Ilimitados" },
            { label: "Reportes oficiales", value: "CSS / MITRADEL" },
        ],
        useCases: [
            { title: "Cadenas multi-sucursal", description: "Kioskos biométricos en cada punto con consolidación central." },
            { title: "Plantas de manufactura", description: "Turnos rotativos y control de horas extras a escala." },
            { title: "Cadenas de servicio", description: "Horarios variables con cálculo automático de nómina." },
            { title: "Empresas con trabajo remoto", description: "Check-in móvil con geolocalización opcional." },
        ],
        pricingInfo: { plan: "Control de Personal", description: "Incluye biometría, turnos y cálculo legal de nómina Panamá." },
    },
    {
        id: "bi",
        icon: BarChart3,
        title: "Reportes y BI",
        subtitle: "Decisiones con datos en vivo",
        description: "Dashboards en vivo con ventas, utilidad y rotación por producto, sucursal o vendedor. Exporta reportes fiscales, contables y operativos listos para compartir.",
        color: "text-rose-600 dark:text-rose-400",
        bgColor: "bg-rose-100 dark:bg-rose-500/10",
        hoverBorder: "hover:border-rose-500/40",
        image: "/assets/landing/feature_bi_dashboard.png",
        priceMonthly: 25,
        priceYearly: 250,
        keyBenefits: [
            "Dashboards en tiempo real con KPIs clave",
            "Ventas por producto, sucursal, vendedor y cliente",
            "Análisis de utilidad bruta y margen por SKU",
            "Rotación de inventario y productos sin movimiento",
            "Reportes fiscales listos para la DGI",
            "Exportación a Excel, PDF y CSV",
            "Comparativas mensuales y por período",
            "Alertas personalizadas por umbral",
        ],
        technicalSpecs: [
            { label: "Actualización", value: "Tiempo real" },
            { label: "Reportes incluidos", value: "30+" },
            { label: "Exportación", value: "Excel / PDF / CSV" },
            { label: "Períodos", value: "Día, mes, año" },
            { label: "Alertas", value: "Personalizables" },
        ],
        useCases: [
            { title: "Gerencia general", description: "Visión ejecutiva consolidada de todo el negocio." },
            { title: "Jefes de sucursal", description: "Seguimiento diario de metas y desempeño." },
            { title: "Contadores", description: "Reportes fiscales listos para cierre mensual y anual." },
            { title: "Dueños de franquicia", description: "Comparativa de desempeño entre sucursales." },
        ],
        pricingInfo: { plan: "Reportes y BI", description: "Capa analítica sobre el resto de módulos activos." },
    },
    {
        id: "creditos",
        icon: CreditCard,
        title: "Créditos a Clientes",
        subtitle: "Otorga crédito y controla el cobro",
        description: "Gestiona el ciclo completo del crédito otorgado a tus clientes: límites por entidad, otorgamiento, abonos, ajustes y estado de cuenta — con bloqueo automático al exceder el límite. Tarifa por tier según número de clientes con crédito activo.",
        color: "text-fuchsia-600 dark:text-fuchsia-400",
        bgColor: "bg-fuchsia-100 dark:bg-fuchsia-500/10",
        hoverBorder: "hover:border-fuchsia-500/40",
        image: "/assets/landing/feature_creditos_phone.png",
        priceMonthly: 49.99,
        priceYearly: 499.9,
        keyBenefits: [
            "Otorgamiento de crédito con límite por cliente",
            "Abonos parciales y aplicaciones a documentos pendientes",
            "Estado de cuenta consolidado por entidad",
            "Bloqueo automático al exceder el límite",
            "Historial completo de movimientos (ledger auditado)",
            "Modal de 3 fases (input → preview → confirm) en cada operación",
            "Tier por volumen: hasta 50, 100 o 250 clientes con crédito activo",
            "SUPER_ADMIN puede subir o bajar de tier desde el panel",
        ],
        technicalSpecs: [
            { label: "Tier 1", value: "hasta 50 clientes — $49.99/mes" },
            { label: "Tier 2", value: "hasta 100 clientes — $74.99/mes" },
            { label: "Tier 3", value: "hasta 250 clientes — $99.99/mes" },
            { label: "Bloqueo", value: "Duro al exceder límite" },
            { label: "Auditoría", value: "Ledger completo por entidad" },
        ],
        useCases: [
            { title: "Distribuidoras", description: "Crédito a tiendas mayoristas con cobro a 30/60 días." },
            { title: "Mayoristas", description: "Cuenta corriente por cliente con tope dinámico." },
            { title: "Servicios B2B", description: "Facturación recurrente con saldo acumulado." },
            { title: "Concesionarios", description: "Financiamiento parcial con seguimiento de abonos." },
        ],
        pricingInfo: { plan: "Créditos a Clientes", description: "Tier por número de clientes con crédito activo." },
    },
]

const formatPrice = (value: number) =>
    Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2)

export function FeaturesSection() {
    const [detail, setDetail] = useState<ModuleCardData | null>(null)
    const [detailOpen, setDetailOpen] = useState(false)
    const [selected, setSelected] = useState<string[]>([])
    const [isYearly, setIsYearly] = useState(false)

    const openDetail = (mod: ModuleCardData) => {
        setDetail(mod)
        setDetailOpen(true)
    }

    const toggle = (id: string) => {
        setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    }

    const selectedModules = useMemo(
        () => modulesData.filter((m) => selected.includes(m.id)),
        [selected]
    )

    const total = useMemo(
        () =>
            selectedModules.reduce(
                (sum, m) => sum + (isYearly ? m.priceYearly : m.priceMonthly),
                0
            ),
        [selectedModules, isYearly]
    )

    const periodLabel = isYearly ? "año" : "mes"

    const signupHref = useMemo(() => {
        if (selected.length === 0) return ""
        const params = new URLSearchParams({
            modules: selected.join(","),
            billing: isYearly ? "yearly" : "monthly",
        })
        return `/auth/signup?${params.toString()}`
    }, [selected, isYearly])

    return (
        <section
            id="modulos"
            className="relative py-24 sm:py-28 px-4 bg-slate-50 dark:bg-slate-950 overflow-hidden"
        >
            {/* Ambient color orbs */}
            <div
                className="pointer-events-none absolute top-20 left-1/4 h-[420px] w-[420px] rounded-full bg-violet-500/10 blur-[140px] animate-pulse"
                aria-hidden
            />
            <div
                className="pointer-events-none absolute bottom-20 right-1/4 h-[420px] w-[420px] rounded-full bg-indigo-500/10 blur-[140px] animate-pulse"
                aria-hidden
                style={{ animationDelay: "1.5s" }}
            />

            <div className="relative z-10 max-w-6xl mx-auto">
                {/* Section Header */}
                <div className="text-center mb-10 max-w-2xl mx-auto">
                    <p className="text-sm font-bold tracking-wide uppercase text-violet-600 dark:text-violet-400 mb-3">
                        Módulos y planes
                    </p>
                    <h2 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-5">
                        Arma tu{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500">
                            plan modular
                        </span>
                    </h2>
                    <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                        Activa solo los módulos que necesitas, pagas solo por lo que usas. Tu precio
                        se calcula en vivo y se lleva directo a tu registro.
                    </p>
                </div>

                {/* Billing toggle (serves as #planes anchor) */}
                <div id="planes" className="flex justify-center mb-12 scroll-mt-28">
                    <div className="inline-flex items-center gap-1 p-1 bg-white dark:bg-white/[0.06] rounded-full border border-slate-200 dark:border-white/[0.1] shadow-sm">
                        <button
                            type="button"
                            onClick={() => setIsYearly(false)}
                            className={cn(
                                "px-5 py-2 rounded-full text-sm font-medium transition-all",
                                !isYearly
                                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            )}
                        >
                            Mensual
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsYearly(true)}
                            className={cn(
                                "px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                                isYearly
                                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            )}
                        >
                            Anual
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded uppercase font-bold">
                                -17%
                            </span>
                        </button>
                    </div>
                </div>

                {/* Modules Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                    {modulesData.map((mod) => (
                        <ModuleCard
                            key={mod.id}
                            module={mod}
                            isActive={selected.includes(mod.id)}
                            isYearly={isYearly}
                            onToggle={() => toggle(mod.id)}
                            onDetails={() => openDetail(mod)}
                        />
                    ))}
                </div>

                {/* Live summary + CTA */}
                <div className="relative mt-10 rounded-2xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] backdrop-blur-xl overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-transparent to-indigo-500/5 pointer-events-none" />
                    <div className="relative z-10 p-6 md:p-8 flex flex-col lg:flex-row items-center justify-between gap-6">
                        <div className="flex-1 w-full">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                                Tu plan
                            </p>
                            {selectedModules.length === 0 ? (
                                <p className="text-base text-slate-500 dark:text-slate-400">
                                    Activa al menos un módulo para continuar con tu registro.
                                </p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {selectedModules.map((m) => {
                                        const Icon = m.icon
                                        return (
                                            <span
                                                key={m.id}
                                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-white/[0.08] text-xs font-medium text-slate-700 dark:text-slate-200"
                                            >
                                                <Icon className={cn("h-3.5 w-3.5", m.color)} />
                                                {m.title}
                                            </span>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-4">
                            <div className="text-right">
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                                    Desde
                                </p>
                                <div className="flex items-baseline gap-1 justify-end">
                                    <span className="text-lg text-slate-400 font-light">$</span>
                                    <span className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight tabular-nums">
                                        {formatPrice(total)}
                                    </span>
                                    <span className="text-sm text-slate-500 dark:text-slate-400">
                                        /{periodLabel}
                                    </span>
                                </div>
                            </div>
                            <Link
                                href={signupHref || "#modulos"}
                                className={cn(
                                    "inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm sm:text-base whitespace-nowrap transition-all duration-200",
                                    selected.length > 0
                                        ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40"
                                        : "bg-slate-200 dark:bg-white/[0.08] text-slate-500 dark:text-slate-400 cursor-not-allowed pointer-events-none"
                                )}
                                aria-disabled={selected.length === 0}
                            >
                                Continuar al registro
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <FeatureDetailModal feature={detail} open={detailOpen} onOpenChange={setDetailOpen} />
        </section>
    )
}

function ModuleCard({
    module: mod,
    isActive,
    isYearly,
    onToggle,
    onDetails,
}: {
    module: ModuleCardData
    isActive: boolean
    isYearly: boolean
    onToggle: () => void
    onDetails: () => void
}) {
    const Icon = mod.icon
    const price = isYearly ? mod.priceYearly : mod.priceMonthly
    const periodLabel = isYearly ? "año" : "mes"

    return (
        <div
            className={cn(
                "group relative flex flex-col md:flex-row overflow-hidden rounded-2xl",
                "bg-white dark:bg-white/[0.04] backdrop-blur-xl",
                "border transition-all duration-300",
                isActive
                    ? "border-violet-500/60 shadow-xl shadow-violet-500/15 ring-1 ring-violet-500/40"
                    : cn("border-slate-200 dark:border-white/[0.08] hover:-translate-y-0.5 hover:shadow-xl", mod.hoverBorder)
            )}
        >
            {/* Left: content */}
            <div className="flex-1 p-6 lg:p-7 flex flex-col">
                <div className="flex items-start justify-between mb-4">
                    <div
                        className={cn(
                            "inline-flex h-12 w-12 items-center justify-center rounded-xl",
                            mod.bgColor
                        )}
                    >
                        <Icon className={cn("h-6 w-6", mod.color)} />
                    </div>
                    {isActive && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 text-[11px] font-bold uppercase tracking-wider">
                            <Check className="h-3 w-3" strokeWidth={3} />
                            Añadido
                        </span>
                    )}
                </div>

                <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-2">
                    {mod.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {mod.description}
                </p>
            </div>

            {/* Right: illustration with price + buttons overlaid */}
            <div className="relative h-44 md:h-auto md:w-52 lg:w-60 md:flex-shrink-0 overflow-hidden">
                <Image
                    src={mod.image}
                    alt={mod.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 240px"
                    className={cn(
                        "object-cover object-center transition-all duration-500 group-hover:scale-105",
                        isActive ? "grayscale-0 opacity-100" : "grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100"
                    )}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-white via-white/60 to-transparent dark:from-slate-950 dark:via-slate-950/60 dark:to-transparent hidden md:block" />
                <div className="absolute inset-0 bg-gradient-to-t from-white/30 via-transparent to-transparent dark:from-slate-950/30 md:hidden" />

                {/* Price + buttons overlaid at the bottom of the illustration */}
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/55 to-transparent">
                    <div className="flex items-baseline gap-0.5 mb-2">
                        <span className="text-[10px] uppercase tracking-wider text-white/60 font-bold mr-1">desde</span>
                        <span className="text-sm text-white/60 font-light">$</span>
                        <span className="text-xl font-bold text-white tracking-tight tabular-nums">
                            {formatPrice(price)}
                        </span>
                        <span className="text-sm text-white/60">/{periodLabel}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={onToggle}
                            aria-pressed={isActive}
                            className={cn(
                                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                                isActive
                                    ? "bg-violet-600 text-white hover:bg-violet-500"
                                    : "bg-white text-slate-900 hover:opacity-90"
                            )}
                        >
                            {isActive ? (
                                <>
                                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                    Añadido al plan
                                </>
                            ) : (
                                <>
                                    <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                                    Añadir al plan
                                </>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={onDetails}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/80 hover:text-white transition-colors"
                        >
                            <Info className="h-3.5 w-3.5" />
                            Ver detalles
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
