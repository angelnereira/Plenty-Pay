/**
 * PDF Generator Service
 * Generates PDF documents for internal invoices using @react-pdf/renderer
 * Follows Panama fiscal, economic and commercial standards
 */

import React from 'react';
import ReactPDF from '@react-pdf/renderer';
import { InternalInvoicePDF, InternalInvoiceData } from '@/features/pos/ui/InternalInvoicePDF';

export interface GeneratePDFResult {
    success: boolean;
    pdfBuffer?: Buffer;
    pdfBase64?: string;
    error?: string;
}

import { FiscalInvoicePDF, FiscalInvoiceData } from '@/features/pos/ui/FiscalInvoicePDF';

export class PDFGeneratorService {
    /**
     * Generate Internal Invoice PDF
     * Creates a PDF document for internal sales that don't require fiscal emission
     */
    async generateInternalInvoice(data: InternalInvoiceData): Promise<GeneratePDFResult> {
        try {
            // Create React element
            const element = React.createElement(InternalInvoicePDF, data);

            // Render to stream and collect chunks
            const stream = await ReactPDF.renderToStream(element as any);
            const chunks: Buffer[] = [];

            // Collect all chunks from the stream
            for await (const chunk of stream) {
                chunks.push(Buffer.from(chunk));
            }

            // Combine all chunks into single buffer
            const pdfBuffer = Buffer.concat(chunks);

            // Convert to Base64 for client download
            const pdfBase64 = pdfBuffer.toString('base64');

            return {
                success: true,
                pdfBuffer,
                pdfBase64
            };
        } catch (error) {
            console.error('[PDFGeneratorService] Error generating PDF:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Error desconocido al generar PDF'
            };
        }
    }

    /**
     * Generate Fiscal Invoice PDF
     * Creates a PDF document for fiscal invoices with HKA/DGI data
     */
    async generateFiscalInvoice(data: FiscalInvoiceData): Promise<GeneratePDFResult> {
        try {
            // Create React element
            const element = React.createElement(FiscalInvoicePDF, data);

            // Render to stream and collect chunks
            const stream = await ReactPDF.renderToStream(element as any);
            const chunks: Buffer[] = [];

            // Collect all chunks from the stream
            for await (const chunk of stream) {
                chunks.push(Buffer.from(chunk));
            }

            // Combine all chunks into single buffer
            const pdfBuffer = Buffer.concat(chunks);

            // Convert to Base64 for client download
            const pdfBase64 = pdfBuffer.toString('base64');

            return {
                success: true,
                pdfBuffer,
                pdfBase64
            };
        } catch (error) {
            console.error('[PDFGeneratorService] Error generating fiscal PDF:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Error desconocido al generar PDF fiscal'
            };
        }
    }
}

// Singleton instance
export const pdfGeneratorService = new PDFGeneratorService();
