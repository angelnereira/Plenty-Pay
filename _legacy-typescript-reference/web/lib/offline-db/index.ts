'use client'

/**
 * PlentyPay Offline Database
 *
 * Uses Dexie.js for IndexedDB with a clean Promise-based API.
 * Provides offline-first data access for POS and Invoicing modules.
 *
 * Version 2: Added offlineConfig table,
 * extended PendingInvoice with CUFE and PDF data fields.
 *
 * @see https://dexie.org/
 */

import Dexie, { type Table } from 'dexie'

// ============================================
// Types
// ============================================

export interface OfflineProduct {
  id: string
  name: string
  price: number
  sku?: string
  barcode?: string
  stock: number
  taxRate: number
  category?: string
  clientId: string
  lastSyncedAt: number
}

export interface PendingInvoice {
  id: string              // UUID generado localmente (localId)
  clientId: string
  invoiceNumber: string   // Folio provisional (se asigna el real al sincronizar)
  cufe: string            // CUFE generado localmente
  tipoEmision: '02' | '04' // Contingencia internet (02) o fallo DGI (04)
  /** Timestamp (ms) del momento exacto en que se detectó la caída — campo B04 de DGI */
  fechaInicioContingencia: number
  /** Motivo de contingencia para campo B05 de DGI (15-250 chars) */
  motivoContingencia: string
  ambiente: '1' | '2'
  items: Array<{
    productId: string
    productName: string
    quantity: number
    unitPrice: number
    taxRate: number
  }>
  subtotal: number
  tax: number
  total: number
  discount?: number
  paymentMethod: string
  customerName?: string
  customerRuc?: string
  // Snapshot del negocio para generar PDF sin conexión al servidor
  businessName: string
  businessRuc: string
  businessDv: string
  businessAddress: string
  createdAt: number
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed'
  syncAttempts: number
  lastSyncAttempt?: number
  syncError?: string
}

/** Configuración CUFE cacheada (sin credenciales HKA) */
export interface OfflineConfig {
  key: string             // 'hka-cufe-config'
  clientId: string
  emisorRuc: string
  emisorDv: string
  tipoContribuyente: '1' | '2'
  branchCode: string
  puntoFacturacionFiscal: string
  environment: 'demo' | 'prod'
  businessName: string
  businessAddress: string
  cachedAt: number
}

export interface SyncQueueItem {
  id?: number
  type: 'invoice' | 'inventory_update' | 'customer'
  action: 'create' | 'update' | 'delete'
  payload: Record<string, unknown>
  createdAt: number
  attempts: number
  lastAttempt?: number
  error?: string
}

export interface CacheMetadata {
  key: string
  clientId: string
  lastSyncedAt: number
  expiresAt: number
}

// ============================================
// Database Definition
// ============================================

export class PlentyPayOfflineDB extends Dexie {
  products!: Table<OfflineProduct, string>
  pendingInvoices!: Table<PendingInvoice, string>
  syncQueue!: Table<SyncQueueItem, number>
  cacheMetadata!: Table<CacheMetadata, string>
  offlineConfig!: Table<OfflineConfig, string>

  constructor() {
    super('plentypay-offline')

    // v1: tablas originales
    this.version(1).stores({
      products: 'id, sku, barcode, name, clientId, lastSyncedAt',
      pendingInvoices: 'id, clientId, syncStatus, createdAt',
      syncQueue: '++id, type, createdAt, attempts',
      cacheMetadata: 'key, clientId, expiresAt',
    })

    // v2: config CUFE cacheada
    this.version(2).stores({
      products: 'id, sku, barcode, name, clientId, lastSyncedAt',
      pendingInvoices: 'id, clientId, syncStatus, createdAt',
      syncQueue: '++id, type, createdAt, attempts',
      cacheMetadata: 'key, clientId, expiresAt',
      offlineConfig: 'key, clientId',
    })

    // v3: campos de contingencia en PendingInvoice (fechaInicioContingencia, motivoContingencia)
    // Nota: Dexie no requiere listar campos de datos, solo índices. La version bump
    // garantiza que registros existentes se migren sin romper la estructura.
    this.version(3).stores({
      products: 'id, sku, barcode, name, clientId, lastSyncedAt',
      pendingInvoices: 'id, clientId, syncStatus, createdAt',
      syncQueue: '++id, type, createdAt, attempts',
      cacheMetadata: 'key, clientId, expiresAt',
      offlineConfig: 'key, clientId',
    })
  }
}

// Singleton instance
let db: PlentyPayOfflineDB | null = null

export function getOfflineDB(): PlentyPayOfflineDB {
  if (typeof window === 'undefined') {
    throw new Error('Offline database can only be used in the browser')
  }
  if (!db) {
    db = new PlentyPayOfflineDB()
  }
  return db
}

// ============================================
// Product Operations
// ============================================

export async function syncProducts(products: OfflineProduct[]): Promise<void> {
  const db = getOfflineDB()
  const now = Date.now()
  await db.products.bulkPut(products.map(p => ({ ...p, lastSyncedAt: now })))
  console.log(`[OfflineDB] Synced ${products.length} products`)
}

export async function getLocalProducts(clientId: string): Promise<OfflineProduct[]> {
  const db = getOfflineDB()
  return db.products.where('clientId').equals(clientId).toArray()
}

export async function searchProducts(clientId: string, query: string): Promise<OfflineProduct[]> {
  const db = getOfflineDB()
  const lowerQuery = query.toLowerCase()
  return db.products
    .where('clientId')
    .equals(clientId)
    .filter((p: any) =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.sku?.toLowerCase().includes(lowerQuery) ||
      p.barcode?.includes(query)
    )
    .toArray()
}

export async function getProductByBarcode(clientId: string, barcode: string): Promise<OfflineProduct | undefined> {
  const db = getOfflineDB()
  return db.products.where({ clientId, barcode }).first()
}

// ============================================
// Pending Invoice Operations
// ============================================

export async function createPendingInvoice(
  invoice: Omit<PendingInvoice, 'syncStatus' | 'syncAttempts' | 'createdAt'>
): Promise<string> {
  const db = getOfflineDB()
  const pendingInvoice: PendingInvoice = {
    ...invoice,
    createdAt: Date.now(),
    syncStatus: 'pending',
    syncAttempts: 0,
  }
  await db.pendingInvoices.add(pendingInvoice)
  console.log(`[OfflineDB] Created pending invoice: ${invoice.id} (folio: ${invoice.invoiceNumber})`)
  return invoice.id
}

export async function getPendingInvoices(clientId: string): Promise<PendingInvoice[]> {
  const db = getOfflineDB()
  return db.pendingInvoices
    .where({ clientId, syncStatus: 'pending' })
    .toArray()
}

export async function updateInvoiceSyncStatus(
  invoiceId: string,
  status: PendingInvoice['syncStatus'],
  error?: string
): Promise<void> {
  const db = getOfflineDB()
  const current = await db.pendingInvoices.get(invoiceId)
  await db.pendingInvoices.update(invoiceId, {
    syncStatus: status,
    lastSyncAttempt: Date.now(),
    syncAttempts: (current?.syncAttempts ?? 0) + 1,
    syncError: error,
  })
}

export async function cleanupSyncedInvoices(daysOld = 7): Promise<number> {
  const db = getOfflineDB()
  const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000
  const toDelete = await db.pendingInvoices
    .where('syncStatus')
    .equals('synced')
    .filter(inv => inv.createdAt < cutoff)
    .primaryKeys()
  await db.pendingInvoices.bulkDelete(toDelete)
  console.log(`[OfflineDB] Cleaned up ${toDelete.length} old synced invoices`)
  return toDelete.length
}

// ============================================
// Offline Config Operations
// ============================================

const OFFLINE_CONFIG_KEY = 'hka-cufe-config'

export async function setOfflineConfig(config: Omit<OfflineConfig, 'key'>): Promise<void> {
  const db = getOfflineDB()
  await db.offlineConfig.put({ ...config, key: OFFLINE_CONFIG_KEY })
  console.log(`[OfflineDB] Cached offline config for client ${config.clientId}`)
}

export async function getOfflineConfig(clientId: string): Promise<OfflineConfig | undefined> {
  const db = getOfflineDB()
  return db.offlineConfig.where({ key: OFFLINE_CONFIG_KEY, clientId }).first()
}

// ============================================
// Sync Queue Operations
// ============================================

export async function addToSyncQueue(
  item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'attempts'>
): Promise<number> {
  const db = getOfflineDB()
  return db.syncQueue.add({ ...item, createdAt: Date.now(), attempts: 0 })
}

export async function getSyncQueueItems(limit = 10): Promise<SyncQueueItem[]> {
  const db = getOfflineDB()
  return db.syncQueue.orderBy('createdAt').limit(limit).toArray()
}

export async function removeSyncQueueItem(id: number): Promise<void> {
  const db = getOfflineDB()
  await db.syncQueue.delete(id)
}

export async function markSyncQueueItemFailed(id: number, error: string): Promise<void> {
  const db = getOfflineDB()
  const item = await db.syncQueue.get(id)
  if (item) {
    await db.syncQueue.update(id, { attempts: item.attempts + 1, lastAttempt: Date.now(), error })
  }
}

// ============================================
// Cache Management
// ============================================

export async function isCacheStale(key: string, clientId: string): Promise<boolean> {
  const db = getOfflineDB()
  const metadata = await db.cacheMetadata.where({ key, clientId }).first()
  if (!metadata) return true
  return Date.now() > metadata.expiresAt
}

export async function updateCacheMetadata(key: string, clientId: string, ttlMs: number): Promise<void> {
  const db = getOfflineDB()
  const now = Date.now()
  await db.cacheMetadata.put({ key, clientId, lastSyncedAt: now, expiresAt: now + ttlMs })
}

export async function clearClientData(clientId: string): Promise<void> {
  const db = getOfflineDB()
  await Promise.all([
    db.products.where('clientId').equals(clientId).delete(),
    db.pendingInvoices.where('clientId').equals(clientId).delete(),
    db.offlineConfig.where('clientId').equals(clientId).delete(),
    db.cacheMetadata.where('clientId').equals(clientId).delete(),
  ])
  console.log(`[OfflineDB] Cleared all data for client: ${clientId}`)
}
