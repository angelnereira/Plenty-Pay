/**
 * core/dataport/contract.ts
 *
 * SDS — PlentyPay Data Sovereignty Standard. Contrato funcional común al que se
 * adhiere cada módulo del producto mediante un DataProvider declarativo.
 *
 * Principio rector: la base de datos es la única fuente de verdad; toda
 * exportación es una proyección reproducible y probada de ella, y toda
 * importación es una transacción validada contra ella.
 */

/** Módulos de datos del producto (superset canónico para DataPort). */
export type DataModule =
    | 'invoicing'
    | 'inventory'
    | 'pos'
    | 'logistics'
    | 'payday'
    | 'bi'
    | 'credits';

export type ExchangeFormat = 'csv' | 'xlsx' | 'json';
export type Sensitivity = 'normal' | 'pii' | 'fiscal';
export type Mutability = 'immutable' | 'mutable';
export type ExportScope = 'dataset' | 'module' | 'tenant';
export type ImportMode = 'dry-run' | 'commit';

/** Contexto de tenant. El core lo construye desde la sesión; un provider NUNCA elige el clientId. */
export interface TenantCtx {
    clientId: string;
    actorUserId: string;
    actorEmail: string;
    /** true si el actor puede ver datos sensibles (pii/fiscal). */
    elevated: boolean;
}

export interface PeriodOpts {
    from?: string; // ISO YYYY-MM-DD (inclusive)
    to?: string;   // ISO YYYY-MM-DD (inclusive)
}

/** Especificación de importación de un dataset (solo datos maestros). */
export interface ImportSpec {
    /** Campos que forman la clave natural (idempotencia). */
    naturalKey: string[];
    /** Nombre del input compuesto único de Prisma (ej. 'clientId_sku'). */
    uniqueWhereKey: string;
    /** Campos aceptados desde el archivo (lo demás se ignora). */
    allowedFields: string[];
    /** Campos obligatorios por fila. */
    requiredFields: string[];
    /** Campos a coercer a número (Decimal/Int). */
    numericFields?: string[];
    /** Campos a coercer a booleano. */
    booleanFields?: string[];
    /** Tamaño de lote para ingestión transaccional. */
    batchSize: number;
}

/**
 * Descriptor declarativo de un dataset. El core hace el trabajo pesado
 * (streaming por cursor, scoping, serialización, evidencia) a partir de esto.
 * Para casos especiales se puede proveer `customStream`.
 */
export interface DatasetDescriptor {
    key: string;                 // 'invoices', 'products'...
    label: string;
    module: DataModule;
    version: string;             // versión de esquema del dataset (va al manifest)
    sensitivity: Sensitivity;
    mutability: Mutability;

    /** Modelo Prisma (nombre de delegate, ej. 'invoice'). Requerido salvo customStream. */
    model?: string;
    tenantField?: string;        // default 'clientId'
    orderBy?: string;            // default 'id' — DEBE ser estable/único (determinismo)
    periodField?: string;        // columna fecha para filtrar por período
    excludeFields?: string[];    // campos sensibles/crudos a excluir SIEMPRE
    dependsOn?: string[];        // datasets prerequisito (FK) → orden topológico

    /** Stream a medida (sobrepone `model`); útil para vistas/SQL crudo. */
    customStream?: (ctx: TenantCtx, opts: PeriodOpts) => AsyncIterable<Record<string, unknown>>;

    /** Si está definido, el dataset es importable; si no, es export-only. */
    importSpec?: ImportSpec;
}

export interface DataProvider {
    module: DataModule;
    datasets(): DatasetDescriptor[];
}

// ── Resultados ────────────────────────────────────────────────────────────

export interface ExportArtifact {
    buffer: Buffer;
    filename: string;
    contentType: string;
    sha256: string;
    byteSize: number;
    rowCounts: Record<string, number>;
    reproducible: boolean;
}

export interface RowError {
    row: number;
    field?: string;
    message: string;
}

export interface ImportPreview {
    dataset: string;
    totalRows: number;
    validRows: number;
    invalidRows: number;
    toInsert: number;
    toUpdate: number;
    errors: RowError[];
    sampleNormalized: Record<string, unknown>[];
}

export interface ImportResult extends ImportPreview {
    inserted: number;
    updated: number;
    skipped: number;
    importBatchId: string;
}
