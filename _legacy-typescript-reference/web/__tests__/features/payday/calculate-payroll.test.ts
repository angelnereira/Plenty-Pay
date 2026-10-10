
import { generatePayrollRun } from '../../../features/payday/actions/calculate-payroll';
import { prisma } from '@core/database/prisma';

// Mocking Prisma
// $transaction ejecuta el callback pasándole el propio mock como `tx`,
// así los mocks sirven tanto para llamadas directas como transaccionales.
jest.mock('@core/database/prisma', () => {
    const prismaMock: any = {
        paydayEmployee: {
            findMany: jest.fn(),
        },
        paydayPayrollRun: {
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
        attendanceRecord: {
            findMany: jest.fn(),
        },
        payrollItem: {
            create: jest.fn(),
            createMany: jest.fn(),
        },
    };
    prismaMock.$transaction = jest.fn(async (fn: any) => fn(prismaMock));
    return { prisma: prismaMock };
});

describe('generatePayrollRun', () => {
    const mockEmployees = [
        { id: 'emp1', hourlyRate: 10, isActive: true },
        { id: 'emp2', hourlyRate: 15, isActive: true },
    ];

    const mockShifts = [
        // Emp 1: 2 shifts
        { employeeId: 'emp1', regularHours: 8, overtime25: 0, overtime50: 0, overtime75: 0, status: 'COMPLETED' },
        { employeeId: 'emp1', regularHours: 8, overtime25: 2, overtime50: 0, overtime75: 0, status: 'COMPLETED' },
        // Emp 2: 1 shift
        { employeeId: 'emp2', regularHours: 8, overtime25: 0, overtime50: 0, overtime75: 0, status: 'COMPLETED' },
    ];

    beforeEach(() => {
        jest.clearAllMocks();

        // clearAllMocks borra la implementación de $transaction: restaurarla
        (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn(prisma));
        // Sin nómina cerrada previa en el período
        // @ts-expect-error Mocking prisma method
        prisma.paydayPayrollRun.findFirst.mockResolvedValue(null);
        // @ts-expect-error Mocking prisma method
        prisma.paydayEmployee.findMany.mockResolvedValue(mockEmployees);
        // @ts-expect-error Mocking prisma method
        prisma.paydayPayrollRun.create.mockResolvedValue({ id: 'run1', clientId: 'client1' });
        // @ts-expect-error Mocking prisma method
        prisma.paydayPayrollRun.update.mockResolvedValue({});
        // @ts-expect-error Mocking prisma method
        prisma.payrollItem.create.mockResolvedValue({});
        // @ts-expect-error Mocking prisma method
        prisma.payrollItem.createMany.mockResolvedValue({ count: 2 });

        // Mock implementation to handle both N+1 and Optimized queries
        // @ts-expect-error Mocking prisma method
        prisma.attendanceRecord.findMany.mockImplementation((args) => {
            // N+1 case: querying by single employeeId
            if (args.where.employeeId && typeof args.where.employeeId === 'string') {
                 return Promise.resolve(mockShifts.filter(s => s.employeeId === args.where.employeeId));
            }
            // Optimized case: querying by list of employeeIds or just clientId/date
            // The plan is to filter by employeeIds list.
             if (args.where.employeeId && args.where.employeeId.in) {
                 return Promise.resolve(mockShifts);
            }
            return Promise.resolve([]);
        });
    });

    it('should calculate payroll correctly', async () => {
        const result = await generatePayrollRun({
            clientId: 'client1',
            periodStart: new Date('2023-01-01'),
            periodEnd: new Date('2023-01-15')
        });

        expect(result.success).toBe(true);
        expect(prisma.paydayEmployee.findMany).toHaveBeenCalledWith({ where: { clientId: 'client1', isActive: true } });

        // Verify calculations via what was saved
        // We need to capture the calls to create or createMany

        // Emp 1 Calculation:
        // Reg: 16 hrs * $10 = $160
        // OT25: 2 hrs * $10 * 1.25 = $25
        // Gross: $185
        // Deductions: 185 * 0.11 = 20.35
        // Net: 164.65

        // Emp 2 Calculation:
        // Reg: 8 hrs * $15 = $120
        // Gross: $120
        // Deductions: 120 * 0.11 = 13.20
        // Net: 106.80

        // Total Gross: 185 + 120 = 305

        expect(prisma.paydayPayrollRun.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'run1' },
            data: expect.objectContaining({
                totalGross: 305
            })
        }));
    });
});
