import { kioskDB } from './kiosk-db';
import { processAttendance } from '../actions/check-in';

class SyncManager {
    private isSyncing = false;
    private syncInterval: NodeJS.Timeout | null = null;

    constructor() {
        if (typeof window !== 'undefined') {
            this.startListeners();
        }
    }

    private startListeners() {
        window.addEventListener('online', () => {
            console.log('[SyncManager] Online detected, starting sync...');
            this.sync();
        });

        // Periodic check (every 60s)
        this.syncInterval = setInterval(() => {
            if (navigator.onLine && !this.isSyncing) {
                this.sync();
            }
        }, 60000);
    }

    async sync() {
        if (this.isSyncing || !navigator.onLine) return;

        try {
            this.isSyncing = true;
            const pendingPunches = await kioskDB.getPendingPunches();

            if (pendingPunches.length === 0) {
                this.isSyncing = false;
                return;
            }

            console.log(`[SyncManager] Found ${pendingPunches.length} pending punches. Syncing...`);

            // Sort by timestamp to process in order
            pendingPunches.sort((a, b) => a.timestamp - b.timestamp);

            for (const punch of pendingPunches) {
                try {
                    console.log(`[SyncManager] Syncing punch ${punch.id} (${punch.type})...`);

                    const result = await processAttendance(
                        punch.identifier,
                        punch.method,
                        punch.type,
                        punch.clientId,
                        punch.timestamp
                    );

                    if (result.success) {
                        console.log(`[SyncManager] Punch ${punch.id} synced successfully!`);
                        await kioskDB.removePunch(punch.id);
                    } else {
                        console.warn(`[SyncManager] Punch ${punch.id} failed: ${result.message}`);
                        // Remove invalid punches to unblock queue
                        // We assume logic errors (invalid PIN) cannot be fixed by retrying
                        await kioskDB.removePunch(punch.id);
                    }
                } catch (error: any) {
                    console.error(`[SyncManager] Error syncing punch ${punch.id}:`, error);

                    // Stop on network errors
                    if (error.message && (error.message.includes('fetch') || error.message.includes('network'))) {
                        console.log('[SyncManager] Network error, stopping sync.');
                        break;
                    }
                }
            }

        } catch (error) {
            console.error('[SyncManager] Sync failed:', error);
        } finally {
            this.isSyncing = false;
        }
    }
}

export const syncManager = new SyncManager();
