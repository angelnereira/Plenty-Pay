'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog';
import { Button } from '@shared/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/ui/table';
import { Separator } from '@shared/ui/separator';
import { ScrollArea } from '@shared/ui/scroll-area'; // Assuming it exists or use div
import { FileSpreadsheet, Loader2, AlertTriangle, CheckCircle2, Building2, ShoppingCart, DollarSign, User } from 'lucide-react';
const formatCurrency = (val: number) => new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'PAB' }).format(val);
import { toast } from 'sonner';
import { createInvoice } from '@/app/actions/invoice/create-invoice.action';
import { emitInvoice } from '@/app/actions/invoice/emit-invoice.action';
import { InvoiceEmissionResult } from '@/features/invoicing/ui/invoice-emission-result';
import { getHKACredentials } from '@/app/actions/settings/get-hka-credentials.action';
import { ExcelInvoiceData } from '@/lib/utils/excel-parser';
import { logFrontendError } from '@/components/dev/error-display';

interface ExcelReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  excelData: ExcelInvoiceData | null;
  onEmissionSuccess: (invoice: any) => void;
}

export function ExcelReviewModal({
  isOpen,
  onClose,
  excelData,
  onEmissionSuccess,
}: ExcelReviewModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [userEnvironment, setUserEnvironment] = useState<'demo' | 'production' | null>(null);
  const [showEmissionResult, setShowEmissionResult] = useState(false);
  const [emissionInvoice, setEmissionInvoice] = useState<any>(null);

  useEffect(() => {
    const loadUserCredentials = async () => {
      try {
        const result = await getHKACredentials();
        if (result.success && result.data) {
          setUserEnvironment(result.data.environment === 'PROD' ? 'production' : 'demo');
        } else {
          toast.error('No se encontraron credenciales HKA. Por favor configura tus credenciales en Configuración.');
        }
      } catch (error) {
        console.error('Error loading HKA credentials:', error);
        toast.error('Error al cargar credenciales HKA');
      }
    };
    if (isOpen) {
      loadUserCredentials();
    }
  }, [isOpen]);

  if (!excelData) return null;

  const { client, items } = excelData;

  // Calculate totals
  const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
  const total = items.reduce((sum: number, item: any) => {
    const lineSubtotal = item.quantity * item.unitPrice;
    const lineTax = lineSubtotal * ((item.taxRate || 7) / 100);
    return sum + lineSubtotal + lineTax;
  }, 0);
  const tax = total - subtotal;

  const calculateTotals = (data: ExcelInvoiceData) => {
    let subtotal = 0;
    let taxAmount = 0;
    data.items.forEach((item: any) => {
      const lineSubtotal = item.quantity * item.unitPrice;
      const lineTax = lineSubtotal * ((item.taxRate || 7) / 100);
      subtotal += lineSubtotal;
      taxAmount += lineTax;
    });
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const handleEmitFromExcel = async () => {
    if (!excelData) {
      toast.error('No hay datos de Excel cargados para emitir.');
      return;
    }

    console.log('[Frontend] Iniciando proceso de emisión desde Excel');
    setIsProcessing(true);
    try {
      // 1. Crear borrador de factura
      console.log('[Frontend] Creando borrador de factura...');

      const createResult = await createInvoice({
        clientData: {
          ruc: excelData.client.taxId,
          dv: excelData.client.dv || '00',
          razonSocial: excelData.client.name,
          tipoContribuyente: '1', // Asumimos tipo 1, ajustar si Excel lo provee
          email: excelData.client.email,
          address: excelData.client.address,
          phone: excelData.client.phone,
        },
        items: excelData.items.map((item: any) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate || 7,
        })),
        paymentMethod: excelData.paymentMethod || 'CASH',
      });

      console.log('[Frontend] Resultado createInvoice:', createResult);

      if (!createResult.success || !createResult.invoiceId) {
        throw new Error(createResult.error || 'Error al crear factura');
      }

      toast.success('Factura creada como borrador');

      // 2. Emitir a HKA/DGI
      toast.info(`Enviando a HKA (${userEnvironment === 'demo' ? 'Demo' : 'Producción'})...`);
      console.log(`📨 [Frontend] Enviando a HKA (Invoice ID: ${createResult.invoiceId})...`);

      const emitResult = await emitInvoice({ invoiceId: createResult.invoiceId });

      console.log('📨 [Frontend] Resultado emitInvoice:', emitResult);

      if (emitResult.success) {
        toast.success('Factura enviada a proceso de emisión');

        const { subtotal, taxAmount, total } = calculateTotals(excelData);

        const emittedInvoiceData = {
          id: createResult.invoiceId,
          folio: (emitResult.data as any)?.numeroDocumentoFiscal || 'Pendiente...',
          invoiceNumber: (emitResult.data as any)?.numeroDocumentoFiscal || 'Pendiente...',
          status: 'PROCESSING',
          total: total,
          subtotal: subtotal,
          itbms: taxAmount,
          currency: 'PAB',
          receiverName: excelData.client.name,
          receiverRuc: excelData.client.taxId,
          receiverEmail: excelData.client.email,
          createdAt: new Date(),
          cufe: (emitResult.data as any)?.cufe,
          qrCode: (emitResult.data as any)?.qrUrl || (emitResult.data as any)?.qrCode,
          hkaResponseMessage: (emitResult.data as any)?.mensaje
        };

        console.log('[Frontend] Emisión exitosa, abriendo modal de resultado:', emittedInvoiceData);

        setEmissionInvoice(emittedInvoiceData);
        setShowEmissionResult(true);
        onEmissionSuccess(emittedInvoiceData); // Notificar al padre
        onClose(); // Cerrar este modal de revisión
      } else {
        console.error('❌ [Frontend] Error en emitInvoice:', emitResult.error);
        toast.error(`Error al emitir: ${emitResult.error || 'Error desconocido'}`);

        // Mostrar resultado de error para feedback visual
        setEmissionInvoice({
          id: createResult.invoiceId,
          status: 'ERROR',
          hkaMessage: emitResult.error || 'Error desconocido al emitir',
          receiverName: excelData.client.name,
          total: calculateTotals(excelData).total,
          createdAt: new Date(),
        });
        setShowEmissionResult(true);
        onClose();
      }
    } catch (error: any) {
      console.error('❌ [Frontend] Excepción en handleEmitFromExcel:', error);

      // Registrar en sistema de monitoreo de desarrollo
      logFrontendError({
        location: 'excel-review-modal',
        severity: 'critical',
        message: error.message || 'Error al procesar factura desde Excel',
        stack: error.stack,
        context: {
          clientName: excelData?.client?.name,
          itemsCount: excelData?.items?.length,
        },
      });

      toast.error(error.message || 'Error al procesar factura desde Excel');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={isProcessing ? undefined : onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-6 pb-2">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <FileSpreadsheet className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <DialogTitle className="text-xl">Revisar Datos de Factura</DialogTitle>
                <DialogDescription>
                  Verifica que la información extraída del Excel sea correcta antes de emitir.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto scrollbar-hide p-6 pt-2 space-y-6">
            {/* Ambiente HKA */}
            {userEnvironment && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
                <span className={`inline-block w-3 h-3 rounded-full ${userEnvironment === 'demo' ? 'bg-yellow-500' : 'bg-green-500'}`}></span>
                <span className="font-medium text-blue-900 dark:text-blue-200">
                  Ambiente HKA: {userEnvironment === 'demo' ? 'Demo (Pruebas)' : 'Producción (Real)'}
                </span>
              </div>
            )}

            {/* Cliente Section */}
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Información del Cliente
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-gray-500 block">Razón Social</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{client.name}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">RUC / Cédula</span>
                  <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{client.taxId} {client.dv ? `- DV ${client.dv}` : ''}</span>
                </div>
                {client.email && (
                  <div>
                    <span className="text-xs text-gray-500 block">Email</span>
                    <span className="text-gray-900 dark:text-gray-100">{client.email}</span>
                  </div>
                )}
                {client.phone && (
                  <div>
                    <span className="text-xs text-gray-500 block">Teléfono</span>
                    <span className="text-gray-900 dark:text-gray-100">{client.phone}</span>
                  </div>
                )}
                {client.address && (
                  <div className="md:col-span-2">
                    <span className="text-xs text-gray-500 block">Dirección</span>
                    <span className="text-gray-900 dark:text-gray-100">{client.address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Items Section */}
            <div className="border rounded-xl overflow-hidden border-gray-200 dark:border-gray-800">
              <div className="bg-gray-50 dark:bg-gray-900/50 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Items ({items.length})
                </h3>
              </div>
              <div className="max-h-[300px] overflow-y-auto scrollbar-hide">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50%]">Descripción</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">Precio U.</TableHead>
                      <TableHead className="text-right">ITBMS</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.description}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">${Number(item.unitPrice).toFixed(2)}</TableCell>
                        <TableCell className="text-right">{item.taxRate}%</TableCell>
                        <TableCell className="text-right font-semibold">
                          ${(item.quantity * item.unitPrice * (1 + (item.taxRate || 0) / 100)).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Totals Section */}
            <div className="flex justify-end">
              <div className="w-full md:w-1/3 bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-200 dark:border-gray-800 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal:</span>
                  <span className="font-medium">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Impuestos (ITBMS):</span>
                  <span className="font-medium">${tax.toFixed(2)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-900 dark:text-white">Total a Pagar:</span>
                  <span className="text-xl font-bold text-green-600 dark:text-green-400">
                    ${total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 pt-2 border-t bg-gray-50/50 dark:bg-gray-900/20 gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 sm:flex-none"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEmitFromExcel}
              disabled={isProcessing}
              className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar y Emitir Factura
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {emissionInvoice && (
        <InvoiceEmissionResult
          isOpen={showEmissionResult}
          onClose={() => {
            setShowEmissionResult(false);
          }}
          invoice={emissionInvoice}
        />
      )}
    </>
  );
}
