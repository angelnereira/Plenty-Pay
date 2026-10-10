export const PAYDAY_PRICING = [
    { maxEmployees: 10, price: 50, id: 'TIER_1' },
    { maxEmployees: 20, price: 70, id: 'TIER_2' },
    { maxEmployees: 50, price: 100, id: 'TIER_3' }
];

export const ENTERPRISE_THRESHOLD = 50;

/**
 * Calculates the monthly cost of the Payday module based on active employee count.
 */
export function calculateModuleCost(employeeCount: number): number {
    if (employeeCount <= 10) return 50;
    if (employeeCount <= 20) return 70;
    if (employeeCount < 50) return 100;

    // Enterprise pricing logic (Custom or scaled)
    // For now, returning base + increment or just a contact sales placeholder logic
    // User said "menos de 50 empleados pagan 100", implying distinct fix tiers.
    // For > 50, usually "Call Sales", but let's assume a cap or per-seat.
    // Returning -1 to indicate 'Contact Sales' or Custom Quote required.
    return -1;
}

export function getTierName(employeeCount: number): string {
    if (employeeCount <= 10) return "Micro Business";
    if (employeeCount <= 20) return "Small Business";
    if (employeeCount < 50) return "Medium Business";
    return "Enterprise";
}
