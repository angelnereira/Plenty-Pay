import { prisma } from "@core/database/prisma-singleton"

/**
 * Get Payday dashboard statistics
 * 
 * @param clientId - Client ID to filter data
 * @returns Dashboard stats including active employees, weekly hours, and recent activity
 */
export async function getPaydayStats(clientId: string) {
    // 1. Get Live Stats (Who is working NOW)
    const activeEmployeeCount = await prisma.attendanceRecord.count({
        where: {
            employee: { clientId },
            status: 'OPEN'
        }
    });

    // 2. Get Weekly Stats (This week)
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    // Optimized Aggregation
    const aggregations = await prisma.attendanceRecord.aggregate({
        where: {
            employee: { clientId },
            shiftDate: { gte: startOfWeek }
        },
        _sum: {
            regularHours: true,
            overtime25: true,
            overtime50: true,
            overtime75: true
        }
    });

    const totalRegular = aggregations._sum.regularHours || 0;
    const totalOvertime = (aggregations._sum.overtime25 || 0) +
        (aggregations._sum.overtime50 || 0) +
        (aggregations._sum.overtime75 || 0);

    // We still need records for payroll calculation if hourly rates vary per employee
    // Ideally this should also be aggregated in DB if possible, but keep simple for now
    const weeklyRecords = await prisma.attendanceRecord.findMany({
        where: {
            employee: { clientId },
            shiftDate: { gte: startOfWeek }
        },
        include: {
            employee: {
                select: {
                    hourlyRate: true
                }
            }
        }
    });

    // 3. Get Recent Activity Feed (Last 7 days, ordered by most recent check-in)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const recentActivity = await prisma.attendanceRecord.findMany({
        where: {
            employee: { clientId },
            checkIn: { gte: sevenDaysAgo }
        },
        take: 15, // Increased from 10 to show more activity
        orderBy: { checkIn: 'desc' }, // Order by check-in time for chronological view
        include: {
            employee: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true
                }
            }
        }
    });

    // 4. Calculate estimated weekly payroll
    const estimatedPayroll = weeklyRecords.reduce((sum, record) => {
        const employee = record.employee;
        if (employee?.hourlyRate) {
            const regularPay = record.regularHours * employee.hourlyRate.toNumber();
            const overtimePay = (record.overtime25 * 1.25 + record.overtime50 * 1.5 + record.overtime75 * 1.75) * employee.hourlyRate.toNumber();
            return sum + regularPay + overtimePay;
        }
        return sum;
    }, 0);

    return {
        activeEmployeeCount,
        weeklyHours: {
            regular: totalRegular,
            overtime: totalOvertime
        },
        estimatedPayroll,
        recentActivity: recentActivity.map(record => ({
            ...record,
            // Convert Decimals to number for serialization
            rawDurationMinutes: Number(record.rawDurationMinutes),
            regularHours: Number(record.regularHours),
            overtime25: Number(record.overtime25),
            overtime50: Number(record.overtime50),
            overtime75: Number(record.overtime75),
            employee: {
                ...record.employee,
                // Only id, firstName, lastName are selected in the query above, 
                // but if we selected more in the future we would need to handle decimals.
                // Currently safe as we select specific fields.
            }
        }))
    };
}
