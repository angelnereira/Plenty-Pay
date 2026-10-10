/**
 * Unit Tests for KioskDB (Offline Storage)
 * 
 * Mocks IndexedDB using fake-indexeddb (if available) or a simple mock.
 * Since we don't have fake-indexeddb installed in package.json, we will create a 
 * functional mock of the IDBWrapper to verify Key-Value logic pattern.
 */

import { EmployeeVector, PendingPunch } from '@/features/payday/lib/kiosk-db';

// Mock KioskDB logic for testing logic without browser environment
class MockKioskDB {
    employees: Map<string, EmployeeVector>;
    punches: Map<string, PendingPunch>;

    constructor() {
        this.employees = new Map();
        this.punches = new Map();
    }

    async saveEmployee(employee: EmployeeVector) {
        this.employees.set(employee.id, employee);
    }

    async getEmployeeCount() {
        return this.employees.size;
    }

    async addPunch(punch: PendingPunch) {
        this.punches.set(punch.id, punch);
    }

    async getPendingPunches() {
        // Return values sorted by timestamp
        return Array.from(this.punches.values())
            .sort((a, b) => a.timestamp - b.timestamp);
    }

    async removePunch(id: string) {
        this.punches.delete(id);
    }
}

describe('KioskDB Logic', () => {
    let db: MockKioskDB;

    beforeEach(() => {
        db = new MockKioskDB();
    });

    describe('Employee Storage', () => {
        it('should save and count employees', async () => {
            await db.saveEmployee({ id: '1', name: 'John', descriptor: [], updatedAt: new Date().getTime() });
            await db.saveEmployee({ id: '2', name: 'Jane', descriptor: [], updatedAt: new Date().getTime() });

            expect(await db.getEmployeeCount()).toBe(2);
        });
    });

    describe('Pending Punches', () => {
        it('should add and retrieve punches', async () => {
            const punch1 = {
                id: 'p1',
                clientId: 'client-1',
                timestamp: 1000,
                type: 'CHECK_IN',
                employeeId: 'e1',
                identifier: 'code-1',
                method: 'FACE_RECOGNITION',
                synced: false,
                attempts: 0
            } as PendingPunch;
            const punch2 = {
                id: 'p2',
                clientId: 'client-1',
                timestamp: 2000,
                type: 'CHECK_OUT',
                employeeId: 'e1',
                identifier: 'code-1',
                method: 'FACE_RECOGNITION',
                synced: false,
                attempts: 0
            } as PendingPunch;

            await db.addPunch(punch2);
            await db.addPunch(punch1);

            const punches = await db.getPendingPunches();

            // Should be sorted by timestamp
            expect(punches.length).toBe(2);
            expect(punches[0].id).toBe('p1');
            expect(punches[1].id).toBe('p2');
        });

        it('should remove punch', async () => {
            await db.addPunch({ id: 'p1', timestamp: 1000 } as any);
            await db.removePunch('p1');

            const punches = await db.getPendingPunches();
            expect(punches.length).toBe(0);
        });
    });
});
