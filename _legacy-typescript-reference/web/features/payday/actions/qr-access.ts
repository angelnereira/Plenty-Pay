'use server';

import { prisma } from '@core/database/prisma';
import QRCode from 'qrcode';
import crypto from 'crypto';

/**
 * Genera un código QR de acceso seguro y temporal para un empleado.
 * El QR contiene un token cifrado que valida la identidad.
 */
export async function generateAccessQR(employeeId: string) {
    const employee = await prisma.paydayEmployee.findUnique({
        where: { id: employeeId },
        select: { id: true, firstName: true, qrSecret: true }
    });

    if (!employee) throw new Error("Empleado no encontrado");

    // 1. Asegurar que existe un secreto base (semilla) para este usuario
    let secret = employee.qrSecret;
    if (!secret) {
        secret = crypto.randomBytes(32).toString('hex');
        await prisma.paydayEmployee.update({
            where: { id: employeeId },
            data: { qrSecret: secret }
        });
    }

    // 2. Generar el payload del QR
    // Formato: {userId}:{timestamp}:{signature}
    // Esto permite validar caducidad (ej: QR válido por 24h)
    const timestamp = Date.now();
    const rawData = `${employeeId}:${timestamp}`;

    // Firma digital simple HMCA para evitar falsificación
    const signature = crypto
        .createHmac('sha256', secret)
        .update(rawData)
        .digest('hex');

    const token = `${rawData}:${signature}`;

    // 3. Generar imagen DataURL
    const qrDataUrl = await QRCode.toDataURL(token);

    return {
        qrImage: qrDataUrl,
        token: token,
        expiresAt: new Date(timestamp + 24 * 60 * 60 * 1000) // 24h validez UI
    };
}

/**
 * Valida un token escaneado desde el Kiosco
 */
export async function validateQRToken(token: string) {
    try {
        const parts = token.split(':');
        if (parts.length !== 3) return { valid: false, message: "Formato inválido" };

        const [empId, timestampStr, signature] = parts;
        const timestamp = parseInt(timestampStr);

        // 1. Chequeo de expiración (ej: 24h)
        // Para credenciales permanentes, se podría obviar el timestamp o hacerlo rotativo
        const now = Date.now();
        if (now - timestamp > 24 * 60 * 60 * 1000) {
            return { valid: false, message: "Código QR expirado" };
        }

        // 2. Buscar usuario y secreto
        const employee = await prisma.paydayEmployee.findUnique({
            where: { id: empId },
            select: { qrSecret: true, isActive: true }
        });

        if (!employee || !employee.isActive) return { valid: false, message: "Usuario inválido" };
        if (!employee.qrSecret) return { valid: false, message: "Usuario sin credencial QR activa" };

        // 3. Verificar Firma
        const expectedSignature = crypto
            .createHmac('sha256', employee.qrSecret)
            .update(`${empId}:${timestampStr}`)
            .digest('hex');

        if (signature !== expectedSignature) {
            return { valid: false, message: "Firma inválida (QR Falsificado)" };
        }

        return { valid: true, employeeId: empId };

    } catch (e) {
        console.error(e);
        return { valid: false, message: "Error de lectura" };
    }
}
