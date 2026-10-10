"use server";

import { auth } from "@core/auth";
import { revalidatePath } from "next/cache";
import { SupplierService } from "@/features/inventory/model/services/supplier.service";
import {
    CreateSupplierInput,
    UpdateSupplierInput,
    SupplierProductInput,
    SupplierEvaluationInput,
    SupplierListFilters,
} from "@/features/inventory/model/types/purchase.types";

const supplierService = new SupplierService();

// ============================================
// SUPPLIER ACTIONS
// ============================================

export async function createSupplier(input: CreateSupplierInput) {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    const supplier = await supplierService.createSupplier(
        session.user.clientId,
        input
    );

    revalidatePath("/dashboard/inventory/proveedores");
    return supplier;
}

export async function updateSupplier(input: UpdateSupplierInput) {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    const supplier = await supplierService.updateSupplier(
        session.user.clientId,
        input
    );

    revalidatePath("/dashboard/inventory/proveedores");
    revalidatePath(`/dashboard/inventory/proveedores/${input.id}`);
    return supplier;
}

export async function deleteSupplier(supplierId: string) {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    await supplierService.deleteSupplier(session.user.clientId, supplierId);

    revalidatePath("/dashboard/inventory/proveedores");
    return { success: true };
}

export async function getSupplier(supplierId: string) {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    return supplierService.getSupplier(session.user.clientId, supplierId);
}

export async function listSuppliers(filters?: SupplierListFilters) {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    return supplierService.listSuppliers(session.user.clientId, filters);
}

export async function getSupplierStats() {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    return supplierService.getSupplierStats(session.user.clientId);
}

// ============================================
// SUPPLIER PRODUCT ACTIONS
// ============================================

export async function linkProductToSupplier(input: SupplierProductInput) {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    const result = await supplierService.linkProductToSupplier(
        session.user.clientId,
        input
    );

    revalidatePath("/dashboard/inventory/proveedores");
    revalidatePath(`/dashboard/inventory/productos/${input.productId}`);
    return result;
}

export async function unlinkProductFromSupplier(
    supplierId: string,
    productId: string
) {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    await supplierService.unlinkProductFromSupplier(
        session.user.clientId,
        supplierId,
        productId
    );

    revalidatePath("/dashboard/inventory/proveedores");
    return { success: true };
}

export async function getProductsBySupplier(supplierId: string) {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    return supplierService.getProductsBySupplier(session.user.clientId, supplierId);
}

export async function getSuppliersByProduct(productId: string) {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    return supplierService.getSuppliersByProduct(productId);
}

// ============================================
// SUPPLIER EVALUATION ACTIONS
// ============================================

export async function evaluateSupplier(input: SupplierEvaluationInput) {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    const inputWithEvaluator = {
        ...input,
        evaluatedBy: session.user.id,
    };

    const evaluation = await supplierService.evaluateSupplier(
        session.user.clientId,
        inputWithEvaluator
    );

    revalidatePath(`/dashboard/inventory/proveedores/${input.supplierId}`);
    return evaluation;
}

export async function getEvaluationHistory(supplierId: string) {
    const session = await auth();
    if (!session?.user?.clientId) {
        throw new Error("No autorizado");
    }

    return supplierService.getEvaluationHistory(session.user.clientId, supplierId);
}
