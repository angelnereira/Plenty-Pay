
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@shared/ui/dialog';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { Textarea } from '@shared/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs';
import { Loader2, CheckCircle2, AlertTriangle, FileText, Download, Mail, Edit, Eye } from 'lucide-react';
import { toast } from 'sonner';
import type { DocumentoElectronico } from '@/features/hka/model/types/types';

// Alias for backwards compatibility
type EnviarFacturaRequest = DocumentoElectronico;
import { ScrollArea } from '@shared/ui/scroll-area';
import { Separator } from '@shared/ui/separator';

interface InvoiceReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: (EnviarFacturaRequest & { invoiceId?: string; isRetry?: boolean }) | null;
    onSuccess: () => void;
}

type Step = 'review' | 'edit' | 'emitting' | 'success' | 'error';

export function InvoiceReviewModal({ isOpen, onClose, data, onSuccess }: InvoiceReviewModalProps) {
    const [step, setStep] = useState<Step>('review');
    const [result, setResult] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [editableData, setEditableData] = useState<EnviarFacturaRequest | null>(null);

    // Inicializar datos editables cuando se reciben nuevos datos
    useEffect(() => {
        if (data) {
            setEditableData(JSON.parse(JSON.stringify(data))); // Deep copy
            setStep('review');
        }
    }, [data]);

    // Resetear estados al cerrar
    useEffect(() => {
        if (!isOpen) {
            setStep('review');
            setEditableData(null);
            setResult(null);
            setErrorMsg('');
        }
    }, [isOpen]);

    if (!data) return null;

    // Usar editableData si existe, de lo contrario usar data
    const workingData = editableData || data;

    const handleEmit = async () => {
        setStep('emitting');

        try {
            // Extraer datos de reintento si existen
            const invoiceId = (workingData as any)?.invoiceId;
            const isRetry = (workingData as any)?.isRetry;

            if (isRetry && invoiceId) {
                // ============================================
                // MODO REINTENTO: Usar factura existente
                // No crear duplicados
                // ============================================
                console.log('[InvoiceReviewModal] 🔄 Modo reintento - usando factura existente:', invoiceId);

                const { retryExistingInvoice } = await import('@/app/actions/invoice/retry-invoice.action');

                // Limpiar los campos de control antes de enviar
                const cleanData = { ...workingData };
                delete (cleanData as any).invoiceId;
                delete (cleanData as any).isRetry;
                delete (cleanData as any).previousStatus;
                delete (cleanData as any).attempts;

                const res = await retryExistingInvoice(invoiceId, cleanData as EnviarFacturaRequest);

                if (res.success) {
                    setResult(res.data);
                    setStep('success');
                    onSuccess();
                } else {
                    setStep('error');
                    setErrorMsg(res.error || 'Error desconocido al reintentar');
                }
            } else {
                // ============================================
                // MODO NUEVO: Crear borrador y emitir
                // Flujo original para nuevas facturas
                // ============================================
                console.log('[InvoiceReviewModal] 📝 Modo nuevo - creando borrador');

                const { saveDraft } = await import('@/app/actions/invoice/draft.action');

                const draftName = `Importación ${new Date().toLocaleString()}`;
                const draftResult = await saveDraft({
                    name: draftName,
                    data: workingData
                });

                if (!draftResult.success || !draftResult.data?.id) {
                    throw new Error(draftResult.error || 'Error al guardar borrador preliminar');
                }

                const newInvoiceId = draftResult.data.id;

                // Emitir factura usando el Orchestrator
                const { emitInvoice } = await import('@/app/actions/invoice/emit-invoice.action');
                const res = await emitInvoice({ invoiceId: newInvoiceId });

                if (res.success) {
                    setResult(res.data);
                    setStep('success');
                    onSuccess();
                } else {
                    setStep('error');
                    const errorMessage = typeof res.error === 'string'
                        ? res.error
                        : (res.error as any)?.message || JSON.stringify(res.error);
                    setErrorMsg(errorMessage || 'Error desconocido al emitir');
                }
            }
        } catch (e: any) {
            console.error('Error emitting invoice:', e);
            setStep('error');
            setErrorMsg(e.message || 'Error inesperado durante el proceso');
        }
    };

    // Funciones de actualización de datos
    const updateClientField = (field: string, value: string) => {
        const baseData = editableData || data;
        if (!baseData) return;
        setEditableData({
            ...baseData,
            datosTransaccion: {
                ...baseData.datosTransaccion,
                cliente: {
                    ...baseData.datosTransaccion.cliente,
                    [field]: value
                }
            }
        });
    };

    const updateTransactionField = (field: string, value: string) => {
        const baseData = editableData || data;
        if (!baseData) return;
        setEditableData({
            ...baseData,
            datosTransaccion: {
                ...baseData.datosTransaccion,
                [field]: value
            }
        });
    };

    const updateItem = (index: number, field: string, value: string) => {
        const baseData = editableData || data;
        if (!baseData) return;
        const newItems = [...baseData.listaItems];
        newItems[index] = {
            ...newItems[index],
            [field]: value
        };
        setEditableData({
            ...baseData,
            listaItems: newItems
        });
    };

    const updateTotals = (field: string, value: string) => {
        const baseData = editableData || data;
        if (!baseData) return;
        setEditableData({
            ...baseData,
            totalesSubTotales: {
                ...baseData.totalesSubTotales,
                [field]: value
            }
        });
    };

    const renderReview = () => (
        <div className="space-y-6">
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg space-y-2">
                <h3 className="font-semibold text-sm uppercase text-gray-500">Cliente</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs text-gray-500">Razón Social</p>
                        <p className="font-medium">{'razonSocial' in workingData.datosTransaccion.cliente ? workingData.datosTransaccion.cliente.razonSocial : 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">RUC</p>
                        <p className="font-medium">{'numeroRUC' in workingData.datosTransaccion.cliente ? workingData.datosTransaccion.cliente.numeroRUC : 'N/A'}</p>
                    </div>
                    {'direccion' in workingData.datosTransaccion.cliente && workingData.datosTransaccion.cliente.direccion && (
                        <div className="col-span-2">
                            <p className="text-xs text-gray-500">Dirección</p>
                            <p className="font-medium">{workingData.datosTransaccion.cliente.direccion}</p>
                        </div>
                    )}
                </div>
            </div>

            <div>
                <h3 className="font-semibold text-sm uppercase text-gray-500 mb-2">Items</h3>
                <ScrollArea className="h-[200px] border rounded-md p-4">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="border-b">
                                <th className="pb-2">Descripción</th>
                                <th className="pb-2 text-right">Cant</th>
                                <th className="pb-2 text-right">Precio</th>
                                <th className="pb-2 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {workingData.listaItems.map((item, idx) => (
                                <tr key={idx} className="border-b last:border-0">
                                    <td className="py-2">{item.descripcion}</td>
                                    <td className="py-2 text-right">{item.cantidad}</td>
                                    <td className="py-2 text-right">${item.precioUnitario}</td>
                                    <td className="py-2 text-right">${item.valorTotal}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </ScrollArea>
            </div>

            <div className="flex justify-end">
                <div className="text-right space-y-1">
                    <div className="flex justify-between gap-8">
                        <span className="text-gray-500">Subtotal</span>
                        <span>${workingData.totalesSubTotales.totalPrecioNeto}</span>
                    </div>
                    <div className="flex justify-between gap-8">
                        <span className="text-gray-500">ITBMS</span>
                        <span>${workingData.totalesSubTotales.totalITBMS}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between gap-8 font-bold text-lg">
                        <span>Total</span>
                        <span>${workingData.totalesSubTotales.totalFactura}</span>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderEdit = () => (
        <ScrollArea className="h-[500px] pr-4">
            <Tabs defaultValue="cliente" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="cliente">Cliente</TabsTrigger>
                    <TabsTrigger value="items">Items</TabsTrigger>
                    <TabsTrigger value="totales">Totales</TabsTrigger>
                </TabsList>

                <TabsContent value="cliente" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="razonSocial">Razón Social *</Label>
                            <Input
                                id="razonSocial"
                                value={('razonSocial' in workingData.datosTransaccion.cliente ? workingData.datosTransaccion.cliente.razonSocial : '') || ''}
                                onChange={(e) => updateClientField('razonSocial', e.target.value)}
                            />
                        </div>
                        <div>
                            <Label htmlFor="numeroRUC">RUC *</Label>
                            <Input
                                id="numeroRUC"
                                value={('numeroRUC' in workingData.datosTransaccion.cliente ? workingData.datosTransaccion.cliente.numeroRUC : '') || ''}
                                onChange={(e) => updateClientField('numeroRUC', e.target.value)}
                            />
                        </div>
                        {/* DV field removed - auto-filled during RUC validation */}
                        <div>
                            <Label htmlFor="tipoClienteFE">Tipo Cliente *</Label>
                            <Input
                                id="tipoClienteFE"
                                value={workingData.datosTransaccion.cliente.tipoClienteFE || ''}
                                onChange={(e) => updateClientField('tipoClienteFE', e.target.value)}
                                placeholder="01: Contribuyente, 02: Consumidor"
                            />
                        </div>
                        <div className="col-span-2">
                            <Label htmlFor="direccion">Dirección</Label>
                            <Input
                                id="direccion"
                                value={('direccion' in workingData.datosTransaccion.cliente ? workingData.datosTransaccion.cliente.direccion : '') || ''}
                                onChange={(e) => updateClientField('direccion', e.target.value)}
                            />
                        </div>
                        {workingData.datosTransaccion.cliente.correoElectronico1 && (
                            <div className="col-span-2">
                                <Label htmlFor="correo">Correo Electrónico</Label>
                                <Input
                                    id="correo"
                                    type="email"
                                    value={workingData.datosTransaccion.cliente.correoElectronico1}
                                    onChange={(e) => updateClientField('correoElectronico1', e.target.value)}
                                />
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="items" className="space-y-4 mt-4">
                    {workingData.listaItems.map((item, idx) => (
                        <div key={idx} className="border rounded-lg p-4 space-y-3">
                            <h4 className="font-semibold text-sm">Item {idx + 1}</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <Label>Descripción *</Label>
                                    <Textarea
                                        value={item.descripcion}
                                        onChange={(e) => updateItem(idx, 'descripcion', e.target.value)}
                                        rows={2}
                                    />
                                </div>
                                <div>
                                    <Label>Cantidad *</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={item.cantidad}
                                        onChange={(e) => updateItem(idx, 'cantidad', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label>Precio Unitario *</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={item.precioUnitario}
                                        onChange={(e) => updateItem(idx, 'precioUnitario', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label>Descuento</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={item.precioUnitarioDescuento}
                                        onChange={(e) => updateItem(idx, 'precioUnitarioDescuento', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label>Total *</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={item.valorTotal}
                                        onChange={(e) => updateItem(idx, 'valorTotal', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </TabsContent>

                <TabsContent value="totales" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Subtotal (Precio Neto) *</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={workingData.totalesSubTotales.totalPrecioNeto}
                                onChange={(e) => updateTotals('totalPrecioNeto', e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>ITBMS *</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={workingData.totalesSubTotales.totalITBMS}
                                onChange={(e) => updateTotals('totalITBMS', e.target.value)}
                            />
                        </div>
                        <div className="col-span-2">
                            <Label>Total Factura *</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={workingData.totalesSubTotales.totalFactura}
                                onChange={(e) => updateTotals('totalFactura', e.target.value)}
                                className="text-lg font-bold"
                            />
                        </div>
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-sm">
                        <p className="text-yellow-800 dark:text-yellow-200">
                            <strong>Nota HKA:</strong> Los totales deben calcularse según las reglas oficiales.
                            Asegúrate de que los cálculos coincidan con las especificaciones de la documentación HKA.
                        </p>
                    </div>
                </TabsContent>
            </Tabs>
        </ScrollArea>
    );

    const renderEmitting = () => (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
            <h3 className="text-lg font-medium">Emitiendo Factura...</h3>
            <p className="text-sm text-gray-500">Contactando con HKA / DGI</p>
            {/* Stepper visual simple */}
            <div className="flex gap-2 mt-4">
                <div className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce delay-100" />
                <div className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce delay-200" />
            </div>
        </div>
    );

    const renderSuccess = () => (
        <div className="flex flex-col items-center justify-center py-8 space-y-6">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="text-center">
                <h3 className="text-xl font-bold text-green-700">¡Emisión Exitosa!</h3>
                <p className="text-gray-500 mt-1">La factura ha sido autorizada por la DGI</p>
                <p className="font-mono bg-gray-100 p-2 rounded mt-2 text-xs break-all max-w-[400px]">
                    CUFE: {result?.envio?.cufe || result?.envio?.codigoGeneracion || result?.cufe}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                <Button variant="outline" className="w-full gap-2">
                    <Download className="h-4 w-4" /> PDF
                </Button>
                <Button variant="outline" className="w-full gap-2">
                    <FileText className="h-4 w-4" /> XML
                </Button>
                <Button variant="outline" className="w-full gap-2 col-span-2">
                    <Mail className="h-4 w-4" /> Enviar por Correo
                </Button>
            </div>
        </div>
    );

    const renderError = () => (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-8 w-8" />
            </div>
            <div className="text-center">
                <h3 className="text-xl font-bold text-red-700">Error en Emisión</h3>
                <p className="text-gray-500 mt-1 max-w-md">{errorMsg}</p>
            </div>
        </div>
    );

    return (
        <Dialog open={isOpen} onOpenChange={step === 'emitting' ? undefined : onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span>
                            {step === 'review' && 'Revisar Factura Importada'}
                            {step === 'edit' && 'Editar Factura'}
                            {step === 'emitting' && 'Procesando'}
                            {step === 'success' && 'Factura Emitida'}
                            {step === 'error' && 'Error'}
                        </span>
                        {(step === 'review' || step === 'edit') && (
                            <div className="flex gap-2">
                                <Button
                                    variant={step === 'review' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setStep('review')}
                                    className="gap-2"
                                >
                                    <Eye className="h-4 w-4" />
                                    Ver
                                </Button>
                                <Button
                                    variant={step === 'edit' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setStep('edit')}
                                    className="gap-2"
                                >
                                    <Edit className="h-4 w-4" />
                                    Editar
                                </Button>
                            </div>
                        )}
                    </DialogTitle>
                    {(step === 'review' || step === 'edit') && (
                        <DialogDescription>
                            {step === 'review'
                                ? 'Revisa los datos importados antes de emitir. Puedes editar cualquier campo si es necesario.'
                                : 'Edita los campos según las reglas HKA. Los cambios se guardarán al confirmar.'}
                        </DialogDescription>
                    )}
                </DialogHeader>

                {step === 'review' && renderReview()}
                {step === 'edit' && renderEdit()}
                {step === 'emitting' && renderEmitting()}
                {step === 'success' && renderSuccess()}
                {step === 'error' && renderError()}

                <DialogFooter>
                    {(step === 'review' || step === 'edit') && (
                        <>
                            <Button variant="outline" onClick={onClose}>Cancelar</Button>
                            <Button onClick={handleEmit} className="gap-2">
                                <CheckCircle2 className="h-4 w-4" />
                                Confirmar y Emitir
                            </Button>
                        </>
                    )}
                    {(step === 'success' || step === 'error') && (
                        <Button onClick={onClose}>Cerrar</Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

