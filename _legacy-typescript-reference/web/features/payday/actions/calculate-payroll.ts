'use server';

import { Prisma } from '@prisma/client';
import { prisma } from '@core/database/prisma';
import { SURCHARGES } from '../lib/panama-rules';

type PayrollGenerationInput = {
    clientId: string;
    periodStart: Date;
    periodEnd: Date;
};

export async function generatePayrollRun({ clientId, periodStart, periodEnd }: PayrollGenerationInput) {
    // Check for existing locked run in this period (outside transaction for quick fail)
    const existingLocked = await prisma.paydayPayrollRun.findFirst({
        where: {
            clientId,
            periodStart,
            periodEnd,
            status: 'LOCKED'
        }
    });

    if (existingLocked) {
        throw new Error('Ya existe una nómina cerrada para este período');
    }

    // Use atomic transaction for entire payroll generation
    return prisma.$transaction(async (tx) => {
        // 1. Get Employees within transaction
        const employees = await tx.paydayEmployee.findMany({
            where: { clientId, isActive: true }
        });

        // 2. Initialize Run
        const payrollRun = await tx.paydayPayrollRun.create({
            data: {
                clientId,
                periodStart,
                periodEnd,
                status: 'DRAFT',
                totalGross: 0,
                totalNet: 0,
                employeeCount: employees.length
            }
        });

        let grandTotalGross = 0;
        let grandTotalNet = 0;

        // 3. Fetch All Shifts for Period
        const allShifts = await tx.attendanceRecord.findMany({
            where: {
                employeeId: { in: employees.map(e => e.id) },
                shiftDate: {
                    gte: periodStart,
                    lte: periodEnd
                },
                status: 'COMPLETED'
            }
        });

        // Group shifts by Employee
        const shiftsByEmployee = new Map<string, typeof allShifts>();
        for (const shift of allShifts) {
            if (!shiftsByEmployee.has(shift.employeeId)) {
                shiftsByEmployee.set(shift.employeeId, []);
            }
            shiftsByEmployee.get(shift.employeeId)?.push(shift);
        }

        const payrollItemsToCreate: Prisma.PayrollItemCreateManyInput[] = [];

        // 4. Process Each Employee (In Memory)
        for (const emp of employees) {
            const shifts = shiftsByEmployee.get(emp.id) || [];

            let regularHours = 0;
            let ot25 = 0;
            let ot50 = 0;
            let ot75 = 0;

            // Aggregate Hours
            shifts.forEach(shift => {
                regularHours += shift.regularHours;
                ot25 += shift.overtime25;
                ot50 += shift.overtime50;
                ot75 += shift.overtime75;
            });

            // Calculate Pay
            const rate = Number(emp.hourlyRate || 0);

            const regularPay = regularHours * rate;
            const overtimePay = (ot25 * rate * SURCHARGES.OVERTIME_DIURNA) +
                (ot50 * rate * SURCHARGES.OVERTIME_NOCTURNA) +
                (ot75 * rate * SURCHARGES.EXTENSION_NOCTURNA);

            const grossPay = regularPay + overtimePay;

            // Deductions (Social Security 9.75%, Edu. Insurance 1.25%) - Panama Standard
            const socialSecurity = grossPay * 0.0975;
            const eduInsurance = grossPay * 0.0125;
            const incomeTax = 0; // Simplified (Complex bracket logic needed)

            const totalDeductions = socialSecurity + eduInsurance + incomeTax;
            const netPay = grossPay - totalDeductions;

            grandTotalGross += grossPay;
            grandTotalNet += netPay;

            // Add to batch
            payrollItemsToCreate.push({
                payrollRunId: payrollRun.id,
                employeeId: emp.id,
                regularPay,
                overtimePay,
                deductions: totalDeductions,
                netPay,
                bonuses: 0 // Placeholder
            });
        }

        // 5. Batch Insert Items atomically
        if (payrollItemsToCreate.length > 0) {
            await tx.payrollItem.createMany({
                data: payrollItemsToCreate
            });
        }

        // 6. Update Run Totals
        await tx.paydayPayrollRun.update({
            where: { id: payrollRun.id },
            data: {
                totalGross: grandTotalGross,
                totalNet: grandTotalNet
            }
        });

        return { success: true, runId: payrollRun.id };
    }, {
        timeout: 60000 // 60 second timeout for large payrolls
    });
}

