"use server";

import { auth } from "@core/auth";
import { revalidatePath } from "next/cache";
import { PurchaseOrderService } from "@/features/inventory/model/services/purchase-order.service";
import {
    CreatePurchaseOrderInput,
    PurchaseOrderListFilters,
    CreateGoodsReceiptInput,
} from "@/features/inventory/model/types/purchase.types";

const poService = new PurchaseOrderService();

// ============================================
// PURCHASE ORDER ACTIONS
// ============================================

export async function createPurchaseOrder(input: CreatePurchaseOrderInput) {
    const session = await auth();
    if (!session?.user?.clientId || !session?.user?.id) {
        throw new Error("No autorizado");
    }

    const po = await poService.createPurchaseOrder(
        session.user.clientId,
        session.user.id,
        input
    );

    revalidatePath("/dashboard/inventory/ordenes-compra");
    return po;
}

export async function getPurchaseOrder(poId: string) {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    return poService.getPurchaseOrder(session.user.clientId, poId);
}

export async function listPurchaseOrders(filters?: PurchaseOrderListFilters) {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    return poService.listPurchaseOrders(session.user.clientId, filters);
}

export async function sendPurchaseOrder(poId: string) {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    const po = await poService.sendPurchaseOrder(session.user.clientId, poId);

    revalidatePath("/dashboard/inventory/ordenes-compra");
    revalidatePath(`/dashboard/inventory/ordenes-compra/${poId}`);
    return po;
}

export async function confirmPurchaseOrder(poId: string) {
    const session = await auth();
    if (!session?.user?.clientId || !session?.user?.id) {
        throw new Error("No autorizado");
    }

    const po = await poService.confirmPurchaseOrder(
        session.user.clientId,
        poId,
        session.user.id
    );

    revalidatePath("/dashboard/inventory/ordenes-compra");
    revalidatePath(`/dashboard/inventory/ordenes-compra/${poId}`);
    return po;
}

export async function cancelPurchaseOrder(poId: string, reason: string) {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    const po = await poService.cancelPurchaseOrder(
        session.user.clientId,
        poId,
        reason
    );

    revalidatePath("/dashboard/inventory/ordenes-compra");
    revalidatePath(`/dashboard/inventory/ordenes-compra/${poId}`);
    return po;
}

export async function closePurchaseOrder(poId: string) {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    const po = await poService.closePurchaseOrder(session.user.clientId, poId);

    revalidatePath("/dashboard/inventory/ordenes-compra");
    revalidatePath(`/dashboard/inventory/ordenes-compra/${poId}`);
    return po;
}

// ============================================
// GOODS RECEIPT ACTIONS
// ============================================

export async function receiveGoods(input: CreateGoodsReceiptInput) {
    const session = await auth();
    if (!session?.user?.clientId || !session?.user?.id) {
        throw new Error("No autorizado");
    }

    const receipt = await poService.receiveGoods(
        session.user.clientId,
        session.user.id,
        input
    );

    revalidatePath("/dashboard/inventory/ordenes-compra");
    revalidatePath(`/dashboard/inventory/ordenes-compra/${input.purchaseOrderId}`);
    revalidatePath("/dashboard/inventory/recepciones");
    revalidatePath("/dashboard/inventory"); // Refresh inventory stats
    return receipt;
}

export async function listGoodsReceipts(purchaseOrderId?: string) {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    return poService.getGoodsReceipts(session.user.clientId, purchaseOrderId);
}

export async function getPendingReceipts() {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    return poService.getPendingReceipts(session.user.clientId);
}

// ============================================
// REORDER SUGGESTIONS
// ============================================

export async function getReorderSuggestions() {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    return poService.getReorderSuggestions(session.user.clientId);
}

export async function getPurchaseOrderStats() {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    return poService.getStats(session.user.clientId);
}
