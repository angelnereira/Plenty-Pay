"use server";

import { auth } from "@core/auth";
import { revalidatePath } from "next/cache";
import { InventoryAnalyticsService } from "@/features/inventory/model/services/inventory-analytics.service";
import { ValuationMethod } from "@/features/inventory/model/types/purchase.types";

const analyticsService = new InventoryAnalyticsService();

// ============================================
// ABC CLASSIFICATION
// ============================================

export async function calculateABCClassification() {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    return analyticsService.calculateABCClassification(session.user.clientId);
}

export async function applyABCClassification() {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    const updated = await analyticsService.applyABCClassification(
        session.user.clientId
    );

    revalidatePath("/dashboard/inventory/productos");
    revalidatePath("/dashboard/inventory/analitica");
    return { updated };
}

// ============================================
// INVENTORY VALUATION
// ============================================

export async function getProductValuation(
    productId: string,
    method: ValuationMethod = "WEIGHTED_AVG"
) {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    if (method === "FIFO") {
        return analyticsService.calculateFIFOValuation(productId);
    }
    return analyticsService.calculateWeightedAverageValuation(productId);
}

export async function calculateCOGS(
    productId: string,
    quantity: number,
    method: ValuationMethod = "WEIGHTED_AVG"
) {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    return analyticsService.calculateCOGS(productId, quantity, method);
}

// ============================================
// INVENTORY TURNOVER
// ============================================

export async function getInventoryTurnover(startDate: Date, endDate: Date) {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    return analyticsService.calculateInventoryTurnover(
        session.user.clientId,
        startDate,
        endDate
    );
}

// ============================================
// STOCKOUT FORECAST
// ============================================

export async function getStockoutForecasts() {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    return analyticsService.getStockoutForecasts(session.user.clientId);
}

// ============================================
// PRODUCT ANALYTICS UPDATE
// ============================================

export async function updateProductAnalytics(productId: string) {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    await analyticsService.updateProductAnalytics(productId);

    revalidatePath(`/dashboard/inventory/productos/${productId}`);
    return { success: true };
}

// ============================================
// FORMULA CALCULATIONS (utilities)
// ============================================

export async function calculateReorderPoint(
    avgDailyDemand: number,
    leadTimeDays: number,
    safetyStock: number
) {
    return analyticsService.calculateReorderPoint(
        avgDailyDemand,
        leadTimeDays,
        safetyStock
    );
}

export async function calculateSafetyStock(
    avgDailyDemand: number,
    safetyDays: number = 7
) {
    return analyticsService.calculateSafetyStock(avgDailyDemand, safetyDays);
}

export async function calculateEOQ(
    annualDemand: number,
    orderingCost: number,
    holdingCostPerUnit: number
) {
    return analyticsService.calculateEOQ(
        annualDemand,
        orderingCost,
        holdingCostPerUnit
    );
}
