/**
 * Kiosk IndexedDB Wrapper
 * 
 * Handles offline storage for:
 * 1. Facial recognition vectors (for offline matching)
 * 2. Pending punches (when network is down)
 */

export interface EmployeeVector {
    id: string;
    descriptor: number[]; // Float32Array converted to array
    name: string;
    updatedAt: number;
}

export interface PendingPunch {
    id: string; // UUID
    clientId: string; // Add clientId for security scope
    employeeId: string;
    identifier: string; // PIN, QR token, or Face Descriptor JSON
    method: 'PIN_CODE' | 'FACE_RECOGNITION' | 'QR_DYNAMIC' | 'NFC';
    timestamp: number;
    type: 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_START' | 'BREAK_END';
    photo?: string; // Base64 (optional, if we decide to store it)
    synced: boolean;
    attempts: number;
}

const DB_NAME = 'plentypay_kiosk_db';
const DB_VERSION = 1;
const STORES = {
    EMPLOYEES: 'employees',
    PUNCHES: 'punches'
};

export class KioskDB {
    private db: IDBDatabase | null = null;

    constructor() {
        if (typeof window !== 'undefined') {
            this.init();
        }
    }

    private async init(): Promise<IDBDatabase> {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(request.result);
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Store for employees (face vectors)
                if (!db.objectStoreNames.contains(STORES.EMPLOYEES)) {
                    db.createObjectStore(STORES.EMPLOYEES, { keyPath: 'id' });
                }

                // Store for pending punches (queue)
                if (!db.objectStoreNames.contains(STORES.PUNCHES)) {
                    const punchStore = db.createObjectStore(STORES.PUNCHES, { keyPath: 'id' });
                    punchStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    // --- Employee Methods ---

    async saveEmployee(employee: EmployeeVector): Promise<void> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.EMPLOYEES, 'readwrite');
            const store = tx.objectStore(STORES.EMPLOYEES);
            const request = store.put(employee);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async bulkSaveEmployees(employees: EmployeeVector[]): Promise<void> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.EMPLOYEES, 'readwrite');
            const store = tx.objectStore(STORES.EMPLOYEES);

            employees.forEach(emp => store.put(emp));

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async getAllEmployees(): Promise<EmployeeVector[]> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.EMPLOYEES, 'readonly');
            const store = tx.objectStore(STORES.EMPLOYEES);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getEmployeeCount(): Promise<number> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.EMPLOYEES, 'readonly');
            const store = tx.objectStore(STORES.EMPLOYEES);
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async clearEmployees(): Promise<void> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.EMPLOYEES, 'readwrite');
            const store = tx.objectStore(STORES.EMPLOYEES);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // --- Punch Methods ---

    async addPunch(punch: PendingPunch): Promise<void> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.PUNCHES, 'readwrite');
            const store = tx.objectStore(STORES.PUNCHES);
            const request = store.add(punch);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getPendingPunches(): Promise<PendingPunch[]> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.PUNCHES, 'readonly');
            const store = tx.objectStore(STORES.PUNCHES);
            // Sort by timestamp
            const index = store.index('timestamp');
            const request = index.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async removePunch(id: string): Promise<void> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.PUNCHES, 'readwrite');
            const store = tx.objectStore(STORES.PUNCHES);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

export const kioskDB = new KioskDB();
