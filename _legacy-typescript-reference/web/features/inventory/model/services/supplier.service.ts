import { SupplierRepository } from "../repositories/supplier.repository";
import {
    CreateSupplierInput,
    UpdateSupplierInput,
    SupplierProductInput,
    SupplierEvaluationInput,
    SupplierListFilters,
} from "../types/purchase.types";
import { syncSupplierToMotorEntity } from "@/core/motor/credit-hook";

export class SupplierService {
    private repository: SupplierRepository;

    constructor() {
        this.repository = new SupplierRepository();
    }

    // ============================================
    // SUPPLIER MANAGEMENT
    // ============================================

    async createSupplier(clientId: string, input: CreateSupplierInput) {
        // Validate unique code
        const existing = await this.repository.findByCode(clientId, input.code);
        if (existing) {
            throw new Error(`Ya existe un proveedor con el código ${input.code}`);
        }

        // Validate RUC format for Panama if provided
        if (input.ruc && input.country === "PA") {
            this.validatePanamaRUC(input.ruc, input.dv);
        }

        const supplier = await this.repository.create(clientId, input);
        
        // Sync to MotorEntity asynchronously (best-effort)
        syncSupplierToMotorEntity(supplier.id).catch(console.error);

        return supplier;
    }

    async updateSupplier(clientId: string, input: UpdateSupplierInput) {
        const existing = await this.repository.findById(input.id);
        if (!existing || existing.clientId !== clientId) {
            throw new Error("Proveedor no encontrado o no autorizado");
        }

        // Validate RUC format if changed
        if (input.ruc && input.country === "PA") {
            this.validatePanamaRUC(input.ruc, input.dv);
        }

        const supplier = await this.repository.update(input);
        
        // Sync to MotorEntity asynchronously (best-effort)
        syncSupplierToMotorEntity(supplier.id).catch(console.error);

        return supplier;
    }

    async deleteSupplier(clientId: string, supplierId: string) {
        const existing = await this.repository.findById(supplierId);
        if (!existing || existing.clientId !== clientId) {
            throw new Error("Proveedor no encontrado o no autorizado");
        }

        // Check for active purchase orders
        if ((existing as any).purchaseOrders?.some((po: any) => po.status !== "CLOSED" && po.status !== "CANCELLED")) {
            throw new Error("No se puede eliminar un proveedor con órdenes de compra activas");
        }

        return this.repository.delete(supplierId);
    }

    async getSupplier(clientId: string, supplierId: string) {
        const supplier = await this.repository.findById(supplierId);
        if (!supplier || supplier.clientId !== clientId) {
            throw new Error("Proveedor no encontrado o no autorizado");
        }
        return supplier;
    }

    async listSuppliers(clientId: string, filters?: SupplierListFilters) {
        return this.repository.list(clientId, filters);
    }

    async getSupplierStats(clientId: string) {
        return this.repository.getSupplierStats(clientId);
    }

    // ============================================
    // SUPPLIER PRODUCTS
    // ============================================

    async linkProductToSupplier(clientId: string, input: SupplierProductInput) {
        // Verify supplier belongs to client
        const supplier = await this.repository.findById(input.supplierId);
        if (!supplier || supplier.clientId !== clientId) {
            throw new Error("Proveedor no autorizado");
        }

        return this.repository.addProduct(input);
    }

    async unlinkProductFromSupplier(clientId: string, supplierId: string, productId: string) {
        const supplier = await this.repository.findById(supplierId);
        if (!supplier || supplier.clientId !== clientId) {
            throw new Error("Proveedor no autorizado");
        }

        return this.repository.removeProduct(supplierId, productId);
    }

    async getProductsBySupplier(clientId: string, supplierId: string) {
        const supplier = await this.repository.findById(supplierId);
        if (!supplier || supplier.clientId !== clientId) {
            throw new Error("Proveedor no autorizado");
        }

        return this.repository.getProductsBySupplier(supplierId);
    }

    async getSuppliersByProduct(productId: string) {
        return this.repository.getSuppliersByProduct(productId);
    }

    async getPrimarySupplier(productId: string) {
        return this.repository.getPrimarySupplier(productId);
    }

    // ============================================
    // SUPPLIER EVALUATION
    // ============================================

    async evaluateSupplier(clientId: string, input: SupplierEvaluationInput) {
        const supplier = await this.repository.findById(input.supplierId);
        if (!supplier || supplier.clientId !== clientId) {
            throw new Error("Proveedor no autorizado");
        }

        // Validate scores
        const scores = [
            input.onTimeDeliveryRate,
            input.qualityRate,
            input.responseTimeScore,
            input.priceCompetitiveness,
        ];

        for (const score of scores) {
            if (score < 0 || score > 100) {
                throw new Error("Los puntajes deben estar entre 0 y 100");
            }
        }

        const evaluation = await this.repository.createEvaluation(input);

        // Update supplier tier based on score
        await this.updateSupplierTier(input.supplierId, Number(evaluation.overallScore));

        return evaluation;
    }

    async getEvaluationHistory(clientId: string, supplierId: string) {
        const supplier = await this.repository.findById(supplierId);
        if (!supplier || supplier.clientId !== clientId) {
            throw new Error("Proveedor no autorizado");
        }

        return this.repository.getEvaluationHistory(supplierId);
    }

    // ============================================
    // PRIVATE HELPERS
    // ============================================

    private validatePanamaRUC(ruc: string, dv?: string) {
        // Basic validation for Panama RUC format
        // Natural person: 1-XXXX-YYYY or PE-XX-XXX (for foreigners)
        // Legal entity: 2-XXX-YYYY

        if (!ruc || ruc.length < 5) {
            throw new Error("RUC inválido");
        }

        // Check DV (verification digit) requirement for legal entities
        if (ruc.startsWith("2-") && !dv) {
            throw new Error("El dígito verificador (DV) es requerido para personas jurídicas");
        }
    }

    private async updateSupplierTier(supplierId: string, overallScore: number) {
        let tier = "STANDARD";

        if (overallScore >= 90) {
            tier = "STRATEGIC";
        } else if (overallScore >= 75) {
            tier = "PREFERRED";
        } else if (overallScore >= 50) {
            tier = "STANDARD";
        } else {
            tier = "PROBATION";
        }

        await this.repository.update({ id: supplierId, tier: tier as any });
    }
}
