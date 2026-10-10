"use server";

import { auth } from "@/core/auth";
import { prisma } from "@/lib/db";
import { InventoryService } from "@/features/inventory/model/services/inventory.service";
import { revalidatePath } from "next/cache";
import { verifyPassword } from "@/actions/security";
import { z } from "zod";

import { jsonify } from "@/lib/serialize";


const productSchema = z.object({
    name: z.string().min(1, "El nombre es obligatorio"),
    purchasePrice: z.coerce.number().min(0, "El precio de compra debe ser mayor o igual a 0"),
    salePrice: z.coerce.number().min(0, "El precio de venta debe ser mayor o igual a 0"),
    taxRate: z.coerce.number().min(0).default(7),
    sku: z.string().optional(),
    barcode: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    taxCode: z.string().min(1, "El código de impuesto es obligatorio").default("01"),
    weight: z.string().optional(),
    size: z.string().optional(),
    dimensions: z.string().optional(),
    color: z.string().optional(),
    material: z.string().optional(),
    unitType: z.string().optional(),
    originCountry: z.string().optional(),
    image: z.string().optional(),
    cpbsCode: z.string().optional(),
    cpbsUnit: z.string().optional(),
}).passthrough();

const inventoryService = new InventoryService();

async function getClientContext() {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("No autorizado");
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            id: true,
            client: {
                select: {
                    id: true,
                    inventoryEnabled: true
                }
            }
        }
    });

    if (!user?.client) {
        throw new Error("No se encontró organización configurada");
    }

    return {
        clientId: user.client.id,
        userId: user.id,
        inventoryEnabled: user.client.inventoryEnabled ?? false
    };
}

export async function registerProductAction(input: unknown) {
    try {
        const { clientId, userId, inventoryEnabled } = await getClientContext();

        if (!inventoryEnabled) {
            throw new Error("El módulo de inventario no está habilitado para su plan");
        }

        const validation = productSchema.safeParse(input);
        if (!validation.success) {
            return { success: false, error: validation.error.issues[0].message };
        }

        const product = await inventoryService.registerProduct(clientId, { ...validation.data, userId });
        revalidatePath("/dashboard/inventory");
        return { success: true, data: jsonify(product) };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
    }
}

export async function processBatchEntryAction(input: { productId: string, [key: string]: unknown }) {
    try {
        const { clientId, userId, inventoryEnabled } = await getClientContext();

        if (!inventoryEnabled) {
            throw new Error("El módulo de inventario no está habilitado para su plan");
        }

        const lot = await inventoryService.processBatchEntry(
            clientId,
            input.productId,
            input as unknown as Parameters<typeof inventoryService.processBatchEntry>[2],
            userId
        );

        revalidatePath("/dashboard/inventory");
        return { success: true, data: jsonify(lot) };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
    }
}

export async function getInventoryStatsAction() {
    try {
        const { clientId } = await getClientContext();
        const stats = await inventoryService.getDashboard(clientId);
        return { success: true, data: jsonify(stats) };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
    }
}

export async function searchProductsAction(query: string) {
    try {
        const { clientId } = await getClientContext();
        const products = await inventoryService.searchProduct(clientId, query);
        return { success: true, data: jsonify(products) };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
    }
}

export async function updateProductAction(id: string, input: { password?: string, [key: string]: unknown }) {
    try {
        const { clientId, inventoryEnabled } = await getClientContext();
        if (!inventoryEnabled) {
            throw new Error("El módulo de inventario no está habilitado");
        }

        // Verify password if provided
        if (input.password) {
            const verification = await verifyPassword(input.password);
            if (!verification.success) {
                throw new Error(verification.error || "Contraseña incorrecta. Operación cancelada.");
            }
        } else {
            throw new Error("Se requiere contraseña para realizar esta acción.");
        }

        // Sanitize input: remove fields that are not in the Product model
        const sanitizedInput = { ...input };
        const keysToRemove = ['initialQuantity', 'notes', 'userId', 'password', 'currentStock', 'createdAt', 'updatedAt', 'id', 'clientId', 'lots', 'transactions'];
        keysToRemove.forEach(key => delete (sanitizedInput as Record<string, unknown>)[key]);

        const product = await inventoryService.updateProduct(clientId, id, sanitizedInput);

        // Revalidate specifically the inventory section
        revalidatePath("/dashboard/inventory", "layout");

        return { success: true, data: jsonify(product) };
    } catch (error) {
        console.error("[UPDATE_PRODUCT_CRASH_PROTECTION]", error);
        return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
    }
}

export async function getProductByIdAction(id: string) {
    try {
        const { clientId } = await getClientContext();
        const product = await prisma.product.findUnique({
            where: { id, clientId, deletedAt: null },
            include: {
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 50
                },
                lots: {
                    where: { isActive: true },
                    orderBy: { expiryDate: 'asc' }
                }
            }
        });
        return { success: true, data: jsonify(product) };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
    }
}

export async function deleteProductAction(id: string, password?: string) {
    try {
        const { clientId, inventoryEnabled } = await getClientContext();
        if (!inventoryEnabled) {
            throw new Error("El módulo de inventario no está habilitado");
        }

        if (!password) {
            throw new Error("Se requiere contraseña para eliminar un producto.");
        }

        const verification = await verifyPassword(password);
        if (!verification.success) {
            throw new Error(verification.error || "Contraseña incorrecta. Operación cancelada.");
        }

        await inventoryService.deleteProduct(clientId, id);
        revalidatePath("/dashboard/inventory");
        revalidatePath("/dashboard/inventory/productos");
        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
    }
}

export async function processStockMovementAction(input: {
    productId: string,
    type: 'ENTRY' | 'EXIT' | 'ADJUST',
    quantity: number,
    reason: string,
    reference?: string,
    password?: string
}) {
    try {
        const { clientId, userId, inventoryEnabled } = await getClientContext();
        if (!inventoryEnabled) throw new Error("Módulo no habilitado");

        if (!input.password) throw new Error("Se requiere contraseña para procesar movimientos manuales.");

        const verification = await verifyPassword(input.password);
        if (!verification.success) throw new Error(verification.error || "Contraseña incorrecta.");

        const movement = await inventoryService.registerMovement(clientId, {
            productId: input.productId,
            type: input.type,
            quantity: input.quantity,
            reason: input.reason,
            reference: input.reference,
            userId
        });

        revalidatePath("/dashboard/inventory");
        revalidatePath(`/dashboard/inventory/productos/${input.productId}`);

        return { success: true, data: jsonify(movement) };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
    }
}

export async function checkDuplicateProductAction(input: { sku?: string, barcode?: string, excludeId?: string }) {
    try {
        const { clientId } = await getClientContext();

        if (input.sku) {
            const existing = await prisma.product.findFirst({
                where: {
                    clientId,
                    sku: input.sku,
                    deletedAt: null,
                    NOT: input.excludeId ? { id: input.excludeId } : undefined
                }
            });
            if (existing) return { success: true, exists: true, field: 'sku' as const, id: existing.id, name: existing.name };
        }

        if (input.barcode) {
            const existing = await prisma.product.findFirst({
                where: {
                    clientId,
                    barcode: input.barcode,
                    deletedAt: null,
                    NOT: input.excludeId ? { id: input.excludeId } : undefined
                }
            });
            if (existing) return { success: true, exists: true, field: 'barcode' as const, id: existing.id, name: existing.name };
        }

        return { success: true, exists: false };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
    }
}

/**
 * DEPRECATED: Cloudinary is no longer used.
 * Images are now handled via the /api/upload/image route which returns optimized base64.
 */
export async function uploadImageAction() {
    return { success: false, error: "Cloudinary está deshabilitado. Use la API de carga directa." };
}
