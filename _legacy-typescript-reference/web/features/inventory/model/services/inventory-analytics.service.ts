import { prisma } from "@/lib/db";
import {
    ValuationMethod,
    InventoryValuation,
    FIFOLayer,
    COGSCalculation,
    ABCClassificationResult,
    ABCClass,
    InventoryTurnoverMetrics,
    StockoutForecast,
} from "../types/purchase.types";

export class InventoryAnalyticsService {
    // ============================================
    // INVENTORY VALUATION
    // ============================================

    /**
     * Calculate inventory valuation using FIFO method
     */
    async calculateFIFOValuation(productId: string): Promise<{
        totalValue: number;
        layers: FIFOLayer[];
        unitCost: number;
    }> {
        const lots = await prisma.inventoryLot.findMany({
            where: {
                productId,
                isActive: true,
                quantity: { gt: 0 },
            },
            orderBy: { entryDate: "asc" },
        });

        const layers: FIFOLayer[] = lots.map((lot) => ({
            lotId: lot.id,
            batchNumber: lot.batchNumber,
            quantity: Number(lot.quantity),
            unitCost: Number(lot.unitCost),
            entryDate: lot.entryDate,
        }));

        const totalValue = layers.reduce(
            (sum, layer) => sum + layer.quantity * layer.unitCost,
            0
        );
        const totalQuantity = layers.reduce((sum, layer) => sum + layer.quantity, 0);
        const unitCost = totalQuantity > 0 ? totalValue / totalQuantity : 0;

        return { totalValue, layers, unitCost };
    }

    /**
     * Calculate inventory valuation using Weighted Average method
     */
    async calculateWeightedAverageValuation(productId: string): Promise<{
        totalValue: number;
        unitCost: number;
    }> {
        const lots = await prisma.inventoryLot.findMany({
            where: {
                productId,
                isActive: true,
                quantity: { gt: 0 },
            },
        });

        let totalValue = 0;
        let totalQuantity = 0;

        for (const lot of lots) {
            totalValue += Number(lot.quantity) * Number(lot.unitCost);
            totalQuantity += Number(lot.quantity);
        }

        const unitCost = totalQuantity > 0 ? totalValue / totalQuantity : 0;

        return { totalValue, unitCost };
    }

    /**
     * Calculate Cost of Goods Sold for a quantity
     */
    async calculateCOGS(
        productId: string,
        quantity: number,
        method: ValuationMethod
    ): Promise<COGSCalculation> {
        if (method === "FIFO") {
            return this.calculateFIFOCOGS(productId, quantity);
        }
        return this.calculateWeightedAverageCOGS(productId, quantity);
    }

    private async calculateFIFOCOGS(
        productId: string,
        quantity: number
    ): Promise<COGSCalculation> {
        const lots = await prisma.inventoryLot.findMany({
            where: {
                productId,
                isActive: true,
                quantity: { gt: 0 },
            },
            orderBy: { entryDate: "asc" },
        });

        let remainingQty = quantity;
        let totalCost = 0;
        const consumedLayers: FIFOLayer[] = [];

        for (const lot of lots) {
            if (remainingQty <= 0) break;

            const lotQty = Number(lot.quantity);
            const consumeQty = Math.min(lotQty, remainingQty);
            const lotCost = consumeQty * Number(lot.unitCost);

            totalCost += lotCost;
            remainingQty -= consumeQty;

            consumedLayers.push({
                lotId: lot.id,
                batchNumber: lot.batchNumber,
                quantity: consumeQty,
                unitCost: Number(lot.unitCost),
                entryDate: lot.entryDate,
            });
        }

        return {
            productId,
            quantity,
            method: "FIFO",
            totalCost,
            layers: consumedLayers,
        };
    }

    private async calculateWeightedAverageCOGS(
        productId: string,
        quantity: number
    ): Promise<COGSCalculation> {
        const { unitCost } = await this.calculateWeightedAverageValuation(productId);

        return {
            productId,
            quantity,
            method: "WEIGHTED_AVG",
            totalCost: quantity * unitCost,
        };
    }

    // ============================================
    // ABC CLASSIFICATION
    // ============================================

    /**
     * Calculate ABC classification for all products
     * A: Top 80% of value (typically ~20% of items)
     * B: Next 15% of value (typically ~30% of items)
     * C: Bottom 5% of value (typically ~50% of items)
     */
    async calculateABCClassification(
        clientId: string
    ): Promise<ABCClassificationResult[]> {
        const products = await prisma.product.findMany({
            where: { clientId, deletedAt: null, isActive: true },
            include: {
                transactions: {
                    where: {
                        type: "EXIT",
                        createdAt: {
                            gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Last 12 months
                        },
                    },
                    select: { quantity: true },
                },
            },
        });

        // Calculate annual value (quantity sold * sale price)
        const productValues = products.map((product) => {
            const totalSold = product.transactions.reduce(
                (sum, t) => sum + Number(t.quantity),
                0
            );
            const annualValue = totalSold * Number(product.salePrice);

            return {
                productId: product.id,
                productName: product.name,
                annualValue,
            };
        });

        // Sort by value descending
        productValues.sort((a, b) => b.annualValue - a.annualValue);

        // Calculate total value
        const totalValue = productValues.reduce((sum, p) => sum + p.annualValue, 0);

        // Assign ABC classes
        let cumulativePercentage = 0;
        const results: ABCClassificationResult[] = [];

        for (const product of productValues) {
            const percentageOfTotal =
                totalValue > 0 ? (product.annualValue / totalValue) * 100 : 0;
            cumulativePercentage += percentageOfTotal;

            let abcClass: ABCClass = "C";
            if (cumulativePercentage <= 80) {
                abcClass = "A";
            } else if (cumulativePercentage <= 95) {
                abcClass = "B";
            }

            results.push({
                ...product,
                abcClass,
                percentageOfTotal,
                cumulativePercentage,
            });
        }

        return results;
    }

    /**
     * Apply ABC classification to products in database
     */
    async applyABCClassification(clientId: string): Promise<number> {
        const classifications = await this.calculateABCClassification(clientId);

        let updated = 0;
        for (const classification of classifications) {
            await prisma.product.update({
                where: { id: classification.productId },
                data: {
                    abcClass: classification.abcClass,
                    abcClassifiedAt: new Date(),
                },
            });
            updated++;
        }

        return updated;
    }

    // ============================================
    // INVENTORY TURNOVER
    // ============================================

    async calculateInventoryTurnover(
        clientId: string,
        startDate: Date,
        endDate: Date
    ): Promise<InventoryTurnoverMetrics> {
        // Calculate COGS for period
        const salesTransactions = await prisma.inventoryTransaction.findMany({
            where: {
                product: { clientId },
                type: "EXIT",
                createdAt: { gte: startDate, lte: endDate },
            },
            include: { product: true },
        });

        const cogs = salesTransactions.reduce(
            (sum, t) => sum + Number(t.quantity) * Number(t.product.purchasePrice),
            0
        );

        // Calculate average inventory
        const currentInventory = await prisma.$queryRaw<[{ total: number }]>`
      SELECT SUM("currentStock" * "purchasePrice")::float as total
      FROM "products"
      WHERE "clientId" = ${clientId} AND "deletedAt" IS NULL
    `;

        const averageInventory = Number(currentInventory[0]?.total || 0);

        // Calculate metrics
        const turnoverRatio = averageInventory > 0 ? cogs / averageInventory : 0;
        const periodDays = Math.ceil(
            (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const daysOfInventory = turnoverRatio > 0 ? periodDays / turnoverRatio : 0;

        return {
            period: { start: startDate, end: endDate },
            cogs,
            averageInventory,
            turnoverRatio,
            daysOfInventory,
        };
    }

    // ============================================
    // STOCKOUT FORECAST
    // ============================================

    async getStockoutForecasts(clientId: string): Promise<StockoutForecast[]> {
        const products = await prisma.product.findMany({
            where: {
                clientId,
                deletedAt: null,
                isActive: true,
                avgDailyDemand: { gt: 0 },
                currentStock: { gt: 0 },
            },
        });

        const forecasts: StockoutForecast[] = [];

        for (const product of products) {
            const currentStock = Number(product.currentStock);
            const avgDailyDemand = Number(product.avgDailyDemand);
            const reorderPoint = Number(product.reorderPoint);

            if (avgDailyDemand > 0) {
                const daysUntilStockout = Math.floor(currentStock / avgDailyDemand);
                const estimatedStockoutDate = new Date();
                estimatedStockoutDate.setDate(
                    estimatedStockoutDate.getDate() + daysUntilStockout
                );

                forecasts.push({
                    productId: product.id,
                    productName: product.name,
                    currentStock,
                    avgDailyDemand,
                    daysUntilStockout,
                    estimatedStockoutDate,
                    reorderRecommended: currentStock <= reorderPoint,
                });
            }
        }

        // Sort by days until stockout (most urgent first)
        return forecasts.sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);
    }

    // ============================================
    // REORDER CALCULATIONS
    // ============================================

    /**
     * Calculate Reorder Point (ROP)
     * ROP = (Average Daily Demand × Lead Time) + Safety Stock
     */
    calculateReorderPoint(
        avgDailyDemand: number,
        leadTimeDays: number,
        safetyStock: number
    ): number {
        return avgDailyDemand * leadTimeDays + safetyStock;
    }

    /**
     * Calculate Safety Stock
     * Using simple method: Safety Stock = Average Daily Demand × Safety Days
     */
    calculateSafetyStock(avgDailyDemand: number, safetyDays: number = 7): number {
        return avgDailyDemand * safetyDays;
    }

    /**
     * Calculate Economic Order Quantity (EOQ)
     * EOQ = √(2 × D × S / H)
     * D = Annual demand
     * S = Ordering cost per order
     * H = Holding cost per unit per year
     */
    calculateEOQ(
        annualDemand: number,
        orderingCost: number,
        holdingCostPerUnit: number
    ): number {
        if (holdingCostPerUnit <= 0 || orderingCost <= 0 || annualDemand <= 0) {
            return 0;
        }
        return Math.sqrt((2 * annualDemand * orderingCost) / holdingCostPerUnit);
    }

    /**
     * Update product analytics based on historical data
     */
    async updateProductAnalytics(productId: string): Promise<void> {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const transactions = await prisma.inventoryTransaction.findMany({
            where: {
                productId,
                type: "EXIT",
                createdAt: { gte: thirtyDaysAgo },
            },
        });

        const totalSold = transactions.reduce(
            (sum, t) => sum + Number(t.quantity),
            0
        );
        const avgDailyDemand = totalSold / 30;

        // Calculate demand variability (coefficient of variation)
        const dailyDemands = new Map<string, number>();
        for (const t of transactions) {
            const dateKey = t.createdAt.toISOString().split("T")[0];
            dailyDemands.set(
                dateKey,
                (dailyDemands.get(dateKey) || 0) + Number(t.quantity)
            );
        }

        const demands = Array.from(dailyDemands.values());
        const mean = demands.reduce((a, b) => a + b, 0) / (demands.length || 1);
        const variance =
            demands.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) /
            (demands.length || 1);
        const stdDev = Math.sqrt(variance);
        const cv = mean > 0 ? (stdDev / mean) * 100 : 0;

        await prisma.product.update({
            where: { id: productId },
            data: {
                avgDailyDemand,
                demandVariability: Math.min(cv, 999.99), // Cap at 999.99%
                lastDemandUpdate: new Date(),
            },
        });
    }
}
