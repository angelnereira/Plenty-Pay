/**
 * QR Code Generation Service
 *
 * Generates QR codes as base64 data URIs for embedding in emails.
 * Uses the `qrcode` package which is already in the project dependencies.
 */

import QRCode from 'qrcode'

interface QROptions {
    width?: number
    margin?: number
    color?: {
        dark?: string
        light?: string
    }
}

/**
 * Generate a QR code as a base64 data URI (PNG)
 * Suitable for embedding directly in HTML emails as <img src="data:image/png;base64,...">
 */
export async function generateQRDataURI(
    url: string,
    options?: QROptions,
): Promise<string> {
    const dataURI = await QRCode.toDataURL(url, {
        width: options?.width ?? 200,
        margin: options?.margin ?? 2,
        color: {
            dark: options?.color?.dark ?? '#1e1b4b', // indigo-950
            light: options?.color?.light ?? '#ffffff',
        },
        errorCorrectionLevel: 'M',
    })
    return dataURI
}
