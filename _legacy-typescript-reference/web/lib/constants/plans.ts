/**
 * Catálogo único de planes, addons y precios — single source of truth.
 *
 * Todo precio en CENTAVOS (number). Convierte a "$X.YY" via formatCents().
 *
 * Modelo (v2 — START/BUSINESS/ENTERPRISE):
 *
 *   Cada plan incluye Facturación, Inventario y POS (con cap de cajas).
 *   Cada plan trae un cap mensual de facturas (soft cap con avisos al
 *   80% / 100% — nunca bloquea emisión).
 *   ENTERPRISE incluye además Logística, API Access y Multi-sucursal.
 *
 *   Periodicidad de cobro:
 *     - MONTHLY : precio base mensual (priceCents)
 *     - YEARLY  : ~17% de descuento sobre 12 meses (priceYearlyCents)
 *     Los addons recurring se siguen cobrando siempre mensual, aun cuando
 *     el plan es anual — el período aplica al "compromiso" del plan.
 *
 *   Addons cobrables aparte (independientes del plan):
 *     - payday          : $20 base + $5 × empleado activo (dinámico, runtime)
 *     - logistics       : $35/mes (incluido en ENTERPRISE)
 *     - creditos        : tiered $49.99 / $74.99 / $99.99 según # clientes con crédito
 *     - apiAccess       : $29/mes (incluido en ENTERPRISE)
 *     - multiBranch     : $19/mes por sucursal extra (ENTERPRISE permite ilimitadas)
 *     - whatsapp        : $19/mes (envío de comprobantes y notificaciones por WhatsApp)
 *     - premiumSupport  : $49/mes (SLA < 1h, agente asignado)
 *
 *   Servicios fuera del catálogo recurrente (cobro único, gestionado a mano):
 *     - Onboarding pagado / capacitación
 *     - Hardware (impresoras, lectores, kit POS)
 *
 *   Capacidad extra (sobre lo del plan):
 *     - usuario extra : $10/mes
 *     - caja POS extra: $15/mes
 *
 * NUNCA hardcodear precios en otros archivos — siempre importar de aquí.
 */

import type { MotorCreditTier, BillingPeriod } from "@prisma/client";

// ============================================
// PLANES
// ============================================

export type PlanType = "START" | "BUSINESS" | "ENTERPRISE";

export type { BillingPeriod };

export interface PlanSpec {
    readonly label: string;
    readonly priceCents: number;
    /** Precio anual con descuento ~17% sobre 12 meses (≈ 2 meses gratis). */
    readonly priceYearlyCents: number;
    readonly maxUsers: number;
    readonly maxPosStations: number;
    readonly maxBranches: number;
    readonly monthlyInvoiceCap: number;
    readonly overageBlock: { readonly facturas: number; readonly priceCents: number };
    readonly includedAddons: readonly AddonId[];
    readonly targetSegment: string;
    readonly bullets: readonly string[];
}

export const PLAN_CONFIG: Record<PlanType, PlanSpec> = {
    START: {
        label: "Start",
        priceCents: 2499,
        priceYearlyCents: 24900, // $249/año (≈ $20.75/mes)
        maxUsers: 3,
        maxPosStations: 1,
        maxBranches: 1,
        monthlyInvoiceCap: 100,
        overageBlock: { facturas: 100, priceCents: 700 },
        includedAddons: [],
        targetSegment: "Emprendedores, tiendas pequeñas y freelancers",
        bullets: [
            "Facturación electrónica DGI",
            "Inventario básico",
            "1 caja POS",
            "Dashboard y reportes básicos",
            "PWA offline",
            "Soporte estándar",
            "100 facturas/mes incluidas",
        ],
    },
    BUSINESS: {
        label: "Business",
        priceCents: 5999,
        priceYearlyCents: 59900, // $599/año (≈ $49.92/mes)
        maxUsers: 10,
        maxPosStations: 3,
        maxBranches: 1,
        monthlyInvoiceCap: 500,
        overageBlock: { facturas: 500, priceCents: 2500 },
        includedAddons: [],
        targetSegment: "Minisupers, restaurantes, retail mediano",
        bullets: [
            "Todo lo de Start",
            "3 cajas POS",
            "Inventario avanzado",
            "Control de caja y arqueo",
            "Usuarios múltiples con roles",
            "Reportes avanzados",
            "Prioridad en soporte",
            "500 facturas/mes incluidas",
        ],
    },
    ENTERPRISE: {
        label: "Enterprise",
        priceCents: 14999,
        priceYearlyCents: 149900, // $1,499/año (≈ $124.92/mes)
        maxUsers: 100,
        maxPosStations: 5,
        maxBranches: 999,
        monthlyInvoiceCap: 3000,
        overageBlock: { facturas: 1000, priceCents: 4000 },
        includedAddons: ["logistics", "apiAccess", "multiBranch"],
        targetSegment: "Cadenas, multi-sucursal, ecommerce + POS",
        bullets: [
            "Facturación avanzada",
            "Multi-sucursal incluido",
            "5 cajas POS",
            "API Access incluido",
            "Logística y entregas incluidas",
            "SLA prioritario",
            "Soporte dedicado",
            "Integraciones a medida",
            "3,000 facturas/mes (alto volumen disponible)",
        ],
    },
};

export const PLAN_ORDER: readonly PlanType[] = ["START", "BUSINESS", "ENTERPRISE"];

// Compat: muchos lugares importan PLAN_OPTIONS como [{value,label,price,maxUsers,maxPosStations}]
export const PLAN_OPTIONS = PLAN_ORDER.map((value) => {
    const cfg = PLAN_CONFIG[value];
    return {
        value,
        label: cfg.label,
        price: cfg.priceCents / 100,
        maxUsers: cfg.maxUsers,
        maxPosStations: cfg.maxPosStations,
    };
});

// ============================================
// ADDONS
// ============================================

export type AddonId =
    | "payday"
    | "logistics"
    | "creditos"
    | "apiAccess"
    | "multiBranch"
    | "whatsapp"
    | "premiumSupport"
    | "bi"
    | "biPro";

type AddonPricing =
    | { readonly kind: "fixed"; readonly priceCents: number }
    | { readonly kind: "dynamic"; readonly baseCents: number; readonly perEmployeeCents: number }
    | {
          readonly kind: "tiered";
          readonly tiers: Readonly<
              Record<MotorCreditTier, { readonly priceCents: number; readonly limit: number; readonly label: string }>
          >;
      }
    | { readonly kind: "perUnit"; readonly unitPriceCents: number };

export interface AddonSpec {
    readonly id: AddonId;
    readonly label: string;
    readonly description: string;
    readonly pricing: AddonPricing;
    /** Campo Boolean del Client que indica si está activo. multiBranch usa el contador extraBranches. */
    readonly flagField?: keyof ClientFlags;
    /** Solo en addon tiered (creditos). */
    readonly tierField?: "motorCreditTier";
    /** Otro addon que debe estar activo para poder activar este. Ej: biPro requiere bi. */
    readonly requires?: AddonId;
}

export const ADDON_CATALOG: Record<AddonId, AddonSpec> = {
    payday: {
        id: "payday",
        label: "Nómina Legal Panamá",
        description: "Cálculo de planilla, SIPE, liquidaciones y control biométrico",
        pricing: { kind: "dynamic", baseCents: 2000, perEmployeeCents: 500 },
        flagField: "paydayEnabled",
    },
    logistics: {
        id: "logistics",
        label: "Órdenes de Entrega",
        description: "Gestión de despachos, conductores, rutas y tracking de entregas",
        pricing: { kind: "fixed", priceCents: 3500 },
        flagField: "logisticsEnabled",
    },
    creditos: {
        id: "creditos",
        label: "Módulo de Créditos",
        description: "Crédito otorgado a tus clientes: cargos, abonos, ajustes y estado de cuenta",
        pricing: {
            kind: "tiered",
            tiers: {
                TIER_1: { priceCents: 4999, limit: 50, label: "Tier 1 — hasta 50 clientes" },
                TIER_2: { priceCents: 7499, limit: 100, label: "Tier 2 — hasta 100 clientes" },
                TIER_3: { priceCents: 9999, limit: 250, label: "Tier 3 — hasta 250 clientes" },
            },
        },
        flagField: "creditosEnabled",
        tierField: "motorCreditTier",
    },
    apiAccess: {
        id: "apiAccess",
        label: "API Access",
        description: "Endpoints REST + webhooks para integraciones externas",
        pricing: { kind: "fixed", priceCents: 2900 },
        flagField: "apiAccessEnabled",
    },
    multiBranch: {
        id: "multiBranch",
        label: "Sucursales adicionales",
        description: "Cada sucursal extra sobre la incluida en el plan",
        pricing: { kind: "perUnit", unitPriceCents: 1900 },
    },
    whatsapp: {
        id: "whatsapp",
        label: "WhatsApp Business",
        description: "Envía facturas, cotizaciones y notificaciones a tus clientes por WhatsApp",
        pricing: { kind: "fixed", priceCents: 1900 },
        flagField: "whatsappEnabled",
    },
    premiumSupport: {
        id: "premiumSupport",
        label: "Soporte Premium",
        description: "Tiempo de respuesta < 1h, canal directo y agente asignado",
        pricing: { kind: "fixed", priceCents: 4900 },
        flagField: "premiumSupportEnabled",
    },
    bi: {
        id: "bi",
        label: "BI Esencial",
        description: "Dashboards de monitoreo, drill-down, exportes y alertas por umbral",
        pricing: { kind: "fixed", priceCents: 2500 },
        flagField: "biEnabled",
    },
    biPro: {
        id: "biPro",
        label: "BI Pro",
        description: "Builder de vistas custom, predicción, segmentación y campañas (incluye Esencial)",
        pricing: { kind: "fixed", priceCents: 5900 },
        flagField: "biProEnabled",
        requires: "bi",
    },
};

export const ADDON_ORDER: readonly AddonId[] = [
    "payday",
    "logistics",
    "creditos",
    "apiAccess",
    "multiBranch",
    "whatsapp",
    "premiumSupport",
    "bi",
    "biPro",
];

// ============================================
// CAPACIDAD EXTRA
// ============================================

export const EXTRA_PRICING_CENTS = {
    user: 1000, // por usuario extra/mes
    posStation: 1500, // por caja POS extra/mes
} as const;

// ============================================
// COMPAT: MODULE_PRICES legacy
// ============================================
// Algunos archivos siguen importando MODULE_PRICES con keys antiguas
// (inventory/pos/payday/logistics/extraUser/extraPos). Conservamos el
// objeto pero ahora derivado del catálogo. Nuevos archivos deben usar
// ADDON_CATALOG / EXTRA_PRICING_CENTS.
export const MODULE_PRICES = {
    inventory: 0, // ahora incluido en plan; legado
    pos: 0, // ahora incluido en plan; legado
    payday: ADDON_CATALOG.payday.pricing.kind === "dynamic"
        ? ADDON_CATALOG.payday.pricing.baseCents / 100
        : 0,
    logistics: ADDON_CATALOG.logistics.pricing.kind === "fixed"
        ? ADDON_CATALOG.logistics.pricing.priceCents / 100
        : 0,
    extraUser: EXTRA_PRICING_CENTS.user / 100,
    extraPos: EXTRA_PRICING_CENTS.posStation / 100,
} as const;

// ============================================
// HELPERS
// ============================================

export interface ClientFlags {
    facturacionEnabled?: boolean;
    inventoryEnabled?: boolean;
    posEnabled?: boolean;
    paydayEnabled?: boolean;
    logisticsEnabled?: boolean;
    creditosEnabled?: boolean;
    apiAccessEnabled?: boolean;
    whatsappEnabled?: boolean;
    premiumSupportEnabled?: boolean;
    biEnabled?: boolean;
    biProEnabled?: boolean;
    motorCreditTier?: MotorCreditTier | null;
    extraBranches?: number;
    planType?: string;
}

/** BI Esencial activo (directo o porque tiene Pro). */
export function isBIEnabled(client: ClientFlags): boolean {
    return Boolean(client.biEnabled || client.biProEnabled);
}

/** BI Pro activo. */
export function isBIProEnabled(client: ClientFlags): boolean {
    return Boolean(client.biProEnabled);
}

export function isAddonIncludedInPlan(planType: PlanType, addonId: AddonId): boolean {
    return PLAN_CONFIG[planType].includedAddons.includes(addonId);
}

export function isAddonActive(client: ClientFlags, addonId: AddonId): boolean {
    const planType = (client.planType as PlanType | undefined) ?? "START";
    if (PLAN_CONFIG[planType] && isAddonIncludedInPlan(planType, addonId)) return true;
    const spec = ADDON_CATALOG[addonId];
    if (!spec.flagField) {
        // multiBranch: activo si extraBranches > 0
        return (client.extraBranches ?? 0) > 0;
    }
    return Boolean(client[spec.flagField]);
}

export interface BillingContext {
    /** Empleados activos de payday (count). 0 si addon inactivo. */
    paydayEmployeeCount?: number;
    /** Cajas POS extra contratadas sobre el plan. */
    extraPosStations?: number;
    /** Usuarios extra contratados sobre el plan. */
    extraUsers?: number;
    /** Bloques de sobreconsumo de facturas comprados este mes. */
    extraInvoiceBlocks?: number;
}

/** Precio mensual del addon para este client (0 si inactivo o incluido en plan). */
export function getAddonMonthlyCents(
    client: ClientFlags,
    addonId: AddonId,
    ctx: BillingContext = {}
): number {
    const planType = (client.planType as PlanType | undefined) ?? "START";
    if (PLAN_CONFIG[planType] && isAddonIncludedInPlan(planType, addonId)) return 0;
    if (!isAddonActive(client, addonId)) return 0;

    const spec = ADDON_CATALOG[addonId];
    switch (spec.pricing.kind) {
        case "fixed":
            return spec.pricing.priceCents;
        case "dynamic": {
            const employees = Math.max(0, ctx.paydayEmployeeCount ?? 0);
            return spec.pricing.baseCents + employees * spec.pricing.perEmployeeCents;
        }
        case "tiered": {
            const tier = client.motorCreditTier;
            if (!tier) return 0;
            return spec.pricing.tiers[tier].priceCents;
        }
        case "perUnit": {
            const units = Math.max(0, client.extraBranches ?? 0);
            return units * spec.pricing.unitPriceCents;
        }
    }
}

/** Total mensual (centavos) considerando plan + addons activos + capacidad extra + sobreconsumo. */
export function computeMonthlyTotalCents(client: ClientFlags, ctx: BillingContext = {}): number {
    const planType = (client.planType as PlanType | undefined) ?? "START";
    const plan = PLAN_CONFIG[planType] ?? PLAN_CONFIG.START;
    let total = plan.priceCents;
    for (const addonId of ADDON_ORDER) {
        total += getAddonMonthlyCents(client, addonId, ctx);
    }
    total += (ctx.extraUsers ?? 0) * EXTRA_PRICING_CENTS.user;
    total += (ctx.extraPosStations ?? 0) * EXTRA_PRICING_CENTS.posStation;
    total += (ctx.extraInvoiceBlocks ?? 0) * plan.overageBlock.priceCents;
    return total;
}

// ============================================
// PERIODICIDAD DE COBRO (mensual / anual)
// ============================================

/** Precio del plan para el período seleccionado. Anual incluye descuento ~17%. */
export function getPlanPriceCents(planType: PlanType, period: BillingPeriod): number {
    const plan = PLAN_CONFIG[planType] ?? PLAN_CONFIG.START;
    return period === "YEARLY" ? plan.priceYearlyCents : plan.priceCents;
}

/** Equivalente mensual del plan en el período dado (anual / 12 redondeado al centavo). */
export function getPlanMonthlyEquivalentCents(planType: PlanType, period: BillingPeriod): number {
    const plan = PLAN_CONFIG[planType] ?? PLAN_CONFIG.START;
    if (period === "YEARLY") return Math.round(plan.priceYearlyCents / 12);
    return plan.priceCents;
}

/**
 * Ahorro anual (centavos) al pagar yearly vs 12 × mensual.
 * Útil para mostrar "Ahorra B/. X al año" en landing y mi-suscripción.
 */
export function getYearlySavingsCents(planType: PlanType): number {
    const plan = PLAN_CONFIG[planType] ?? PLAN_CONFIG.START;
    return Math.max(0, plan.priceCents * 12 - plan.priceYearlyCents);
}

export function formatBillingPeriod(period: BillingPeriod): string {
    return period === "YEARLY" ? "Anual" : "Mensual";
}

/** Cap mensual de facturas para el plan. */
export function getInvoiceCapForPlan(planType: PlanType): number {
    return PLAN_CONFIG[planType]?.monthlyInvoiceCap ?? PLAN_CONFIG.START.monthlyInvoiceCap;
}

/** "$24.99" — formato canónico para UI y emails. */
export function formatCents(cents: number): string {
    const sign = cents < 0 ? "-" : "";
    const abs = Math.abs(cents);
    const dollars = Math.floor(abs / 100);
    const remainder = abs % 100;
    return `${sign}$${dollars.toLocaleString("en-US")}.${remainder.toString().padStart(2, "0")}`;
}
