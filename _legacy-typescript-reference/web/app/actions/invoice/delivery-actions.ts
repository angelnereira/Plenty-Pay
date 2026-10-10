
'use server';

import { auth } from '@core/auth';
// HKA imports removed for hollow backend

interface DeliveryResponse {
    success: boolean;
    data?: { contentBase64?: string };
    error?: string;
}

// @ts-ignore
export async function downloadPDF(request: any): Promise<DeliveryResponse> {
    console.log('[Backend-Clean] Download PDF (PENDING IMPLEMENTATION)');
    return { success: false, error: 'Descarga PDF pendiente de implementación.' };
}

// @ts-ignore
export async function downloadXML(request: any): Promise<DeliveryResponse> {
    console.log('[Backend-Clean] Download XML (PENDING IMPLEMENTATION)');
    return { success: false, error: 'Descarga XML pendiente de implementación.' };
}

// @ts-ignore
export async function sendEmail(request: any, emails: string[]): Promise<DeliveryResponse> {
    console.log('[Backend-Clean] Send Email (PENDING IMPLEMENTATION)');
    return { success: false, error: 'Envío de correo pendiente de implementación.' };
}

