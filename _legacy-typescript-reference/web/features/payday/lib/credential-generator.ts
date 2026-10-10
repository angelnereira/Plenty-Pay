/**
 * Credential Generator for Payday Employees
 * Generates unique employee codes, PINs, and QR codes
 */

import { prisma } from '@core/database/prisma';
import { randomBytes } from 'crypto';

/**
 * Generate next sequential employee code for a client
 * Format: EMP-00001, EMP-00002, etc.
 */
export async function generateEmployeeCode(clientId: string): Promise<string> {
    // Find highest existing employee code for this client
    const lastEmployee = await prisma.paydayEmployee.findFirst({
        where: {
            clientId,
            employeeCode: { not: null }
        },
        orderBy: { employeeCode: 'desc' },
        select: { employeeCode: true }
    });

    let nextNumber = 1;

    if (lastEmployee?.employeeCode) {
        // Extract number from "EMP-00042" → 42
        const match = lastEmployee.employeeCode.match(/EMP-(\d+)/);
        if (match) {
            nextNumber = parseInt(match[1], 10) + 1;
        }
    }

    // Format with padding: EMP-00001
    return `EMP-${nextNumber.toString().padStart(5, '0')}`;
}

/**
 * Generate a random 4-digit PIN
 */
export function generatePIN(): string {
    // Generate number between 1000-9999
    const pin = Math.floor(Math.random() * 9000) + 1000;
    return pin.toString();
}

/**
 * Generate a unique QR code identifier
 * Uses crypto random bytes for security
 */
export function generateQRCode(): string {
    // Generate 16 random bytes, convert to hex
    const bytes = randomBytes(16);
    return bytes.toString('hex');
}

/**
 * Generate all credentials at once
 */
export async function generateEmployeeCredentials(clientId: string) {
    const employeeCode = await generateEmployeeCode(clientId);
    const pinCode = generatePIN();
    const qrSecret = generateQRCode();

    return {
        employeeCode,
        pinCode,
        qrSecret
    };
}

/**
 * Verify uniqueness of QR code (safety check)
 */
export async function isQRCodeUnique(qrSecret: string): Promise<boolean> {
    const existing = await prisma.paydayEmployee.findUnique({
        where: { qrSecret },
        select: { id: true }
    });

    return !existing;
}

/**
 * Verify uniqueness of employee code (safety check)
 */
export async function isEmployeeCodeUnique(employeeCode: string, clientId: string): Promise<boolean> {
    const existing = await prisma.paydayEmployee.findFirst({
        where: {
            employeeCode,
            clientId
        },
        select: { id: true }
    });

    return !existing;
}
