"use client";

/**
 * useOfflineSync
 *
 * Hook que gestiona la resiliencia offline del POS:
 *
 * 1. Pre-fetch de config CUFE: cachea la configuración del emisor
 *    (sin credenciales HKA) en IndexedDB, TTL 24 horas.
 *
 * 2. Sincronización al reconectar: cuando el evento 'online' se dispara,
 *    envía las facturas pendientes en Dexie al servidor via
 *    POST /api/pos/sync-offline, que asigna el número fiscal real,
 *    recalcula el CUFE y encola en BullMQ para HKA.
 *
 * 3. Mensaje del Service Worker: el SW puede enviar { type: 'SYNC_INVOICES' }
 *    para disparar la misma sync desde un Background Sync event.
 */

import { useEffect, useCallback } from "react";
import {
  getPendingInvoices,
  updateInvoiceSyncStatus,
  getOfflineConfig,
  setOfflineConfig,
  cleanupSyncedInvoices,
} from "@/lib/offline-db";

const CONFIG_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

export function useOfflineSync(clientId: string | null | undefined) {
  // ── Sync pending invoices to server ────────────────────────────
  const syncPendingInvoices = useCallback(async () => {
    if (!clientId || !navigator.onLine) return;

    try {
      const pending = await getPendingInvoices(clientId);
      if (pending.length === 0) return;

      console.log(`[OfflineSync] Syncing ${pending.length} pending invoice(s)...`);

      // Mark all as 'syncing' before sending
      await Promise.all(pending.map(inv => updateInvoiceSyncStatus(inv.id, 'syncing')));

      const res = await fetch('/api/pos/sync-offline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoices: pending }),
      });

      if (!res.ok) throw new Error(`sync-offline HTTP ${res.status}`);

      const { results } = await res.json() as {
        results: Array<{ localId: string; success: boolean; error?: string }>
      };

      for (const r of results) {
        await updateInvoiceSyncStatus(
          r.localId,
          r.success ? 'synced' : 'failed',
          r.error
        );
      }

      const synced = results.filter(r => r.success).length;
      console.log(`[OfflineSync] Synced: ${synced}/${results.length}`);

      // Cleanup old synced records (> 7 days)
      await cleanupSyncedInvoices(7);
    } catch (err) {
      console.warn('[OfflineSync] Sync failed:', err);
    }
  }, [clientId]);

  // ── Pre-fetch CUFE config (cached 24h) ─────────────────────────
  const prefetchConfig = useCallback(async () => {
    if (!clientId || !navigator.onLine) return;

    try {
      const existing = await getOfflineConfig(clientId);
      const isStale = !existing || (Date.now() - existing.cachedAt) > CONFIG_TTL_MS;
      if (!isStale) return;

      console.log('[OfflineSync] Refreshing offline config...');

      const res = await fetch('/api/pos/offline-config');
      if (!res.ok) return;

      const { data } = await res.json();
      if (data) {
        await setOfflineConfig({ ...data, clientId, cachedAt: Date.now() });
        console.log('[OfflineSync] Offline config updated');
      }
    } catch (err) {
      console.warn('[OfflineSync] Config pre-fetch failed:', err);
    }
  }, [clientId]);

  useEffect(() => {
    if (!clientId) return;

    prefetchConfig();
    syncPendingInvoices();

    const handleOnline = () => {
      console.log('[OfflineSync] Connection restored — syncing...');
      syncPendingInvoices();
      prefetchConfig();
    };
    window.addEventListener('online', handleOnline);

    const handleSWMessage = (e: MessageEvent) => {
      if (e.data?.type === 'SYNC_INVOICES') syncPendingInvoices();
    };
    navigator.serviceWorker?.addEventListener('message', handleSWMessage);

    return () => {
      window.removeEventListener('online', handleOnline);
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    };
  }, [clientId, syncPendingInvoices, prefetchConfig]);
}
