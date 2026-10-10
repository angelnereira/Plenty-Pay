
'use client';

import { useState, useMemo } from 'react';
import { EnhancedInvoiceTable } from './enhanced-invoice-table';
import { Input } from '@shared/ui/input';
import { Button } from '@shared/ui/button';
import { refreshInvoiceStatus, refreshProcessingInvoices } from '@/app/actions/invoice/refresh-invoice-status.action';
import { toast } from 'sonner';
import {
    Search,
    Filter,
    RefreshCw,
    Loader2,
    Download,
    FileText,
    CheckCircle,
    XCircle,
    Clock,
    AlertCircle,
} from 'lucide-react';
import { Badge } from '@shared/ui/badge';
import { useRouter } from 'next/navigation';

interface Invoice {
    id: string;
    folio?: string;
    invoiceNumber?: string;
    clientName?: string;
    receiverName?: string;
    clientRuc?: string;
    receiverRuc?: string;
    total: number;
    status: string;
    cufe?: string;
    cafe?: string;
    createdAt: Date;
    emittedAt?: Date;
}

interface Stats {
    total: number;
    emitted: number;
    draft: number;
    processing: number;
    error: number;
    totalAmount: number;
}

interface InvoiceManagementPageProps {
    invoices: Invoice[];
    stats: Stats;
    activeFilter: 'all' | 'certified' | 'draft' | 'processing' | 'error' | 'recent';
}

type FilterType = 'all' | 'recent' | 'certified' | 'draft' | 'processing' | 'error';

export function InvoiceManagementPage({ invoices, stats, activeFilter }: InvoiceManagementPageProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const router = useRouter();

    // Filtrar facturas
    const filteredInvoices = useMemo(() => {
        let filtered = invoices;

        // Aplicar búsqueda
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            filtered = filtered.filter(invoice =>
                (invoice.folio?.toLowerCase().includes(search)) ||
                (invoice.invoiceNumber?.toLowerCase().includes(search)) ||
                (invoice.clientName?.toLowerCase().includes(search)) ||
                (invoice.receiverName?.toLowerCase().includes(search)) ||
                (invoice.clientRuc?.toLowerCase().includes(search)) ||
                (invoice.receiverRuc?.toLowerCase().includes(search)) ||
                (invoice.cufe?.toLowerCase().includes(search))
            );
        }

        return filtered;
    }, [invoices, searchTerm]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            const res = await refreshProcessingInvoices() as any;
            if (res.success) {
                toast.success('Estado de facturas actualizado');
            } else {
                toast.error('Error al actualizar: ' + res.error);
            }
            router.refresh();
        } catch (e) {
            toast.error('Error al actualizar');
        } finally {
            setIsRefreshing(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Barra de búsqueda y acciones */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    {/* Búsqueda */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            type="text"
                            placeholder="Buscar por folio, cliente, RUC, CUFE..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    {/* Botón refrescar */}
                    <Button
                        variant="outline"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="gap-2"
                    >
                        {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        <span className="hidden sm:inline">Actualizar</span>
                    </Button>
                </div>
            </div>

            {/* Alerta de Errores (Banner Contextual UX-02) */}
            {stats.error > 0 && (
                <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="text-rose-600 dark:text-rose-400 h-5 w-5 flex-shrink-0" />
                        <p className="text-rose-800 dark:text-rose-300 text-sm font-medium tracking-tight">
                            Atención: Hay <strong className="font-bold">{stats.error} factura{stats.error > 1 ? 's' : ''}</strong> con errores de certificación.
                        </p>
                    </div>
                    <Button
                        onClick={() => router.push('?filter=error')}
                        variant="default"
                        size="sm"
                        className="bg-white text-rose-700 border-rose-200 hover:bg-rose-50 shadow-sm whitespace-nowrap dark:bg-rose-950 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900"
                    >
                        Ver errores
                    </Button>
                </div>
            )}

            {/* Resultados */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Facturas
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                Mostrando {filteredInvoices.length} de {invoices.length} facturas
                            </p>
                        </div>
                        {searchTerm && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSearchTerm('')}
                                className="text-gray-600 dark:text-gray-400"
                            >
                                Limpiar búsqueda
                            </Button>
                        )}
                    </div>
                </div>

                <div className="p-4">
                    <EnhancedInvoiceTable
                        invoices={filteredInvoices}
                        filterStatus={activeFilter}
                        onRefresh={handleRefresh}
                    />
                </div>
            </div>

            {/* Info adicional */}
            {filteredInvoices.length === 0 && (
                <div className="text-center py-12">
                    <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        No se encontraron facturas
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                        {searchTerm
                            ? 'Intenta con otros términos de búsqueda'
                            : 'Comienza creando tu primera factura'}
                    </p>
                </div>
            )}
        </div>
    );
}
