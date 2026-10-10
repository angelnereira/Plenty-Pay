
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@shared/ui/dialog';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { Loader2, Download, Mail, CheckCircle2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { DatosDocumento } from '@/features/hka/model/types/types';

// Alias for backwards compatibility
type DescargaRequest = DatosDocumento;
import { downloadPDF, downloadXML, sendEmail } from '@/app/actions/invoice/delivery-actions';

interface DeliveryModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoiceDetails: DescargaRequest;
    emailDefault?: string;
}

export function DeliveryModal({ isOpen, onClose, invoiceDetails, emailDefault }: DeliveryModalProps) {
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
    const [isDownloadingXml, setIsDownloadingXml] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [email, setEmail] = useState(emailDefault || '');

    const handleDownloadPdf = async () => {
        setIsDownloadingPdf(true);
        try {
            const res = await downloadPDF(invoiceDetails);
            if (res.success && res.data?.contentBase64) {
                // Convert Base64 to Blob and download
                const byteCharacters = atob(res.data.contentBase64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/pdf' });

                const link = document.createElement('a');
                link.href = window.URL.createObjectURL(blob);
                link.download = `factura-${invoiceDetails.numeroDocumentoFiscal}.pdf`;
                link.click();
                toast.success('PDF descargado');
            } else {
                toast.error(res.error || 'Error al descargar PDF');
            }
        } catch (error) {
            toast.error('Error al descargar PDF');
        } finally {
            setIsDownloadingPdf(false);
        }
    };

    const handleDownloadXml = async () => {
        setIsDownloadingXml(true);
        try {
            const res = await downloadXML(invoiceDetails);
            if (res.success && res.data?.contentBase64) {
                const byteCharacters = atob(res.data.contentBase64);
                const blob = new Blob([byteCharacters], { type: 'application/xml' });
                const link = document.createElement('a');
                link.href = window.URL.createObjectURL(blob);
                link.download = `factura-${invoiceDetails.numeroDocumentoFiscal}.xml`;
                link.click();
                toast.success('XML descargado');
            } else {
                toast.error(res.error || 'Error al descargar XML');
            }
        } catch (error) {
            toast.error('Error al descargar XML');
        } finally {
            setIsDownloadingXml(false);
        }
    };

    const handleSendEmail = async () => {
        if (!email) return toast.error('Ingrese un correo electrónico');
        setIsSendingEmail(true);
        try {
            const res = await sendEmail(invoiceDetails, [email]);
            if (res.success) {
                toast.success('Correo enviado exitosamente');
                onClose();
            } else {
                toast.error(res.error || 'Error al enviar correo');
            }
        } catch (error) {
            toast.error('Error al enviar correo');
        } finally {
            setIsSendingEmail(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Entrega de Factura</DialogTitle>
                    <DialogDescription>
                        Descargue los archivos o envíelos por correo al cliente.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4 py-4">
                    <Button
                        variant="outline"
                        className="h-24 flex flex-col gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 border-2"
                        onClick={handleDownloadPdf}
                        disabled={isDownloadingPdf}
                    >
                        {isDownloadingPdf ? <Loader2 className="h-8 w-8 animate-spin" /> : <Download className="h-8 w-8 text-red-500" />}
                        <span>Descargar PDF</span>
                    </Button>
                    <Button
                        variant="outline"
                        className="h-24 flex flex-col gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 border-2"
                        onClick={handleDownloadXml}
                        disabled={isDownloadingXml}
                    >
                        {isDownloadingXml ? <Loader2 className="h-8 w-8 animate-spin" /> : <FileText className="h-8 w-8 text-blue-500" />}
                        <span>Descargar XML</span>
                    </Button>
                </div>

                <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                        <Label>Enviar por Correo</Label>
                        <div className="flex gap-2">
                            <Input
                                placeholder="cliente@ejemplo.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            <Button onClick={handleSendEmail} disabled={isSendingEmail}>
                                {isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

